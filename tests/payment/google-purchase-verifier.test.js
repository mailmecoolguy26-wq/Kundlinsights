'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GooglePurchaseVerifier } = require('../../src/payment/google/google-purchase-verifier');

const NOW = '2026-09-02T00:00:00.000Z';
const FUTURE = '2027-09-02T00:00:00.000Z';
const PACKAGE = 'com.kundlinsights.test';
const PRODUCT = 'career.premium.annual';
function payload(overrides = {}) { return { packageName: PACKAGE, latestOrderId: 'GPA.1-2-3', startTime: NOW, subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', lineItems: [{ productId: PRODUCT, expiryTime: FUTURE }], ...overrides }; }
function verifier(response = payload()) { return new GooglePurchaseVerifier({ apiClient: { async getSubscription(input) { assert.deepEqual(input, { packageName: PACKAGE, purchaseToken: 'opaque-token' }); return response; } }, packageName: PACKAGE, googleProductId: PRODUCT, clock: () => Date.parse(NOW) }); }
function request(overrides = {}) { return { evidence: { purchaseToken: 'opaque-token' }, environment: 'PRODUCTION', productId: PRODUCT, ...overrides }; }

test('normalizes active, canceled-valid, expired, and grace Google authority states', async () => {
  for (const [source, status] of [['SUBSCRIPTION_STATE_ACTIVE', 'ACTIVE'], ['SUBSCRIPTION_STATE_CANCELED', 'CANCELED'], ['SUBSCRIPTION_STATE_EXPIRED', 'EXPIRED'], ['SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'GRACE_PERIOD']]) {
    const value = await verifier(payload({ subscriptionState: source })).verify(request());
    assert.equal(value.status, status); assert.equal(value.productId, 'career_premium_annual'); assert.equal(value.providerTransactionId, 'GPA.1-2-3'); assert.match(value.originalTransactionId, /^[0-9a-f]{64}$/); assert.equal(JSON.stringify(value).includes('opaque-token'), false);
  }
});

test('enforces package and product and rejects invalid authority failures', async () => {
  await assert.rejects(verifier(payload({ packageName: 'other' })).verify(request()), (error) => error.code === 'PURCHASE_EVIDENCE_INVALID');
  await assert.rejects(verifier(payload({ lineItems: [{ productId: 'other', expiryTime: FUTURE }] })).verify(request()), (error) => error.code === 'PURCHASE_PRODUCT_UNSUPPORTED');
  await assert.rejects(verifier().verify(request({ evidence: { purchaseToken: '' } })), (error) => error.code === 'PURCHASE_EVIDENCE_INVALID');
});
