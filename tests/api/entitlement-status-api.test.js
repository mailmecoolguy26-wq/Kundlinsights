'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const prohibited = new Set(['id', 'userId', 'ownerId', 'authSubject', 'quantity', 'validUntil', 'sourcePaymentTransactionId', 'payment']);
function assertSafe(value) { if (Array.isArray(value)) return value.forEach(assertSafe); if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { assert.equal(prohibited.has(key), false, `prohibited ${key}`); assertSafe(child); } }

test('API-P5C3 exposes only authenticated, safe, read-only CAREER eligibility with no client owner authority', async () => {
  const calls = []; const service = {
    async getReadingEntitlementStatus(input) { calls.push(input); return { career: { eligible: input.principal.subject === 'subject-a' } }; },
    async generateSecureReading() { throw new Error('not used'); }, async listSecureReadings() { return []; }, async getSecureReadingDetail() { return null; }, async replaySecureReading() { return null; },
  };
  const api = createApi({ authVerifier: createTestOnlyAuthVerifier({ a }), userResolver: { resolve: async () => ({ id: 'internal-user', status: 'active' }) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, secureReadingService: service, requestIdGenerator: () => 'request-1' });
  const unauthenticated = await api.inject('/v1/me/entitlements'); assert.equal(unauthenticated.statusCode, 401);
  const response = await api.inject({ method: 'GET', url: '/v1/me/entitlements?userId=other&ownerId=other&authSubject=other', headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200); assert.deepEqual(response.json().entitlements, { career: { eligible: true } }); assert.deepEqual(calls, [{ principal: a }]); assertSafe(response.json());
  await api.close();
});
