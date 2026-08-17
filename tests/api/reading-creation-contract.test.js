'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };

function buildApi(calls) {
  return createApi({
    authVerifier: createTestOnlyAuthVerifier({ token: principal }),
    userResolver: { resolve: async () => ({ id: 'user-a', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: {
      async generateSecureReading(input) {
        calls.push(input);
        return {
          readingId: 'reading-a',
          domain: input.domain,
          engineProfileId: 'profile-v2',
          createdAt: '2026-08-17T00:00:00.000Z',
          status: 'active',
        };
      },
      async getSecureReading() { throw new Error('not used'); },
      async replaySecureReading() { throw new Error('not used'); },
    },
    requestIdGenerator: () => 'request-1',
  });
}

function request(payload, key = 'key-1') {
  return {
    method: 'POST',
    url: '/v1/readings',
    headers: { authorization: 'Bearer token', 'idempotency-key': key },
    payload,
  };
}

test('Career is the sole public creation domain and unsupported domains do not reach entitlement/generation', async () => {
  const calls = [];
  const api = buildApi(calls);
  const rejected = await api.inject(request({ birthProfileId: 'profile-a', domain: 'MARRIAGE' }));
  assert.equal(rejected.statusCode, 400);
  assert.deepEqual(rejected.json().error, { code: 'INVALID_READING_DOMAIN', message: 'INVALID_READING_DOMAIN' });
  assert.equal(calls.length, 0);

  const created = await api.inject(request({ birthProfileId: 'profile-a', domain: 'CAREER' }));
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().reading.domain, 'CAREER');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].domain, 'CAREER');
  await api.close();
});

test('caller reading instant and locale are not forwarded as public creation authority', async () => {
  const calls = [];
  const api = buildApi(calls);
  const created = await api.inject(request({
    birthProfileId: 'profile-a',
    domain: 'CAREER',
    readingInstant: '1900-01-01T00:00:00.000Z',
    locale: 'xx-XX',
  }));
  assert.equal(created.statusCode, 201);
  assert.deepEqual(calls[0], {
    principal,
    birthProfileId: 'profile-a',
    domain: 'CAREER',
    idempotencyKey: 'key-1',
  });
  await api.close();
});
