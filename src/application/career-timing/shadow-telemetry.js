'use strict';

const SHADOW_EVENT = 'career_timing_v2_shadow';
const COMPARISON = Object.freeze({
  CURRENT_MATCH: 'CURRENT_MATCH',
  CURRENT_LEGACY_ONLY: 'CURRENT_LEGACY_ONLY',
  CURRENT_CANONICAL_ONLY: 'CURRENT_CANONICAL_ONLY',
  CURRENT_STATE_DIFFERENT: 'CURRENT_STATE_DIFFERENT',
  NEXT_MATCH: 'NEXT_MATCH',
  NEXT_LEGACY_ONLY: 'NEXT_LEGACY_ONLY',
  NEXT_CANONICAL_ONLY: 'NEXT_CANONICAL_ONLY',
  NEXT_STATE_DIFFERENT: 'NEXT_STATE_DIFFERENT',
  NO_COMPARABLE_STATE: 'NO_COMPARABLE_STATE',
});
const ERROR_CODES = Object.freeze([
  'CAREER_V2_EVIDENCE_UNAVAILABLE',
  'CAREER_V2_ELIGIBILITY_FAILURE',
  'CAREER_V2_REFINEMENT_FAILURE',
  'CAREER_V2_SERIALIZATION_FAILURE',
  'CAREER_V2_UNSUPPORTED_CONTRACT',
  'CAREER_V2_CONSUMER_ADAPTATION_FAILURE',
]);

function activeAndNext(periods, at) {
  const instant = Date.parse(at);
  if (!Number.isFinite(instant) || !Array.isArray(periods)) return { current: null, next: null };
  const ordered = periods
    .filter((item) => item && Number.isFinite(Date.parse(item.startDate || item.start)) && Number.isFinite(Date.parse(item.endDate || item.end)))
    .slice()
    .sort((left, right) => Date.parse(left.startDate || left.start) - Date.parse(right.startDate || right.start));
  return {
    current: ordered.find((item) => Date.parse(item.startDate || item.start) <= instant && instant < Date.parse(item.endDate || item.end)) || null,
    next: ordered.find((item) => Date.parse(item.startDate || item.start) > instant) || null,
  };
}

function state(item) { return item && (item.evidenceState || item.internalState) || null; }
function compare(legacy, canonical, prefix) {
  if (!legacy && !canonical) return COMPARISON[`${prefix}_MATCH`];
  if (legacy && !canonical) return COMPARISON[`${prefix}_LEGACY_ONLY`];
  if (!legacy && canonical) return COMPARISON[`${prefix}_CANONICAL_ONLY`];
  const left = state(legacy), right = state(canonical);
  if (!left || !right) return COMPARISON.NO_COMPARABLE_STATE;
  return left === right ? COMPARISON[`${prefix}_MATCH`] : COMPARISON[`${prefix}_STATE_DIFFERENT`];
}

function shadowComparison({ legacyTiming, careerTiming, referenceInstant }) {
  const legacy = activeAndNext(legacyTiming && legacyTiming.periods, referenceInstant);
  const canonical = {
    current: careerTiming && careerTiming.current && careerTiming.current.eligiblePeriod || null,
    next: careerTiming && careerTiming.next && careerTiming.next.eligiblePeriod || null,
  };
  return Object.freeze({
    currentComparison: compare(legacy.current, canonical.current, 'CURRENT'),
    nextComparison: compare(legacy.next, canonical.next, 'NEXT'),
    windowCountDifferent: Boolean(legacyTiming && careerTiming && legacyTiming.periods.length !== careerTiming.periods.length),
    legacyCurrentPresent: Boolean(legacy.current),
    legacyNextPresent: Boolean(legacy.next),
    canonicalCurrentPresent: Boolean(canonical.current),
    canonicalNextPresent: Boolean(canonical.next),
    canonicalStrongestPresent: Boolean(careerTiming && careerTiming.periods.some((period) => period.strongestWindow)),
  });
}

function normalizeShadowError(error) {
  return ERROR_CODES.includes(error && error.code)
    ? error.code
    : 'CAREER_V2_CONSUMER_ADAPTATION_FAILURE';
}

const SHADOW_DASHBOARD_METRICS = Object.freeze([
  'career_timing_v2_shadow.attempts',
  'career_timing_v2_shadow.success_rate',
  'career_timing_v2_shadow.failure_rate',
  'career_timing_v2_shadow.fallback_rate',
  'career_timing_v2_shadow.duration_ms.p50',
  'career_timing_v2_shadow.duration_ms.p95',
  'career_timing_v2_shadow.current_comparison',
  'career_timing_v2_shadow.next_comparison',
  'career_timing_v2_shadow.window_count_different',
  'career_timing_v2_shadow.parent_count',
  'career_timing_v2_shadow.refinement_count',
]);

module.exports = {
  SHADOW_EVENT,
  COMPARISON,
  ERROR_CODES,
  SHADOW_DASHBOARD_METRICS,
  shadowComparison,
  normalizeShadowError,
};
