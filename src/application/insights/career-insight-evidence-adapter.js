'use strict';

const { freeze } = require('../../synthesis/evidence-node');
const { createInsightEvidence } = require('./career-insight-contract');
const { FAMILY_METADATA } = require('./career-insight-rulebook');

function familyForTopic(topic) { return Object.entries(FAMILY_METADATA).find(([, value]) => value.conclusionTopics.includes(topic))?.[0] || null; }
function adaptConclusion({ conclusion, analysis }) {
  const family = familyForTopic(conclusion.topic); if (!family) return null;
  const nodes = new Map((analysis.nodeAnalysis || []).map((node) => [node.nodeId, node]));
  const evidenceId = `conclusion:${conclusion.conclusionId}`;
  return createInsightEvidence({ evidenceId, domain: 'CAREER', family, sourceLayer: '13', sourceRulesetId: conclusion.rulesetId, sourceStrength: conclusion.sourceStrengths && conclusion.sourceStrengths[0] || null, subject: conclusion.temporalContext && conclusion.temporalContext.careerSubject || null, target: null, chart: null, temporalContext: conclusion.temporalContext, rawFacts: { topic: conclusion.topic, conclusionStatus: conclusion.conclusionStatus, ruleId: conclusion.interpretiveRuleId, evidenceIds: conclusion.evidenceIds }, rootSourceIds: conclusion.rootSourceIds || [], evidenceFamilyIds: conclusion.evidenceFamilyIds || [], lineage: { conclusionId: conclusion.conclusionId, sourceEvidenceIds: conclusion.evidenceIds || [], nodeAnalysis: (conclusion.evidenceIds || []).map((id) => nodes.get(id)).filter(Boolean) }, status: conclusion.conclusionStatus, explanationKey: `career.evidence.${family.toLowerCase()}`, provenance: { sourceConclusionId: conclusion.conclusionId, sourceRuleId: conclusion.interpretiveRuleId, sourceRulesetId: conclusion.rulesetId, sourceRefs: conclusion.provenance && conclusion.provenance.sourceRefs || [] } });
}
function calibrationEvidence(item, family, kind) { return createInsightEvidence({ evidenceId: item.evidenceId, domain: 'CAREER', family, sourceLayer: 'CALIBRATION', sourceRulesetId: item.rulesetId || kind, sourceStrength: 'ENGINE_CONVENTION', subject: null, target: null, chart: null, temporalContext: item.occurrenceType === 'EVENT' ? { instant: item.instant } : { from: item.from, to: item.to }, rawFacts: item, rootSourceIds: item.sourceEventIds || [], evidenceFamilyIds: [item.contextKey].filter(Boolean), lineage: { calibrationEvidenceId: item.evidenceId, sourceEventIds: item.sourceEventIds || [] }, status: 'SUPPORTED', explanationKey: `career.evidence.${family.toLowerCase()}`, provenance: { calibration: true, kind } }); }
function adaptCareerInsightEvidence({ conclusions = [], analysis = {}, calibrationContext = null } = {}) {
  const adapted = conclusions.map((conclusion) => adaptConclusion({ conclusion, analysis })).filter(Boolean);
  if (calibrationContext && calibrationContext.calibrationLevel === 'CALIBRATED') {
    (calibrationContext.historicalEvidence || []).forEach((item) => adapted.push(calibrationEvidence(item, 'HISTORICAL_CALIBRATION_RECURRENCE', 'historical')));
    (calibrationContext.futureOccurrences || []).forEach((item) => adapted.push(calibrationEvidence(item, 'FUTURE_RECURRENCE_WINDOW', 'future')));
    (calibrationContext.composites || []).forEach((item) => adapted.push(calibrationEvidence(item, 'FUTURE_RECURRENCE_WINDOW', 'composite')));
  }
  return freeze([...new Map(adapted.map((item) => [item.evidenceId, item])).values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)));
}
module.exports = { adaptCareerInsightEvidence, familyForTopic };
