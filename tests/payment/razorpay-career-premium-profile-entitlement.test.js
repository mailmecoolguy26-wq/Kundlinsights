'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { RazorpayPaymentService } = require('../../src/payment/razorpay/razorpay-payment-service');
const { createRazorpayProductCatalog } = require('../../src/payment/razorpay/razorpay-product-catalog');
const { PurchaseVerificationService, PurchaseProviderRegistry } = require('../../src/payment/purchase-services');
const { InMemoryBirthProfileRepository, InMemoryEntitlementRepository, InMemoryProfileEntitlementRepository, InMemoryProviderPaymentOrderRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-09-08T00:00:00.000Z';
const SECRET = 'synthetic-test-secret';

function birthProfile(id, userId) {
  return { id, userId, displayLabel: id, birthData: { localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', utc: NOW, latitude: 0, longitude: 0, timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' } }, createdAt: NOW };
}

function setup() {
  const repositories = {
    purchases: new InMemoryPurchaseRepository(),
    subscriptions: new InMemorySubscriptionRepository(),
    entitlements: new InMemoryEntitlementRepository(),
    profileEntitlements: new InMemoryProfileEntitlementRepository(),
    birthProfiles: new InMemoryBirthProfileRepository(),
    providerPaymentOrders: new InMemoryProviderPaymentOrderRepository(),
  };
  repositories.birthProfiles.createBirthProfile(birthProfile('profile-a', 'user-a'));
  let sequence = 0;
  const idGenerator = () => `id-${++sequence}`;
  const unitOfWork = new InMemoryPaymentUnitOfWork({ repositories: () => repositories });
  const purchaseService = new PurchaseVerificationService({
    authUserResolver: async (principal) => ({ id: principal.id }),
    repositories: () => repositories,
    unitOfWork,
    registry: new PurchaseProviderRegistry(),
    careerAccessResolver: new CareerAccessResolver(),
    idGenerator,
    clock: () => NOW,
  });
  let providerOrderSequence = 0;
  const service = new RazorpayPaymentService({
    authUserResolver: async (principal) => ({ id: principal.id }),
    birthProfileRepository: repositories.birthProfiles,
    providerOrders: repositories.providerPaymentOrders,
    razorpayClient: { async createOrder() { return { id: `order-${++providerOrderSequence}` }; }, async fetchPayment(paymentId) { return { id: paymentId, order_id: paymentId.replace(/^pay-/, 'order-'), amount: 58882, currency: 'INR', status: 'captured' }; }, async fetchPaymentsForOrder() { return { items: [] }; } },
    productCatalog: createRazorpayProductCatalog([{ logicalSku: 'career_premium_annual', amountMinor: 58882, currency: 'INR' }]),
    purchaseService,
    unitOfWork,
    idGenerator,
    clock: () => NOW,
    keyId: 'rzp_test_key',
    keySecret: SECRET,
    webhookSecret: SECRET,
  });
  return { repositories, service };
}

function signature(orderId, paymentId) {
  return crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

async function finalize(service) {
  const order = await service.createOrder({ principal: { id: 'user-a' }, logicalSku: 'career_premium_annual', birthProfileId: 'profile-a' });
  const paymentId = order.orderId.replace(/^order-/, 'pay-');
  return service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId, signature: signature(order.orderId, paymentId) });
}

async function seedHistoricalFinalizedOrder(repositories, service) {
  const order = await service.createOrder({ principal: { id: 'user-a' }, logicalSku: 'career_premium_annual', birthProfileId: 'profile-a' });
  const stored = repositories.providerPaymentOrders.findByProviderOrderId({ provider: 'RAZORPAY', providerOrderId: order.orderId });
  repositories.purchases.insert({ id: 'legacy-purchase', userId: 'user-a', provider: 'RAZORPAY', environment: 'SANDBOX', productId: 'career_premium_annual', providerTransactionId: 'legacy-payment', originalTransactionId: 'legacy-payment', status: 'VERIFIED', purchasedAt: NOW, validFrom: NOW, validUntil: '2027-09-08T00:00:00.000Z', verifiedAt: NOW, createdAt: NOW });
  repositories.subscriptions.upsertVerifiedState({ id: 'legacy-subscription', userId: 'user-a', provider: 'RAZORPAY', environment: 'SANDBOX', productId: 'career_premium_annual', originalTransactionId: 'legacy-payment', status: 'ACTIVE', validFrom: NOW, validUntil: '2027-09-08T00:00:00.000Z', latestPurchaseRecordId: 'legacy-purchase', providerEventTime: NOW, createdAt: NOW });
  repositories.providerPaymentOrders.markPaid(stored.id, { providerPaymentId: 'legacy-payment', updatedAt: NOW });
  repositories.providerPaymentOrders.markFinalized(stored.id, { purchaseRecordId: 'legacy-purchase', updatedAt: NOW });
  return order;
}

test('Razorpay annual finalization atomically persists purchase, subscription, and profile entitlement', async () => {
  const { repositories, service } = setup();
  const result = await finalize(service);

  assert.equal(result.finalized, true);
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  const entitlement = repositories.profileEntitlements.findForProfile({ userId: 'user-a', birthProfileId: 'profile-a', logicalSku: 'career_profile_unlock' });
  assert.ok(entitlement);
  assert.equal(entitlement.purchaseRecordId, result.purchaseRecordId);
  assert.equal(entitlement.birthProfileId, 'profile-a');
  assert.equal(repositories.providerPaymentOrders.findByProviderOrderId({ provider: 'RAZORPAY', providerOrderId: 'order-1' }).status, 'FINALIZED');
});

test('Razorpay annual finalization rolls back purchase, subscription, and entitlement together on assignment failure', async () => {
  const { repositories, service } = setup();
  repositories.profileEntitlements.create = () => { const error = new Error('synthetic assignment failure'); error.code = 'ASSIGNMENT_FAILED'; throw error; };
  const order = await service.createOrder({ principal: { id: 'user-a' }, logicalSku: 'career_premium_annual', birthProfileId: 'profile-a' });

  await assert.rejects(
    service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId: 'pay-1', signature: signature(order.orderId, 'pay-1') }),
    { code: 'ASSIGNMENT_FAILED' },
  );

  assert.equal(repositories.purchases.listForUser('user-a').length, 0);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 0);
  assert.equal(repositories.profileEntitlements.records.size, 0);
  assert.equal(repositories.providerPaymentOrders.findByProviderOrderId({ provider: 'RAZORPAY', providerOrderId: order.orderId }).status, 'CREATED');
});

test('Razorpay annual finalization is idempotent and remains profile-bound', async () => {
  const { repositories, service } = setup();
  const first = await finalize(service);
  const replay = await service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: 'order-1', paymentId: 'pay-1', signature: signature('order-1', 'pay-1') });

  assert.equal(replay.purchaseRecordId, first.purchaseRecordId);
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(repositories.profileEntitlements.records.size, 1);
  await assert.rejects(service.createOrder({ principal: { id: 'user-a' }, logicalSku: 'career_premium_annual' }), { code: 'INVALID_BIRTH_PROFILE_ID' });
});

test('a second Razorpay annual purchase cannot create a duplicate entitlement for an already unlocked profile', async () => {
  const { repositories, service } = setup();
  await finalize(service);
  const order = await service.createOrder({ principal: { id: 'user-a' }, logicalSku: 'career_premium_annual', birthProfileId: 'profile-a' });
  const paymentId = order.orderId.replace(/^order-/, 'pay-');

  await assert.rejects(
    service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId, signature: signature(order.orderId, paymentId) }),
    { code: 'PROFILE_ALREADY_UNLOCKED' },
  );

  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(repositories.profileEntitlements.records.size, 1);
  assert.equal(repositories.providerPaymentOrders.findByProviderOrderId({ provider: 'RAZORPAY', providerOrderId: order.orderId }).status, 'CREATED');
});

test('recovery repairs only the missing entitlement for a historical finalized Razorpay annual order', async () => {
  const { repositories, service } = setup();
  const order = await seedHistoricalFinalizedOrder(repositories, service);

  const result = await service.getOrderStatus({ principal: { id: 'user-a' }, orderId: order.orderId });
  const entitlement = repositories.profileEntitlements.findForProfile({ userId: 'user-a', birthProfileId: 'profile-a', logicalSku: 'career_profile_unlock' });

  assert.deepEqual(result, { orderId: order.orderId, status: 'FINALIZED', finalized: true, logicalSku: 'career_premium_annual' });
  assert.ok(entitlement);
  assert.equal(entitlement.purchaseRecordId, 'legacy-purchase');
  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(repositories.providerPaymentOrders.findByProviderOrderId({ provider: 'RAZORPAY', providerOrderId: order.orderId }).status, 'FINALIZED');
});

test('repeated finalized-order recovery is idempotent when the profile entitlement already exists', async () => {
  const { repositories, service } = setup();
  const order = await seedHistoricalFinalizedOrder(repositories, service);

  await service.getOrderStatus({ principal: { id: 'user-a' }, orderId: order.orderId });
  await service.getOrderStatus({ principal: { id: 'user-a' }, orderId: order.orderId });

  assert.equal(repositories.purchases.listForUser('user-a').length, 1);
  assert.equal(repositories.subscriptions.listForUser('user-a').length, 1);
  assert.equal(repositories.profileEntitlements.records.size, 1);
});
