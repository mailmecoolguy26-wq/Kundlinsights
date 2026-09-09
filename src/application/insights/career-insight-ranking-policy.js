'use strict';
const { freeze } = require('../../synthesis/evidence-node');
const ORDER = freeze(['CONCURRENT_CAREER_TIMING', 'ACTIVE_CAREER_DASHA', 'CURRENT_CAREER_TRANSIT', 'FUTURE_RECURRENCE_WINDOW', 'HISTORICAL_CALIBRATION_RECURRENCE', 'AUDITED_CLASSICAL_PREDICATE', 'CAREER_FOUNDATION']);
function ordinal(signal) { const base = ORDER.indexOf(signal.family); const independent = (signal.independentMechanismFamilies || []).length > 1 ? 0 : 1; const provenance = signal.ruleId.includes('parashari') || signal.ruleId.includes('BPHS') ? 0 : 1; const calibration = signal.calibrationSupport ? 0 : 1; return [base < 0 ? ORDER.length : base, independent, provenance, calibration, signal.signalId]; }
function rankCareerInsightSignals(signals = []) { return freeze(signals.filter((item) => item.status !== 'NOT_APPLICABLE').slice().sort((left, right) => { const a = ordinal(left), b = ordinal(right); for (let i = 0; i < a.length; i += 1) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; })); }
module.exports = { rankCareerInsightSignals, CAREER_INSIGHT_ORDINAL_ORDER: ORDER };
