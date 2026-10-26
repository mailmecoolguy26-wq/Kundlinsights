'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerDecisionService, DecisionState, validateCareerDecisionRequest } = require('../../src/application/career-decisions');

const supported = { answerability: 'SUPPORTED', sourceReadingId: 'reading-a', answer: { window: { start: '2026-11-01', end: '2026-12-01' }, limitation: 'No outcome is guaranteed.' }, evidence: [{ family: 'DASHA', role: 'PRIMARY', summary: 'Career-linked Dasha evidence is active.' }], agreement: { primaryEligibility: true } };
test('Career decisions reuse persisted Career timing and preserve practical context', async () => {
  const service = new CareerDecisionService({ careerAnswerService: { answer: async () => supported } });
  const result = await service.decide({ principal: {}, birthProfileId: 'profile-a', body: { decisionType: 'JOB_OFFER', context: { priority: 'Growth', joiningDate: '2026-11-12' } } });
  assert.equal(result.state, DecisionState.SUPPORTIVE_WITH_CONDITIONS);
  assert.deepEqual(result.timing, supported.answer.window);
  assert.equal(result.context.priority, 'Growth');
  assert.match(result.limitation, /guaranteed/i);
});
test('Career decisions fail safely without a usable saved timing window', async () => {
  const service = new CareerDecisionService({ careerAnswerService: { answer: async () => ({ answerability: 'INSUFFICIENT_EVIDENCE', sourceReadingId: null, evidence: [], agreement: null }) } });
  const result = await service.decide({ principal: {}, birthProfileId: 'profile-a', body: { decisionType: 'START_BUSINESS', context: {} } });
  assert.equal(result.state, DecisionState.INSUFFICIENT_EVIDENCE);
  assert.equal(result.timing, undefined);
});
test('Career decision validation rejects arbitrary context fields', () => {
  assert.throws(() => validateCareerDecisionRequest({ decisionType: 'JOB_OFFER', context: { score: 100 } }), { code: 'INVALID_CAREER_DECISION_CONTEXT' });
});
test('Switch Job keeps typed context and exposes exploration-only timing', async () => {
  const service = new CareerDecisionService({ careerAnswerService: { answer: async () => supported } });
  const result = await service.decide({ principal: {}, birthProfileId: 'profile-a', body: { decisionType: 'SWITCH_JOB', context: { reasons: ['Career growth', 'Better compensation'], activelyInterviewing: 'EXPLORING', preferredTimeline: 'ONE_TO_THREE_MONTHS', noticePeriod: '30 days' } } });
  assert.equal(result.decisionType, 'SWITCH_JOB');
  assert.equal(result.timingScope, 'EXPLORE_ONLY');
  assert.deepEqual(result.context.reasons, ['Career growth', 'Better compensation']);
  assert.equal(result.context.activelyInterviewing, 'EXPLORING');
  assert.equal(result.context.preferredTimeline, 'ONE_TO_THREE_MONTHS');
});
test('Switch Job requires its typed reason, interviewing, and timeline context', () => {
  assert.throws(() => validateCareerDecisionRequest({ decisionType: 'SWITCH_JOB', context: { reasons: ['Career growth'], activelyInterviewing: 'EXPLORING' } }), { code: 'INVALID_SWITCH_JOB_CONTEXT' });
  assert.throws(() => validateCareerDecisionRequest({ decisionType: 'SWITCH_JOB', context: { reasons: ['Unrecognized reason'], activelyInterviewing: 'EXPLORING', preferredTimeline: 'ONE_TO_THREE_MONTHS' } }), { code: 'INVALID_SWITCH_JOB_CONTEXT' });
});
