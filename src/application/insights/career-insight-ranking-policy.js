'use strict';
const { freeze } = require('../../synthesis/evidence-node');
const ORDER = freeze(['CONCURRENT_CAREER_TIMING', 'ACTIVE_CAREER_DASHA', 'CURRENT_CAREER_TRANSIT', 'FUTURE_RECURRENCE_WINDOW', 'HISTORICAL_CALIBRATION_RECURRENCE', 'AUDITED_CLASSICAL_PREDICATE', 'CAREER_FOUNDATION']);
function timingTier(signal) {
  if (signal.family === 'CONCURRENT_CAREER_TIMING') return signal.temporalContext && signal.temporalContext.timingState === 'CURRENT' ? 0 : signal.temporalContext && signal.temporalContext.timingState === 'UPCOMING' ? 1 : 2;
  if (['ACTIVE_CAREER_DASHA', 'CURRENT_CAREER_TRANSIT'].includes(signal.family)) return 2;
  if (signal.family === 'FUTURE_RECURRENCE_WINDOW') return 3;
  if (signal.family === 'HISTORICAL_CALIBRATION_RECURRENCE') return 4;
  if (signal.family === 'AUDITED_CLASSICAL_PREDICATE') return 5;
  if (signal.family === 'CAREER_FOUNDATION') return 6;
  return ORDER.length;
}
function lineageTier(signal) { const value = signal.temporalContext && signal.temporalContext.lineageClassification; if (value === 'INDEPENDENT') return 0; if (value === 'PARTIALLY_OVERLAPPING') return 1; return (signal.independentMechanismFamilies || []).length > 1 ? 0 : 2; }
function ordinal(signal) { const base = timingTier(signal); const independent = lineageTier(signal); const provenance = signal.ruleId.includes('parashari') || signal.ruleId.includes('BPHS') ? 0 : 1; const calibration = signal.calibrationSupport ? 0 : 1; return [base < 0 ? ORDER.length : base, independent, provenance, calibration, signal.signalId]; }
function rankCareerInsightSignals(signals = []) { return freeze(signals.filter((item) => item.status !== 'NOT_APPLICABLE').slice().sort((left, right) => { const a = ordinal(left), b = ordinal(right); for (let i = 0; i < a.length; i += 1) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; })); }
module.exports = { rankCareerInsightSignals, CAREER_INSIGHT_ORDINAL_ORDER: ORDER };
