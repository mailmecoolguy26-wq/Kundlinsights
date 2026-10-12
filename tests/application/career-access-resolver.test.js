'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerAccessResolver } = require('../../src/application/readings');
const { InMemoryEntitlementRepository, InMemorySubscriptionRepository, InMemoryBirthProfileRepository, InMemoryProfileEntitlementRepository } = require('../../src/persistence');
const { CAREER_PROFILE_UNLOCK_SKU } = require('../../src/payment');

const T0 = '2026-09-01T00:00:00.000Z';
const T1 = '2027-09-01T00:00:00.000Z';
const at = '2026-10-01T00:00:00.000Z';
const birthData = { localDate: '1990-01-01', localTime: '00:00:00', timezone: 'UTC', utc: T0, latitude: 0, longitude: 0, timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' } };

function subscription(overrides = {}) {
  return { id: 'sub-a', userId: 'user-a', birthProfileId: 'profile-a', provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_6_month', providerProductId: 'apple.6month', entitlementKey: 'CAREER_PREMIUM', originalTransactionId: 'orig-a', status: 'ACTIVE', validFrom: T0, validUntil: T1, createdAt: T0, ...overrides };
}

function repositories(values = [], credit = false) {
  const entitlements = new InMemoryEntitlementRepository();
  const birthProfiles = new InMemoryBirthProfileRepository();
  birthProfiles.createBirthProfile({ id: 'profile-a', userId: 'user-a', birthData, createdAt: T0 });
  birthProfiles.createBirthProfile({ id: 'profile-b', userId: 'user-a', birthData, createdAt: T0 });
  const subscriptions = new InMemorySubscriptionRepository();
  for (const value of values) subscriptions.upsertVerifiedState(value);
  if (credit) entitlements.createEntitlement({ id: 'credit-a', userId: 'user-a', productKey: 'CAREER', status: 'active', quantity: 2, validFrom: T0 });
  return { entitlements, birthProfiles, subscriptions, profileEntitlements: new InMemoryProfileEntitlementRepository() };
}

test('a subscription is usable only for its linked owned profile', async () => {
  const repo = repositories([subscription()], true);
  const resolver = new CareerAccessResolver();
  const a = await resolver.resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-a', at });
  assert.equal(a.mode, 'SUBSCRIPTION');
  assert.equal(a.birthProfileId, 'profile-a');
  const b = await resolver.resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-b', at });
  assert.equal(b.mode, 'CREDIT');
  assert.equal(b.consuming, true);
});

test('both plans grant the same entitlement only to their linked profile', async () => {
  for (const productId of ['career_premium_6_month', 'career_premium_12_month']) {
    const repo = repositories([subscription({ productId })]);
    const resolver = new CareerAccessResolver();
    assert.equal((await resolver.resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-a', at })).eligible, true);
    assert.equal((await resolver.resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-b', at })).eligible, false);
  }
});

test('legacy unlinked subscriptions do not become account-wide access', async () => {
  const repo = repositories([subscription({ productId: 'career_premium_annual', birthProfileId: null, providerProductId: null, entitlementKey: null })]);
  const value = await new CareerAccessResolver().resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-a', at });
  assert.equal(value.eligible, false);
  assert.equal(value.mode, 'NONE');
});

test('legacy profile unlock remains profile-scoped', async () => {
  const repo = repositories();
  repo.profileEntitlements.create({ id: 'unlock-a', userId: 'user-a', birthProfileId: 'profile-a', logicalSku: CAREER_PROFILE_UNLOCK_SKU, purchaseRecordId: 'purchase-a', unlockedAt: T0, createdAt: T0 });
  const resolver = new CareerAccessResolver();
  assert.equal((await resolver.resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-a', at })).mode, 'LEGACY_PROFILE_UNLOCK');
  assert.equal((await resolver.resolveForProfile({ repositories: repo, userId: 'user-a', birthProfileId: 'profile-b', at })).eligible, false);
});
