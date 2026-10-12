'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemorySubscriptionRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { CareerAccessResolver } = require('../../src/application/readings');

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-07-01T00:00:00.000Z';
const T2 = '2027-07-01T00:00:00.000Z';
const T3 = '2028-07-01T00:00:00.000Z';

function state(overrides = {}) {
  return {
    id: 'subscription-1', userId: 'user-1', birthProfileId: 'profile-a', provider: 'APPLE', environment: 'PRODUCTION',
    productId: 'career_premium_6_month', providerProductId: 'com.taraverse.career.premium.6month',
    entitlementKey: 'CAREER_PREMIUM', originalTransactionId: 'original-1', status: 'ACTIVE',
    validFrom: T0, validUntil: T1, providerEventTime: T0, createdAt: T0, updatedAt: T0,
    ...overrides,
  };
}

test('subscription metadata persists exact provider SKU at initial purchase and survives renewal and restore', () => {
  const subscriptions = new InMemorySubscriptionRepository();
  const initial = subscriptions.upsertVerifiedState(state());
  assert.equal(initial.providerProductId, 'com.taraverse.career.premium.6month');
  assert.equal(initial.entitlementKey, 'CAREER_PREMIUM');

  const renewal = subscriptions.upsertVerifiedState(state({ id: 'renewal-attempt', providerProductId: null, entitlementKey: null, validUntil: T2, providerEventTime: T1, updatedAt: T1 }));
  assert.equal(renewal.id, initial.id);
  assert.equal(renewal.providerProductId, 'com.taraverse.career.premium.6month');
  assert.equal(renewal.entitlementKey, 'CAREER_PREMIUM');

  const restored = subscriptions.upsertVerifiedState(state({ id: 'restore-attempt', providerProductId: null, entitlementKey: null, validUntil: T2, providerEventTime: T2, updatedAt: T2 }));
  assert.equal(restored.id, initial.id);
  assert.equal(restored.providerProductId, 'com.taraverse.career.premium.6month');
  assert.equal(restored.entitlementKey, 'CAREER_PREMIUM');
});

test('plan switch updates provider SKU while retaining normalized Career Premium entitlement', () => {
  const subscriptions = new InMemorySubscriptionRepository();
  subscriptions.upsertVerifiedState(state());
  const switched = subscriptions.upsertVerifiedState(state({
    id: 'switch-attempt', productId: 'career_premium_12_month',
    providerProductId: 'com.taraverse.career.premium.12month', validUntil: T3,
    providerEventTime: T1, updatedAt: T1,
  }));
  assert.equal(switched.productId, 'career_premium_12_month');
  assert.equal(switched.providerProductId, 'com.taraverse.career.premium.12month');
  assert.equal(switched.entitlementKey, 'CAREER_PREMIUM');
});

test('a subscription cannot be transferred to another birth profile', () => {
  const subscriptions = new InMemorySubscriptionRepository();
  subscriptions.upsertVerifiedState(state());
  assert.throws(
    () => subscriptions.upsertVerifiedState(state({ id: 'transfer-attempt', birthProfileId: 'profile-b', providerEventTime: T1, updatedAt: T1 })),
    (error) => error && error.code === 'SUBSCRIPTION_PROFILE_IMMUTABLE',
  );
});

test('legacy unlinked subscription rows do not create profile-wide access', async () => {
  const subscriptions = new InMemorySubscriptionRepository();
  subscriptions.upsertVerifiedState(state({
    productId: 'career_premium_annual', birthProfileId: null, providerProductId: null, entitlementKey: null,
  }));
  const access = await new CareerAccessResolver().resolveForProfile({
    repositories: { subscriptions, entitlements: new InMemoryEntitlementRepository(), birthProfiles: { getBirthProfile: () => ({ userId: 'user-1' }) } },
    userId: 'user-1', birthProfileId: 'profile-a', at: '2026-03-01T00:00:00.000Z',
  });
  assert.equal(access.eligible, false);
  assert.equal(access.mode, 'NONE');
});
