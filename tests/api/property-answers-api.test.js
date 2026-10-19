'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

test('Property Answers API is authenticated, profile-scoped, and forwards only server-owned intent', async () => {
  const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };
  const calls = [];
  const app = createApi({
    authVerifier: createTestOnlyAuthVerifier({ a: principal }),
    userResolver: { resolve: async () => ({ id: 'user-a', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: {},
    propertyAnswerService: {
      answer: async (input) => {
        calls.push(input);
        return { intent: input.intent, classification: 'MIXED', strongerWindow: null };
      },
    },
    requestIdGenerator: () => 'property-request',
  });

  const response = await app.inject({
    method: 'POST',
    url: '/v1/birth-profiles/profile-a/property-answers',
    headers: { authorization: 'Bearer a' },
    payload: { intent: 'PROPERTY_PURCHASE_TIMING', clientSuppliedChart: 'ignored' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().propertyAnswer.classification, 'MIXED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].birthProfileId, 'profile-a');
  assert.equal(calls[0].principal.subject, 'subject-a');
  assert.equal(calls[0].intent, 'PROPERTY_PURCHASE_TIMING');
  assert.equal(Object.hasOwn(calls[0], 'clientSuppliedChart'), false);
  await app.close();
});
