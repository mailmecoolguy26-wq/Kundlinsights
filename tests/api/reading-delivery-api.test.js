'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const a = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
const b = { provider: 'supabase', subject: 'subject-b', isAnonymous: false };
const prohibited = new Set(['ciphertext', 'nonce', 'dek', 'wrappedKey', 'kms', 'userId', 'authSubject', 'prompt', 'apiKey', 'cost']);

function assertSafe(value) {
  if (Array.isArray(value)) return value.forEach(assertSafe);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) { assert.equal(prohibited.has(key), false, `prohibited field ${key}`); assertSafe(child); }
}
function summary(id, createdAt, profile = 'profile-a') { return { readingId: id, birthProfileId: profile, domain: 'CAREER', status: 'active', createdAt, readingInstant: '2026-08-17T00:00:00.000Z', locale: 'en-IN' }; }
function detail(id, profile = 'profile-a') { return { ...summary(id, '2026-08-17T00:00:00.000Z', profile), content: { domain: 'CAREER', locale: 'en-IN', sections: [{ section: 'CAREER_STRUCTURE', headline: 'Career structure', items: [{ topic: 'H10', sentence: 'Stored reading content.' }] }] } }; }
function buildApi(calls) {
  const service = {
    async generateSecureReading() { throw new Error('not used'); },
    async listSecureReadings(input) { calls.list.push(input); if (input.principal.subject !== 'subject-a') return []; return [summary('reading-new', '2026-08-18T00:00:00.000Z'), summary('reading-old', '2026-08-17T00:00:00.000Z')]; },
    async getSecureReadingDetail(input) { calls.detail.push(input); if (input.principal.subject !== 'subject-a' || input.readingId === 'reading-b') { const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; } return detail(input.readingId); },
    async replaySecureReading() { calls.replay += 1; throw new Error('replay must not run'); },
  };
  return createApi({ authVerifier: createTestOnlyAuthVerifier({ a, b }), userResolver: { resolve: async () => ({ id: 'internal-user', status: 'active' }) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, secureReadingService: service, requestIdGenerator: () => 'request-1' });
}
function request(token, url) { return { method: 'GET', url, headers: { authorization: `Bearer ${token}` } }; }

test('API-P5C2 lists only safe owned reading summaries in newest-first order without content or side effects', async () => {
  const calls = { list: [], detail: [], replay: 0 }; const api = buildApi(calls);
  const response = await api.inject(request('a', '/v1/readings?birthProfileId=profile-a'));
  assert.equal(response.statusCode, 200); assert.deepEqual(response.json().readings.map((item) => item.readingId), ['reading-new', 'reading-old']);
  assert.deepEqual(calls.list, [{ principal: a, birthProfileId: 'profile-a' }]); assert.equal(calls.detail.length, 0); assert.equal(calls.replay, 0);
  assertSafe(response.json()); assert.equal(JSON.stringify(response.json()).includes('content'), false); await api.close();
});

test('API-P5C2 returns owned stored detail without replay and hides cross-user reading IDs', async () => {
  const calls = { list: [], detail: [], replay: 0 }; const api = buildApi(calls);
  const owned = await api.inject(request('a', '/v1/readings/reading-a'));
  assert.equal(owned.statusCode, 200); assert.equal(owned.json().reading.content.sections[0].items[0].sentence, 'Stored reading content.'); assertSafe(owned.json());
  const foreign = await api.inject(request('b', '/v1/readings/reading-b'));
  assert.equal(foreign.statusCode, 404); assert.deepEqual(foreign.json().error, { code: 'NOT_FOUND_OR_FORBIDDEN', message: 'NOT_FOUND_OR_FORBIDDEN' });
  assert.equal(calls.replay, 0); assert.equal(calls.list.length, 0); await api.close();
});
