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
test('Compare Offers keeps two typed offers distinct and returns a calibrated comparison', async () => {
  const service = new CareerDecisionService({ careerAnswerService: { answer: async () => supported } });
  const result = await service.decide({ principal: {}, birthProfileId: 'profile-a', body: { decisionType: 'COMPARE_OFFERS', context: { priorities: ['Higher compensation'], offerA: { offerDate: '2026-10-01', joiningDate: '2026-11-12', role: 'Lead Engineer', moveType: 'NEW_COMPANY', compensationContext: 'HIGHER', strengths: ['Broader scope'] }, offerB: { offerDate: '2026-10-02', joiningDate: '2027-01-12', role: 'Engineering Manager', moveType: 'INTERNAL_MOVE', compensationContext: 'SIMILAR', concerns: ['Later start'] } } } });
  assert.equal(result.comparison.outcome, 'OFFER_A_MORE_ALIGNED');
  assert.equal(result.comparison.offerA.timing.state, 'WITHIN_CURRENT_WINDOW');
  assert.equal(result.comparison.offerB.timing.state, 'OUTSIDE_CURRENT_WINDOW');
  assert.equal(result.context.offerA.role, 'Lead Engineer');
  assert.equal(result.context.offerB.role, 'Engineering Manager');
});
test('Compare Offers validates each offer and does not fabricate missing joining timing', async () => {
  assert.throws(() => validateCareerDecisionRequest({ decisionType: 'COMPARE_OFFERS', context: { priorities: ['Career growth'], offerA: { offerDate: '2026-10-01', role: 'A', moveType: 'NEW_COMPANY' }, offerB: { offerDate: '2026-10-02', role: 'B', moveType: 'INVALID' } } }), { code: 'INVALID_OFFER_B_MOVE_TYPE' });
  const service = new CareerDecisionService({ careerAnswerService: { answer: async () => supported } });
  const result = await service.decide({ principal: {}, birthProfileId: 'profile-a', body: { decisionType: 'COMPARE_OFFERS', context: { priorities: ['Career growth'], offerA: { offerDate: '2026-10-01', role: 'A', moveType: 'NEW_COMPANY' }, offerB: { offerDate: '2026-10-02', role: 'B', moveType: 'INTERNAL_MOVE' } } } });
  assert.equal(result.comparison.outcome, 'MIXED');
  assert.match(result.comparison.timingComparison, /cannot be compared/i);
  assert.equal(result.comparison.offerA.timing.state, 'NOT_ASSESSED');
});
