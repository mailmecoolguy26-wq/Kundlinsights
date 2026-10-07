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
  careerAnswerService: { answer: async ({ birthProfileId, body }) => ({ questionType: body.questionType, answerability: 'INSUFFICIENT_EVIDENCE', answer: { headline: 'No concentrated Career activity signal is identified', summary: 'Safe.', currentPhase: null, window: null, actionItems: [], limitation: 'Safe.' }, agreement: { availableMajorSignals: 0, alignedMajorSignals: 0, primaryEligibility: false, supportSignals: [] }, evidence: [], historicalContext: null, sourceReadingId: null, rulesetVersion: `v1:${birthProfileId}` }) },
});

test('Career Answers API accepts both free Phase 1 question types through the owned-answer contract', async () => {
  const app = api();
  for (const questionType of ['CURRENT_CAREER_PHASE', 'CAREER_ACTIVITY_TIMING']) {
    const response = await app.inject({ method: 'POST', url: '/v1/birth-profiles/profile-a/career-answers', headers: { authorization: 'Bearer a' }, payload: { questionType } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().careerAnswer.questionType, questionType);
    assert.equal(response.json().careerAnswer.answer.window, null);
    assert.equal(JSON.stringify(response.json()).match(/probability|guaranteed|favo[u]?rable/i), null);
  }
  await app.close();
});
