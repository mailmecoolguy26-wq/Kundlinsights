'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../../src/payment/purchase-services');
const { InMemoryBirthProfileRepository, InMemoryEntitlementRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-01-01T00:00:00.000Z';

function birthProfile(id, userId) {
  return {
    id,
    userId,
    displayLabel: id,
    birthData: {
      localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC',
      utc: NOW, latitude: 0, longitude: 0,
      timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' },
    },
    createdAt: NOW,
  };
}

function setup() {
  const repositories = {
    purchases: new InMemoryPurchaseRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    entitlements: new InMemoryEntitlementRepository(),
    birthProfiles: new InMemoryBirthProfileRepository(),
  };
  for (const [id, userId] of [['a', 'user-a'], ['b', 'user-a'], ['c', 'user-a'], ['d', 'user-a'], ['foreign', 'user-b']]) {
    repositories.birthProfiles.createBirthProfile(birthProfile(id, userId));
  }
  let ids = 0;
  const registry = new PurchaseProviderRegistry({
    GOOGLE: {
      async verify({ productId, evidence }) {
        const months = productId === 'career_premium_addon_6_month' ? 6 : 12;
        return {
          provider: 'GOOGLE', environment: 'PRODUCTION', productId,
          providerProductId: productId === 'career_premium_addon_6_month'
            ? 'com.taraverse.career.addon.6month'
            : 'com.taraverse.career.addon.12month',
          providerTransactionId: `GPA.${evidence.purchaseToken}`,
          originalTransactionId: `token:${evidence.purchaseToken}`,
          purchasedAt: NOW, validFrom: NOW,
          validUntil: new Date(Date.UTC(2026, months, 1)).toISOString(),
          status: 'ACTIVE', providerEventTime: NOW,
        };
      },
    },
  });
  const service = new PurchaseVerificationService({
    authUserResolver: async (principal) => ({ id: principal.id }),
    repositories: () => repositories,
    unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }),
    registry,
    careerAccessResolver: new CareerAccessResolver(),
    idGenerator: () => `id-${++ids}`,
    clock: () => NOW,
  });
  return { repositories, service };
}

function verify(service, { profileId, productId, token, userId = 'user-a' }) {
  return service.verify({
    principal: { id: userId },
    body: {
      provider: 'GOOGLE', environment: 'PRODUCTION', productId,
      birthProfileId: profileId, evidence: { purchaseToken: token },
    },
  });
}

test('Google timed add-ons are replay-safe, profile-scoped, and extend only the linked profile', async () => {
  const { repositories, service } = setup();
  const six = 'career_premium_addon_6_month';
  const twelve = 'career_premium_addon_12_month';

  const b = await verify(service, { profileId: 'b', productId: six, token: 'b-6' });
  const replay = await verify(service, { profileId: 'b', productId: six, token: 'b-6' });
  const c = await verify(service, { profileId: 'c', productId: six, token: 'c-6' });
  const d = await verify(service, { profileId: 'd', productId: twelve, token: 'd-12' });

  assert.equal(b.entitlement.career.eligible, true);
  assert.equal(b.subscription.entitlementSource, 'ADDON_PURCHASE');
  assert.equal(replay.purchase.id, b.purchase.id);
  assert.equal(repositories.purchases.listForUser('user-a').length, 3);
  const records = repositories.subscriptions.listForUser('user-a');
  assert.deepEqual(records.map((record) => record.birthProfileId).sort(), ['b', 'c', 'd']);
  assert.equal(records.find((record) => record.birthProfileId === 'b').validUntil, '2026-07-01T00:00:00.000Z');
  assert.equal(records.find((record) => record.birthProfileId === 'd').validUntil, '2027-01-01T00:00:00.000Z');
  await assert.rejects(
    verify(service, { profileId: 'foreign', productId: six, token: 'foreign-6' }),
    { code: 'NOT_FOUND_OR_FORBIDDEN' },
  );
});
