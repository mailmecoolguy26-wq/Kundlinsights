'use strict';

const crypto = require('node:crypto');
const { canonicalTime } = require('../../persistence/contracts');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function hashToken(value) { return crypto.createHash('sha256').update(`google-play:${value}`).digest('hex'); }
function canonical(value) { try { return canonicalTime(value, 'PURCHASE_EVIDENCE_INVALID'); } catch { fail('PURCHASE_EVIDENCE_INVALID'); } }
function later(left, right) { return Date.parse(left) >= Date.parse(right) ? left : right; }
function productId(subscription) { const ids = (subscription.lineItems || []).map((line) => line.productId).filter(Boolean); return ids.length === 1 ? ids[0] : null; }
function expiry(subscription) { const values = (subscription.lineItems || []).map((line) => line.expiryTime).filter((value) => typeof value === 'string'); if (values.length !== 1) fail('PURCHASE_EVIDENCE_INVALID'); return canonical(values[0]); }
function normalizeGoogleSubscription({ subscription, packageName, googleProductId, purchaseToken, eventTime } = {}) {
  if (!subscription || subscription.packageName !== packageName || productId(subscription) !== googleProductId || !subscription.latestOrderId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
  const raw = subscription.subscriptionState;
  const status = raw === 'SUBSCRIPTION_STATE_ACTIVE' ? 'ACTIVE'
    : raw === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ? 'GRACE_PERIOD'
    : raw === 'SUBSCRIPTION_STATE_CANCELED' ? 'CANCELED'
    : raw === 'SUBSCRIPTION_STATE_EXPIRED' || raw === 'SUBSCRIPTION_STATE_ON_HOLD' || raw === 'SUBSCRIPTION_STATE_PAUSED' || raw === 'SUBSCRIPTION_STATE_PENDING' ? 'EXPIRED'
      : null;
  if (!status) fail('PURCHASE_EVIDENCE_INVALID');
  const validFrom = canonical(subscription.startTime);
  const validUntil = expiry(subscription);
  return Object.freeze({ provider: 'GOOGLE', environment: 'PRODUCTION', originalTransactionId: hashToken(subscription.linkedPurchaseToken || purchaseToken), providerTransactionId: subscription.latestOrderId, productId: 'career_premium_annual', status, validFrom, validUntil, providerEventTime: eventTime || validUntil, providerEventVersion: subscription.latestOrderId, autoRenewEnabled: status === 'ACTIVE' ? true : null });
}

class GoogleSubscriptionLifecycleReconciler {
  constructor({ repositories, unitOfWork, idGenerator, clock } = {}) { this.repositories = repositories; this.unitOfWork = unitOfWork; this.idGenerator = idGenerator; this.clock = clock; }
  async reconcile(normalized) {
    const lookup = { provider: normalized.provider, environment: normalized.environment, originalTransactionId: normalized.originalTransactionId };
    if (!await this.repositories().subscriptions.findByProviderOriginalTransaction(lookup)) return { reconciled: false };
    return this.unitOfWork.run(async ({ subscriptions }) => {
      const existing = await subscriptions.findByProviderOriginalTransaction(lookup);
      if (!existing) return { reconciled: false };
      const now = canonicalTime(this.clock(), 'INVALID_PAYMENT_TIMESTAMP');
      const validUntil = later(existing.validUntil, normalized.validUntil);
      const subscription = await subscriptions.upsertVerifiedState({ ...existing, id: existing.id || this.idGenerator(), status: normalized.status, validFrom: existing.validFrom, validUntil, autoRenewEnabled: normalized.autoRenewEnabled, graceUntil: normalized.status === 'GRACE_PERIOD' ? validUntil : null, canceledAt: normalized.status === 'CANCELED' ? normalized.providerEventTime : existing.canceledAt, revokedAt: existing.revokedAt, refundedAt: existing.refundedAt, providerEventTime: normalized.providerEventTime, providerEventVersion: normalized.providerEventVersion, updatedAt: now });
      return { reconciled: subscription.id === existing.id };
    });
  }
}

module.exports = { GoogleSubscriptionLifecycleReconciler, normalizeGoogleSubscription, hashToken };
