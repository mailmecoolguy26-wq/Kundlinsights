'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryPaymentEventRepository } = require('../../src/persistence/in-memory');
const { AppleNotificationService } = require('../../src/payment/apple/apple-notification-service');

const NOW = '2026-09-01T00:00:00.000Z';

function normalized(eventType = 'SUBSCRIBED', providerEventId = 'event-1') {
  return {
    provider: 'APPLE', environment: 'SANDBOX', providerEventId, eventType,
    providerEventTime: NOW, transaction: { providerTransactionId: 'transaction-1' },
    renewal: { originalTransactionId: 'original-1' },
  };
}

function setup({ failure = null } = {}) {
  const events = new InMemoryPaymentEventRepository();
  const verifier = {
    async verifyAndNormalizeNotification({ signedPayload }) {
      if (failure && signedPayload === failure.payload) {
        const error = new Error(failure.code);
        error.code = failure.code;
        throw error;
      }
      return normalized(signedPayload === 'unknown' ? 'UNKNOWN' : signedPayload, signedPayload === 'unknown' ? 'future-event' : 'event-1');
    },
  };
  let serial = 0;
  return { events, service: new AppleNotificationService({ notificationVerifier: verifier, paymentEvents: events, idGenerator: () => `event-record-${++serial}`, clock: () => NOW }) };
}

test('persists verified known Apple notification types as immutable, raw-payload-free events', async () => {
  for (const eventType of ['SUBSCRIBED', 'DID_RENEW', 'EXPIRED', 'REFUND', 'REVOKE']) {
    const { events, service } = setup();
    const result = await service.handle({ signedPayload: eventType });
    const stored = events.findByProviderEventId({ provider: 'APPLE', environment: 'SANDBOX', providerEventId: 'event-1' });
    assert.deepEqual(result, { received: true, duplicate: false });
    assert.equal(stored.processingStatus, 'PROCESSED');
    assert.equal(stored.provider, 'APPLE');
    assert.equal(stored.environment, 'SANDBOX');
    assert.equal(stored.providerEventId, 'event-1');
    assert.equal(stored.eventType, eventType);
    assert.equal(stored.providerEventTime, NOW);
    assert.equal(stored.purchaseRecordId, null);
    assert.equal(stored.subscriptionRecordId, null);
    assert.equal(JSON.stringify(stored).includes(eventType), true);
    assert.equal(JSON.stringify(stored).includes('signedPayload'), false);
  }
});

test('handles replay and concurrent duplicate delivery with one durable payment-event identity', async () => {
  const { events, service } = setup();
  assert.deepEqual(await service.handle({ signedPayload: 'SUBSCRIBED' }), { received: true, duplicate: false });
  assert.deepEqual(await service.handle({ signedPayload: 'SUBSCRIBED' }), { received: true, duplicate: true });
  const responses = await Promise.all([service.handle({ signedPayload: 'DID_RENEW' }), service.handle({ signedPayload: 'DID_RENEW' })]);
  assert.equal(responses.every((response) => response.received), true);
  assert.equal(events.records.size, 1);
});

test('rejects unverified evidence before persistence and persists unknown verified notifications safely', async () => {
  for (const failure of [
    { payload: 'invalid', code: 'APPLE_NOTIFICATION_VERIFICATION_FAILED' },
    { payload: 'wrong-bundle', code: 'PURCHASE_EVIDENCE_INVALID' },
    { payload: 'wrong-product', code: 'PURCHASE_PRODUCT_UNSUPPORTED' },
    { payload: 'wrong-environment', code: 'APPLE_NOTIFICATION_EVIDENCE_INVALID' },
  ]) {
    const { events, service } = setup({ failure });
    await assert.rejects(service.handle({ signedPayload: failure.payload }), (error) => error.code === 'INVALID_APPLE_NOTIFICATION');
    assert.equal(events.records.size, 0);
  }
  const { events, service } = setup();
  await service.handle({ signedPayload: 'unknown' });
  assert.equal(events.findByProviderEventId({ provider: 'APPLE', environment: 'SANDBOX', providerEventId: 'future-event' }).eventType, 'UNKNOWN');
});

test('marks a received audit event failed if post-insert processing fails', async () => {
  const { events, service } = setup();
  const original = events.markProcessed.bind(events);
  events.markProcessed = () => { throw Object.assign(new Error('write failure'), { code: 'UPDATE_PAYMENT_EVENT_FAILED' }); };
  await assert.rejects(service.handle({ signedPayload: 'SUBSCRIBED' }), (error) => error.code === 'UPDATE_PAYMENT_EVENT_FAILED');
  events.markProcessed = original;
  assert.equal(events.findByProviderEventId({ provider: 'APPLE', environment: 'SANDBOX', providerEventId: 'event-1' }).processingStatus, 'FAILED');
});
