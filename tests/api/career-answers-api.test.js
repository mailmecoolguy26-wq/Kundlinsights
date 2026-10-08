'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const api = () => createApi({
  authVerifier: createTestOnlyAuthVerifier({ a: principal }),
  userResolver: { resolve: async () => ({ id: 'u', status: 'active' }) },
  birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
  secureReadingService: { generateSecureReading: async () => null, listSecureReadings: async () => [], getSecureReadingDetail: async () => null, replaySecureReading: async () => null },
  careerAnswerService: { answer: async ({ birthProfileId, body }) => body.questionType === 'JOB_FAVOURABILITY_TIMING'
    ? ({ questionType: body.questionType, answerability: 'PROJECTION_DISABLED', projectionStatus: 'DISABLED', sourceReadingId: null, broadWindow: null, strongerConcentrationWindow: null, primaryAlignment: {}, supportingContext: {}, limitationCode: 'JOB_FAVOURABILITY_RESEARCH_DISABLED', provenance: { projectionGate: 'DISABLED' }, rulesetVersion: `v1:${birthProfileId}` })
    : ({ questionType: body.questionType, answerability: 'INSUFFICIENT_EVIDENCE', answer: { headline: 'No concentrated Career activity signal is identified', summary: 'Safe.', currentPhase: null, window: null, actionItems: [], limitation: 'Safe.' }, agreement: { availableMajorSignals: 0, alignedMajorSignals: 0, primaryEligibility: false, supportSignals: [] }, evidence: [], historicalContext: null, sourceReadingId: null, rulesetVersion: `v1:${birthProfileId}` }) },
});

test('Career Answers API accepts existing free questions and keeps job favourability windowless behind its disabled gate', async () => {
  const app = api();
  for (const questionType of ['CURRENT_CAREER_PHASE', 'CAREER_ACTIVITY_TIMING']) {
    const response = await app.inject({ method: 'POST', url: '/v1/birth-profiles/profile-a/career-answers', headers: { authorization: 'Bearer a' }, payload: { questionType } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().careerAnswer.questionType, questionType);
    assert.equal(response.json().careerAnswer.answer.window, null);
    assert.equal(JSON.stringify(response.json()).match(/probability|guaranteed|favo[u]?rable/i), null);
  }
  const jobResponse = await app.inject({ method: 'POST', url: '/v1/birth-profiles/profile-a/career-answers', headers: { authorization: 'Bearer a' }, payload: { questionType: 'JOB_FAVOURABILITY_TIMING' } });
  assert.equal(jobResponse.statusCode, 200);
  assert.equal(jobResponse.json().careerAnswer.questionType, 'JOB_FAVOURABILITY_TIMING');
  assert.equal(jobResponse.json().careerAnswer.answerability, 'PROJECTION_DISABLED');
  assert.equal(jobResponse.json().careerAnswer.broadWindow, null);
  assert.equal(jobResponse.json().careerAnswer.strongerConcentrationWindow, null);
  assert.equal(jobResponse.json().careerAnswer.provenance.projectionGate, 'DISABLED');
  await app.close();
});

test('Career Answers API provides only a timing callback to the service', async () => {
  let timing = null;
  const app = createApi({
    authVerifier: createTestOnlyAuthVerifier({ a: principal }),
    userResolver: { resolve: async () => ({ id: 'u', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: { generateSecureReading: async () => null, listSecureReadings: async () => [], getSecureReadingDetail: async () => null, replaySecureReading: async () => null },
    careerAnswerService: { answer: async (input) => {
      timing = input.timing;
      timing({ stage: 'TRANSIT_SCAN', durationMs: 12 });
      return { questionType: input.body.questionType, answerability: 'PROJECTION_DISABLED', projectionStatus: 'DISABLED', sourceReadingId: null, broadWindow: null, strongerConcentrationWindow: null, primaryAlignment: {}, supportingContext: {}, limitationCode: 'JOB_FAVOURABILITY_RESEARCH_DISABLED', provenance: { projectionGate: 'DISABLED' }, rulesetVersion: 'v1' };
    } },
  });
  const response = await app.inject({ method: 'POST', url: '/v1/birth-profiles/profile-a/career-answers', headers: { authorization: 'Bearer a' }, payload: { questionType: 'JOB_FAVOURABILITY_TIMING' } });
  assert.equal(response.statusCode, 200);
  assert.equal(typeof timing, 'function');
  await app.close();
});
