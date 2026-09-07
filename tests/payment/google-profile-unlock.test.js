'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { GooglePurchaseVerifier } = require('../../src/payment/google/google-purchase-verifier');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../../src/payment/purchase-services');
const { ProfileUnlockAssignmentService } = require('../../src/payment/profile-unlock-assignment-service');
const { InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryEntitlementRepository, InMemoryProfileEntitlementRepository, InMemoryBirthProfileRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-04T00:00:00.000Z';
const PACKAGE = 'com.kundlinsights.test';
const PRODUCT = 'career.profile.unlock';

function profile(id, userId) { return { id, userId, displayLabel: id, birthData: { localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', utc: NOW, latitude: 0, longitude: 0, timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' } }, createdAt: NOW }; }
function setup() {
  const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository(), profileEntitlements: new InMemoryProfileEntitlementRepository(), birthProfiles: new InMemoryBirthProfileRepository() };
  for (const [id, user] of [['a', 'user-a'], ['b', 'user-a'], ['foreign', 'user-b']]) repositories.birthProfiles.createBirthProfile(profile(id, user));
  const calls = [];
  const apiClient = { async getProductPurchase(input) { calls.push(input); const token = input.purchaseToken; if (token === 'wrong-package') return { packageName: 'other', productId: PRODUCT, orderId: 'GPA.wrong-package', purchaseState: 0, purchaseTimeMillis: Date.parse(NOW) }; if (token === 'wrong-product') return { packageName: PACKAGE, productId: 'other', orderId: 'GPA.wrong-product', purchaseState: 0, purchaseTimeMillis: Date.parse(NOW) }; if (token === 'invalid-state') return { packageName: PACKAGE, productId: PRODUCT, orderId: 'GPA.invalid-state', purchaseState: 1, purchaseTimeMillis: Date.parse(NOW) }; return { packageName: PACKAGE, productId: PRODUCT, orderId: `GPA.${token}`, purchaseState: 0, acknowledgementState: 0, consumptionState: 0, purchaseTimeMillis: Date.parse(NOW) }; }, async getSubscription() { throw new Error('SUBSCRIPTIONS_V2_USED'); } };
  let ids = 0; const unitOfWork = new InMemoryPaymentUnitOfWork({ repositories: () => repositories });
  const service = new PurchaseVerificationService({ authUserResolver: async (principal) => ({ id: principal.id }), repositories: () => repositories, unitOfWork, registry: new PurchaseProviderRegistry({ GOOGLE: new GooglePurchaseVerifier({ apiClient, packageName: PACKAGE, googleProductId: 'career.annual', googleProfileUnlockProductId: PRODUCT }) }), careerAccessResolver: new CareerAccessResolver(), profileUnlockAssignmentService: new ProfileUnlockAssignmentService({ unitOfWork, idGenerator: () => `ent-${++ids}`, clock: () => NOW }), idGenerator: () => `purchase-${++ids}`, clock: () => NOW });
  return { repositories, calls, service };
}
function verify(service, userId, token, birthProfileId) { return service.verify({ principal: { id: userId }, body: { provider: 'GOOGLE', environment: 'PRODUCTION', productId: PRODUCT, birthProfileId, evidence: { purchaseToken: token } } }); }

test('Google one-time verification uses purchases.products.get and returns permanent profile access without a subscription', async () => {
  const { repositories, calls, service } = setup(); const result = await verify(service, 'user-a', 'p1', 'a');
  assert.deepEqual(calls, [{ packageName: PACKAGE, productId: PRODUCT, purchaseToken: 'p1' }]); assert.equal(result.purchase.provider, 'GOOGLE'); assert.equal(result.purchase.logicalProductSku, 'career_profile_unlock'); assert.equal(result.purchase.status, 'VERIFIED'); assert.equal(result.entitlement.career.mode, 'PROFILE_UNLOCK'); assert.equal(result.entitlement.career.consuming, false); assert.equal(repositories.subscriptions.listForUser('user-a').length, 0); assert.equal(repositories.profileEntitlements.records.size, 1); assert.equal(result.purchase.id, repositories.profileEntitlements.records.values().next().value.purchaseRecordId); assert.equal(JSON.stringify(repositories.profileEntitlements.records.values().next().value).includes('p1'), false);
});

test('Google one-time verifier rejects incorrect package, product, and purchase state', async () => {
  const { repositories, service } = setup();
  for (const token of ['wrong-package', 'wrong-product', 'invalid-state']) await assert.rejects(verify(service, 'user-a', token, 'a'));
  await assert.rejects(verify(service, 'user-a', 'p1'), { code: 'INVALID_BIRTH_PROFILE_ID' });
  await assert.rejects(verify(service, 'user-a', 'p2', 'foreign'), { code: 'NOT_FOUND_OR_FORBIDDEN' });
  assert.equal(repositories.purchases.records.size, 0);
});

test('Google one-time purchases are stable by order ID, profile-bound, repeat-purchasable, and atomic', async () => {
  const { repositories, service } = setup(); const first = await verify(service, 'user-a', 'p1', 'a'); const replay = await verify(service, 'user-a', 'p1', 'a');
  assert.equal(first.purchase.id, replay.purchase.id); await assert.rejects(verify(service, 'user-a', 'p1', 'b'), { code: 'PURCHASE_ALREADY_ASSIGNED' });
  await verify(service, 'user-a', 'p2', 'b'); assert.equal(repositories.profileEntitlements.records.size, 2);
  await assert.rejects(verify(service, 'user-a', 'p3', 'a'), { code: 'PROFILE_ALREADY_UNLOCKED' }); assert.equal(await repositories.purchases.findByProviderTransaction({ provider: 'GOOGLE', environment: 'PRODUCTION', providerTransactionId: 'GPA.p3' }), null);
  await assert.rejects(verify(service, 'user-b', 'p1', 'foreign'), { code: 'PURCHASE_OWNERSHIP_CONFLICT' });
});
