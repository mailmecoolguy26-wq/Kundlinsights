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
const D10_RELATION_TYPES = new Set(['CAREER_D10_PLACEMENT', 'CAREER_D10_TENTH_HOUSE', 'CAREER_D10_TENTH_LORD', 'CAREER_D10_TENTH_OCCUPANT']);
function adaptD10Evidence(domainGraph) {
  const relations = domainGraph && Array.isArray(domainGraph.derivedRelations)
    ? domainGraph.derivedRelations.filter((relation) => D10_RELATION_TYPES.has(relation.relationType))
    : [];
  if (!relations.length) return null;
  const relationIds = relations.map((relation) => relation.id).sort();
  const inputNodeIds = [...new Set(relations.flatMap((relation) => relation.inputNodeIds || []))].sort();
  return createInsightEvidence({
    evidenceId: `d10:${relationIds.join('|')}`,
    domain: 'CAREER',
    family: 'CAREER_FOUNDATION',
    sourceLayer: '12B',
    sourceRulesetId: domainGraph.rulesetId,
    sourceStrength: 'ENGINE_CONVENTION',
    subject: { entityType: 'VARGA', entityId: 'D10' },
    target: { entityType: 'DOMAIN', entityId: 'CAREER' },
    chart: 'D10',
    temporalContext: {},
    rawFacts: relations.map((relation) => ({ relationType: relation.relationType, fact: relation.fact })),
    rootSourceIds: inputNodeIds,
    evidenceFamilyIds: ['D10_DIVISIONAL'],
    lineage: { sourceRelationIds: relationIds, inputNodeIds },
    status: 'SUPPORTED',
    explanationKey: 'career.evidence.career_foundation',
    provenance: { sourceChart: 'D10', sourceRelationTypes: [...new Set(relations.map((relation) => relation.relationType))].sort() },
  });
}
function adaptCareerInsightEvidence({ conclusions = [], analysis = {}, domainGraph = null, calibrationContext = null } = {}) {
  const adapted = conclusions.map((conclusion) => adaptConclusion({ conclusion, analysis })).filter(Boolean);
  const d10 = adaptD10Evidence(domainGraph); if (d10) adapted.push(d10);
  if (calibrationContext && calibrationContext.calibrationLevel === 'CALIBRATED') {
    (calibrationContext.historicalEvidence || []).forEach((item) => adapted.push(calibrationEvidence(item, 'HISTORICAL_CALIBRATION_RECURRENCE', 'historical')));
    (calibrationContext.futureOccurrences || []).forEach((item) => adapted.push(calibrationEvidence(item, 'FUTURE_RECURRENCE_WINDOW', 'future')));
    (calibrationContext.composites || []).forEach((item) => adapted.push(calibrationEvidence(item, 'FUTURE_RECURRENCE_WINDOW', 'composite')));
  }
  return freeze([...new Map(adapted.map((item) => [item.evidenceId, item])).values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)));
}
module.exports = { adaptCareerInsightEvidence, familyForTopic, adaptD10Evidence };
