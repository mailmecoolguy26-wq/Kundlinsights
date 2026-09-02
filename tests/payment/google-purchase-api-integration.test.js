'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { GooglePurchaseVerifier } = require('../../src/payment/google/google-purchase-verifier');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../../src/payment/purchase-services');
const { InMemoryEntitlementRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-02T00:00:00.000Z'; const FUTURE = '2027-09-02T00:00:00.000Z'; const PACKAGE = 'com.kundlinsights.test'; const PRODUCT = 'career.premium.annual';
function setup({ state = 'SUBSCRIPTION_STATE_ACTIVE', expires = FUTURE, started = NOW } = {}) {
  const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository() }; let ids = 0;
  const verifier = new GooglePurchaseVerifier({ packageName: PACKAGE, googleProductId: PRODUCT, apiClient: { async getSubscription() { return { packageName: PACKAGE, latestOrderId: 'GPA.123', startTime: started, subscriptionState: state, lineItems: [{ productId: PRODUCT, expiryTime: expires }] }; } } });
  const purchaseService = new PurchaseVerificationService({ authUserResolver: async (principal) => ({ id: principal.subject }), repositories: () => repositories, unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }), registry: new PurchaseProviderRegistry({ GOOGLE: verifier }), careerAccessResolver: new CareerAccessResolver(), idGenerator: () => `id-${++ids}`, clock: () => NOW });
  const authVerifier = { async verifyRequest(request) { const subject = request.headers.authorization === 'Bearer b' ? 'user-b' : request.headers.authorization === 'Bearer a' ? 'user-a' : null; if (!subject) { const error = new Error('auth'); error.code = 'INVALID_AUTH_PRINCIPAL'; throw error; } return { subject, provider: 'supabase', isAnonymous: false }; } };
  return { repositories, api: createApi({ authVerifier, userResolver: { resolve: async (principal) => ({ id: principal.subject, status: 'active' }) }, birthProfileService: {}, secureReadingService: {}, purchaseService, requestIdGenerator: () => 'request' }) };
}
function verify(api, token) { return api.inject({ method: 'POST', url: '/v1/purchases/verify', headers: { authorization: token }, payload: { provider: 'GOOGLE', environment: 'PRODUCTION', productId: PRODUCT, evidence: { purchaseToken: 'opaque-token' } } }); }

test('Google verify persists authoritative active access, replays safely, and protects ownership', async () => {
  const { api, repositories } = setup(); const first = await verify(api, 'Bearer a'); assert.equal(first.statusCode, 200); assert.equal(first.json().entitlement.career.mode, 'SUBSCRIPTION'); assert.equal(JSON.stringify(first.json()).includes('opaque-token'), false); assert.equal(repositories.purchases.listForUser('user-a').length, 1); assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal((await verify(api, 'Bearer a')).statusCode, 200); assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  const conflict = await verify(api, 'Bearer b'); assert.equal(conflict.json().error.code, 'PURCHASE_OWNERSHIP_CONFLICT'); assert.equal(repositories.purchases.listForUser('user-b').length, 0); await api.close();
});

test('expired Google subscriptions do not grant subscription access', async () => {
  const { api } = setup({ state: 'SUBSCRIPTION_STATE_EXPIRED', started: '2026-07-01T00:00:00.000Z', expires: '2026-08-01T00:00:00.000Z' }); const response = await verify(api, 'Bearer a'); assert.equal(response.statusCode, 200); assert.equal(response.json().entitlement.career.mode, 'NONE'); await api.close();
});
