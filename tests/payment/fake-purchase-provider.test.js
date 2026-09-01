'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FakePurchaseProvider } = require('../../src/payment/purchase-services');
const { getProduct } = require('../../src/payment');
const T0 = '2026-01-01T00:00:00.000Z'; const T1 = '2027-01-01T00:00:00.000Z';
function request(status = 'ACTIVE', overrides = {}) { return { provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', evidence: { kind: 'FAKE_PURCHASE', transactionId: 'synthetic-tx-1', originalTransactionId: 'synthetic-original-1', status, purchasedAt: T0, validFrom: T0, validUntil: T1, ...overrides } }; }
test('fake provider normalizes all supported synthetic lifecycle states deterministically', async () => {
  const provider = new FakePurchaseProvider({ enabled: true });
  for (const status of ['ACTIVE', 'EXPIRED', 'CANCELED', 'REFUNDED', 'REVOKED']) {
    const normalized = await provider.verify(request(status));
    assert.equal(normalized.status, status);
    assert.equal(normalized.providerTransactionId, 'synthetic-tx-1');
  }
  assert.deepEqual(await provider.verify(request()), await provider.verify(request()));
});
test('fake provider rejects invalid evidence and is disabled for production registration', async () => {
  const provider = new FakePurchaseProvider({ enabled: true });
  await assert.rejects(provider.verify({ provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', evidence: {} }), (error) => error.code === 'PURCHASE_EVIDENCE_INVALID');
  await assert.rejects(new FakePurchaseProvider({ enabled: false }).verify(request()), (error) => error.code === 'PURCHASE_PROVIDER_UNSUPPORTED');
  assert.throws(() => getProduct('unsupported-product'), (error) => error.code === 'UNKNOWN_PRODUCT_SKU');
});
