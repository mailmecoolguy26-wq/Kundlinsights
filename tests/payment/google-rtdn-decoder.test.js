'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeGoogleRtdn } = require('../../src/payment/google/google-rtdn-decoder');
const packageName = 'com.kundli.test';
function envelope(payload, messageId = 'message-1') { return { message: { messageId, data: Buffer.from(JSON.stringify(payload)).toString('base64') } }; }
function subscription(overrides = {}) { return { version: '1.0', packageName, eventTimeMillis: '1788307200000', subscriptionNotification: { version: '1.0', notificationType: 2, purchaseToken: 'sensitive-token' }, ...overrides }; }
test('decodes a subscription RTDN and keeps provider evidence internal', () => {
  const decoded = decodeGoogleRtdn({ envelope: envelope(subscription()), packageName });
  assert.equal(decoded.providerEventId, 'message-1'); assert.equal(decoded.notificationType, 2); assert.equal(decoded.purchaseToken, 'sensitive-token');
  assert.deepEqual(Object.keys(decoded).filter((key) => key !== 'purchaseToken').includes('purchaseToken'), false);
});
test('recognizes test and unsupported notification families safely', () => {
  assert.equal(decodeGoogleRtdn({ envelope: envelope({ version: '1.0', packageName, eventTimeMillis: '1788307200000', testNotification: { version: '1.0' } }), packageName }).kind, 'TEST');
  assert.equal(decodeGoogleRtdn({ envelope: envelope({ version: '1.0', packageName, eventTimeMillis: '1788307200000', oneTimeProductNotification: {} }), packageName }).kind, 'IGNORED');
});
test('rejects malformed envelope data, message identity, and package mismatch', () => {
  assert.throws(() => decodeGoogleRtdn({ envelope: { message: { messageId: 'x', data: 'not-base64!' } }, packageName }), { code: 'INVALID_GOOGLE_RTDN' });
  assert.throws(() => decodeGoogleRtdn({ envelope: envelope(subscription(), ''), packageName }), { code: 'INVALID_GOOGLE_RTDN' });
  assert.throws(() => decodeGoogleRtdn({ envelope: envelope(subscription({ packageName: 'other' })), packageName }), { code: 'INVALID_GOOGLE_RTDN' });
});
