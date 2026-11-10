'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { OpenAITarotInterpretationAdapter, extractTarotProviderOutput } = require('../../src/infrastructure/ai/openai-tarot-interpretation-adapter');

const output = { overview: 'Overview', cards: [], combinedMessage: 'Meaning', practicalReflection: 'Reflect', nextStep: 'Act', caution: 'Caution', disclaimer: 'Disclaimer' };

test('extracts parsed and output-text structured Tarot responses', () => {
  assert.deepEqual(extractTarotProviderOutput({ status: 'completed', output_parsed: output }), output);
  assert.deepEqual(extractTarotProviderOutput({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] }), output);
});

test('fails closed for incomplete, refusal, malformed, or ambiguous provider output', () => {
  for (const body of [
    { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } },
    { status: 'completed', refusal: 'no' },
    { status: 'completed', output: [] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [] }, { type: 'message', content: [] }] },
  ]) assert.throws(() => extractTarotProviderOutput(body));
});

test('sends strict schema, bounded tokens, and no storage request', async () => {
  let request;
  const adapter = new OpenAITarotInterpretationAdapter({ apiKey: 'test-key', model: 'test-model', fetchImplementation: async (_, options) => { request = JSON.parse(options.body); return { ok: true, json: async () => ({ status: 'completed', output_parsed: output }) }; } });
  await adapter.interpret({ question: 'Safe question' });
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);
  assert.equal(request.max_output_tokens, 1400);
  assert.equal(request.store, false);
});
