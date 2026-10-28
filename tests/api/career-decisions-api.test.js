'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const b = { provider: 'supabase', subject: 'subject-b', isAnonymous: false };
function fixture() {
  const decisions = new Map();
  const service = {
    async decide({ birthProfileId, body }) { const value = { decisionId: 'decision-a', createdAt: '2026-10-28T10:00:00.000Z', decisionType: body.decisionType, state: 'INSUFFICIENT_EVIDENCE', context: body.context, sourceReadingId: null, limitation: 'Not enough evidence.' }; decisions.set(`${birthProfileId}:decision-a`, value); return value; },
    async list({ birthProfileId }) { return [...decisions.values()].filter((item) => decisions.has(`${birthProfileId}:${item.decisionId}`)).map(({ decisionId, decisionType, state, sourceReadingId, createdAt }) => ({ decisionId, decisionType, state, sourceReadingId, createdAt })); },
    async get({ birthProfileId, decisionId }) { const found = decisions.get(`${birthProfileId}:${decisionId}`); if (!found) { const error = new Error('NOT_FOUND_OR_FORBIDDEN'); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; } return found; },
  };
  return createApi({ authVerifier: createTestOnlyAuthVerifier({ a, b }), userResolver: { resolve: async () => ({ id: 'user', status: 'active' }) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, secureReadingService: {}, careerDecisionService: service, requestIdGenerator: () => 'request-1' });
}
function request(app, method, url, subject = 'a', payload) { return app.inject({ method, url, headers: { authorization: `Bearer ${subject}` }, payload }); }

test('Career Decision persistence routes create, list summaries, and reopen a profile-scoped result', async () => {
  const app = fixture();
  const created = await request(app, 'POST', '/v1/birth-profiles/profile-a/career-decisions', 'a', { decisionType: 'JOB_OFFER', context: {} });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().careerDecision.decisionId, 'decision-a');
  const listed = await request(app, 'GET', '/v1/birth-profiles/profile-a/career-decisions');
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(listed.json().careerDecisions, [{ decisionId: 'decision-a', decisionType: 'JOB_OFFER', state: 'INSUFFICIENT_EVIDENCE', sourceReadingId: null, createdAt: '2026-10-28T10:00:00.000Z' }]);
  const detail = await request(app, 'GET', '/v1/birth-profiles/profile-a/career-decisions/decision-a');
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().careerDecision.state, 'INSUFFICIENT_EVIDENCE');
  assert.equal((await request(app, 'GET', '/v1/birth-profiles/profile-b/career-decisions/decision-a', 'b')).statusCode, 404);
  await app.close();
});
