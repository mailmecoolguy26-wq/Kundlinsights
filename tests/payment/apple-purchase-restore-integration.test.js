'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { ApplePurchaseVerifier } = require('../../src/payment/apple/apple-purchase-verifier');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../../src/payment/purchase-services');
const { InMemoryEntitlementRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-01T00:00:00.000Z'; const EARLIER = '2026-07-01T00:00:00.000Z'; const PAST = '2026-08-01T00:00:00.000Z'; const FUTURE = '2027-09-01T00:00:00.000Z';
const BUNDLE_ID = 'com.kundlinsights.test'; const PRODUCT_ID = 'com.kundlinsights.test.career.annual';

function payload(overrides = {}) { return { bundleId: BUNDLE_ID, productId: PRODUCT_ID, environment: 'Sandbox', transactionId: 'apple-tx-1', originalTransactionId: 'apple-original-1', purchaseDate: Date.parse(NOW), expiresDate: Date.parse(FUTURE), signedDate: Date.parse(NOW), ...overrides }; }
function setup({ payloadForEvidence = () => payload() } = {}) {
  const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository() }; let sequence = 0;
  const verifier = new ApplePurchaseVerifier({ signedDataVerifier: { async verifyAndDecodeTransaction({ signedTransaction }) { return payloadForEvidence(signedTransaction); } }, bundleId: BUNDLE_ID, appleProductId: PRODUCT_ID, clock: () => Date.parse(NOW) });
  const purchaseService = new PurchaseVerificationService({ authUserResolver: async (principal) => ({ id: principal.subject }), repositories: () => repositories, unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }), registry: new PurchaseProviderRegistry({ APPLE: verifier }), careerAccessResolver: new CareerAccessResolver(), idGenerator: () => `payment-${++sequence}`, clock: () => NOW });
  const api = createApi({ authVerifier: { async verifyRequest(request) { const token = request.headers.authorization; if (token === 'Bearer user-a') return { provider: 'supabase', subject: 'user-a', isAnonymous: false }; if (token === 'Bearer user-b') return { provider: 'supabase', subject: 'user-b', isAnonymous: false }; const error = new Error('invalid'); error.code = 'INVALID_AUTH_PRINCIPAL'; throw error; } }, userResolver: { resolve: async (principal) => ({ id: principal.subject, status: 'active' }) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, secureReadingService: {}, purchaseService, requestIdGenerator: () => 'request-id' });
  return { api, repositories, purchaseService };
}
function restore(api, token, signedTransactions) { return api.inject({ method: 'POST', url: '/v1/purchases/restore', headers: { authorization: token }, payload: { provider: 'APPLE', environment: 'SANDBOX', evidence: { signedTransactions } } }); }
function credit(repositories, userId = 'user-a') { repositories.entitlements.createEntitlement({ id: `credit-${userId}`, userId, productKey: 'CAREER', status: 'active', quantity: 1, validFrom: NOW, validUntil: FUTURE }); }

test('Apple restore persists active items, preserves credits, and is idempotent for existing purchases', async () => {
  const { api, repositories, purchaseService } = setup(); credit(repositories);
  await purchaseService.verify({ principal: { subject: 'user-a' }, body: { provider: 'APPLE', environment: 'SANDBOX', productId: PRODUCT_ID, evidence: 'active' } });
  const response = await restore(api, 'Bearer user-a', ['active']);
  assert.equal(response.statusCode, 200); assert.equal(response.json().restored.length, 1); assert.equal(response.json().restored[0].entitlement.career.mode, 'SUBSCRIPTION');
  assert.equal(repositories.purchases.listForUser('user-a').length, 1); assert.equal(repositories.subscriptions.listForUser('user-a').length, 1); assert.equal(repositories.entitlements.getEntitlement('credit-user-a').quantity, 1);
  const replay = await restore(api, 'Bearer user-a', ['active']); assert.equal(replay.statusCode, 200); assert.equal(repositories.purchases.listForUser('user-a').length, 1); assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(JSON.stringify(replay.json()).includes('active'), false); await api.close();
});

test('Apple restore reconciles one original transaction to its newest verified state and ignores stale state', async () => {
  const values = { old: payload({ transactionId: 'renewal-old', purchaseDate: Date.parse(EARLIER), expiresDate: Date.parse(PAST), signedDate: Date.parse(EARLIER) }), latest: payload({ transactionId: 'renewal-latest', signedDate: Date.parse(NOW) }) };
  const { api, repositories } = setup({ payloadForEvidence: (evidence) => values[evidence] });
  const restored = await restore(api, 'Bearer user-a', ['old', 'latest']); assert.equal(restored.statusCode, 200);
  assert.equal(repositories.purchases.listForUser('user-a').length, 2); assert.equal(repositories.subscriptions.listForUser('user-a').length, 1); assert.equal(repositories.subscriptions.listForUser('user-a')[0].validUntil, FUTURE);
  const stale = await restore(api, 'Bearer user-a', ['old']); assert.equal(stale.statusCode, 200); assert.equal(repositories.subscriptions.listForUser('user-a')[0].validUntil, FUTURE); assert.equal(stale.json().restored[0].entitlement.career.mode, 'SUBSCRIPTION'); await api.close();
});

test('Apple restore handles terminal states through legacy credit fallback and protects ownership', async () => {
  const values = { expired: payload({ transactionId: 'expired', originalTransactionId: 'expired-original', purchaseDate: Date.parse(EARLIER), expiresDate: Date.parse(PAST) }), refunded: payload({ transactionId: 'refunded', originalTransactionId: 'refunded-original', revocationDate: Date.parse(NOW), revocationReason: 1 }), revoked: payload({ transactionId: 'revoked', originalTransactionId: 'revoked-original', revocationDate: Date.parse(NOW), revocationReason: 0 }) };
  const { api, repositories } = setup({ payloadForEvidence: (evidence) => values[evidence] });
  const expired = await restore(api, 'Bearer user-a', ['expired']); assert.equal(expired.json().restored[0].entitlement.career.mode, 'NONE'); credit(repositories);
  const refunded = await restore(api, 'Bearer user-a', ['refunded']); const revoked = await restore(api, 'Bearer user-a', ['revoked']); assert.equal(refunded.json().restored[0].entitlement.career.mode, 'CREDIT'); assert.equal(revoked.json().restored[0].entitlement.career.mode, 'CREDIT');
  const conflict = await restore(api, 'Bearer user-b', ['revoked']); assert.equal(conflict.json().error.code, 'PURCHASE_OWNERSHIP_CONFLICT'); assert.equal(repositories.purchases.listForUser('user-b').length, 0); assert.equal(repositories.subscriptions.listForUser('user-b').length, 0); await api.close();
});

test('Apple restore rejects invalid items without persistence and rolls back only a failed item', async () => {
  const values = { wrong: payload({ productId: 'com.example.other' }), bundle: payload({ bundleId: 'com.example.other' }), production: payload({ environment: 'Production' }), first: payload({ transactionId: 'first', originalTransactionId: 'first-original' }), second: payload({ transactionId: 'second', originalTransactionId: 'second-original' }) };
  const { api, repositories } = setup({ payloadForEvidence: (evidence) => { if (evidence === 'failure') { const error = new Error('verify'); error.code = 'APPLE_JWS_VERIFICATION_FAILED'; throw error; } return values[evidence]; } });
  for (const evidence of ['wrong', 'bundle', 'production', 'failure']) { const response = await restore(api, 'Bearer user-a', [evidence]); assert.notEqual(response.statusCode, 200); }
  const mixed = await restore(api, 'Bearer user-a', ['first', 'failure']); assert.notEqual(mixed.statusCode, 200);
  assert.equal(repositories.purchases.listForUser('user-a').length, 0); assert.equal(repositories.subscriptions.listForUser('user-a').length, 0);
  const original = repositories.subscriptions.upsertVerifiedState; repositories.subscriptions.upsertVerifiedState = function (input) { if (input.originalTransactionId === 'second-original') { const error = new Error('fail'); error.code = 'SUBSCRIPTION_PERSISTENCE_FAILED'; throw error; } return original.call(this, input); };
  const partial = await restore(api, 'Bearer user-a', ['first', 'second']); assert.equal(partial.json().error.code, 'SUBSCRIPTION_PERSISTENCE_FAILED'); assert.equal(repositories.purchases.listForUser('user-a').length, 1); assert.equal(repositories.subscriptions.listForUser('user-a').length, 1); await api.close();
});
