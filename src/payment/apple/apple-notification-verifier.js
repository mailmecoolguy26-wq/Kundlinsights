'use strict';

const { canonicalTime } = require('../../persistence/contracts');

const KNOWN_TYPES = new Set(['SUBSCRIBED', 'DID_RENEW', 'DID_FAIL_TO_RENEW', 'EXPIRED', 'REFUND', 'REVOKE', 'DID_CHANGE_RENEWAL_STATUS', 'GRACE_PERIOD_EXPIRED', 'RENEWAL_EXTENDED']);

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function text(value, code) { if (typeof value !== 'string' || !value) fail(code); return value; }
function environment(value) { if (value === 'Sandbox') return 'SANDBOX'; if (value === 'Production') return 'PRODUCTION'; fail('APPLE_NOTIFICATION_EVIDENCE_INVALID'); }
function time(value) { if (!Number.isFinite(value)) fail('APPLE_NOTIFICATION_EVIDENCE_INVALID'); return canonicalTime(new Date(value).toISOString(), 'APPLE_NOTIFICATION_EVIDENCE_INVALID'); }
function nullableTime(value) { return value == null ? null : time(value); }

class AppleNotificationVerifier {
  constructor({ signedDataVerifier, bundleId, appleProductId } = {}) { this.signedDataVerifier = signedDataVerifier; this.bundleId = bundleId; this.appleProductId = appleProductId; }
  async verifiedOuter(signedPayload, expectedEnvironment) {
    const candidates = expectedEnvironment == null ? ['SANDBOX', 'PRODUCTION'] : [expectedEnvironment];
    let lastError;
    for (const candidate of candidates) {
      try { return { notification: await this.signedDataVerifier.verifyAndDecodeNotification({ signedPayload, environment: candidate }), environment: candidate }; }
      catch (error) { lastError = error; }
    }
    if (lastError && lastError.code && lastError.code.startsWith('APPLE_')) throw lastError;
    fail('APPLE_NOTIFICATION_VERIFICATION_FAILED');
  }
  async verifyAndNormalizeNotification({ signedPayload, expectedEnvironment = null } = {}) {
    if (typeof signedPayload !== 'string' || !signedPayload) fail('APPLE_NOTIFICATION_EVIDENCE_INVALID');
    if (expectedEnvironment != null && !['SANDBOX', 'PRODUCTION'].includes(expectedEnvironment)) fail('APPLE_NOTIFICATION_EVIDENCE_INVALID');
    const outer = await this.verifiedOuter(signedPayload, expectedEnvironment);
    const notification = outer.notification; const data = notification && notification.data;
    if (!data || typeof data !== 'object') fail('APPLE_NOTIFICATION_EVIDENCE_INVALID');
    const verifiedEnvironment = environment(data.environment);
    if (verifiedEnvironment !== outer.environment || (expectedEnvironment && verifiedEnvironment !== expectedEnvironment)) fail('APPLE_NOTIFICATION_EVIDENCE_INVALID');
    if (text(data.bundleId, 'APPLE_NOTIFICATION_EVIDENCE_INVALID') !== this.bundleId) fail('PURCHASE_EVIDENCE_INVALID');
    const providerEventId = text(notification.notificationUUID, 'APPLE_NOTIFICATION_EVIDENCE_INVALID');
    const sourceNotificationType = text(notification.notificationType, 'APPLE_NOTIFICATION_EVIDENCE_INVALID');
    const eventType = KNOWN_TYPES.has(sourceNotificationType) ? sourceNotificationType : 'UNKNOWN';
    let transaction = null; let renewal = null; let providerProductId = null; let logicalProductSku = null; let providerTransactionId = null; let originalTransactionId = null;
    if (data.signedTransactionInfo != null) {
      const decoded = await this.signedDataVerifier.verifyAndDecodeTransaction({ signedTransaction: data.signedTransactionInfo, environment: verifiedEnvironment });
      if (!decoded || decoded.bundleId !== this.bundleId) fail('PURCHASE_EVIDENCE_INVALID');
      if (environment(decoded.environment) !== verifiedEnvironment || decoded.productId !== this.appleProductId) fail(decoded.productId === this.appleProductId ? 'PURCHASE_EVIDENCE_INVALID' : 'PURCHASE_PRODUCT_UNSUPPORTED');
      providerProductId = decoded.productId; logicalProductSku = 'career_premium_annual'; providerTransactionId = text(decoded.transactionId, 'PURCHASE_EVIDENCE_INVALID'); originalTransactionId = text(decoded.originalTransactionId, 'PURCHASE_EVIDENCE_INVALID');
      transaction = Object.freeze({ providerTransactionId, originalTransactionId, purchasedAt: nullableTime(decoded.purchaseDate), validUntil: nullableTime(decoded.expiresDate), signedAt: nullableTime(decoded.signedDate), revocationAt: nullableTime(decoded.revocationDate), revocationReason: decoded.revocationReason == null ? null : decoded.revocationReason });
    }
    if (data.signedRenewalInfo != null) {
      const decoded = await this.signedDataVerifier.verifyAndDecodeRenewalInfo({ signedRenewalInfo: data.signedRenewalInfo, environment: verifiedEnvironment });
      if (!decoded || environment(decoded.environment) !== verifiedEnvironment) fail('PURCHASE_EVIDENCE_INVALID');
      const renewalProductId = decoded.productId || decoded.autoRenewProductId || null;
      if (renewalProductId != null && renewalProductId !== this.appleProductId) fail('PURCHASE_PRODUCT_UNSUPPORTED');
      const renewalOriginalTransactionId = text(decoded.originalTransactionId, 'PURCHASE_EVIDENCE_INVALID');
      if (originalTransactionId && originalTransactionId !== renewalOriginalTransactionId) fail('PURCHASE_EVIDENCE_INVALID');
      originalTransactionId = originalTransactionId || renewalOriginalTransactionId; providerProductId = providerProductId || renewalProductId; logicalProductSku = logicalProductSku || (renewalProductId ? 'career_premium_annual' : null);
      renewal = Object.freeze({ originalTransactionId: renewalOriginalTransactionId, autoRenewStatus: decoded.autoRenewStatus == null ? null : decoded.autoRenewStatus, expirationIntent: decoded.expirationIntent == null ? null : decoded.expirationIntent, renewalAt: nullableTime(decoded.renewalDate), gracePeriodExpiresAt: nullableTime(decoded.gracePeriodExpiresDate), signedAt: nullableTime(decoded.signedDate), productId: renewalProductId });
    }
    return Object.freeze({ provider: 'APPLE', environment: verifiedEnvironment, providerEventId, eventType, eventSubtype: notification.subtype == null ? null : String(notification.subtype), sourceNotificationType, providerEventTime: time(notification.signedDate), bundleId: this.bundleId, appAppleId: data.appAppleId == null ? null : data.appAppleId, logicalProductSku, providerProductId, providerTransactionId, originalTransactionId, transaction, renewal });
  }
}

module.exports = { AppleNotificationVerifier };
