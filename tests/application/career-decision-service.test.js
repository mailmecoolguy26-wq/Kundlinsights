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
  const result = await service.decide({ principal: {}, birthProfileId: 'profile-a', body: { decisionType: 'JOB_OFFER', context: {} } });
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

function persistedFixture(answer = supported) {
  const rows = []; let sequence = 0;
  const users = { 'subject-a': { id: 'user-a', status: 'active' }, 'subject-b': { id: 'user-b', status: 'active' } };
  const profileOwners = { 'profile-a': 'subject-a', 'profile-b': 'subject-b' };
  const repository = {
    async createDecision(input) { const row = { ...input, decisionId: input.id, createdAt: input.createdAt }; rows.push(row); return row; },
    async listDecisionsForBirthProfile({ userId, birthProfileId }) { return rows.filter((row) => row.userId === userId && row.birthProfileId === birthProfileId).map((row) => ({ decisionId: row.id, decisionType: row.decisionType, state: row.result.state, context: row.context, sourceReadingId: row.sourceReadingId, createdAt: row.createdAt })); },
    async getDecisionForBirthProfile({ userId, birthProfileId, decisionId }) { const row = rows.find((item) => item.id === decisionId && item.userId === userId && item.birthProfileId === birthProfileId); if (!row) { const error = new Error('CAREER_DECISION_NOT_FOUND'); error.code = 'CAREER_DECISION_NOT_FOUND'; throw error; } return { decisionId: row.id, birthProfileId: row.birthProfileId, context: row.context, result: row.result, sourceReadingId: row.sourceReadingId, createdAt: row.createdAt }; },
  };
  const service = new CareerDecisionService({
    careerAnswerService: { answer: async () => answer },
    authUserResolver: async (principal) => users[principal.subject],
    birthProfileService: { get: async ({ principal, birthProfileId }) => { if (profileOwners[birthProfileId] !== principal.subject) { const error = new Error('NOT_FOUND_OR_FORBIDDEN'); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; } return { id: birthProfileId }; } },
    transactionExecutor: { execute: async ({ operation }) => operation({}) },
    repositories: () => ({ careerDecisions: repository }),
    idGenerator: () => `decision-${++sequence}`,
    clock: () => '2026-10-28T10:00:00.000Z',
  });
  return { service, rows };
}
const principalA = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const principalB = { provider: 'supabase', subject: 'subject-b', isAnonymous: false };
test('valid generated decisions persist a sanitized immutable snapshot and return identity metadata', async () => {
  const { service, rows } = persistedFixture();
  const result = await service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'JOB_OFFER', context: { priority: 'Career growth' } } });
  assert.equal(result.decisionId, 'decision-1');
  assert.equal(result.createdAt, '2026-10-28T10:00:00.000Z');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].birthProfileId, 'profile-a');
  assert.deepEqual(rows[0].context, result.context);
  assert.equal(rows[0].result.decisionId, undefined);
  assert.equal(rows[0].result.createdAt, undefined);
  assert.equal(rows[0].sourceReadingId, 'reading-a');
});
test('valid insufficient-evidence decisions persist while invalid requests do not', async () => {
  const { service, rows } = persistedFixture({ answerability: 'INSUFFICIENT_EVIDENCE', sourceReadingId: null, evidence: [], agreement: null });
  const result = await service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'JOB_OFFER', context: {} } });
  assert.equal(result.state, DecisionState.INSUFFICIENT_EVIDENCE);
  assert.equal(rows.length, 1);
  await assert.rejects(() => service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'JOB_OFFER', context: { untrusted: 'no' } } }), { code: 'INVALID_CAREER_DECISION_CONTEXT' });
  assert.equal(rows.length, 1);
});
test('saved decisions list and reopen only in their authenticated birth-profile scope', async () => {
  const { service } = persistedFixture();
  const created = await service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'COMPARE_OFFERS', context: { priorities: ['Career growth'], offerA: { offerDate: '2026-10-01', role: 'A', moveType: 'NEW_COMPANY' }, offerB: { offerDate: '2026-10-02', role: 'B', moveType: 'INTERNAL_MOVE' } } } });
  const list = await service.list({ principal: principalA, birthProfileId: 'profile-a' });
  assert.deepEqual(list.map((item) => item.decisionId), [created.decisionId]);
  assert.equal(list[0].context.offerA.role, 'A');
  assert.equal(list[0].context.concerns, undefined);
  const reopened = await service.get({ principal: principalA, birthProfileId: 'profile-a', decisionId: created.decisionId });
  assert.equal(reopened.comparison.offerA.timing.state, 'NOT_ASSESSED');
  await assert.rejects(() => service.get({ principal: principalA, birthProfileId: 'profile-b', decisionId: created.decisionId }), { code: 'NOT_FOUND_OR_FORBIDDEN' });
  await assert.rejects(() => service.get({ principal: principalB, birthProfileId: 'profile-b', decisionId: created.decisionId }), { code: 'NOT_FOUND_OR_FORBIDDEN' });
});
test('Promotion, business, and abroad contexts are strictly typed and persist through the shared decision flow', async () => {
  const { service, rows } = persistedFixture();
  const cases = [
    ['PROMOTION_GROWTH', { growthTypes: ['Promotion', 'Leadership role'], managerDiscussionStatus: 'INFORMALLY', preferredTimeline: 'ONE_TO_THREE_MONTHS', reviewDate: '2026-11-01' }],
    ['START_BUSINESS', { startMode: 'ALONGSIDE_CURRENT_JOB', businessStage: 'MVP_PROTOTYPE', preferredTimeline: 'THREE_TO_SIX_MONTHS', founderMode: 'SOLO', businessReason: 'Long-term ambition', runway: 'SIX_TO_TWELVE_MONTHS' }],
    ['CAREER_ABROAD', { abroadPath: 'OVERSEAS_JOB', activelyInterviewing: 'EXPLORING', preferredTimeline: 'SIX_TO_TWELVE_MONTHS', priority: 'International exposure', movementDate: '2027-04-01' }],
  ];
  for (const [decisionType, context] of cases) {
    const result = await service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType, context } });
    assert.ok(result.decisionId);
    assert.equal(result.decisionType, decisionType);
  }
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].context.growthTypes, ['Promotion', 'Leadership role']);
  await assert.rejects(() => service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'PROMOTION_GROWTH', context: { growthTypes: ['Promotion'], managerDiscussionStatus: 'YES' } } }), { code: 'INVALID_PROMOTION_GROWTH_CONTEXT' });
  await assert.rejects(() => service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'START_BUSINESS', context: { startMode: 'FULL_TIME', businessStage: 'IDEA', preferredTimeline: 'NOW', founderMode: 'SOLO', businessReason: 'Unknown' } } }), { code: 'INVALID_START_BUSINESS_CONTEXT' });
  await assert.rejects(() => service.decide({ principal: principalA, birthProfileId: 'profile-a', body: { decisionType: 'CAREER_ABROAD', context: { abroadPath: 'OVERSEAS_JOB', activelyInterviewing: 'YES', preferredTimeline: 'NOW', priority: 'Visa guaranteed' } } }), { code: 'INVALID_CAREER_ABROAD_CONTEXT' });
});
