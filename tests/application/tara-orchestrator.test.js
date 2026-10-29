'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyTaraDomain, TaraOrchestrator, TaraCareerCapability, TaraCareerIntent, TaraCareerResponseState, classifyTaraCareerIntent } = require('../../src/application/tara');

test('routes only Career requests to the grounded Career capability', async () => {
  const calls = [];
  const tara = new TaraOrchestrator({ careerCapability: { respond: async (input) => { calls.push(input.message); return { answerability: 'SUPPORTED', message: 'Grounded Career context.' }; } } });
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

test('maps non-decision Career timing phrasing to the existing job-favourability answer', async () => {
  const calls = [];
  const answers = { answer: async (input) => { calls.push(input); return { questionType: 'JOB_FAVOURABILITY_TIMING', answerability: 'SUPPORTED', broadWindow: { start: '2026-11-20', end: '2027-01-10' } }; } };
  const capability = new TaraCareerCapability({ careerAnswerService: answers });
  for (const message of ['When is my career likely to improve?', 'When will my career improve?', 'When does my career get better?', 'When will things improve professionally?', 'When are better career opportunities likely?', 'When is my career growth stronger?', 'When will career opportunities improve?', 'When is career activity stronger?', "What's my stronger career window?"]) {
    const response = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.equal(response.intent, TaraCareerIntent.JOB_FAVOURABILITY_TIMING);
    assert.equal(response.state, TaraCareerResponseState.ENTITLED_RESULT);
    assert.match(response.message, /20 Nov 2026 to 10 Jan 2027/);
    assert.match(response.message, /does not guarantee/i);
  }
  assert.equal(calls.length, 9);
  assert.ok(calls.every((call) => call.body.questionType === 'JOB_FAVOURABILITY_TIMING'));
});

test('routes only conservative Career decision requests to an existing decision form', async () => {
  const capability = new TaraCareerCapability({ careerAnswerService: { answer: async () => { throw new Error('decision routing must not calculate a result'); } } });
  const cases = [
    ['I have a job offer', TaraCareerIntent.JOB_OFFER, 'JOB_OFFER'],
    ['I got a job offer', TaraCareerIntent.JOB_OFFER, 'JOB_OFFER'],
    ['Should I accept this job offer?', TaraCareerIntent.JOB_OFFER, 'JOB_OFFER'],
    ['Should I switch jobs?', TaraCareerIntent.SWITCH_JOB, 'SWITCH_JOB'],
    ['I want to change my job', TaraCareerIntent.SWITCH_JOB, 'SWITCH_JOB'],
    ['I have two job offers', TaraCareerIntent.COMPARE_OFFERS, 'COMPARE_OFFERS'],
    ['Is this a good time for promotion?', TaraCareerIntent.PROMOTION_GROWTH, 'PROMOTION_GROWTH'],
    ['Is salary growth likely?', TaraCareerIntent.PROMOTION_GROWTH, 'PROMOTION_GROWTH'],
    ['Should I start a business?', TaraCareerIntent.START_BUSINESS, 'START_BUSINESS'],
    ['Can I relocate internationally for work?', TaraCareerIntent.CAREER_ABROAD, 'CAREER_ABROAD'],
  ];
  for (const [message, intent, decisionType] of cases) {
    const response = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.equal(response.intent, intent);
    assert.equal(response.state, 'DECISION_CONTEXT_REQUIRED');
    assert.deepEqual(response.action, { type: 'OPEN_CAREER_DECISION', label: response.action.label, decisionType });
  }
  for (const message of ['I got a discount offer', 'What services do you offer?', 'Should I switch phones?']) {
    assert.equal(classifyTaraCareerIntent(message), TaraCareerIntent.UNSUPPORTED_CAREER);
  }
});

test('keeps premium timing results date-free and exposes an explicit premium action', async () => {
  const capability = new TaraCareerCapability({ careerAnswerService: { answer: async () => ({ questionType: 'JOB_FAVOURABILITY_TIMING', answerability: 'PREMIUM_REQUIRED', teaser: { title: 'A stronger career window is coming up', subtitle: 'ignored in favor of explicit Tara copy' }, broadWindow: { start: '2026-11-20', end: '2027-01-10' } }) } });
  const response = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When is my stronger career window?' });
  assert.equal(response.state, TaraCareerResponseState.PREMIUM_REQUIRED);
  assert.deepEqual(response.action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
  assert.match(response.message, /TaraVerse Premium/i);
  assert.doesNotMatch(response.message, /2026|Nov|Jan/);
});

test('preserves the premium action through the Tara orchestrator boundary', async () => {
  const capability = new TaraCareerCapability({ careerAnswerService: { answer: async () => ({ questionType: 'JOB_FAVOURABILITY_TIMING', answerability: 'PREMIUM_REQUIRED' }) } });
  const tara = new TaraOrchestrator({ careerCapability: capability });
  const response = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When is my career likely to improve?' });
  assert.equal(response.career.state, TaraCareerResponseState.PREMIUM_REQUIRED);
  assert.deepEqual(response.action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
});

test('maps current phase and keeps unsupported Career questions safe', async () => {
  assert.equal(classifyTaraCareerIntent('What is my current career phase?'), TaraCareerIntent.CURRENT_CAREER_PHASE);
  const capability = new TaraCareerCapability({ careerAnswerService: { answer: async () => { throw new Error('should not be called'); } } });
  const unsupported = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Which colleague should I trust at work?' });
  assert.equal(unsupported.intent, TaraCareerIntent.UNSUPPORTED_CAREER);
  assert.match(unsupported.message, /Career phase and stronger Career timing windows/i);
  assert.doesNotMatch(unsupported.message, /outside the current Career Chat scope/i);
});

test('classifies supported future-facing Tara domains deterministically', () => {
  assert.equal(classifyTaraDomain('Tell me about my Lagna.'), 'CHART');
  assert.equal(classifyTaraDomain('What should I pay attention to right now?'), 'GENERAL');
});
