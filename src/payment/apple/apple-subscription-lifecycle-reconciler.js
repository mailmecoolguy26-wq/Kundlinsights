'use strict';

const { canonicalTime } = require('../../persistence/contracts');

const LIFECYCLE_TYPES = new Set(['SUBSCRIBED', 'DID_RENEW', 'DID_FAIL_TO_RENEW', 'EXPIRED', 'REFUND', 'REVOKE', 'DID_CHANGE_RENEWAL_STATUS', 'GRACE_PERIOD_EXPIRED', 'RENEWAL_EXTENDED']);

function later(left, right) {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

function currentAt(value, now) {
  return value && Date.parse(value) > Date.parse(now);
}

function lifecycleState({ event, existing, now }) {
  const transaction = event.transaction || {};
  const renewal = event.renewal || {};
  const validUntil = later(existing.validUntil, transaction.validUntil || null);
  const validFrom = transaction.purchasedAt || existing.validFrom;
  const renewalDisabled = event.eventType === 'DID_CHANGE_RENEWAL_STATUS' && event.eventSubtype === 'AUTO_RENEW_DISABLED' || renewal.autoRenewStatus === 0;
  const renewalEnabled = event.eventType === 'DID_CHANGE_RENEWAL_STATUS' && event.eventSubtype === 'AUTO_RENEW_ENABLED' || renewal.autoRenewStatus === 1;
  let status = existing.status;
  let graceUntil = null;
  let canceledAt = existing.canceledAt;
  let refundedAt = existing.refundedAt;
  let revokedAt = existing.revokedAt;

  if (event.eventType === 'REFUND') { status = 'REFUNDED'; refundedAt = event.providerEventTime; }
  else if (event.eventType === 'REVOKE') { status = 'REVOKED'; revokedAt = event.providerEventTime; }
  else if (event.eventType === 'EXPIRED' || event.eventType === 'GRACE_PERIOD_EXPIRED') status = 'EXPIRED';
  else if (event.eventType === 'DID_FAIL_TO_RENEW' && event.eventSubtype === 'GRACE_PERIOD' && renewal.gracePeriodExpiresAt) {
    status = 'GRACE_PERIOD';
    graceUntil = renewal.gracePeriodExpiresAt;
  } else if (event.eventType === 'DID_FAIL_TO_RENEW') {
    status = currentAt(validUntil, now) ? 'CANCELED' : 'EXPIRED';
    if (status === 'CANCELED') canceledAt = event.providerEventTime;
  } else if (renewalDisabled) {
    status = currentAt(validUntil, now) ? 'CANCELED' : 'EXPIRED';
    if (status === 'CANCELED') canceledAt = event.providerEventTime;
  } else if (event.eventType === 'SUBSCRIBED' || event.eventType === 'DID_RENEW' || event.eventType === 'RENEWAL_EXTENDED' || renewalEnabled) {
    status = currentAt(validUntil, now) ? 'ACTIVE' : 'EXPIRED';
  }

  if (status === 'GRACE_PERIOD') {
    const boundary = renewal.gracePeriodExpiresAt;
    return { status, validFrom, validUntil: later(validUntil, boundary), graceUntil: boundary, canceledAt, refundedAt, revokedAt };
  }
  return { status, validFrom, validUntil, graceUntil, canceledAt, refundedAt, revokedAt };
}

class AppleSubscriptionLifecycleReconciler {
  constructor({ repositories, unitOfWork, idGenerator, clock } = {}) {
    this.repositories = repositories;
    this.unitOfWork = unitOfWork;
    this.idGenerator = idGenerator;
    this.clock = clock;
  }

  async reconcile(event) {
    if (!LIFECYCLE_TYPES.has(event.eventType) || !event.originalTransactionId) return { reconciled: false };
    const lookup = { provider: event.provider, environment: event.environment, originalTransactionId: event.originalTransactionId };
    const known = await this.repositories().subscriptions.findByProviderOriginalTransaction(lookup);
    if (!known) return { reconciled: false };
    return this.unitOfWork.run(async ({ subscriptions }) => {
      const existing = await subscriptions.findByProviderOriginalTransaction(lookup);
      if (!existing) return { reconciled: false };
      const now = canonicalTime(this.clock(), 'INVALID_PAYMENT_TIMESTAMP');
      const next = lifecycleState({ event, existing, now });
      const subscription = await subscriptions.upsertVerifiedState({
        ...existing,
        id: existing.id || this.idGenerator(),
        status: next.status,
        validFrom: next.validFrom,
        validUntil: next.validUntil,
        autoRenewEnabled: event.renewal && event.renewal.autoRenewStatus != null ? event.renewal.autoRenewStatus === 1 : existing.autoRenewEnabled,
        graceUntil: next.graceUntil,
        canceledAt: next.canceledAt,
        refundedAt: next.refundedAt,
        revokedAt: next.revokedAt,
        providerEventTime: event.providerEventTime,
        providerEventVersion: event.providerEventId,
        updatedAt: now,
      });
      return { reconciled: subscription.id === existing.id && subscription.status === next.status };
    });
  }
}

module.exports = { AppleSubscriptionLifecycleReconciler, lifecycleState };
