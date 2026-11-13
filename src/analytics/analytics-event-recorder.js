'use strict';

const ALLOWED_PROPERTIES = new Set([
  'user_id', 'birth_profile_id', 'platform', 'app_version', 'screen', 'source',
  'sku', 'payment_provider', 'product_type', 'failure_category', 'is_premium',
  'intent',
  'mode', 'status', 'duration_ms', 'parent_count', 'child_count',
  'has_current', 'has_next', 'legacy_candidate_count', 'fallback_occurred',
  'has_strongest_window', 'legacy_current_present', 'legacy_next_present',
  'current_comparison', 'next_comparison', 'window_count_different',
  'legacy_duration_ms', 'v2_duration_ms', 'contract_version',
  'timing_engine_version', 'eligibility_ruleset', 'refinement_ruleset', 'error_code',
]);

const CAREER_SHADOW_PROPERTIES = new Set([
  'mode', 'status', 'duration_ms', 'parent_count', 'child_count',
  'has_current', 'has_next', 'legacy_candidate_count', 'fallback_occurred',
  'has_strongest_window', 'legacy_current_present', 'legacy_next_present',
  'current_comparison', 'next_comparison', 'window_count_different',
  'legacy_duration_ms', 'v2_duration_ms', 'contract_version',
  'timing_engine_version', 'eligibility_ruleset', 'refinement_ruleset', 'error_code',
]);
const CAREER_CONSUMER_SHADOW_PROPERTIES = new Set([
  'mode', 'status', 'duration_ms', 'has_current', 'has_next',
  'fallback_occurred',
]);
const EVENT_PROPERTY_ALLOWLISTS = Object.freeze({
  career_timing_v2_shadow: CAREER_SHADOW_PROPERTIES,
  career_timing_consumer_shadow: CAREER_CONSUMER_SHADOW_PROPERTIES,
});

class AnalyticsEventRecorder {
  constructor({ provider = null } = {}) { this.provider = provider; }

  async record(name, properties = {}) {
    if (!this.provider || typeof this.provider.track !== 'function') return;
    const allowlist = EVENT_PROPERTY_ALLOWLISTS[name] || ALLOWED_PROPERTIES;
    const safe = {};
    for (const [key, value] of Object.entries(properties)) {
      if (allowlist.has(key) &&
          (value == null || ['string', 'number', 'boolean'].includes(typeof value))) {
        safe[key] = value;
      }
    }
    try { await this.provider.track(name, Object.freeze(safe)); } catch (_) {}
  }
}

module.exports = { AnalyticsEventRecorder, ALLOWED_PROPERTIES, CAREER_SHADOW_PROPERTIES, CAREER_CONSUMER_SHADOW_PROPERTIES, EVENT_PROPERTY_ALLOWLISTS };
