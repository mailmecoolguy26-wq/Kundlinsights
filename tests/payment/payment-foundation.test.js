'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryPaymentEventRepository } = require('../../src/persistence');
const { getProduct, getProductByProviderProductId, SubscriptionStatus } = require('../../src/payment');

const T0 = '2026-09-01T00:00:00.000Z';
const T1 = '2027-09-01T00:00:00.000Z';
function purchase(overrides = {}) { return { id: 'purchase-1', userId: 'user-a', provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', providerTransactionId: 'transaction-1', originalTransactionId: 'original-1', status: 'VERIFIED', purchasedAt: T0, validFrom: T0, validUntil: T1, verifiedAt: T0, paymentTransactionId: null, createdAt: T0, ...overrides }; }
function subscription(overrides = {}) { return { id: 'subscription-1', userId: 'user-a', provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', originalTransactionId: 'original-1', status: 'ACTIVE', validFrom: T0, validUntil: T1, latestPurchaseRecordId: 'purchase-1', createdAt: T0, ...overrides }; }
function event(overrides = {}) { return { id: 'event-1', provider: 'APPLE', environment: 'SANDBOX', providerEventId: 'event-provider-1', eventType: 'DID_RENEW', receivedAt: T0, createdAt: T0, ...overrides }; }

test('payment foundation repositories provide idempotency, durable ownership, and lifecycle primitives', () => {
  const purchases = new InMemoryPurchaseRepository();
  assert.equal(purchases.insert(purchase()).id, 'purchase-1');
  assert.equal(purchases.insert(purchase({ id: 'retry-id' })).id, 'purchase-1');
  assert.equal(purchases.findByProviderTransaction(purchase()).id, 'purchase-1');
  assert.deepEqual(purchases.listForUser('user-a').map((value) => value.id), ['purchase-1']);
  assert.throws(() => purchases.insert(purchase({ id: 'purchase-other', userId: 'user-b' })), (error) => error.code === 'PURCHASE_OWNERSHIP_CONFLICT');

  const subscriptions = new InMemorySubscriptionRepository();
  assert.equal(subscriptions.upsertVerifiedState(subscription()).status, 'ACTIVE');
  assert.equal(subscriptions.findUsableCandidatesForUser('user-a', '2026-10-01T00:00:00.000Z').length, 1);
  assert.equal(subscriptions.upsertVerifiedState(subscription({ status: 'CANCELED', providerEventTime: '2026-12-01T00:00:00.000Z' })).status, 'CANCELED');
  assert.equal(subscriptions.findUsableCandidatesForUser('user-a', '2027-01-01T00:00:00.000Z').length, 1);
  assert.equal(subscriptions.upsertVerifiedState(subscription({ status: 'EXPIRED', providerEventTime: '2026-11-01T00:00:00.000Z' })).status, 'CANCELED');
  assert.throws(() => subscriptions.upsertVerifiedState(subscription({ id: 'subscription-other', userId: 'user-b' })), (error) => error.code === 'PURCHASE_OWNERSHIP_CONFLICT');

  const events = new InMemoryPaymentEventRepository();
  assert.equal(events.insertReceived(event()).processingStatus, 'RECEIVED');
  assert.equal(events.insertReceived(event({ id: 'event-retry' })).id, 'event-1');
  assert.equal(events.markProcessed('event-1', T0).processingStatus, 'PROCESSED');
  assert.equal(events.markFailed('event-1', { processedAt: T0, failureCode: 'RETRYABLE' }).processingStatus, 'FAILED');
});

test('Career Premium catalog remains logical and has no invented provider mapping', () => {
  assert.equal(getProduct('career_premium_annual').displayPrice, '₹599/year');
  assert.equal(getProductByProviderProductId('APPLE', 'not-configured'), null);
  assert.throws(() => getProduct('unknown'), (error) => error.code === 'UNKNOWN_PRODUCT_SKU');
  assert.deepEqual(SubscriptionStatus, ['ACTIVE', 'GRACE_PERIOD', 'CANCELED', 'EXPIRED', 'REVOKED', 'REFUNDED']);
});
