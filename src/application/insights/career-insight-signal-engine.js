'use strict';
const { freeze } = require('../../synthesis/evidence-node');
const { deterministicInsightId, createInsightSignal } = require('./career-insight-contract');
const { CAREER_INSIGHT_FAMILIES } = require('./career-insight-rulebook');
function status(items) { if (items.some((item) => item.status === 'CONTRADICTED')) return 'CONTRADICTED'; if (items.some((item) => item.status === 'SUPPORTED') && items.some((item) => ['MIXED', 'INSUFFICIENT_EVIDENCE'].includes(item.status))) return 'MIXED'; if (items.some((item) => item.status === 'MIXED')) return 'MIXED'; if (items.some((item) => item.status === 'SUPPORTED')) return 'SUPPORTED'; if (items.some((item) => item.status === 'INSUFFICIENT_EVIDENCE')) return 'INSUFFICIENT_EVIDENCE'; return 'NOT_APPLICABLE'; }
function buildCareerInsightSignals({ evidence = [], calibrationContext = null } = {}) { return freeze(CAREER_INSIGHT_FAMILIES.map((family) => {
  const items = evidence.filter((item) => item.family === family); if (!items.length) return null; const result = status(items); const support = items.filter((item) => item.status === 'SUPPORTED').map((item) => item.evidenceId); const limiting = items.filter((item) => ['MIXED', 'INSUFFICIENT_EVIDENCE'].includes(item.status)).map((item) => item.evidenceId); const contradictory = items.filter((item) => item.status === 'CONTRADICTED').map((item) => item.evidenceId);
  const independentMechanismFamilies = [...new Set([
    ...items.flatMap((item) => item.lineage.nodeAnalysis || []).flatMap((node) => node.mechanismFamilies || []),
    ...items.filter((item) => item.chart === 'D10').map(() => 'D10_DIVISIONAL'),
  ])].sort();
  return createInsightSignal({ signalId: deterministicInsightId('signal', { family, evidenceIds: items.map((item) => item.evidenceId), status: result }), domain: 'CAREER', family, ruleId: items.map((item) => item.provenance.sourceRuleId || item.sourceRulesetId).sort().join('|'), status: result, supportiveEvidenceIds: support, limitingEvidenceIds: limiting, contradictoryEvidenceIds: contradictory, independentMechanismFamilies, temporalContext: items.find((item) => Object.keys(item.temporalContext || {}).length)?.temporalContext || {}, calibrationSupport: family === 'HISTORICAL_CALIBRATION_RECURRENCE' || family === 'FUTURE_RECURRENCE_WINDOW' ? { calibrationLevel: calibrationContext && calibrationContext.calibrationLevel || 'CALIBRATED' } : null, explanationKey: `career.signal.${family.toLowerCase()}`, provenance: { sourceEvidenceIds: items.map((item) => item.evidenceId) } });
}).filter(Boolean).sort((a, b) => a.signalId.localeCompare(b.signalId))); }
module.exports = { buildCareerInsightSignals, signalStatus: status };
