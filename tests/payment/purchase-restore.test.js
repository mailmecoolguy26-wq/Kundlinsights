'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PurchaseVerificationService, PurchaseProviderRegistry, FakePurchaseProvider } = require('../../src/payment/purchase-services');
const { InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const T = '2026-01-01T00:00:00.000Z';
const U = '2027-01-01T00:00:00.000Z';
function setup() { const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository() }; let sequence = 0; return { repositories, service: new PurchaseVerificationService({ authUserResolver: async (principal) => ({ id: principal.id }), repositories: () => repositories, unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }), registry: new PurchaseProviderRegistry({ APPLE: new FakePurchaseProvider({ enabled: true }) }), careerAccessResolver: new CareerAccessResolver(), idGenerator: () => `id-${++sequence}`, clock: () => T }) }; }
function verifyBody(id, birthProfileId) { return { provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_6_month', birthProfileId, evidence: { kind: 'FAKE_PURCHASE', transactionId: id, originalTransactionId: id, status: 'ACTIVE', purchasedAt: T, validFrom: T, validUntil: U } }; }
function restoreBody(id) { return { provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_6_month', evidence: { items: [{ kind: 'FAKE_PURCHASE', transactionId: id, originalTransactionId: id, status: 'ACTIVE', purchasedAt: T, validFrom: T, validUntil: U }] } }; }

test('restore retains an existing subscription profile association', async () => {
  const { repositories, service } = setup();
  await service.verify({ principal: { id: 'user-a' }, body: verifyBody('owned', 'profile-a') });
  await service.restore({ principal: { id: 'user-a' }, body: restoreBody('owned') });
  assert.equal(repositories.subscriptions.listForUser('user-a')[0].birthProfileId, 'profile-a');
});

test('restore never assigns an unknown lineage to the active profile', async () => {
  const { service } = setup();
  await assert.rejects(service.restore({ principal: { id: 'user-a' }, body: restoreBody('unknown') }), (error) => error.code === 'SUBSCRIPTION_PROFILE_RECONCILIATION_REQUIRED');
});
