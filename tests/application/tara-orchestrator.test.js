'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTaraDomain, TaraOrchestrator } = require('../../src/application/tara');

test('routes only Career requests to the grounded Career capability', async () => {
  const calls = [];
  const tara = new TaraOrchestrator({ careerCapability: { respond: async (input) => { calls.push(input.message); return { answer: { answerability: 'SUPPORTED', headlineFact: 'Grounded Career context.' } }; } } });
  const career = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When could my job switch be relevant?' });
  assert.equal(career.domain, 'CAREER');
  assert.equal(career.capability, 'CAREER_GROUNDED');
  assert.deepEqual(calls, ['When could my job switch be relevant?']);
  for (const [message, domain] of [['What does my chart say about marriage?', 'RELATIONSHIPS'], ['Is there a supportive period for property?', 'WEALTH_PROPERTY'], ['Please do a tarot reading.', 'TAROT']]) {
    const result = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.equal(result.domain, domain);
    assert.equal(result.answerability, 'UNSUPPORTED');
    assert.match(result.message, /not ready to give you a reliable personalized answer/i);
  }
  assert.equal(calls.length, 1);
});

test('classifies supported future-facing Tara domains deterministically', () => {
  assert.equal(classifyTaraDomain('Tell me about my Lagna.'), 'CHART');
  assert.equal(classifyTaraDomain('What should I pay attention to right now?'), 'GENERAL');
});
