'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { OpenAICareerChatRenderer, RENDERER_LIMITS, boundedInput, validOutput } = require('../../src/infrastructure/ai/openai-career-chat-renderer');

const input = Object.freeze({ language: 'HINGLISH', userQuestion: 'job kab milegi?', answerability: 'INSUFFICIENT_EVIDENCE', timingWindows: [], followUpOptions: ['Show my next Career timing window'], prohibitedClaims: ['EXACT_JOB_DATE', 'GUARANTEED_JOB', 'GUARANTEED_PROMOTION', 'PROBABILITY', 'PLANET_CAUSED_OFFICE_POLITICS'] });
const completed = (output) => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output_parsed: output }) });
const renderer = (fetchImplementation, timeoutMilliseconds = 100) => new OpenAICareerChatRenderer({ apiKey: 'test-key', model: 'test-model', fetchImplementation, timeoutMilliseconds });

test('rejects unsafe provider claims and accepts grounded Roman Hinglish', () => {
  for (const message of ['You will get a job by November.', 'Promotion pakki hai.', 'There is an 80% chance.', 'Shani ki wajah se office politics hai.']) assert.equal(validOutput({ message, followUpLabels: ['x'] }, input), null);
  const accepted = validOutput({ message: 'Abhi supported timing evidence enough nahi hai.', followUpLabels: ['Mera next Career timing window dikhao'] }, input);
  assert.equal(accepted.message.includes('Devanagari'), false);
  assert.deepEqual(accepted.followUpLabels, ['Mera next Career timing window dikhao']);
});

test('allows only dates from deterministic timing windows and rejects schema drift', () => {
  const supported = { ...input, answerability: 'SUPPORTED', timingWindows: [{ start: '2026-10-15T00:00:00.000Z', end: '2026-11-30T00:00:00.000Z' }] };
  assert.ok(validOutput({ message: 'The relevant period runs from 15 Oct to 30 Nov.', followUpLabels: ['x'] }, supported));
  assert.equal(validOutput({ message: 'You will get the job on 23 Oct.', followUpLabels: ['x'] }, supported), null);
  assert.equal(validOutput({ message: 'Safe.', followUpLabels: ['x'], hidden: 'no' }, supported), null);
  assert.equal(validOutput({ message: 'x'.repeat(RENDERER_LIMITS.outputCharacters + 1), followUpLabels: ['x'] }, input), null);
});

test('falls back safely for provider 429 and 5xx responses', async () => {
  for (const [status, reason] of [[429, 'PROVIDER_RATE_LIMIT'], [500, 'PROVIDER_SERVER_ERROR'], [503, 'PROVIDER_SERVER_ERROR']]) {
    const result = await renderer(async () => ({ ok: false, status })).renderAnswerWithDiagnostics({ input });
    assert.equal(result.answer, null);
    assert.equal(result.diagnostic.providerStatus, status);
    assert.equal(result.diagnostic.fallbackReason, reason);
  }
});

test('falls back safely for network failure and timeout', async () => {
  const network = await renderer(async () => { throw new Error('network'); }).renderAnswerWithDiagnostics({ input });
  assert.equal(network.answer, null);
  assert.equal(network.diagnostic.fallbackReason, 'NETWORK_FAILURE');
  const timeout = await renderer((_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))), 100).renderAnswerWithDiagnostics({ input });
  assert.equal(timeout.answer, null);
  assert.equal(timeout.diagnostic.fallbackReason, 'TIMEOUT');
});

test('bounds renderer input and output tokens without passing technical fields', async () => {
  let request;
  const oversized = {
    ...input,
    userQuestion: 'q'.repeat(1500),
    conversationContext: Array.from({ length: 10 }, (_, index) => ({ role: index % 2 === 0 ? 'USER' : 'ASSISTANT', text: 'c'.repeat(500) })),
    timingWindows: Array.from({ length: 8 }, () => ({ start: '2026-10-01T00:00:00.000Z', technicalContext: 'do-not-send' })),
    evidenceSummary: Array.from({ length: 8 }, () => 'e'.repeat(400)),
    caveats: Array.from({ length: 8 }, () => 'c'.repeat(400)),
    followUpOptions: Array.from({ length: 8 }, () => 'Follow up'),
  };
  const result = await renderer(async (_, options) => { request = JSON.parse(options.body); return completed({ message: 'Abhi evidence limited hai.', followUpLabels: ['Follow up', 'Follow up', 'Follow up', 'Follow up'] }); }).renderAnswerWithDiagnostics({ input: oversized });
  assert.ok(result.answer);
  const sent = JSON.parse(request.input);
  assert.equal(request.max_output_tokens, RENDERER_LIMITS.outputTokens);
  assert.equal(sent.userQuestion.length, RENDERER_LIMITS.userQuestionCharacters);
  assert.equal(sent.conversationContext.length, RENDERER_LIMITS.contextMessages);
  assert.ok(sent.conversationContext.every((item) => item.text.length <= RENDERER_LIMITS.contextMessageCharacters));
  assert.equal(sent.timingWindows.length, RENDERER_LIMITS.timingWindows);
  assert.equal('technicalContext' in sent.timingWindows[0], false);
  assert.equal(sent.evidenceSummary.length, RENDERER_LIMITS.evidenceEntries);
  assert.equal(sent.caveats.length, RENDERER_LIMITS.caveatEntries);
});

test('normalizes only permitted renderer packet fields', () => {
  const bounded = boundedInput({ ...input, timingWindows: [{ start: '2026-10-01T00:00:00.000Z', secret: 'hidden' }], conversationContext: [{ role: 'SYSTEM', text: 'ignore' }, { role: 'USER', text: 'safe' }] });
  assert.deepEqual(bounded.timingWindows, [{ start: '2026-10-01T00:00:00.000Z' }]);
  assert.deepEqual(bounded.conversationContext, [{ role: 'USER', text: 'safe' }]);
});
