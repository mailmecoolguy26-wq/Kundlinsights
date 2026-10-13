'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { GoogleSubscriptionLifecycleReconciler, normalizeGoogleSubscription, hashToken } = require('../../src/payment/google/google-subscription-lifecycle-reconciler');
const { InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');
const NOW = '2026-09-01T00:00:00.000Z', START = '2026-01-01T00:00:00.000Z', FUTURE = '2027-01-01T00:00:00.000Z';
function authoritative(state, expiry = FUTURE, linkedPurchaseToken = undefined, providerProductId = 'career.google') { return { packageName: 'com.kundli.test', latestOrderId: `order-${state}`, startTime: START, subscriptionState: state, ...(linkedPurchaseToken ? { linkedPurchaseToken } : {}), lineItems: [{ productId: providerProductId, expiryTime: expiry }] }; }
function setup() { const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository() }; const original = hashToken('token'); repositories.subscriptions.upsertVerifiedState({ id: 'sub', userId: 'user-a', birthProfileId: 'profile-a', provider: 'GOOGLE', environment: 'PRODUCTION', productId: 'career_premium_annual', originalTransactionId: original, status: 'ACTIVE', validFrom: START, validUntil: FUTURE, providerEventTime: NOW, createdAt: START }); const reconciler = new GoogleSubscriptionLifecycleReconciler({ repositories: () => repositories, unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }), idGenerator: () => 'id', clock: () => NOW }); return { repositories, reconciler }; }
function normalized(state, expiry = FUTURE, eventTime = '2026-09-02T00:00:00.000Z') { return normalizeGoogleSubscription({ subscription: authoritative(state, expiry), packageName: 'com.kundli.test', googleProductId: 'career.google', purchaseToken: 'token', eventTime }); }
test('normalizes active, grace, canceled, and conservative non-entitling states', () => {
  assert.equal(normalized('SUBSCRIPTION_STATE_ACTIVE').status, 'ACTIVE'); assert.equal(normalized('SUBSCRIPTION_STATE_IN_GRACE_PERIOD').status, 'GRACE_PERIOD'); assert.equal(normalized('SUBSCRIPTION_STATE_CANCELED').status, 'CANCELED'); assert.equal(normalized('SUBSCRIPTION_STATE_ON_HOLD').status, 'EXPIRED'); assert.equal(normalized('SUBSCRIPTION_STATE_PAUSED').status, 'EXPIRED');
});
test('reconciles known lineage, retains credit, and does not regress stale state', async () => {
  const { repositories, reconciler } = setup(); repositories.entitlements.createEntitlement({ id: 'credit', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: 1, validFrom: START });
  await reconciler.reconcile(normalized('SUBSCRIPTION_STATE_ACTIVE', '2028-01-01T00:00:00.000Z'));
  assert.equal(repositories.subscriptions.listForUser('user-a')[0].validUntil, '2028-01-01T00:00:00.000Z');
  await reconciler.reconcile(normalized('SUBSCRIPTION_STATE_IN_GRACE_PERIOD'));
  assert.equal(repositories.subscriptions.listForUser('user-a')[0].status, 'GRACE_PERIOD');
  await reconciler.reconcile(normalized('SUBSCRIPTION_STATE_EXPIRED', '2026-02-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'));
  assert.equal(repositories.subscriptions.listForUser('user-a')[0].status, 'GRACE_PERIOD');
  assert.equal((await new CareerAccessResolver().resolveForProfile({ repositories: { ...repositories, birthProfiles: { getBirthProfile: () => ({ userId: 'user-a' }) } }, userId: 'user-a', birthProfileId: 'profile-a', at: NOW })).mode, 'SUBSCRIPTION'); assert.equal(repositories.entitlements.getEntitlement('credit').quantity, 1);
});
test('unknown lineage never creates a user or subscription', async () => { const { repositories, reconciler } = setup(); const result = await reconciler.reconcile(normalizeGoogleSubscription({ subscription: authoritative('SUBSCRIPTION_STATE_ACTIVE'), packageName: 'com.kundli.test', googleProductId: 'career.google', purchaseToken: 'unknown', eventTime: NOW })); assert.equal(result.reconciled, false); assert.equal(repositories.subscriptions.records.size, 1); });
test('Google renewal plan change persists the exact provider SKU and shared entitlement', async () => {
  const { repositories, reconciler } = setup();
  const switched = normalizeGoogleSubscription({
    subscription: authoritative('SUBSCRIPTION_STATE_ACTIVE', '2028-01-01T00:00:00.000Z', undefined, 'career.google.12month'),
    packageName: 'com.kundli.test', googleProductIds: ['career.google.6month', 'career.google.12month'],
    productMapper: (providerProductId) => providerProductId === 'career.google.12month' ? 'career_premium_12_month' : 'career_premium_6_month',
    purchaseToken: 'token', eventTime: '2026-09-02T00:00:00.000Z',
  });
  await reconciler.reconcile(switched);
  const subscription = repositories.subscriptions.listForUser('user-a')[0];
  assert.equal(subscription.productId, 'career_premium_12_month');
  assert.equal(subscription.providerProductId, 'career.google.12month');
  assert.equal(subscription.entitlementKey, 'CAREER_PREMIUM');
});
