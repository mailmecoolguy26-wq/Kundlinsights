'use strict';

const { buildCareerTimingPeriods, buildCareerTimingV22, buildCareerTimingV23 } = require('../insights');
const { CareerDecisionTimingAdapter, containsDate, lookupDate, legacyContextFromWindow } = require('./decision-timing-adapter');
const { CAREER_TIMING_NO_INVENTION_RULE, canonicalJobFavourabilityProjection, buildTaraCareerTimingContext } = require('./specialized-career-context');
const { shadowComparison, normalizeShadowError, SHADOW_DASHBOARD_METRICS } = require('./shadow-telemetry');

const CAREER_TIMING_PRODUCTION_CONTRACT_VERSION = 'career-timing-production-v1';
const CAREER_TIMING_V2_MODES = Object.freeze(['OFF', 'SHADOW', 'ON']);
const PRODUCT_STATE = Object.freeze({ SUPPORTIVE: 'Supportive period', SUPPORTIVE_WITH_CONDITIONS: 'Supportive with conditions', MIXED: 'Mixed signals', CAUTIOUS: 'Caution advised' });
const PRODUCT_TIER = Object.freeze({ PEAK: 'Strongest window', STRONG: 'Strong support', MODERATE: 'Supportive timing', BASE: 'Background support' });

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function mode(value = 'OFF') { if (!CAREER_TIMING_V2_MODES.includes(value)) throw new RangeError('CAREER_TIMING_V2_MODE must be OFF, SHADOW, or ON.'); return value; }
function validInstant(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function clockMilliseconds(clock) {
  const value = clock();
  const milliseconds = typeof value === 'number' ? value : value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError('Career timing telemetry clock must resolve to a valid instant.');
  return milliseconds;
}
function requiredInput(value) {
  if (!value || typeof value !== 'object' || !value.d1Houses || !Array.isArray(value.dashaIntervals) || !Array.isArray(value.transitIntervals) || !validInstant(value.forecastStart) || !validInstant(value.forecastEnd) || Date.parse(value.forecastStart) >= Date.parse(value.forecastEnd)) throw new TypeError('CareerTimingAuthorityService requires bounded deterministic Career evidence.');
  return value;
}
function childDto(child) {
  return freeze({ windowId: child.childId, start: child.start, end: child.end, internalTier: child.tier, label: PRODUCT_TIER[child.tier] || PRODUCT_TIER.BASE, reasonSummary: freeze({ primaryDashaConvergence: child.reasonSummary.primaryDashaConvergence, pdRefinement: child.reasonSummary.pdRefinement, d10Confirmation: child.reasonSummary.d10Confirmation, transitConfirmation: child.reasonSummary.transitConfirmation }), evidence: freeze({ pd: child.refinement.pd, d10: child.refinement.d10, jupiter: ['DUAL_STRONG', 'JUPITER_ONLY'].includes(child.refinement.transit) ? 'CONFIRMS' : 'NOT_CONFIRMED', saturn: ['DUAL_STRONG', 'SATURN_ONLY'].includes(child.refinement.transit) ? 'CONFIRMS' : 'NOT_CONFIRMED', ashtakavarga: child.refinement.ashtakavarga }) });
}
function parentDto(parent) {
  const children = freeze(parent.children.map(childDto)); const strongestWindow = children.find((child) => child.windowId === parent.strongestWindowId) || null;
  return freeze({ periodId: parent.parentId, start: parent.start, end: parent.end, internalState: parent.state, label: PRODUCT_STATE[parent.state] || 'Career period', convergence: parent.convergence, strongestWindow, refinementWindows: children });
}
function canonicalDto(v22, v23, authority = 'CANONICAL') {
  if (!['SHADOW', 'CANONICAL'].includes(authority)) throw new RangeError('Canonical Career timing authority must be SHADOW or CANONICAL.');
  const periods = freeze(v23.parents.map(parentDto)); const byId = new Map(periods.map((period) => [period.periodId, period])); const child = (id) => periods.flatMap((period) => period.refinementWindows).find((value) => value.windowId === id) || null;
  const currentPeriod = byId.get(v23.selected.activeParentId) || null, activeRefinement = child(v23.selected.activeRefinementId), nextPeriod = byId.get(v23.selected.nextParentId) || null, nextStrongest = child(v23.selected.nextStrongestWindowId);
  return freeze({ contractVersion: CAREER_TIMING_PRODUCTION_CONTRACT_VERSION, timingEngineVersion: 'career-timing-v2-production-1', eligibilityRuleset: v22.rulesetVersion, refinementRuleset: v23.rulesetVersion, authority, intervalSemantics: 'HALF_OPEN', periods, current: currentPeriod || activeRefinement ? freeze({ eligiblePeriod: currentPeriod, activeRefinement }) : null, next: nextPeriod || nextStrongest ? freeze({ eligiblePeriod: nextPeriod, strongestWindow: nextStrongest }) : null, explanationPolicy: freeze({ outcomeGuarantee: false, customerTimingLanguage: 'SUPPORT_ONLY', ashtakavargaRole: 'CONTEXT_ONLY', historicalEventsRole: 'NOT_USED_FOR_ELIGIBILITY_OR_REFINEMENT' }) });
}
function legacy(input) { return buildCareerTimingPeriods({ d1Houses: input.d1Houses, dashaIntervals: input.dashaIntervals, transitIntervals: input.transitIntervals, horizonStart: input.forecastStart, horizonEnd: input.forecastEnd, d10Confirmation: Boolean(input.d10Corroboration), h10Sav: input.h10Sav, recurrence: input.recurrence || null }); }
function v2(input, referenceInstant, authority) {
  let v22; try { v22 = buildCareerTimingV22({ ...input, calculationInstant: input.calculationInstant || input.forecastStart, referenceInstant }); } catch (error) { error.code = 'CAREER_V2_ELIGIBILITY_FAILURE'; throw error; }
  let v23; try { v23 = buildCareerTimingV23({ v22Result: v22, referenceInstant, ashtakavargaContext: input.ashtakavargaContext || null }); } catch (error) { error.code = 'CAREER_V2_REFINEMENT_FAILURE'; throw error; }
  try { return { v22, v23, dto: canonicalDto(v22, v23, authority) }; } catch (error) { error.code = 'CAREER_V2_SERIALIZATION_FAILURE'; throw error; }
}

class CareerTimingAuthorityService {
  constructor({ rolloutMode = 'OFF', diagnosticObserver = null, fallbackToLegacy = true, clock = Date.now, legacyCalculator = legacy, v2Calculator = v2 } = {}) { this.mode = mode(rolloutMode); if (diagnosticObserver !== null && typeof diagnosticObserver !== 'function') throw new TypeError('diagnosticObserver must be a function.'); if (typeof clock !== 'function' || typeof legacyCalculator !== 'function' || typeof v2Calculator !== 'function') throw new TypeError('Career timing calculators and clock must be functions.'); this.observe = diagnosticObserver; this.fallbackToLegacy = fallbackToLegacy === true; this.clock = clock; this.legacyCalculator = legacyCalculator; this.v2Calculator = v2Calculator; Object.freeze(this); }
  calculate(evidence, { referenceInstant = null } = {}) {
    const input = requiredInput(evidence); const at = referenceInstant || input.calculationInstant || input.forecastStart; if (!validInstant(at)) throw new TypeError('Career timing referenceInstant must be valid.');
    if (this.mode === 'OFF') return freeze({ mode: 'OFF', authority: 'LEGACY', legacyTiming: this.legacyCalculator(input), careerTiming: null });
    const started = clockMilliseconds(this.clock); let legacyTiming = null;
    try {
      // Retain legacy timing in both rollout modes until the rollback window
      // closes. V2 and legacy consume the same already-calculated evidence.
      const legacyStarted = clockMilliseconds(this.clock); legacyTiming = this.legacyCalculator(input); const legacyDurationMs = Math.max(0, clockMilliseconds(this.clock) - legacyStarted);
      const v2Started = clockMilliseconds(this.clock); const output = this.v2Calculator(input, at, this.mode === 'SHADOW' ? 'SHADOW' : 'CANONICAL'); const v2DurationMs = Math.max(0, clockMilliseconds(this.clock) - v2Started); const durationMs = Math.max(0, clockMilliseconds(this.clock) - started);
      const comparison = shadowComparison({ legacyTiming, careerTiming: output.dto, referenceInstant: at });
      const diagnostic = freeze({ event: 'CAREER_TIMING_V2_SHADOW', mode: this.mode, status: 'SUCCEEDED', durationMs, legacyDurationMs, v2DurationMs, v2ParentCount: output.v23.parentCount, v2ChildCount: output.v23.children.length, hasCurrent: output.v23.selected.activeParentId !== null, hasNext: output.v23.selected.nextParentId !== null, hasStrongestWindow: comparison.canonicalStrongestPresent, legacyCandidateCount: legacyTiming ? legacyTiming.periods.length : null, legacyCurrentPresent: comparison.legacyCurrentPresent, legacyNextPresent: comparison.legacyNextPresent, currentComparison: comparison.currentComparison, nextComparison: comparison.nextComparison, windowCountDifferent: comparison.windowCountDifferent, fallbackOccurred: false, contractVersion: output.dto.contractVersion, timingEngineVersion: output.dto.timingEngineVersion, eligibilityRuleset: output.dto.eligibilityRuleset, refinementRuleset: output.dto.refinementRuleset });
      if (this.observe) this.observe(diagnostic);
      return freeze({ mode: this.mode, authority: this.mode === 'ON' ? 'CAREER_TIMING_V2' : 'LEGACY', legacyTiming, careerTiming: output.dto, shadowDiagnostic: this.mode === 'SHADOW' ? diagnostic : null });
    } catch (error) {
      const durationMs = Math.max(0, clockMilliseconds(this.clock) - started); if (this.observe) this.observe(freeze({ event: 'CAREER_TIMING_V2_SHADOW', mode: this.mode, status: 'FAILED', durationMs, errorCode: normalizeShadowError(error), fallbackOccurred: this.fallbackToLegacy }));
      if (!this.fallbackToLegacy) throw error;
      return freeze({ mode: this.mode, authority: 'LEGACY_FALLBACK', legacyTiming: legacyTiming || this.legacyCalculator(input), careerTiming: null, fallbackReason: 'CAREER_TIMING_V2_UNAVAILABLE' });
    }
  }
}

module.exports = { CAREER_TIMING_PRODUCTION_CONTRACT_VERSION, CAREER_TIMING_V2_MODES, PRODUCT_STATE, PRODUCT_TIER, CareerTimingAuthorityService, CareerDecisionTimingAdapter, containsDate, lookupDate, legacyContextFromWindow, canonicalJobFavourabilityProjection, buildTaraCareerTimingContext, CAREER_TIMING_NO_INVENTION_RULE, canonicalDto, shadowComparison, normalizeShadowError, SHADOW_DASHBOARD_METRICS };
