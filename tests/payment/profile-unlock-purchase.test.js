'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PurchaseVerificationService, PurchaseProviderRegistry, FakePurchaseProvider } = require('../../src/payment/purchase-services');
const { ProfileUnlockAssignmentService } = require('../../src/payment/profile-unlock-assignment-service');
const { InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryEntitlementRepository, InMemoryProfileEntitlementRepository, InMemoryBirthProfileRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-04T00:00:00.000Z';

function birthProfile(id, userId) {
  return { id, userId, displayLabel: id, birthData: { localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', utc: '2000-01-01T00:00:00.000Z', latitude: 0, longitude: 0, timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' } }, createdAt: NOW };
}

function setup() {
  const repositories = {
    purchases: new InMemoryPurchaseRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    entitlements: new InMemoryEntitlementRepository(),
    profileEntitlements: new InMemoryProfileEntitlementRepository(),
    birthProfiles: new InMemoryBirthProfileRepository(),
  };
  repositories.birthProfiles.createBirthProfile(birthProfile('profile-a', 'user-a'));
  repositories.birthProfiles.createBirthProfile(birthProfile('profile-b', 'user-a'));
  repositories.birthProfiles.createBirthProfile(birthProfile('profile-d', 'user-a'));
  repositories.birthProfiles.createBirthProfile(birthProfile('profile-c', 'user-b'));
  let sequence = 0;
  const unitOfWork = new InMemoryPaymentUnitOfWork({ repositories: () => repositories });
  const service = new PurchaseVerificationService({
    authUserResolver: async (principal) => ({ id: principal.id }),
    repositories: () => repositories,
    unitOfWork,
    registry: new PurchaseProviderRegistry({ APPLE: new FakePurchaseProvider({ enabled: true }) }),
    careerAccessResolver: new CareerAccessResolver(),
    profileUnlockAssignmentService: new ProfileUnlockAssignmentService({ unitOfWork, idGenerator: () => `entitlement-${++sequence}`, clock: () => NOW }),
    idGenerator: () => `purchase-${++sequence}`,
    clock: () => NOW,
  });
  return { repositories, service };
}

function unlockBody(transactionId, birthProfileId) {
  return { provider: 'APPLE', environment: 'SANDBOX', productId: 'career_profile_unlock', birthProfileId, evidence: { kind: 'FAKE_PURCHASE', transactionId, purchasedAt: NOW } };
}

test('verified profile unlock persists one purchase and one permanent profile entitlement without a subscription', async () => {
  const { repositories, service } = setup();
  const resolver = new CareerAccessResolver();
  let legacyResolverUsed = false;
  service.careerAccessResolver = { resolve: async () => { legacyResolverUsed = true; throw new Error('LEGACY_RESOLVER_USED'); }, resolveForProfile: (input) => resolver.resolveForProfile(input) };
  const result = await service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-a', 'profile-a') });

  assert.equal(result.purchase.status, 'VERIFIED');
  assert.equal(result.purchase.logicalProductSku, 'career_profile_unlock');
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 0);
  assert.equal(repositories.profileEntitlements.findForProfile({ userId: 'user-a', birthProfileId: 'profile-a', logicalSku: 'career_profile_unlock' }).purchaseRecordId, result.purchase.id);
  assert.deepEqual(result.entitlement.career, { eligible: true, mode: 'PROFILE_UNLOCK', consuming: false, validUntil: null });
  assert.equal('subscription' in result, false);
  assert.equal(JSON.stringify(repositories.profileEntitlements.findByPurchaseRecordId(result.purchase.id)).includes('FAKE_PURCHASE'), false);
  assert.equal(legacyResolverUsed, false);
});

test('profile unlock requires an owned birth profile before any purchase is persisted', async () => {
  const { repositories, service } = setup();
  await assert.rejects(service.verify({ principal: { id: 'user-a' }, body: unlockBody('missing-profile') }), { code: 'INVALID_BIRTH_PROFILE_ID' });
  await assert.rejects(service.verify({ principal: { id: 'user-a' }, body: unlockBody('foreign-profile', 'profile-c') }), { code: 'NOT_FOUND_OR_FORBIDDEN' });
  assert.equal(repositories.purchases.listForUser('user-a').length, 0);
  assert.equal(repositories.profileEntitlements.records.size, 0);
});

test('same purchase is idempotent for its profile and cannot unlock a second profile', async () => {
  const { repositories, service } = setup();
  const first = await service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-a', 'profile-a') });
  const replay = await service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-a', 'profile-a') });
  assert.equal(replay.purchase.id, first.purchase.id);
  assert.equal(replay.profileEntitlement.id, first.profileEntitlement.id);
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.profileEntitlements.records.size, 1);
  await assert.rejects(service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-a', 'profile-b') }), { code: 'PURCHASE_ALREADY_ASSIGNED' });
  assert.equal(repositories.profileEntitlements.findForProfile({ userId: 'user-a', birthProfileId: 'profile-b', logicalSku: 'career_profile_unlock' }), null);
});

test('different verified purchases unlock different profiles while a second purchase for an unlocked profile remains unassigned', async () => {
  const { repositories, service } = setup();
  await service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-a', 'profile-a') });
  await service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-b', 'profile-b') });
  assert.equal(repositories.profileEntitlements.records.size, 2);
  await assert.rejects(service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-c', 'profile-a') }), { code: 'PROFILE_ALREADY_UNLOCKED' });
  assert.equal(await repositories.purchases.findByProviderTransaction({ provider: 'APPLE', environment: 'SANDBOX', providerTransactionId: 'purchase-c' }), null);
  assert.equal(repositories.profileEntitlements.records.size, 2);
  const availablePurchase = await service.verify({ principal: { id: 'user-a' }, body: unlockBody('purchase-c', 'profile-d') });
  assert.equal(availablePurchase.entitlement.career.mode, 'PROFILE_UNLOCK');
});

test('purchase ownership, profile ownership, and assignment failures leave no partial profile-unlock state', async () => {
  const { repositories, service } = setup();
  await service.verify({ principal: { id: 'user-a' }, body: unlockBody('owned-purchase', 'profile-a') });
  await assert.rejects(service.verify({ principal: { id: 'user-b' }, body: unlockBody('owned-purchase', 'profile-c') }), { code: 'PURCHASE_OWNERSHIP_CONFLICT' });
  await assert.rejects(service.verify({ principal: { id: 'user-a' }, body: unlockBody('foreign-profile', 'profile-c') }), { code: 'NOT_FOUND_OR_FORBIDDEN' });
  repositories.profileEntitlements.create = () => { const error = new Error('assignment failure'); error.code = 'ASSIGNMENT_FAILED'; throw error; };
  await assert.rejects(service.verify({ principal: { id: 'user-a' }, body: unlockBody('failed-assignment', 'profile-b') }), { code: 'ASSIGNMENT_FAILED' });
  assert.equal(repositories.purchases.listForUser('user-b').length, 0);
  assert.equal(await repositories.purchases.findByProviderTransaction({ provider: 'APPLE', environment: 'SANDBOX', providerTransactionId: 'foreign-profile' }), null);
  assert.equal(await repositories.purchases.findByProviderTransaction({ provider: 'APPLE', environment: 'SANDBOX', providerTransactionId: 'failed-assignment' }), null);
  assert.equal(repositories.profileEntitlements.records.size, 1);
});

test('legacy annual subscription verification remains on its existing subscription path', async () => {
  const { repositories, service } = setup();
  const body = { provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', evidence: { kind: 'FAKE_PURCHASE', transactionId: 'annual-purchase', purchasedAt: NOW, validFrom: NOW, validUntil: '2027-09-04T00:00:00.000Z', status: 'ACTIVE' } };
  const result = await service.verify({ principal: { id: 'user-a' }, body });
  assert.equal(result.entitlement.career.mode, 'SUBSCRIPTION');
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(repositories.profileEntitlements.records.size, 0);
});
