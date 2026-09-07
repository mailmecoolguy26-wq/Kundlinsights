'use strict';
const { repositoryError } = require('../../persistence/contracts');
function fail(code) { throw repositoryError(code); }
class RazorpayApiClient {
  constructor({ keyId, keySecret, baseUrl = 'https://api.razorpay.com/v1', fetchImpl = globalThis.fetch } = {}) { if (!keyId || !keySecret || typeof fetchImpl !== 'function') fail('INVALID_RAZORPAY_CONFIGURATION'); this.keyId = keyId; this.keySecret = keySecret; this.baseUrl = baseUrl.replace(/\/$/, ''); this.fetch = fetchImpl; }
  async _request(path, options = {}) { const response = await this.fetch(`${this.baseUrl}${path}`, { ...options, headers: { authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`, 'content-type': 'application/json', ...(options.headers || {}) } }); let body = null; try { body = await response.json(); } catch {} if (!response.ok) fail('RAZORPAY_API_REQUEST_FAILED'); return body; }
  createOrder({ amount, currency, receipt }) { return this._request('/orders', { method: 'POST', body: JSON.stringify({ amount, currency, receipt }) }); }
  fetchPayment(paymentId) { return this._request(`/payments/${encodeURIComponent(paymentId)}`); }
  fetchPaymentsForOrder(orderId) { return this._request(`/orders/${encodeURIComponent(orderId)}/payments`); }
}
module.exports = { RazorpayApiClient };
