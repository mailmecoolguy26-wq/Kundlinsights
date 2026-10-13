'use strict';

const crypto = require('node:crypto');
const { canonicalTime } = require('../../persistence/contracts');
const { CAREER_PREMIUM_6_MONTH_SKU, CAREER_PREMIUM_12_MONTH_SKU, CAREER_PREMIUM_ADDON_6_MONTH_SKU, CAREER_PREMIUM_ADDON_12_MONTH_SKU, LEGACY_CAREER_PREMIUM_ANNUAL_SKU } = require('..');

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
  constructor({ apiClient, packageName, googleProductId, googlePremium6MonthProductId, googlePremium12MonthProductId, googlePremiumAddOn6MonthProductId, googlePremiumAddOn12MonthProductId, googleProfileUnlockProductId = null, clock = () => Date.now() } = {}) {
    this.apiClient = apiClient;
    this.packageName = packageName;
    this.googleProductId = googleProductId;
    this.googleProfileUnlockProductId = googleProfileUnlockProductId;
    this.plans = new Map([[googlePremium6MonthProductId, CAREER_PREMIUM_6_MONTH_SKU], [googlePremium12MonthProductId, CAREER_PREMIUM_12_MONTH_SKU], [googleProductId, LEGACY_CAREER_PREMIUM_ANNUAL_SKU]].filter(([id]) => typeof id === 'string' && id));
    this.addOns = new Map([[googlePremiumAddOn6MonthProductId, CAREER_PREMIUM_ADDON_6_MONTH_SKU], [googlePremiumAddOn12MonthProductId, CAREER_PREMIUM_ADDON_12_MONTH_SKU]].filter(([id]) => typeof id === 'string' && id));
    this.clock = clock;
  }

  async verify({ evidence, environment, productId: clientProductId } = {}) {
    if (!evidence || typeof evidence.purchaseToken !== 'string' || !evidence.purchaseToken) fail('PURCHASE_EVIDENCE_INVALID');
    if (!this.apiClient || !this.packageName || (!this.plans.size && !this.addOns.size && !this.googleProfileUnlockProductId)) fail('PURCHASE_PROVIDER_UNSUPPORTED');
    const requestedProductId = clientProductId || evidence.productId;
    if (!this.plans.has(requestedProductId) && !this.addOns.has(requestedProductId) && requestedProductId !== this.googleProfileUnlockProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (evidence.productId != null && evidence.productId !== requestedProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (requestedProductId === this.googleProfileUnlockProductId) return this._verifyProfileUnlock({ evidence, environment, productId: requestedProductId });
    if (this.addOns.has(requestedProductId)) return this._verifyTimedAddOn({ evidence, environment, productId: requestedProductId });
    let verified;
    try { verified = await this.apiClient.getSubscription({ packageName: this.packageName, purchaseToken: evidence.purchaseToken }); }
    catch (error) { if (error && error.code === 'PURCHASE_PRODUCT_UNSUPPORTED') throw error; fail('PURCHASE_EVIDENCE_INVALID'); }
    if (!verified || verified.packageName !== this.packageName) fail('PURCHASE_EVIDENCE_INVALID');
    const verifiedProductId = productId(verified);
    const plan = this.plans.get(verifiedProductId); if (!plan || verifiedProductId !== requestedProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (!verified.latestOrderId || typeof verified.latestOrderId !== 'string') fail('PURCHASE_EVIDENCE_INVALID');
    const purchasedAt = time(verified.startTime);
    const validUntil = expiry(verified);
    const normalizedStatus = state(verified.subscriptionState);
    return {
      provider: 'GOOGLE', environment, productId: plan, providerProductId: verifiedProductId,
      providerTransactionId: verified.latestOrderId,
      originalTransactionId: crypto.createHash('sha256').update(`google-play:${verified.linkedPurchaseToken || evidence.purchaseToken}`).digest('hex'),
      purchasedAt, validFrom: purchasedAt, validUntil, status: normalizedStatus,
      providerEventTime: validUntil,
    };
  }

  async _verifyProfileUnlock({ evidence, environment, productId }) {
    let verified;
    try { verified = await this.apiClient.getProductPurchase({ packageName: this.packageName, productId, purchaseToken: evidence.purchaseToken }); }
    catch { fail('PURCHASE_EVIDENCE_INVALID'); }
    if (!verified || (verified.packageName && verified.packageName !== this.packageName)) fail('PURCHASE_EVIDENCE_INVALID');
    if (verified.productId && verified.productId !== productId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (verified.purchaseState !== 0 || typeof verified.orderId !== 'string' || !verified.orderId) fail('PURCHASE_EVIDENCE_INVALID');
    const rawPurchaseTime = verified.purchaseTimeMillis;
    if (!(typeof rawPurchaseTime === 'string' || typeof rawPurchaseTime === 'number') || !Number.isFinite(Number(rawPurchaseTime))) fail('PURCHASE_EVIDENCE_INVALID');
    return { provider: 'GOOGLE', environment, productId: 'career_profile_unlock', providerProductId: productId, providerTransactionId: verified.orderId, originalTransactionId: null, purchasedAt: new Date(Number(rawPurchaseTime)).toISOString(), validFrom: null, validUntil: null, status: 'ACTIVE', providerEventTime: null };
  }

  async _verifyTimedAddOn({ evidence, environment, productId }) {
    let verified;
    try { verified = await this.apiClient.getProductPurchase({ packageName: this.packageName, productId, purchaseToken: evidence.purchaseToken }); }
    catch { fail('PURCHASE_EVIDENCE_INVALID'); }
    if (!verified || (verified.packageName && verified.packageName !== this.packageName)) fail('PURCHASE_EVIDENCE_INVALID');
    if (verified.productId && verified.productId !== productId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
    if (verified.purchaseState !== 0 || typeof verified.orderId !== 'string' || !verified.orderId) fail('PURCHASE_EVIDENCE_INVALID');
    const rawPurchaseTime = verified.purchaseTimeMillis;
    if (!(typeof rawPurchaseTime === 'string' || typeof rawPurchaseTime === 'number') || !Number.isFinite(Number(rawPurchaseTime))) fail('PURCHASE_EVIDENCE_INVALID');
    return { provider: 'GOOGLE', environment, productId: this.addOns.get(productId), providerProductId: productId, providerTransactionId: verified.orderId, originalTransactionId: crypto.createHash('sha256').update(`google-play-one-time:${evidence.purchaseToken}`).digest('hex'), purchasedAt: new Date(Number(rawPurchaseTime)).toISOString(), validFrom: new Date(Number(rawPurchaseTime)).toISOString(), validUntil: new Date(Number(rawPurchaseTime) + 1).toISOString(), status: 'ACTIVE', providerEventTime: new Date(Number(rawPurchaseTime)).toISOString() };
  }

  async restore() { fail('PURCHASE_PROVIDER_UNSUPPORTED'); }
}

module.exports = { GooglePurchaseVerifier };
