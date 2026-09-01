'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { CareerAccessResolver } = require('../../src/application/readings');
const { InMemoryEntitlementRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const T0 = '2026-09-01T00:00:00.000Z'; const T1 = '2027-09-01T00:00:00.000Z';
function subscription(overrides = {}) { return { id: 'sub-a', userId: 'user-a', provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', originalTransactionId: 'orig-a', status: 'ACTIVE', validFrom: T0, validUntil: T1, createdAt: T0, ...overrides }; }
async function access(subscriptions = [], credit = false, at = '2026-10-01T00:00:00.000Z') { const entitlements = new InMemoryEntitlementRepository(); const repo = { entitlements, subscriptions: new InMemorySubscriptionRepository() }; for (const value of subscriptions) repo.subscriptions.upsertVerifiedState(value); if (credit) entitlements.createEntitlement({ id: 'credit-a', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: 2, validFrom: T0 }); return new CareerAccessResolver().resolve({ repositories: repo, userId: 'user-a', at }); }
test('Career access resolver applies subscription state, deterministic precedence, and credit fallback', async () => {
  assert.deepEqual(await access([subscription()], true), { eligible: true, mode: 'SUBSCRIPTION', consuming: false, sourceId: 'sub-a', validUntil: T1, remainingQuantity: null });
  assert.equal((await access([subscription({ status: 'GRACE_PERIOD', graceUntil: T1 })])).mode, 'SUBSCRIPTION');
  assert.equal((await access([subscription({ status: 'CANCELED' })])).mode, 'SUBSCRIPTION');
  for (const status of ['EXPIRED', 'REVOKED', 'REFUNDED']) assert.equal((await access([subscription({ status })], true)).mode, 'CREDIT');
  assert.equal((await access([subscription({ validFrom: T1, validUntil: '2028-09-01T00:00:00.000Z' })], true)).mode, 'CREDIT');
  assert.equal((await access([subscription({ productId: 'other' })], true)).mode, 'CREDIT');
  assert.equal((await access([subscription({ id: 'sub-b', originalTransactionId: 'orig-b', validUntil: '2028-09-01T00:00:00.000Z' }), subscription()])).sourceId, 'sub-b');
  assert.equal((await access()).mode, 'NONE');
});
