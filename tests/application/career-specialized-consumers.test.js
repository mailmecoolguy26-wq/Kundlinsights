'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerAnswerService } = require('../../src/application/career-answers');
const { TaraCareerCapability } = require('../../src/application/tara');
const { CAREER_TIMING_NO_INVENTION_RULE } = require('../../src/application/career-timing');

const summary = { readingId: 'reading-specialized', birthProfileId: 'profile-a', domain: 'CAREER', createdAt: '2026-10-01T00:00:00.000Z' };
const legacyPeriod = { startDate: '2026-11-20T00:00:00.000Z', endDate: '2027-01-10T00:00:00.000Z', evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL', technicalDetails: { dasha: { periods: ['MD:Mercury'] }, gochar: [{ transitPlanet: 'Jupiter' }] } };
function refinement(id, start, end) { return { windowId: id, start, end, internalTier: 'STRONG', label: 'Strong support', reasonSummary: { primaryDashaConvergence: 'STRONG_CONVERGENCE', pdRefinement: 'DIRECT', d10Confirmation: 'CONFIRMS', transitConfirmation: 'JUPITER_ONLY' }, evidence: { pd: 'DIRECT', d10: 'CONFIRMS', jupiter: 'CONFIRMS', saturn: 'NOT_CONFIRMED', ashtakavarga: 'RAW_CONTEXT' } }; }
function period(id, start, end, strongestWindow) { return { periodId: id, start, end, internalState: 'SUPPORTIVE', label: 'Supportive period', convergence: 'STRONG_CONVERGENCE', strongestWindow, refinementWindows: strongestWindow ? [strongestWindow] : [] }; }
function canonical(authority = 'CANONICAL', currentPresent = true) {
  const currentStrongest = refinement('current-strong', '2026-11-10T00:00:00.000Z', '2026-11-20T00:00:00.000Z');
  const current = period('current', '2026-11-01T00:00:00.000Z', '2026-12-01T00:00:00.000Z', currentStrongest);
  const nextStrongest = refinement('next-strong', '2027-02-10T00:00:00.000Z', '2027-02-20T00:00:00.000Z');
  const next = period('next', '2027-02-01T00:00:00.000Z', '2027-03-01T00:00:00.000Z', nextStrongest);
  return { contractVersion: 'career-timing-production-v1', timingEngineVersion: 'career-timing-v2-production-1', eligibilityRuleset: 'career-timing-v2.2-shadow-1', refinementRuleset: 'career-timing-v2.3-shadow-1', authority, intervalSemantics: 'HALF_OPEN', periods: currentPresent ? [current, next] : [next], current: currentPresent ? { eligiblePeriod: current, activeRefinement: currentStrongest } : null, next: { eligiblePeriod: next, strongestWindow: nextStrongest }, explanationPolicy: {} };
}
function reading(careerTiming = canonical()) { return { ...summary, insights: [{ family: 'CAREER_FOUNDATION', status: 'SUPPORTED' }], careerTimingPeriods: [legacyPeriod], careerTiming }; }
function readings(value = reading(), eligible = true) { return { getReadingEntitlementStatus: async () => ({ career: { eligible } }), listSecureReadings: async () => [summary], getSecureReadingDetail: async () => value }; }
function beta() { return { status: 'SUPPORTED', broadWindow: { start: '2028-01-01T00:00:00.000Z', end: '2028-02-01T00:00:00.000Z' }, strongerConcentrationWindow: null, strength: 'MODERATE', evidenceAgreementCount: 2, evidenceReasonCodes: ['CAREER_TIMING_ACTIVATED'], recommendedActionCodes: ['PREPARE_CAREER_MATERIALS_AND_CONVERSATIONS'] }; }

test('Job Favourability OFF and SHADOW preserve the legacy evaluator while ON uses only canonical persisted timing', async () => {
  for (const [mode, authority] of [['OFF', 'CANONICAL'], ['SHADOW', 'SHADOW']]) {
    let calls = 0;
    const value = reading(canonical(authority));
    const service = new CareerAnswerService({ secureReadingService: readings(value), jobFavourabilityResearchEnabled: true, jobFavourabilityEvaluator: { evaluate: async () => { calls += 1; return beta(); } }, timingMode: mode });
    const answer = await service.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: 'JOB_FAVOURABILITY_TIMING' } });
    assert.equal(calls, 1); assert.deepEqual(answer.broadWindow, beta().broadWindow); assert.equal(answer.timingAuthority, 'LEGACY_JOB_FAVOURABILITY');
  }
  let calls = 0;
  const service = new CareerAnswerService({ secureReadingService: readings(), jobFavourabilityResearchEnabled: true, jobFavourabilityEvaluator: { evaluate: async () => { calls += 1; return beta(); } }, timingMode: 'ON' });
  const answer = await service.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: 'JOB_FAVOURABILITY_TIMING' } });
  assert.equal(calls, 0);
  assert.equal(answer.timingAuthority, 'CANONICAL');
  assert.deepEqual(answer.broadWindow, { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z', label: 'Supportive period' });
  assert.deepEqual(answer.strongerConcentrationWindow, { start: '2026-11-10T00:00:00.000Z', end: '2026-11-20T00:00:00.000Z', label: 'Strong support' });
  assert.equal(answer.currentPeriod.start, '2026-11-01T00:00:00.000Z'); assert.equal(answer.nextPeriod.start, '2027-02-01T00:00:00.000Z');
  assert.equal(answer.contractVersion, 'career-timing-production-v1'); assert.equal(answer.provenance.calculationAuthority, 'CANONICAL_CAREER_TIMING');
});

test('Job Favourability structural ON selects next canonical timing and falls back wholly to legacy when canonical is invalid', async () => {
  let calls = 0;
  const nextOnly = new CareerAnswerService({ secureReadingService: readings(reading(canonical('CANONICAL', false))), jobFavourabilityResearchEnabled: true, jobFavourabilityEvaluator: { evaluate: async () => { calls += 1; return beta(); } }, timingMode: 'ON' });
  const nextAnswer = await nextOnly.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: 'JOB_FAVOURABILITY_TIMING' } });
  assert.equal(calls, 0); assert.equal(nextAnswer.currentPeriod, null); assert.equal(nextAnswer.broadWindow.start, '2027-02-01T00:00:00.000Z'); assert.equal(nextAnswer.strongerConcentrationWindow.start, '2027-02-10T00:00:00.000Z');
  const malformed = reading({ ...canonical(), periods: { invalid: true } });
  const fallback = new CareerAnswerService({ secureReadingService: readings(malformed), jobFavourabilityResearchEnabled: true, jobFavourabilityEvaluator: { evaluate: async () => { calls += 1; return beta(); } }, timingMode: 'ON' });
  const fallbackAnswer = await fallback.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: 'JOB_FAVOURABILITY_TIMING' } });
  assert.equal(calls, 1); assert.equal(fallbackAnswer.timingAuthority, 'LEGACY_JOB_FAVOURABILITY'); assert.deepEqual(fallbackAnswer.broadWindow, beta().broadWindow); assert.equal(fallbackAnswer.currentPeriod, undefined);
});

test('Ask Tara exposes only a bounded Career timing packet and an explicit no-invention rule', async () => {
  const answerService = new CareerAnswerService({ secureReadingService: readings(), jobFavourabilityResearchEnabled: true, jobFavourabilityEvaluator: { evaluate: async () => { throw new Error('canonical ON must not recalculate'); } }, timingMode: 'ON' });
  const capability = new TaraCareerCapability({ careerAnswerService: answerService });
  const result = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When is my next strong Career window?' });
  assert.equal(result.careerTimingContext.timingAuthority, 'CANONICAL');
  assert.equal(result.careerTimingContext.currentPeriod.start, '2026-11-01T00:00:00.000Z');
  assert.equal(result.careerTimingContext.nextPeriod.start, '2027-02-01T00:00:00.000Z');
  assert.equal(result.careerTimingContext.nextStrongestWindow.start, '2026-11-10T00:00:00.000Z');
  assert.equal(result.careerTimingContext.timingRule, CAREER_TIMING_NO_INVENTION_RULE);
  const serialized = JSON.stringify(result.careerTimingContext);
  for (const forbidden of ['birthData', 'rawChart', 'historicalEvents', 'certification', 'salary', 'company']) assert.equal(serialized.includes(forbidden), false);
  assert.match(result.message, /01 Nov 2026 to 01 Dec 2026/); assert.doesNotMatch(result.message, /promotion.*\d{1,2}/i);
});

test('Ask Tara legacy context remains visible in OFF/SHADOW and structured decision routing remains calculation-free', async () => {
  for (const mode of ['OFF', 'SHADOW']) {
    const authority = mode === 'SHADOW' ? 'SHADOW' : 'CANONICAL';
    const service = new CareerAnswerService({ secureReadingService: readings(reading(canonical(authority))), jobFavourabilityResearchEnabled: true, jobFavourabilityEvaluator: { evaluate: async () => beta() }, timingMode: mode });
    const result = await new TaraCareerCapability({ careerAnswerService: service }).respond({ principal: {}, birthProfileId: 'profile-a', message: 'When is my next strong Career window?' });
    assert.equal(result.careerTimingContext.timingAuthority, 'LEGACY_JOB_FAVOURABILITY'); assert.equal(result.careerTimingContext.currentPeriod, null); assert.equal(result.careerTimingContext.nextPeriod.start, '2028-01-01T00:00:00.000Z');
  }
  const decision = await new TaraCareerCapability({ careerAnswerService: { answer: async () => { throw new Error('decision route must not calculate timing'); } } }).respond({ principal: {}, birthProfileId: 'profile-a', message: 'Should I switch jobs?' });
  assert.equal(decision.action.decisionType, 'SWITCH_JOB'); assert.match(decision.message, /explor/i); assert.equal(decision.careerTimingContext, undefined);
});
