'use strict';

// Application-level projection over persisted Career timing. It performs no
// astrology, evidence generation, transit scan, or historical calibration.
const MODES = new Set(['OFF', 'SHADOW', 'ON']);
const POSSIBLE_SIGNAL = 'POSSIBLE_CAREER_ACTIVITY_SIGNAL';

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function validInterval(value) { return value && typeof value.start === 'string' && typeof value.end === 'string' && Number.isFinite(Date.parse(value.start)) && Number.isFinite(Date.parse(value.end)) && Date.parse(value.start) < Date.parse(value.end); }
function containsDate(interval, date, { halfOpen = true } = {}) { const instant = Date.parse(date), start = interval && Date.parse(interval.start), end = interval && Date.parse(interval.end); return Number.isFinite(instant) && Number.isFinite(start) && Number.isFinite(end) && instant >= start && (halfOpen ? instant < end : instant <= end); }
function copyWindow(value, classification = null) { return validInterval(value) ? freeze({ start: value.start, end: value.end, ...(classification ? { classification } : {}), ...(typeof value.label === 'string' ? { label: value.label } : {}) }) : null; }
function legacySignal(reading) { return (Array.isArray(reading && reading.careerTimingPeriods) ? reading.careerTimingPeriods : []).filter((item) => item && item.evidenceState === POSSIBLE_SIGNAL && validInterval({ start: item.startDate, end: item.endDate })).slice().sort((left, right) => left.startDate.localeCompare(right.startDate))[0] || null; }
function legacyContext(reading, source = 'LEGACY') {
  const signal = legacySignal(reading); const window = signal ? copyWindow({ start: signal.startDate, end: signal.endDate }, POSSIBLE_SIGNAL) : null;
  return freeze({ source, authority: 'LEGACY', mode: source === 'LEGACY' ? 'OFF_OR_SHADOW' : 'ON_FALLBACK', contractVersion: null, timingEngineVersion: null, eligibilityRuleset: null, refinementRuleset: null, intervalSemantics: 'LEGACY_INCLUSIVE_END', eligiblePeriods: window ? freeze([window]) : freeze([]), strongestWindows: window ? freeze([window]) : freeze([]), currentEligiblePeriod: null, nextEligiblePeriod: window, activeRefinement: null, strongestCurrentRefinement: null, strongestUpcomingRefinement: window, primaryWindow: window, productState: signal && signal.evidenceState || null, evidenceSummary: null });
}
function legacyContextFromWindow(window) { return legacyContext({ careerTimingPeriods: validInterval(window) ? [{ startDate: window.start, endDate: window.end, evidenceState: window.classification || POSSIBLE_SIGNAL }] : [] }); }
function supportedCanonical(timing) { return Boolean(timing && timing.contractVersion === 'career-timing-production-v1' && timing.authority === 'CANONICAL' && timing.intervalSemantics === 'HALF_OPEN' && Array.isArray(timing.periods)); }
function canonicalContext(timing) {
  const current = timing.current, next = timing.next;
  const currentPeriod = current && current.eligiblePeriod || null, nextPeriod = next && next.eligiblePeriod || null;
  const activeRefinement = current && current.activeRefinement || null, currentStrongest = currentPeriod && currentPeriod.strongestWindow || null, nextStrongest = next && next.strongestWindow || null;
  const primary = currentStrongest || currentPeriod || nextStrongest || nextPeriod;
  const selectedRefinement = currentStrongest || activeRefinement || nextStrongest || nextPeriod && nextPeriod.strongestWindow || null;
  const evidence = selectedRefinement && selectedRefinement.evidence || null, reason = selectedRefinement && selectedRefinement.reasonSummary || null;
  const eligiblePeriods = freeze((timing.periods || []).map((item) => copyWindow(item)).filter(Boolean)), strongestWindows = freeze((timing.periods || []).map((item) => copyWindow(item.strongestWindow)).filter(Boolean));
  return freeze({ source: 'CANONICAL', authority: 'CANONICAL', mode: 'ON', contractVersion: timing.contractVersion, timingEngineVersion: timing.timingEngineVersion, eligibilityRuleset: timing.eligibilityRuleset, refinementRuleset: timing.refinementRuleset, intervalSemantics: 'HALF_OPEN', eligiblePeriods, strongestWindows, currentEligiblePeriod: copyWindow(currentPeriod), nextEligiblePeriod: copyWindow(nextPeriod), activeRefinement: copyWindow(activeRefinement), strongestCurrentRefinement: copyWindow(currentStrongest), strongestUpcomingRefinement: copyWindow(nextStrongest), primaryWindow: copyWindow(primary, primary && (primary.internalTier || primary.internalState)), productState: currentPeriod && currentPeriod.internalState || nextPeriod && nextPeriod.internalState || null, evidenceSummary: evidence || reason ? freeze({ ...(reason || {}), ...(evidence || {}) }) : null });
}
function lookupDate(context, date) {
  if (!date) return freeze({ state: 'NOT_ASSESSED', authority: context.authority, eligiblePeriod: null, strongestWindow: null });
  const halfOpen = context.intervalSemantics === 'HALF_OPEN';
  const periods = Array.isArray(context.eligiblePeriods) ? context.eligiblePeriods : [context.currentEligiblePeriod, context.nextEligiblePeriod].filter(Boolean);
  const refinements = Array.isArray(context.strongestWindows) ? context.strongestWindows : [context.strongestCurrentRefinement, context.strongestUpcomingRefinement].filter(Boolean);
  const eligiblePeriod = periods.find((item) => containsDate(item, date, { halfOpen })) || null;
  const strongestWindow = refinements.find((item) => containsDate(item, date, { halfOpen })) || null;
  return freeze({ state: strongestWindow ? 'INSIDE_STRONGEST_WINDOW' : eligiblePeriod ? 'INSIDE_ELIGIBLE_PERIOD' : 'OUTSIDE_ELIGIBLE_PERIOD', authority: context.authority, eligiblePeriod, strongestWindow });
}

class CareerDecisionTimingAdapter {
  constructor({ mode = 'OFF', diagnosticObserver = null, clock = Date.now } = {}) { if (!MODES.has(mode)) throw new RangeError('Career decision timing mode must be OFF, SHADOW, or ON.'); if (diagnosticObserver !== null && typeof diagnosticObserver !== 'function') throw new TypeError('diagnosticObserver must be a function.'); this.mode = mode; this.observe = diagnosticObserver; this.clock = clock; Object.freeze(this); }
  resolve(reading) {
    const started = this.clock(); const canonical = reading && reading.careerTiming;
    let context; let fallbackOccurred = false;
    if (this.mode === 'ON' && supportedCanonical(canonical)) {
      try { context = canonicalContext(canonical); }
      catch (_) { fallbackOccurred = true; context = legacyContext(reading, 'LEGACY_FALLBACK'); }
    } else { fallbackOccurred = this.mode === 'ON'; context = legacyContext(reading, this.mode === 'ON' ? 'LEGACY_FALLBACK' : 'LEGACY'); }
    if (this.mode === 'SHADOW' && this.observe) {
      let shadow = null;
      const shadowCandidate = canonical && canonical.authority === 'SHADOW';
      try { if (shadowCandidate && canonical.contractVersion === 'career-timing-production-v1' && canonical.intervalSemantics === 'HALF_OPEN' && Array.isArray(canonical.periods)) shadow = canonicalContext({ ...canonical, authority: 'CANONICAL' }); else if (shadowCandidate) fallbackOccurred = true; } catch (_) { fallbackOccurred = true; }
      this.observe(freeze({ event: 'CAREER_TIMING_CONSUMER_SHADOW', legacyCurrentPresent: context.currentEligiblePeriod !== null, canonicalCurrentPresent: Boolean(shadow && shadow.currentEligiblePeriod), legacyWindowPresent: context.primaryWindow !== null, canonicalStrongestWindowPresent: Boolean(shadow && (shadow.strongestCurrentRefinement || shadow.strongestUpcomingRefinement)), timingStateMismatch: Boolean(shadow) && Boolean(context.primaryWindow) !== Boolean(shadow.primaryWindow), fallbackOccurred, durationMs: Math.max(0, this.clock() - started) }));
    }
    return context;
  }
  lookupDate(context, date) { return lookupDate(context, date); }
}

module.exports = { CareerDecisionTimingAdapter, containsDate, lookupDate, legacyContextFromWindow };
