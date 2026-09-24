'use strict';

const ALLOWED_PROPERTIES = new Set([
  'user_id', 'birth_profile_id', 'platform', 'app_version', 'screen', 'source',
  'sku', 'payment_provider', 'product_type', 'failure_category', 'is_premium',
  'intent',
]);

class AnalyticsEventRecorder {
  constructor({ provider = null } = {}) { this.provider = provider; }

  async record(name, properties = {}) {
    if (!this.provider || typeof this.provider.track !== 'function') return;
    const safe = {};
    for (const [key, value] of Object.entries(properties)) {
      if (ALLOWED_PROPERTIES.has(key) &&
          (value == null || ['string', 'number', 'boolean'].includes(typeof value))) {
        safe[key] = value;
      }
    }
    try { await this.provider.track(name, Object.freeze(safe)); } catch (_) {}
  }
}

module.exports = { AnalyticsEventRecorder, ALLOWED_PROPERTIES };
