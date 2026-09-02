'use strict';

const crypto = require('node:crypto');
const { canonicalTime } = require('../../persistence/contracts');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function time(value) { if (typeof value !== 'string') fail('PURCHASE_EVIDENCE_INVALID'); try { return canonicalTime(value, 'PURCHASE_EVIDENCE_INVALID'); } catch { fail('PURCHASE_EVIDENCE_INVALID'); } }
function state(value) {
  switch (value) {
    case 'SUBSCRIPTION_STATE_ACTIVE': return 'ACTIVE';
    case 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD': return 'GRACE_PERIOD';
    case 'SUBSCRIPTION_STATE_CANCELED': return 'CANCELED';
    case 'SUBSCRIPTION_STATE_EXPIRED': return 'EXPIRED';
    default: fail('PURCHASE_EVIDENCE_INVALID');
  }
}
function productId(subscription) {
  const ids = (subscription.lineItems || []).map((line) => line.productId).filter(Boolean);
  return ids.length === 1 ? ids[0] : null;
}
function expiry(subscription) {
  const items = subscription.lineItems || [];
  const values = items.map((line) => line.expiryTime).filter((value) => typeof value === 'string');
  if (values.length !== 1) fail('PURCHASE_EVIDENCE_INVALID');
  return time(values[0]);
}

class GooglePurchaseVerifier {
  constructor({ apiClient, packageName, googleProductId, clock = () => Date.now() } = {}) {
    this.apiClient = apiClient;
    this.packageName = packageName;
    this.googleProductId = googleProductId;
    this.clock = clock;
  }

  async verify({ evidence, environment, productId: clientProductId } = {}) {
    if (!evidence || typeof evidence.purchaseToken !== 'string' || !evidence.purchaseToken) fail('PURCHASE_EVIDENCE_INVALID');
    if (!this.apiClient || !this.packageName || !this.googleProductId) fail('PURCHASE_PROVIDER_UNSUPPORTED');
    if (clientProductId && clientProductId !== this.googleProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (evidence.productId != null && evidence.productId !== this.googleProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    let verified;
    try { verified = await this.apiClient.getSubscription({ packageName: this.packageName, purchaseToken: evidence.purchaseToken }); }
    catch (error) { if (error && error.code === 'PURCHASE_PRODUCT_UNSUPPORTED') throw error; fail('PURCHASE_EVIDENCE_INVALID'); }
    if (!verified || verified.packageName !== this.packageName) fail('PURCHASE_EVIDENCE_INVALID');
    const verifiedProductId = productId(verified);
    if (verifiedProductId !== this.googleProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (!verified.latestOrderId || typeof verified.latestOrderId !== 'string') fail('PURCHASE_EVIDENCE_INVALID');
    const purchasedAt = time(verified.startTime);
    const validUntil = expiry(verified);
    const normalizedStatus = state(verified.subscriptionState);
    return {
      provider: 'GOOGLE', environment, productId: 'career_premium_annual', providerProductId: verifiedProductId,
      providerTransactionId: verified.latestOrderId,
      originalTransactionId: crypto.createHash('sha256').update(`google-play:${verified.linkedPurchaseToken || evidence.purchaseToken}`).digest('hex'),
      purchasedAt, validFrom: purchasedAt, validUntil, status: normalizedStatus,
      providerEventTime: validUntil,
    };
  }

  async restore() { fail('PURCHASE_PROVIDER_UNSUPPORTED'); }
}

module.exports = { GooglePurchaseVerifier };
