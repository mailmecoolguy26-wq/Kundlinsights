'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { appendHistoricalContext } = require('../../src/application/tara/tara-historical-context');
const { TaraCareerCapability } = require('../../src/application/tara');

const historicalContext = Object.freeze({
  available: true,
  summary: 'Similar timing factors were present around 2 of your 3 recorded job changes.',
  matchedEventCount: 2,
  comparableEventCount: 3,
});

test('Ask Tara appends only the already-public Career context', () => {
  const content = appendHistoricalContext('Grounded Career result.', {
    domain: 'CAREER', historicalContext, language: 'ENGLISH',
  });
  assert.match(content, /recorded Career history also adds context/i);
  assert.match(content, /2 of your 3 recorded job changes/);
  assert.doesNotMatch(content, /fingerprint|audit|confidence|pattern strength/i);
});

test('Ask Tara is silent when historical context is absent or ineligible', () => {
  assert.equal(appendHistoricalContext('Grounded result.', { domain: 'PROPERTY', historicalContext: null, language: 'ENGLISH' }), 'Grounded result.');
  assert.equal(appendHistoricalContext('Grounded result.', { domain: 'PROPERTY', historicalContext: { available: false, summary: 'do not use' }, language: 'ENGLISH' }), 'Grounded result.');
});

test('Ask Tara preserves safe Hinglish wrapper without changing the server summary', () => {
  const content = appendHistoricalContext('Grounded Vehicle result.', {
    domain: 'VEHICLE', historicalContext, language: 'HINGLISH',
  });
  assert.match(content, /recorded Vehicle history/i);
  assert.match(content, /Similar timing factors were present around 2 of your 3 recorded job changes\./);
});

test('Career capability includes eligible public context but not it for premium boundary responses', async () => {
  const eligible = new TaraCareerCapability({
    careerAnswerService: { answer: async () => ({
      questionType: 'CURRENT_CAREER_PHASE', answerability: 'SUPPORTED',
      answer: { headline: 'Career insight', summary: 'Grounded result.', limitation: '' },
      historicalContext,
    }) },
  });
  const result = await eligible.respond({ principal: {}, birthProfileId: 'profile-a', message: 'What is my career now?', language: 'ENGLISH' });
  assert.match(result.message, /recorded Career history also adds context/i);

  const premium = new TaraCareerCapability({
    careerAnswerService: { answer: async () => ({ questionType: 'CURRENT_CAREER_PHASE', answerability: 'PREMIUM_REQUIRED', historicalContext }) },
  });
  const boundary = await premium.respond({ principal: {}, birthProfileId: 'profile-a', message: 'What is my career now?', language: 'ENGLISH' });
  assert.doesNotMatch(boundary.message, /recorded Career history/i);
});
