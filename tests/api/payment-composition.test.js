'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiComposition } = require('../../src/api');

const now = '2026-09-01T00:00:00.000Z';

function pool() {
  const user = { id: 'user-a', auth_subject: 'subject-a', status: 'active', created_at: now, updated_at: now, deleted_at: null };
  const client = {
    async query(sql) {
      if (sql.includes('from app.users where auth_subject')) return { rows: [user] };
      return { rows: [] };
    },
    release() {},
  };
  return { async connect() { return client; } };
}

function input(apple = null) {
  return {
    db: pool(),
    authVerifier: { async verifyRequest() { return { provider: 'supabase', subject: 'subject-a', isAnonymous: false }; } },
    kms: {},
    astronomicalEngine: { calculate() {} },
    canonicalSiderealSunSampler: { sampleCanonicalSiderealSun() {} },
    idGenerator: () => 'generated-id',
    clock: () => now,
    apple,
  };
}

test('composition wires internal payment routes while preserving its public shape', async () => {
  const composition = createApiComposition(input());

  assert.deepEqual(Object.keys(composition).sort(), ['api', 'services']);
  assert.ok(composition.api);
  assert.equal(typeof composition.services.userResolver, 'function');
  assert.equal(typeof composition.services.transactionExecutor.execute, 'function');
  assert.deepEqual(Object.keys(composition.api.apiRuntime).sort(), ['astronomicalEngine', 'canonicalSiderealSunSampler']);

  const response = await composition.api.inject({ method: 'POST', url: '/v1/purchases/verify', payload: { provider: 'APPLE' } });
  assert.equal(response.statusCode, 500);
  assert.equal(response.json().error.code, 'PURCHASE_PROVIDER_UNSUPPORTED');
  await composition.api.close();
});

test('composition registers Apple only from complete runtime configuration', async () => {
  const apple = {
    bundleId: 'com.kundlinsights.test',
    careerPremiumAnnualProductId: 'com.kundlinsights.test.career.annual',
    appAppleId: '123456789',
    rootCertificateProvider: { load: () => [Buffer.from('configured-root')] },
  };
  const configured = createApiComposition(input(apple));
  const configuredResponse = await configured.api.inject({ method: 'POST', url: '/v1/purchases/verify', payload: { provider: 'APPLE', environment: 'SANDBOX', productId: apple.careerPremiumAnnualProductId, evidence: 'not-a-jws' } });
  assert.equal(configuredResponse.json().error.code, 'APPLE_JWS_VERIFICATION_FAILED');
  await configured.api.close();

  const partial = createApiComposition(input({ ...apple, rootCertificateProvider: null }));
  const partialResponse = await partial.api.inject({ method: 'POST', url: '/v1/purchases/verify', payload: { provider: 'APPLE', rootCertificateProvider: { load: () => [Buffer.from('client-root')] } } });
  assert.equal(partialResponse.json().error.code, 'PURCHASE_PROVIDER_UNSUPPORTED');
  const unknownResponse = await partial.api.inject({ method: 'POST', url: '/v1/purchases/verify', payload: { provider: 'GOOGLE' } });
  assert.equal(unknownResponse.json().error.code, 'PURCHASE_PROVIDER_UNSUPPORTED');
  await partial.api.close();
});
