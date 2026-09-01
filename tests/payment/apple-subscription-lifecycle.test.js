'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AppleNotificationService } = require('../../src/payment/apple/apple-notification-service');
const { AppleSubscriptionLifecycleReconciler } = require('../../src/payment/apple/apple-subscription-lifecycle-reconciler');
const { InMemoryPaymentEventRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-01T00:00:00.000Z';
const START = '2026-01-01T00:00:00.000Z';
const FUTURE = '2027-01-01T00:00:00.000Z';

function event(type, overrides = {}) {
  return JSON.stringify({
    provider: 'APPLE', environment: 'SANDBOX', providerEventId: `event-${type}`, eventType: type,
    eventSubtype: null, providerEventTime: '2026-09-02T00:00:00.000Z', originalTransactionId: 'original-a',
    transaction: { providerTransactionId: `transaction-${type}`, originalTransactionId: 'original-a', purchasedAt: START, validUntil: FUTURE },
    renewal: { originalTransactionId: 'original-a', autoRenewStatus: null, gracePeriodExpiresAt: null },
    ...overrides,
  });
}

function setup({ withLineage = true } = {}) {
  const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository() };
  if (withLineage) repositories.subscriptions.upsertVerifiedState({ id: 'subscription-a', userId: 'user-a', provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', originalTransactionId: 'original-a', status: 'ACTIVE', validFrom: START, validUntil: FUTURE, providerEventTime: '2026-09-01T00:00:00.000Z', createdAt: START });
  const events = new InMemoryPaymentEventRepository();
  let sequence = 0;
  const lifecycleReconciler = new AppleSubscriptionLifecycleReconciler({ repositories: () => repositories, unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }), idGenerator: () => `id-${++sequence}`, clock: () => NOW });
  const service = new AppleNotificationService({ notificationVerifier: { async verifyAndNormalizeNotification({ signedPayload }) { return JSON.parse(signedPayload); } }, paymentEvents: events, lifecycleReconciler, idGenerator: () => `event-${++sequence}`, clock: () => NOW });
  return { repositories, events, service };
}

function subscription(repositories) { return repositories.subscriptions.listForUser('user-a')[0]; }
async function access(repositories) { return new CareerAccessResolver().resolve({ repositories, userId: 'user-a', at: NOW }); }

test('reconciles subscribed, renewal, grace, cancellation, and auto-renew-enabled lifecycle states', async () => {
  const { repositories, service } = setup();
  await service.handle({ signedPayload: event('SUBSCRIBED') });
  assert.equal(subscription(repositories).status, 'ACTIVE');
  await service.handle({ signedPayload: event('DID_RENEW', { providerEventId: 'renew', transaction: { providerTransactionId: 'renew-transaction', originalTransactionId: 'original-a', purchasedAt: START, validUntil: '2028-01-01T00:00:00.000Z' } }) });
  assert.equal(subscription(repositories).validUntil, '2028-01-01T00:00:00.000Z');
  assert.equal((await access(repositories)).mode, 'SUBSCRIPTION');
  await service.handle({ signedPayload: event('DID_FAIL_TO_RENEW', { providerEventId: 'grace', eventSubtype: 'GRACE_PERIOD', renewal: { originalTransactionId: 'original-a', autoRenewStatus: 0, gracePeriodExpiresAt: '2028-02-01T00:00:00.000Z' } }) });
  assert.equal(subscription(repositories).status, 'GRACE_PERIOD');
  assert.equal((await access(repositories)).mode, 'SUBSCRIPTION');
  await service.handle({ signedPayload: event('DID_CHANGE_RENEWAL_STATUS', { providerEventId: 'disabled', eventSubtype: 'AUTO_RENEW_DISABLED', renewal: { originalTransactionId: 'original-a', autoRenewStatus: 0, gracePeriodExpiresAt: null } }) });
  assert.equal(subscription(repositories).status, 'CANCELED');
  assert.equal((await access(repositories)).mode, 'SUBSCRIPTION');
  await service.handle({ signedPayload: event('DID_CHANGE_RENEWAL_STATUS', { providerEventId: 'enabled', eventSubtype: 'AUTO_RENEW_ENABLED', renewal: { originalTransactionId: 'original-a', autoRenewStatus: 1, gracePeriodExpiresAt: null } }) });
  assert.equal(subscription(repositories).status, 'ACTIVE');
});

test('reconciles terminal states, preserves credit fallback, and does not consume it', async () => {
  for (const [type, status] of [['EXPIRED', 'EXPIRED'], ['GRACE_PERIOD_EXPIRED', 'EXPIRED'], ['REFUND', 'REFUNDED'], ['REVOKE', 'REVOKED']]) {
    const { repositories, service } = setup();
    repositories.entitlements.createEntitlement({ id: 'credit-a', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: 1, validFrom: START });
    await service.handle({ signedPayload: event(type) });
    assert.equal(subscription(repositories).status, status);
    assert.equal((await access(repositories)).mode, 'CREDIT');
    assert.equal(repositories.entitlements.getEntitlement('credit-a').quantity, 1);
  }
});

test('extends validity without regression, ignores stale lifecycle events, and is event-idempotent', async () => {
  const { repositories, events, service } = setup();
  await service.handle({ signedPayload: event('RENEWAL_EXTENDED', { providerEventId: 'extension', providerEventTime: '2026-10-01T00:00:00.000Z', transaction: { providerTransactionId: 'extended', originalTransactionId: 'original-a', purchasedAt: START, validUntil: '2028-01-01T00:00:00.000Z' } }) });
  await service.handle({ signedPayload: event('EXPIRED', { providerEventId: 'old-expired', providerEventTime: '2026-09-01T00:00:00.000Z', transaction: { providerTransactionId: 'old', originalTransactionId: 'original-a', purchasedAt: START, validUntil: '2026-02-01T00:00:00.000Z' } }) });
  assert.equal(subscription(repositories).status, 'ACTIVE');
  assert.equal(subscription(repositories).validUntil, '2028-01-01T00:00:00.000Z');
  await service.handle({ signedPayload: event('DID_RENEW', { providerEventId: 'duplicate', providerEventTime: '2026-11-01T00:00:00.000Z', transaction: { providerTransactionId: 'same', originalTransactionId: 'original-a', purchasedAt: START, validUntil: '2029-01-01T00:00:00.000Z' } }) });
  await service.handle({ signedPayload: event('DID_RENEW', { providerEventId: 'duplicate', transaction: { providerTransactionId: 'same', originalTransactionId: 'original-a', purchasedAt: START, validUntil: '2030-01-01T00:00:00.000Z' } }) });
  assert.equal(events.records.size, 3);
  assert.equal(subscription(repositories).validUntil, '2029-01-01T00:00:00.000Z');
});

test('does not create ownership for unknown or unknown-type events and records lifecycle failures', async () => {
  const unknownLineage = setup({ withLineage: false });
  await unknownLineage.service.handle({ signedPayload: event('DID_RENEW') });
  assert.equal(unknownLineage.repositories.subscriptions.records.size, 0);
  const known = setup();
  await known.service.handle({ signedPayload: event('UNKNOWN', { providerEventId: 'future' }) });
  assert.equal(subscription(known.repositories).status, 'ACTIVE');
  known.repositories.subscriptions.upsertVerifiedState = () => { throw Object.assign(new Error('failure'), { code: 'LIFECYCLE_WRITE_FAILED' }); };
  await assert.rejects(known.service.handle({ signedPayload: event('REFUND', { providerEventId: 'failure' }) }), (error) => error.code === 'LIFECYCLE_WRITE_FAILED');
  assert.equal(known.events.findByProviderEventId({ provider: 'APPLE', environment: 'SANDBOX', providerEventId: 'failure' }).processingStatus, 'FAILED');
});
