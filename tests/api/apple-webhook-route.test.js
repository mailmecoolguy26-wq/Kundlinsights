'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { AppleNotificationService } = require('../../src/payment/apple/apple-notification-service');
const { AppleSubscriptionLifecycleReconciler } = require('../../src/payment/apple/apple-subscription-lifecycle-reconciler');
const { InMemoryPaymentEventRepository, InMemoryPurchaseRepository, InMemorySubscriptionRepository, InMemoryEntitlementRepository } = require('../../src/persistence');
const { InMemoryPaymentUnitOfWork } = require('../../src/payment/unit-of-work');

function app({ notificationError = null } = {}) {
  let authCalls = 0;
  const events = [];
  const api = createApi({
    authVerifier: { async verifyRequest() { authCalls += 1; return { subject: 'user' }; } },
    userResolver: { resolve: async () => ({}) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: {},
    appleNotificationService: {
      async handle({ signedPayload }) {
        if (notificationError) { const error = new Error(notificationError); error.code = notificationError; throw error; }
        if (typeof signedPayload !== 'string' || !signedPayload) { const error = new Error('INVALID_APPLE_NOTIFICATION'); error.code = 'INVALID_APPLE_NOTIFICATION'; throw error; }
        const duplicate = events.includes(signedPayload);
        if (!duplicate) events.push(signedPayload);
        return { received: true, duplicate };
      },
    },
    requestIdGenerator: () => 'request-1',
  });
  return { api, events, authCalls: () => authCalls };
}

test('Apple webhook accepts only signed payload handling without user authentication and acknowledges duplicates safely', async () => {
  const { api, events, authCalls } = app();
  const first = await api.inject({ method: 'POST', url: '/v1/webhooks/apple', payload: { signedPayload: 'opaque-jws', notificationType: 'untrusted' } });
  const replay = await api.inject({ method: 'POST', url: '/v1/webhooks/apple', payload: { signedPayload: 'opaque-jws' } });
  const missing = await api.inject({ method: 'POST', url: '/v1/webhooks/apple', payload: {} });
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.json(), { received: true, duplicate: false });
  assert.equal(replay.statusCode, 200);
  assert.deepEqual(replay.json(), { received: true, duplicate: true });
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().error.code, 'INVALID_APPLE_NOTIFICATION');
  assert.equal(authCalls(), 0);
  assert.deepEqual(events, ['opaque-jws']);
  assert.equal(JSON.stringify(first.json()).includes('opaque-jws'), false);
  await api.close();
});

test('Apple webhook returns safe rejection for invalid signed evidence', async () => {
  const { api } = app({ notificationError: 'INVALID_APPLE_NOTIFICATION' });
  const response = await api.inject({ method: 'POST', url: '/v1/webhooks/apple', payload: { signedPayload: 'opaque-jws' } });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json().error, { code: 'INVALID_APPLE_NOTIFICATION', message: 'INVALID_APPLE_NOTIFICATION' });
  await api.close();
});

test('Apple webhook applies verified lifecycle events to an established subscription without user auth', async () => {
  const now = '2026-09-01T00:00:00.000Z';
  const repositories = { purchases: new InMemoryPurchaseRepository(), subscriptions: new InMemorySubscriptionRepository(), entitlements: new InMemoryEntitlementRepository() };
  repositories.subscriptions.upsertVerifiedState({ id: 'subscription-a', userId: 'user-a', provider: 'APPLE', environment: 'SANDBOX', productId: 'career_premium_annual', originalTransactionId: 'original-a', status: 'ACTIVE', validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z', providerEventTime: '2026-08-01T00:00:00.000Z', createdAt: now });
  let sequence = 0;
  const notification = (eventType, eventSubtype = null) => ({ provider: 'APPLE', environment: 'SANDBOX', providerEventId: `event-${eventType}-${eventSubtype || 'none'}`, eventType, eventSubtype, providerEventTime: '2026-09-02T00:00:00.000Z', originalTransactionId: 'original-a', transaction: { providerTransactionId: `transaction-${eventType}`, originalTransactionId: 'original-a', purchasedAt: '2026-01-01T00:00:00.000Z', validUntil: '2028-01-01T00:00:00.000Z' }, renewal: { originalTransactionId: 'original-a', autoRenewStatus: eventSubtype === 'AUTO_RENEW_DISABLED' ? 0 : null, gracePeriodExpiresAt: null } });
  const values = { renew: notification('DID_RENEW'), cancel: notification('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'), expired: notification('EXPIRED'), refund: notification('REFUND') };
  const appleNotificationService = new AppleNotificationService({ notificationVerifier: { async verifyAndNormalizeNotification({ signedPayload }) { return values[signedPayload]; } }, paymentEvents: new InMemoryPaymentEventRepository(), lifecycleReconciler: new AppleSubscriptionLifecycleReconciler({ repositories: () => repositories, unitOfWork: new InMemoryPaymentUnitOfWork({ repositories: () => repositories }), idGenerator: () => `id-${++sequence}`, clock: () => now }), idGenerator: () => `event-${++sequence}`, clock: () => now });
  const api = createApi({ authVerifier: { async verifyRequest() { throw Error('must not authenticate webhook'); } }, userResolver: { resolve: async () => ({}) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, secureReadingService: {}, appleNotificationService });
  for (const [payload, status] of [['renew', 'ACTIVE'], ['cancel', 'CANCELED'], ['expired', 'EXPIRED'], ['refund', 'REFUNDED']]) {
    const response = await api.inject({ method: 'POST', url: '/v1/webhooks/apple', payload: { signedPayload: payload } });
    assert.equal(response.statusCode, 200);
    assert.equal(repositories.subscriptions.listForUser('user-a')[0].status, status);
  }
  const duplicate = await api.inject({ method: 'POST', url: '/v1/webhooks/apple', payload: { signedPayload: 'refund' } });
  assert.equal(duplicate.json().duplicate, true);
  await api.close();
});
