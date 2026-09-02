'use strict';

const crypto = require('node:crypto');

function fail(code) { const error = new Error(code); error.code = code; throw error; }

class GoogleRtdnService {
  constructor({ pubsubAuthVerifier, decoder, apiClient, packageName, googleProductId, paymentEvents, lifecycleReconciler, idGenerator, clock } = {}) {
    Object.assign(this, { pubsubAuthVerifier, decoder, apiClient, packageName, googleProductId, paymentEvents, lifecycleReconciler, idGenerator, clock });
  }
  async handle({ request, envelope } = {}) {
    await this.pubsubAuthVerifier.verifyRequest(request);
    const decoded = this.decoder({ envelope, packageName: this.packageName });
    if (decoded.kind !== 'SUBSCRIPTION') return { received: true, ignored: true };
    const identity = { provider: decoded.provider, environment: decoded.environment, providerEventId: decoded.providerEventId };
    const existing = await this.paymentEvents.findByProviderEventId(identity);
    if (existing && existing.processingStatus === 'PROCESSED') return { received: true, duplicate: true };
    let event = existing;
    if (!event) {
      try { event = await this.paymentEvents.insertReceived({ id: this.idGenerator(), ...identity, eventType: decoded.eventType, providerEventTime: decoded.providerEventTime, purchaseRecordId: null, subscriptionRecordId: null, receivedAt: this.clock(), payloadDigest: crypto.createHash('sha256').update(decoded.providerEventId).digest('hex'), createdAt: this.clock() }); }
      catch (error) { if (!error || error.code !== 'DUPLICATE_PROVIDER_EVENT') throw error; event = await this.paymentEvents.findByProviderEventId(identity); }
    }
    if (event.processingStatus === 'PROCESSED') return { received: true, duplicate: true };
    try {
      let subscription;
      try { subscription = await this.apiClient.getSubscription({ packageName: this.packageName, purchaseToken: decoded.purchaseToken }); }
      catch { fail('GOOGLE_RTDN_RETRYABLE'); }
      const normalized = this.lifecycleReconciler.normalize({ subscription, purchaseToken: decoded.purchaseToken, eventTime: decoded.providerEventTime });
      await this.lifecycleReconciler.reconcile(normalized);
      await this.paymentEvents.markProcessed(event.id, this.clock());
      return { received: true, duplicate: false };
    } catch (error) {
      try { await this.paymentEvents.markFailed(event.id, { processedAt: this.clock(), failureCode: 'GOOGLE_RTDN_PROCESSING_FAILED' }); } catch { /* retain the processing result */ }
      throw error;
    }
  }
}

module.exports = { GoogleRtdnService };
