'use strict';

const crypto = require('node:crypto');

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function safeNotificationError(error) {
  const code = error && error.code;
  if (code === 'APPLE_NOTIFICATION_VERIFICATION_FAILED' || code === 'APPLE_JWS_VERIFICATION_FAILED' || code === 'APPLE_NOTIFICATION_EVIDENCE_INVALID' || code === 'PURCHASE_EVIDENCE_INVALID' || code === 'PURCHASE_PRODUCT_UNSUPPORTED') fail('INVALID_APPLE_NOTIFICATION');
  throw error;
}

class AppleNotificationService {
  constructor({ notificationVerifier, paymentEvents, lifecycleReconciler = null, idGenerator, clock } = {}) {
    this.notificationVerifier = notificationVerifier;
    this.paymentEvents = paymentEvents;
    this.lifecycleReconciler = lifecycleReconciler;
    this.idGenerator = idGenerator;
    this.clock = clock;
  }

  async handle({ signedPayload } = {}) {
    if (typeof signedPayload !== 'string' || !signedPayload) fail('INVALID_APPLE_NOTIFICATION');

    let normalized;
    try {
      normalized = await this.notificationVerifier.verifyAndNormalizeNotification({ signedPayload });
    } catch (error) {
      safeNotificationError(error);
    }

    const identity = {
      provider: normalized.provider,
      environment: normalized.environment,
      providerEventId: normalized.providerEventId,
    };
    const existing = await this.paymentEvents.findByProviderEventId(identity);
    if (existing) return this.completeExisting(existing, normalized);

    let event;
    try {
      event = await this.paymentEvents.insertReceived({
        id: this.idGenerator(),
        ...identity,
        eventType: normalized.eventType,
        providerEventTime: normalized.providerEventTime,
        purchaseRecordId: null,
        subscriptionRecordId: null,
        receivedAt: this.clock(),
        payloadDigest: crypto.createHash('sha256').update(signedPayload).digest('hex'),
        createdAt: this.clock(),
      });
    } catch (error) {
      if (!error || error.code !== 'DUPLICATE_PROVIDER_EVENT') throw error;
      const duplicate = await this.paymentEvents.findByProviderEventId(identity);
      if (!duplicate) throw error;
      return this.completeExisting(duplicate, normalized);
    }

    return this.completeInserted(event, normalized);
  }

  async completeExisting(event, normalized) {
    if (event.processingStatus !== 'PROCESSED') await this.completeInserted(event, normalized);
    return { received: true, duplicate: true };
  }

  async completeInserted(event, normalized) {
    try {
      if (this.lifecycleReconciler) await this.lifecycleReconciler.reconcile(normalized);
      await this.paymentEvents.markProcessed(event.id, this.clock());
      return { received: true, duplicate: false };
    } catch (error) {
      try {
        await this.paymentEvents.markFailed(event.id, { processedAt: this.clock(), failureCode: 'APPLE_NOTIFICATION_PROCESSING_FAILED' });
      } catch { /* Preserve the original processing error. */ }
      throw error;
    }
  }
}

module.exports = { AppleNotificationService };
