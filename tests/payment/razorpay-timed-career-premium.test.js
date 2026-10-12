'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { RazorpayPaymentService } = require('../../src/payment/razorpay/razorpay-payment-service');
const { createCareerPremiumRazorpayProductCatalog } = require('../../src/payment/razorpay/razorpay-product-catalog');
const { PurchaseVerificationService, PurchaseProviderRegistry } = require('../../src/payment/purchase-services');
const { InMemoryBirthProfileRepository, InMemoryEntitlementRepository, InMemoryProfileEntitlementRepository, InMemoryProviderPaymentOrderRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');
const { CareerAccessResolver } = require('../../src/application/readings');

const NOW = '2026-10-12T00:00:00.000Z';
const SECRET = 'test-secret';
const SIX = 'career_premium_razorpay_6_month';
const TWELVE = 'career_premium_razorpay_12_month';

function profile(id, userId) { return { id, userId, displayLabel: id, birthData: { localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', utc: NOW, latitude: 0, longitude: 0, timezoneProvenance: { provider: 'test', datasetVersion: 'test', datasetChecksum: 'test' } }, createdAt: NOW }; }
function signature(orderId, paymentId) { return crypto.createHmac('sha256', SECRET).update(`${orderId}|${paymentId}`).digest('hex'); }
function setup() {
  const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository(), profileEntitlements: new InMemoryProfileEntitlementRepository(), birthProfiles: new InMemoryBirthProfileRepository(), providerPaymentOrders: new InMemoryProviderPaymentOrderRepository() };
  for (const id of ['a', 'b', 'c']) repositories.birthProfiles.createBirthProfile(profile(`profile-${id}`, 'user-a'));
  repositories.birthProfiles.createBirthProfile(profile('profile-foreign', 'user-b'));
  let sequence = 0; const idGenerator = () => `id-${++sequence}`;
  const unitOfWork = new InMemoryPaymentUnitOfWork({ repositories: () => repositories });
  const purchaseService = new PurchaseVerificationService({ authUserResolver: async (principal) => ({ id: principal.id }), repositories: () => repositories, unitOfWork, registry: new PurchaseProviderRegistry(), careerAccessResolver: new CareerAccessResolver(), idGenerator, clock: () => NOW });
  const amounts = new Map();
  const service = new RazorpayPaymentService({
    authUserResolver: async (principal) => ({ id: principal.id }), birthProfileRepository: repositories.birthProfiles, providerOrders: repositories.providerPaymentOrders,
    razorpayClient: { async createOrder({ amount }) { const id = `order-${++sequence}`; amounts.set(id, amount); return { id }; }, async fetchPayment(paymentId) { const orderId = paymentId.replace('pay-', 'order-'); return { id: paymentId, order_id: orderId, amount: amounts.get(orderId), currency: 'INR', status: 'captured' }; }, async fetchPaymentsForOrder() { return { items: [] }; } },
    productCatalog: createCareerPremiumRazorpayProductCatalog([]), purchaseService, unitOfWork, idGenerator, clock: () => NOW, keyId: 'rzp_test', keySecret: SECRET, webhookSecret: SECRET,
  });
  return { repositories, service };
}
async function pay(service, birthProfileId, logicalSku) {
  const order = await service.createOrder({ principal: { id: 'user-a' }, birthProfileId, logicalSku });
  const paymentId = order.orderId.replace('order-', 'pay-');
  return service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId, signature: signature(order.orderId, paymentId) });
}

test('server-owned Razorpay plans create isolated 6/12 month profile entitlements', async () => {
  const { service, repositories } = setup();
  const six = await service.createOrder({ principal: { id: 'user-a' }, birthProfileId: 'profile-a', logicalSku: SIX });
  const twelve = await service.createOrder({ principal: { id: 'user-a' }, birthProfileId: 'profile-b', logicalSku: TWELVE });
  assert.equal(six.amountMinor, 39900); assert.equal(twelve.amountMinor, 69900);
  await pay(service, 'profile-a', SIX); await pay(service, 'profile-b', TWELVE);
  const rows = repositories.subscriptions.listForUser('user-a');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => [row.birthProfileId, row.entitlementSource, row.autoRenewEnabled]).sort(), [['profile-a', 'RAZORPAY_TIMED_PURCHASE', false], ['profile-b', 'RAZORPAY_TIMED_PURCHASE', false]]);
  assert.match(rows.find((row) => row.birthProfileId === 'profile-a').validUntil, /^2027-04-12/);
  assert.match(rows.find((row) => row.birthProfileId === 'profile-b').validUntil, /^2027-10-12/);
});

test('Razorpay rejects foreign profiles, invalid signatures, and client amount changes', async () => {
  const { service } = setup();
  await assert.rejects(service.createOrder({ principal: { id: 'user-a' }, birthProfileId: 'profile-foreign', logicalSku: SIX }), (error) => error.code === 'BIRTH_PROFILE_ACCESS_DENIED');
  const order = await service.createOrder({ principal: { id: 'user-a' }, birthProfileId: 'profile-a', logicalSku: SIX, amountMinor: 1 });
  assert.equal(order.amountMinor, 39900);
  await assert.rejects(service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId: order.orderId.replace('order-', 'pay-'), signature: 'bad' }), (error) => error.code === 'RAZORPAY_SIGNATURE_INVALID');
});

test('unresolved Razorpay recovery is constrained to the exact current timed plan and profile', async () => {
  const { service, repositories } = setup();
  repositories.providerPaymentOrders.create({ id: 'legacy-order', userId: 'user-a', birthProfileId: 'profile-a', provider: 'RAZORPAY', logicalSku: 'career_premium_annual', providerOrderId: 'legacy-499', amountMinor: 58882, currency: 'INR', createdAt: NOW });
  repositories.providerPaymentOrders.create({ id: 'twelve-order', userId: 'user-a', birthProfileId: 'profile-a', provider: 'RAZORPAY', logicalSku: TWELVE, providerOrderId: 'twelve-699', amountMinor: 69900, currency: 'INR', createdAt: NOW });
  assert.equal(await service.getLatestUnresolvedForProfile({ principal: { id: 'user-a' }, birthProfileId: 'profile-a', logicalSku: SIX }), null);
  assert.equal(await service.getLatestUnresolvedForProfile({ principal: { id: 'user-a' }, birthProfileId: 'profile-b', logicalSku: TWELVE }), null);
  assert.deepEqual(await service.getLatestUnresolvedForProfile({ principal: { id: 'user-a' }, birthProfileId: 'profile-a', logicalSku: TWELVE }), { providerOrderId: 'twelve-699', status: 'CREATED', logicalSku: TWELVE, amountMinor: 69900, currency: 'INR', finalized: false });
});

test('Razorpay verification is idempotent and extends the same profile from its current valid-until', async () => {
  const { service, repositories } = setup();
  const order = await service.createOrder({ principal: { id: 'user-a' }, birthProfileId: 'profile-c', logicalSku: SIX });
  const paymentId = order.orderId.replace('order-', 'pay-');
  await service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId, signature: signature(order.orderId, paymentId) });
  await service.verifyAndFinalize({ principal: { id: 'user-a' }, orderId: order.orderId, paymentId, signature: signature(order.orderId, paymentId) });
  await pay(service, 'profile-c', SIX);
  const rows = repositories.subscriptions.listForUser('user-a');
  assert.equal(repositories.purchases.listForUser('user-a').length, 2);
  assert.equal(rows.length, 2);
  assert.match([...rows].sort((a, b) => Date.parse(b.validUntil) - Date.parse(a.validUntil))[0].validUntil, /^2027-10-12/);
});
