'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { ApplePurchaseVerifier } = require('../../src/payment/apple/apple-purchase-verifier');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../../src/payment/purchase-services');
const { InMemoryEntitlementRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-01T00:00:00.000Z';
const FUTURE = '2027-09-01T00:00:00.000Z';
const BEFORE_PAST = '2026-07-01T00:00:00.000Z';
const PAST = '2026-08-01T00:00:00.000Z';
const BUNDLE_ID = 'com.kundlinsights.test';
const PRODUCT_ID = 'com.kundlinsights.test.career.annual';

function payload(overrides = {}) {
  return {
    bundleId: BUNDLE_ID,
    productId: PRODUCT_ID,
    environment: 'Sandbox',
    transactionId: 'apple-test-tx-001',
    originalTransactionId: 'apple-test-original-001',
    purchaseDate: Date.parse(NOW),
    expiresDate: Date.parse(FUTURE),
    signedDate: Date.parse(NOW),
    ...overrides,
  };
}

function setup({ payloadForEvidence = () => payload() } = {}) {
  const repositories = {
    purchases: new InMemoryPurchaseRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    entitlements: new InMemoryEntitlementRepository(),
  };
  let sequence = 0;
  const signedDataVerifier = { async verifyAndDecodeTransaction({ signedTransaction }) { return payloadForEvidence(signedTransaction); } };
  const registry = new PurchaseProviderRegistry({
    APPLE: new ApplePurchaseVerifier({ signedDataVerifier, bundleId: BUNDLE_ID, appleProductId: PRODUCT_ID, clock: () => Date.parse(NOW) }),
  });
  const purchaseService = new PurchaseVerificationService({
    authUserResolver: async (principal) => ({ id: principal.subject }),
    repositories: () => repositories,
    unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }),
    registry,
    careerAccessResolver: new CareerAccessResolver(),
    idGenerator: () => `payment-${++sequence}`,
    clock: () => NOW,
  });
  const authVerifier = {
    async verifyRequest(request) {
      const token = request.headers.authorization;
      if (token === 'Bearer user-a') return { provider: 'supabase', subject: 'user-a', isAnonymous: false };
      if (token === 'Bearer user-b') return { provider: 'supabase', subject: 'user-b', isAnonymous: false };
      const error = new Error('invalid'); error.code = 'INVALID_AUTH_PRINCIPAL'; throw error;
    },
  };
  const api = createApi({
    authVerifier,
    userResolver: { resolve: async (principal) => ({ id: principal.subject, status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: {},
    purchaseService,
    requestIdGenerator: () => 'request-id',
  });
  return { api, repositories };
}

function verify(api, token, evidence = 'active') {
  return api.inject({ method: 'POST', url: '/v1/purchases/verify', headers: token ? { authorization: token } : {}, payload: { provider: 'APPLE', environment: 'SANDBOX', productId: PRODUCT_ID, evidence } });
}

function grantCredit(repositories, userId, id) {
  repositories.entitlements.createEntitlement({ id, userId, productKey: 'CAREER', status: 'active', quantity: 1, validFrom: NOW, validUntil: FUTURE });
}

test('Apple verify API persists active purchases, prefers subscriptions, and is replay-safe', async () => {
  const { api, repositories } = setup();
  grantCredit(repositories, 'user-a', 'credit-a');

  const first = await verify(api, 'Bearer user-a', 'opaque-signed-evidence');
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().purchase.logicalProductSku, 'career_premium_annual');
  assert.deepEqual(first.json().entitlement.career, { eligible: true, mode: 'SUBSCRIPTION', validUntil: FUTURE });
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(repositories.entitlements.getEntitlement('credit-a').quantity, 1);
  assert.equal((await new CareerAccessResolver().resolve({ repositories, userId: 'user-a', at: NOW })).consuming, false);
  const responseText = JSON.stringify(first.json());
  for (const forbidden of ['opaque-signed-evidence', 'signedTransaction', 'x5c', 'certificate', 'configured-root']) assert.equal(responseText.includes(forbidden), false);

  const replay = await verify(api, 'Bearer user-a', 'opaque-signed-evidence');
  assert.equal(replay.statusCode, 200);
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);

  const conflict = await verify(api, 'Bearer user-b');
  assert.equal(conflict.json().error.code, 'PURCHASE_OWNERSHIP_CONFLICT');
  assert.equal(repositories.purchases.listForUser('user-b').length, 0);
  assert.equal(repositories.subscriptions.listForUser('user-b').length, 0);
  await api.close();
});

test('Apple verify API persists terminal states and falls back to an unchanged legacy credit', async () => {
  const { api, repositories } = setup({
    payloadForEvidence: (evidence) => evidence === 'expired'
      ? payload({ transactionId: 'expired-tx', originalTransactionId: 'expired-original', purchaseDate: Date.parse(BEFORE_PAST), expiresDate: Date.parse(PAST) })
      : payload({ transactionId: `${evidence}-tx`, originalTransactionId: `${evidence}-original`, revocationDate: Date.parse(NOW), revocationReason: evidence === 'refunded' ? 1 : 0 }),
  });
  const expired = await verify(api, 'Bearer user-a', 'expired');
  assert.equal(expired.statusCode, 200);
  assert.deepEqual(expired.json().entitlement.career, { eligible: false, mode: 'NONE', validUntil: null });
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a')[0].status, 'EXPIRED');

  grantCredit(repositories, 'user-a', 'credit-a');
  const refunded = await verify(api, 'Bearer user-a', 'refunded');
  const revoked = await verify(api, 'Bearer user-a', 'revoked');
  assert.equal(refunded.json().entitlement.career.mode, 'CREDIT');
  assert.equal(revoked.json().entitlement.career.mode, 'CREDIT');
  assert.equal(repositories.entitlements.getEntitlement('credit-a').quantity, 1);
  assert.equal(repositories.purchases.listForUser('user-a').length, 3);
  assert.deepEqual(repositories.subscriptions.listForUser('user-a').map((item) => item.status).sort(), ['EXPIRED', 'REFUNDED', 'REVOKED']);
  await api.close();
});

test('Apple verify API rejects verifier, product, environment, bundle, and unauthenticated requests without persistence', async () => {
  const { api, repositories } = setup({
    payloadForEvidence: (evidence) => {
      if (evidence === 'failure') { const error = new Error('verification'); error.code = 'APPLE_JWS_VERIFICATION_FAILED'; throw error; }
      if (evidence === 'wrong-product') return payload({ productId: 'com.example.other' });
      if (evidence === 'production') return payload({ environment: 'Production' });
      return payload({ bundleId: 'com.example.other' });
    },
  });
  for (const [evidence, code] of [['failure', 'APPLE_JWS_VERIFICATION_FAILED'], ['wrong-product', 'PURCHASE_PRODUCT_UNSUPPORTED'], ['production', 'PURCHASE_EVIDENCE_INVALID'], ['bundle', 'PURCHASE_EVIDENCE_INVALID']]) {
    const response = await verify(api, 'Bearer user-a', evidence);
    assert.equal(response.json().error.code, code);
  }
  const unauthenticated = await verify(api, null);
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(repositories.purchases.listForUser('user-a').length, 0);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 0);
  await api.close();
});

test('Apple verify API rolls back a purchase when subscription persistence fails', async () => {
  const { api, repositories } = setup();
  repositories.subscriptions.upsertVerifiedState = () => { const error = new Error('subscription failure'); error.code = 'SUBSCRIPTION_PERSISTENCE_FAILED'; throw error; };
  const response = await verify(api, 'Bearer user-a');
  assert.equal(response.json().error.code, 'SUBSCRIPTION_PERSISTENCE_FAILED');
  assert.equal(repositories.purchases.listForUser('user-a').length, 0);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 0);
  await api.close();
});
