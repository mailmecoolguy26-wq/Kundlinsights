'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerAnswerService, CareerQuestionType, validateQuestionRequest } = require('../../src/application/career-answers');

const summary = { readingId: 'reading-a', birthProfileId: 'profile-a', domain: 'CAREER', createdAt: '2026-10-01T00:00:00.000Z' };
function detail(overrides = {}) {
  return {
    ...summary,
    insights: [{ family: 'CAREER_FOUNDATION', status: 'SUPPORTED' }],
    careerD10Corroboration: { chart: 'D10' },
    careerAshtakavargaStructure: { h10: { house: 10, sav: 31 } },
    careerTimingPeriods: [{
      startDate: '2026-11-20T00:00:00.000Z', endDate: '2027-01-10T00:00:00.000Z',
      evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
      technicalDetails: { dasha: { periods: ['MD:Saturn'] }, gochar: [{ transitPlanet: 'Jupiter' }], d10: { confirmationPresent: true } },
      recurrenceSummary: 'A related pattern also appeared around a previous Career transition.',
    }],
    ...overrides,
  };
}
function service({ eligible = true, readings = [summary], value = detail() } = {}) {
  return {
    getReadingEntitlementStatus: async () => ({ career: { eligible } }),
    listSecureReadings: async () => readings,
    getSecureReadingDetail: async () => value,
  };
}

test('returns only an existing possible activity signal with primary eligibility and support context', async () => {
  const answer = await new CareerAnswerService({ secureReadingService: service() }).answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CAREER_ACTIVITY_TIMING } });
  assert.equal(answer.answerability, 'SUPPORTED');
  assert.deepEqual(answer.answer.window, { start: '2026-11-20T00:00:00.000Z', end: '2027-01-10T00:00:00.000Z', classification: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL' });
  assert.equal(answer.agreement.primaryEligibility, true);
  assert.deepEqual(answer.agreement.supportSignals, ['D10', 'ASHTAKAVARGA', 'HISTORICAL_PATTERN']);
  assert.equal(answer.historicalContext.summary.includes('related pattern'), true);
  assert.equal(JSON.stringify({ headline: answer.answer.headline, summary: answer.answer.summary, classification: answer.answer.window.classification }).match(/probability|favo[u]?rable|likely job|likely employment|exact.?date/i), null);
  assert.match(answer.answer.limitation, /not a favourable window, job-offer prediction, or guarantee/i);
});

test('does not let D10, Ashtakavarga, or recurrence create timing eligibility', async () => {
  const value = detail({ careerTimingPeriods: [{ ...detail().careerTimingPeriods[0], technicalDetails: { dasha: { periods: [] }, gochar: [], d10: { confirmationPresent: true } } }] });
  const answer = await new CareerAnswerService({ secureReadingService: service({ value }) }).answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CAREER_ACTIVITY_TIMING } });
  assert.equal(answer.answerability, 'INSUFFICIENT_EVIDENCE');
  assert.equal(answer.answer.window, null);
  assert.equal(answer.agreement.primaryEligibility, false);
});

test('returns no-window and current-phase responses from a persisted reading without recalculation', async () => {
  const noSignal = detail({ careerTimingPeriods: [] });
  const answers = new CareerAnswerService({ secureReadingService: service({ value: noSignal }) });
  const timing = await answers.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CAREER_ACTIVITY_TIMING } });
  const phase = await answers.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CURRENT_CAREER_PHASE } });
  assert.equal(timing.answer.window, null);
  assert.equal(timing.answerability, 'INSUFFICIENT_EVIDENCE');
  assert.equal(phase.answerability, 'SUPPORTED');
  assert.equal(phase.answer.currentPhase, 'Current Career context available');
});

test('uses only the selected signal historical context and never invents dates or recurrence', async () => {
  const value = detail({
    careerEvidenceSynthesis: { futureRecurrence: 'Do not expose this unsupported summary.' },
    careerTimingPeriods: [{ ...detail().careerTimingPeriods[0], recurrenceSummary: undefined }],
  });
  const answer = await new CareerAnswerService({ secureReadingService: service({ value }) }).answer({
    principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CAREER_ACTIVITY_TIMING },
  });
  assert.equal(answer.historicalContext, null);
  assert.deepEqual(answer.answer.window, {
    start: '2026-11-20T00:00:00.000Z',
    end: '2027-01-10T00:00:00.000Z',
    classification: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
  });
});

test('free access preserves the current phase and limited possible timing without premium-only detail', async () => {
  const answers = new CareerAnswerService({ secureReadingService: service({ eligible: false }) });
  const phase = await answers.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CURRENT_CAREER_PHASE } });
  const timing = await answers.answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CAREER_ACTIVITY_TIMING } });
  assert.equal(phase.answerability, 'SUPPORTED');
  assert.equal(timing.answerability, 'SUPPORTED');
  assert.equal(timing.answer.window.classification, 'POSSIBLE_CAREER_ACTIVITY_SIGNAL');
  assert.deepEqual(timing.evidence.map((item) => item.family), ['D1_CAREER_FOUNDATION', 'DASHA', 'TRANSIT']);
  assert.deepEqual(timing.agreement.supportSignals, []);
  assert.equal(timing.historicalContext, null);
  assert.match(timing.answer.limitation, /Detailed supporting context is available with Career Premium/);
});

test('a missing owned Career Reading returns a structured insufficient-evidence response for free access', async () => {
  const answer = await new CareerAnswerService({ secureReadingService: service({ eligible: false, readings: [] }) }).answer({
    principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CURRENT_CAREER_PHASE },
  });
  assert.equal(answer.answerability, 'INSUFFICIENT_EVIDENCE');
  assert.equal(answer.answer.headline, 'A Career Reading is needed first');
  assert.equal(answer.answer.window, null);
});

test('premium access retains deeper evidence, support signals, and historical context', async () => {
  const answer = await new CareerAnswerService({ secureReadingService: service({ eligible: true }) }).answer({
    principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CAREER_ACTIVITY_TIMING },
  });
  assert.deepEqual(answer.evidence.map((item) => item.family), [
    'D1_CAREER_FOUNDATION', 'DASHA', 'TRANSIT', 'D10', 'ASHTAKAVARGA', 'HISTORICAL_PATTERN',
  ]);
  assert.deepEqual(answer.agreement.supportSignals, ['D10', 'ASHTAKAVARGA', 'HISTORICAL_PATTERN']);
  assert.ok(answer.historicalContext);
});

test('enforces profile consistency and canonical question types for every access tier', async () => {
  await assert.rejects(() => new CareerAnswerService({ secureReadingService: service({ value: detail({ birthProfileId: 'profile-b' }) }) }).answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CURRENT_CAREER_PHASE } }), { code: 'NOT_FOUND_OR_FORBIDDEN' });
  await assert.rejects(() => new CareerAnswerService({ secureReadingService: service({ eligible: false, readings: [ { ...summary, birthProfileId: 'profile-b' } ] }) }).answer({ principal: {}, birthProfileId: 'profile-a', body: { questionType: CareerQuestionType.CURRENT_CAREER_PHASE, readingId: 'reading-a' } }), { code: 'NOT_FOUND_OR_FORBIDDEN' });
  assert.throws(() => validateQuestionRequest({ questionType: 'NEXT_JOB_TIMING' }), { code: 'UNSUPPORTED_CAREER_QUESTION' });
});
