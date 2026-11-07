'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { OpenAICareerGenerationAdapter, OPENAI_RESPONSES_ENDPOINT, DEFAULT_MAX_OUTPUT_TOKENS, CAREER_OUTPUT_SCHEMA } = require('../../src/infrastructure/ai/openai-career-generation-adapter');
const prompt = Object.freeze({ version: 'career-reading-prompt-v1', instructions: 'safe instructions', input: Object.freeze({ schemaVersion: 'career-reading-interpretation-schema-v1', eventReferences: [] }) });
const candidate = { schemaVersion: 'career-reading-interpretation-schema-v1', calibrationSummary: {}, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: [], disclosure: {} };
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, headers: { get: (key) => key === 'x-request-id' ? 'req-safe' : null }, json: async () => body }; }
function adapter(fetchImplementation) { return new OpenAICareerGenerationAdapter({ apiKey: 'test-secret', model: 'fake-model', fetchImplementation }); }
test('posts one provider-neutral prompt to strict Responses structured output and returns one candidate', async () => { let seen; const value = await adapter(async (url, init) => { seen = { url, init }; return response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(candidate) }] }] }); }).generate({ prompt }); assert.deepEqual(value, candidate); assert.equal(seen.url, OPENAI_RESPONSES_ENDPOINT); assert.equal(seen.init.headers.Authorization, 'Bearer test-secret'); const body = JSON.parse(seen.init.body); assert.equal(body.text.format.type, 'json_schema'); assert.equal(body.text.format.strict, true); assert.equal(body.input.includes('safe instructions'), false); assert.equal(body.input.includes('PRIVATE'), false); assert.equal(body.instructions, 'safe instructions'); });
test('strict schema closes every object and requires strict-mode nullable optionals', () => {
  const objects = [];
  const visit = (schema) => {
    if (!schema || typeof schema !== 'object') return;
    if (schema.type === 'object') objects.push(schema);
    for (const value of Object.values(schema)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(CAREER_OUTPUT_SCHEMA);
  assert.ok(objects.length >= 6);
  for (const schema of objects) {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
  }
  assert.equal(CAREER_OUTPUT_SCHEMA.properties.decisionConsiderations.maxItems, 5);
  assert.deepEqual(
    CAREER_OUTPUT_SCHEMA.properties.upcomingRecurrenceWindows.items.required,
    ['evidenceId', 'text', 'occurrenceType', 'from', 'to', 'instant', 'factorsReferenced'],
  );
  assert.deepEqual(
    CAREER_OUTPUT_SCHEMA.properties.upcomingRecurrenceWindows.items.properties.instant.type,
    ['string', 'null'],
  );
});
test('uses exactly one call and safely maps network, 401, 429, 5xx, empty, refusal, and malformed JSON failures', async () => { for (const fetchImplementation of [async () => { throw new Error('test-secret'); }, async () => response({}, 401), async () => response({}, 429), async () => response({}, 500), async () => response({ status: 'completed', output: [] }), async () => response({ status: 'completed', refusal: 'no' }), async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new Error('bad'); } })]) await assert.rejects(() => adapter(fetchImplementation).generate({ prompt }), (error) => error.code === 'READING_GENERATION_FAILED' && !String(error.message).includes('test-secret')); });
test('emits only safe provider-stage diagnostics when a provider response fails', async () => {
  const diagnostics = [];
  await assert.rejects(() => adapter(async () => response({}, 500)).generate({ prompt, diagnosticLog: (entry) => diagnostics.push(entry) }), (error) => error.code === 'READING_GENERATION_FAILED');
  assert.deepEqual(diagnostics, [
    { event: 'CAREER_READING_INTERPRETER_STEP', step: 'PROVIDER_REQUEST', status: 'STARTED' },
    { event: 'CAREER_READING_INTERPRETER_STEP', step: 'PROVIDER_RESPONSE', status: 'FAILED' },
  ]);
});
test('aborts an unresolved request once at timeout', async () => { const instance = new OpenAICareerGenerationAdapter({ apiKey: 'x', model: 'fake', timeoutMilliseconds: 100, fetchImplementation: async (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) }); await assert.rejects(() => instance.generate({ prompt }), (error) => error.code === 'READING_GENERATION_FAILED' && error.category === 'timeout'); });
test('validates injected configuration and does not mutate prompt', () => { for (const options of [{}, { apiKey: 'x' }, { apiKey: 'x', model: 'm', timeoutMilliseconds: 99 }, { apiKey: 'x', model: 'm', maxOutputTokens: 1499 }]) assert.throws(() => new OpenAICareerGenerationAdapter(options), /INVALID_OPENAI_CAREER_GENERATION_ADAPTER/); assert.ok(Object.isFrozen(prompt)); });
test('extracts parsed structured output from top-level and output_text parsed shapes', async () => {
  const top = await adapter(async () => response({ status: 'completed', output_parsed: candidate, output: [] })).generate({ prompt });
  const content = await adapter(async () => response({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', parsed: candidate }] }] })).generate({ prompt });
  assert.deepEqual(top, candidate);
  assert.deepEqual(content, candidate);
});
test('classifies incomplete responses and max-output-token exhaustion safely', async () => {
  for (const [reason, category] of [['content_filter', 'incomplete'], ['max_output_tokens', 'max_output_tokens']]) {
    const diagnostics = [];
    await assert.rejects(
      () => adapter(async () => response({ status: 'incomplete', incomplete_details: { reason }, output: [], usage: { input_tokens: 80, output_tokens: 2000, total_tokens: 2080 } })).generate({ prompt, diagnosticLog: (entry) => diagnostics.push(entry) }),
      (error) => error.code === 'READING_GENERATION_FAILED' && error.category === category && error.extractionReasonCode === 'PROVIDER_INCOMPLETE',
    );
    const metadata = diagnostics.find((entry) => entry.event === 'CAREER_PROVIDER_RESPONSE_METADATA');
    assert.equal(metadata.incompleteReason, reason);
    assert.equal(metadata.outputTokens, 2000);
  }
});
test('classifies refusal, invalid JSON, missing text, and unexpected message cardinality', async () => {
  const cases = [
    [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private refusal narrative' }] }] }, 'PROVIDER_REFUSAL'],
    [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{bad json private narrative' }] }] }, 'INVALID_JSON_OUTPUT'],
    [{ status: 'completed', output: [] }, 'NO_OUTPUT_MESSAGE'],
    [{ status: 'completed', output: [{ type: 'message', content: [] }] }, 'NO_OUTPUT_TEXT'],
    [{ status: 'completed', output: [{ type: 'message', content: [] }, { type: 'message', content: [] }] }, 'MULTIPLE_OUTPUT_MESSAGES'],
    [{ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }, { type: 'output_text', text: '{}' }] }] }, 'MULTIPLE_OUTPUT_TEXT'],
  ];
  for (const [body, reasonCode] of cases) {
    await assert.rejects(
      () => adapter(async () => response(body)).generate({ prompt }),
      (error) => error.code === 'READING_GENERATION_FAILED' && error.extractionReasonCode === reasonCode,
    );
  }
});
test('emits response metadata without raw structured output or narrative', async () => {
  const diagnostics = [];
  const privateNarrative = 'PRIVATE_MODEL_NARRATIVE_MUST_NOT_BE_LOGGED';
  await assert.rejects(
    () => adapter(async () => response({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: `{${privateNarrative}` }] }],
      usage: { input_tokens: 10, output_tokens: 20, output_tokens_details: { reasoning_tokens: 7 }, total_tokens: 30 },
    })).generate({ prompt, diagnosticLog: (entry) => diagnostics.push(entry) }),
    (error) => error.extractionReasonCode === 'INVALID_JSON_OUTPUT',
  );
  const encoded = JSON.stringify(diagnostics);
  assert.equal(encoded.includes(privateNarrative), false);
  const metadata = diagnostics.find((entry) => entry.event === 'CAREER_PROVIDER_RESPONSE_METADATA');
  assert.deepEqual({
    status: metadata.responseStatus,
    outputItemTypes: metadata.outputItemTypes,
    contentItemTypes: metadata.contentItemTypes,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    reasoningTokens: metadata.reasoningTokens,
    totalTokens: metadata.totalTokens,
  }, {
    status: 'completed',
    outputItemTypes: ['message'],
    contentItemTypes: ['output_text'],
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 7,
    totalTokens: 30,
  });
});
test('sends the conservative 3000-token default and honors an approved override', async () => {
  assert.equal(DEFAULT_MAX_OUTPUT_TOKENS, 3000);
  for (const [configured, expected] of [[undefined, 3000], [2500, 2500]]) {
    let sent;
    const instance = new OpenAICareerGenerationAdapter({ apiKey: 'x', model: 'fake', fetchImplementation: async (_url, init) => { sent = JSON.parse(init.body); return response({ status: 'completed', output_parsed: candidate }); }, ...(configured ? { maxOutputTokens: configured } : {}) });
    await instance.generate({ prompt });
    assert.equal(sent.max_output_tokens, expected);
  }
});
test('keeps the timeout active while the provider response body is consumed', async () => {
  const instance = new OpenAICareerGenerationAdapter({
    apiKey: 'x', model: 'fake', timeoutMilliseconds: 100,
    fetchImplementation: async (_url, init) => ({
      ok: true, status: 200, headers: { get: () => 'req-body-timeout' },
      json: async () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    }),
  });
  await assert.rejects(() => instance.generate({ prompt }), (error) => error.code === 'READING_GENERATION_FAILED' && error.category === 'timeout');
});
