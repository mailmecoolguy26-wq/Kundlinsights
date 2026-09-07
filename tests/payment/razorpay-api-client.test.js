'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RazorpayApiClient } = require('../../src/payment/razorpay/razorpay-api-client');

function client({ status = 200, body = { entity: 'collection', items: [] } } = {}) {
  let request;
  const api = new RazorpayApiClient({
    keyId: 'test-key-id',
    keySecret: 'test-key-secret',
    baseUrl: 'https://razorpay.example/v1',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    },
  });
  return { api, request: () => request };
}

test('fetches a Razorpay order payment collection with encoded order ID and Basic auth', async () => {
  const expected = { entity: 'collection', count: 1, items: [{ id: 'pay_1' }] };
  const harness = client({ body: expected });

  const result = await harness.api.fetchPaymentsForOrder('order/with space');

  assert.deepEqual(result, expected);
  assert.equal(
    harness.request().url,
    'https://razorpay.example/v1/orders/order%2Fwith%20space/payments',
  );
  assert.equal(harness.request().options.method, undefined);
  assert.equal(
    harness.request().options.headers.authorization,
    `Basic ${Buffer.from('test-key-id:test-key-secret').toString('base64')}`,
  );
});

test('maps non-success Razorpay collection responses to the existing safe error', async () => {
  const harness = client({ status: 500, body: { error: { description: 'ignored' } } });

  await assert.rejects(
    harness.api.fetchPaymentsForOrder('order_1'),
    (error) => error.code === 'RAZORPAY_API_REQUEST_FAILED',
  );
});
