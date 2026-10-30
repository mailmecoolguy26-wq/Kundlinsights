'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');
test('Relationship Answers API is authenticated, profile-scoped, and exposes only the server-owned response', async () => {
  const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false }, calls = [];
  const app = createApi({ authVerifier: createTestOnlyAuthVerifier({ a: principal }), userResolver: { resolve: async () => ({ id: 'user-a', status: 'active' }) }, birthProfileService: { get: async () => null }, secureReadingService: {}, relationshipAnswerService: { answer: async (input) => { calls.push(input); return { intent: input.intent, state: 'Improving', ruleVersion: 'relationship-marriage-rules-v1', strongerWindow: null }; } }, requestIdGenerator: () => 'relationship-request' });
  const response = await app.inject({ method: 'POST', url: '/v1/birth-profiles/profile-a/relationship-answers', headers: { authorization: 'Bearer a' }, payload: { intent: 'RELATIONSHIP_OUTLOOK', clientChart: 'ignored' } });
  assert.equal(response.statusCode, 200); assert.equal(response.json().relationshipAnswer.ruleVersion, 'relationship-marriage-rules-v1'); assert.equal(calls.length, 1); assert.equal(calls[0].birthProfileId, 'profile-a'); assert.equal(calls[0].principal.subject, 'subject-a'); assert.equal(Object.hasOwn(calls[0], 'clientChart'), false); await app.close();
});
