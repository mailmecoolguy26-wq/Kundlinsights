'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');

function app() {
  const calls = [];
  const api = createApi({
    authVerifier: { async verifyRequest() { throw Object.assign(Error('auth'), { code: 'INVALID_AUTH_PRINCIPAL' }); } },
    userResolver: { async resolve() { return { id: 'u' }; } },
    birthProfileService: { async create() {}, async list() { return []; } },
    secureReadingService: {},
    appleNotificationService: { async handle() { calls.push('apple'); return { ok: true }; } },
    googleRtdnService: { async handle() { calls.push('google'); return { ok: true }; } },
    razorpayPaymentService: { async handleWebhook() { calls.push('razorpay'); return { ok: true }; }, async createOrder() {}, async verifyAndFinalize() {}, async getOrderStatus() {} },
  });
  return { api, calls };
}

test('only health and provider webhooks bypass app-user authentication', async () => {
  const { api, calls } = app();
  assert.equal((await api.inject('/health')).statusCode, 200);
  for (const [url, payload] of [['/v1/webhooks/apple', { signedPayload: 'x' }], ['/v1/webhooks/google', {}], ['/v1/payments/razorpay/webhook', '{}']]) assert.equal((await api.inject({ method: 'POST', url, payload, headers: { 'content-type': 'application/json' } })).statusCode, 200);
  assert.deepEqual(calls, ['apple', 'google', 'razorpay']);
  for (const request of [{ method: 'POST', url: '/v1/payments/razorpay/orders', payload: {} }, { method: 'POST', url: '/v1/payments/razorpay/verify', payload: {} }, { url: '/v1/payments/razorpay/orders/order_1' }, { url: '/v1/me' }]) assert.equal((await api.inject(request)).statusCode, 401);
  await api.close();
});
