'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const prohibited = new Set(['id', 'userId', 'ownerId', 'authSubject', 'quantity', 'validUntil', 'sourcePaymentTransactionId', 'payment', 'purchaseRecordId']);
function assertSafe(value) { if (Array.isArray(value)) return value.forEach(assertSafe); if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { assert.equal(prohibited.has(key), false, `prohibited ${key}`); assertSafe(child); } }

test('API-P5K-A1C1C1 requires validated profile context while retaining the safe entitlement response contract', async () => {
  const calls = []; const service = {
    async getReadingEntitlementStatus(input) { calls.push(input); if (input.birthProfileId === 'profile-other') { const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; } return { career: input.birthProfileId === 'profile-a' ? { eligible: true, mode: 'PROFILE_UNLOCK', consuming: false } : input.birthProfileId === 'profile-credit' ? { eligible: true, mode: 'CREDIT', consuming: true } : { eligible: false, mode: 'NONE', consuming: false } }; },
    async generateSecureReading() { throw new Error('not used'); }, async listSecureReadings() { return []; }, async getSecureReadingDetail() { return null; }, async replaySecureReading() { return null; },
  };
  const api = createApi({ authVerifier: createTestOnlyAuthVerifier({ a }), userResolver: { resolve: async () => ({ id: 'internal-user', status: 'active' }) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, secureReadingService: service, requestIdGenerator: () => 'request-1' });
  const unauthenticated = await api.inject('/v1/me/entitlements?birthProfileId=profile-a'); assert.equal(unauthenticated.statusCode, 401);
  const response = await api.inject({ method: 'GET', url: '/v1/me/entitlements?birthProfileId=profile-a&userId=other&ownerId=other&authSubject=other', headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200); assert.deepEqual(response.json().entitlements, { career: { eligible: true, mode: 'PROFILE_UNLOCK', consuming: false } }); assertSafe(response.json());
  const none = await api.inject({ method: 'GET', url: '/v1/me/entitlements?birthProfileId=profile-a2', headers: { authorization: 'Bearer a' } }); assert.deepEqual(none.json().entitlements, { career: { eligible: false, mode: 'NONE', consuming: false } });
  const credit = await api.inject({ method: 'GET', url: '/v1/me/entitlements?birthProfileId=profile-credit', headers: { authorization: 'Bearer a' } }); assert.deepEqual(credit.json().entitlements, { career: { eligible: true, mode: 'CREDIT', consuming: true } });
  const other = await api.inject({ method: 'GET', url: '/v1/me/entitlements?birthProfileId=profile-other', headers: { authorization: 'Bearer a' } }); assert.equal(other.statusCode, 404);
  assert.deepEqual(calls.map((input) => input.principal), [a, a, a, a]);
  for (const url of ['/v1/me/entitlements', '/v1/me/entitlements?birthProfileId=', '/v1/me/entitlements?birthProfileId=bad%20id']) { const invalid = await api.inject({ method: 'GET', url, headers: { authorization: 'Bearer a' } }); assert.equal(invalid.statusCode, 400); assert.equal(invalid.json().error.code, 'INVALID_BIRTH_PROFILE_ID'); }
  await api.close();
});
