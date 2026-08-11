'use strict';

const { createConclusion } = require('./conclusion-model');
const { CAREER_CLASSICAL_EVENT_RULES } = require('./career-rulebook');

const RULE_ID = 'career-venus-md-saturn-ad-professional-loss-predicate-v1';
const NATAL_TYPES = new Set(['CAREER_STATUS_SATURN_NATAL_HOUSE', 'CAREER_STATUS_SATURN_FROM_VENUS']);

function utc(value) {
  const text = value && (value.utc || value);
  return typeof text === 'string' && text.endsWith('Z') && !Number.isNaN(Date.parse(text)) ? text : null;
}
function within(interval, instant) {
  const point = utc(instant); const start = utc(interval && interval.startInstant); const end = utc(interval && interval.endInstant);
  return Boolean(point && start && end && Date.parse(start) <= Date.parse(point) && Date.parse(point) < Date.parse(end));
}
function contains(parent, child) {
  const parentStart = utc(parent && parent.fact && parent.fact.startInstant);
  const parentEnd = utc(parent && parent.fact && parent.fact.endInstant);
  const childStart = utc(child && child.fact && child.fact.startInstant);
  const childEnd = utc(child && child.fact && child.fact.endInstant);
  return Boolean(parentStart && parentEnd && childStart && childEnd && Date.parse(parentStart) <= Date.parse(childStart) && Date.parse(childEnd) <= Date.parse(parentEnd));
}
function rule() {
  const value = CAREER_CLASSICAL_EVENT_RULES.find((item) => item.id === RULE_ID);
  if (!value) throw new RangeError('Career classical event rule is not registered.');
  return value;
}
function relevantContradictions(analysis, ids) {
  return (analysis.contradictionGroups || []).filter((group) => group.memberNodeIds.some((id) => ids.includes(id)));
}
function traceability(analysis, ids) {
  const nodes = new Map((analysis.nodeAnalysis || []).map((item) => [item.nodeId, item]));
  const selected = ids.map((id) => nodes.get(id)).filter(Boolean);
  return {
    rootSourceIds: [...new Set(selected.flatMap((item) => item.rootSourceIds || []))],
    evidenceFamilyIds: (analysis.evidenceFamilies || []).filter((family) => family.memberNodeIds.some((id) => ids.includes(id))).map((family) => family.familyId),
    sourceStrengths: [...new Set(selected.flatMap((item) => item.sourceStrengths || []))]
  };
}
function dashaNode(node, level, lord) {
  return node && node.sourceLayer === '4' && node.fact && node.fact.dashaLevel === level && node.fact.lord === lord;
}
function hasMissingNatalEvidence(domainGraph) {
  return (domainGraph.missingData || []).some((item) => /Saturn|Venus/i.test(item.dataKey || item.fact && item.fact.dataKey || ''));
}

function buildCareerClassicalEventConclusions({ domainGraph, temporalGraph, analysis } = {}) {
  if (!domainGraph || domainGraph.domain !== 'CAREER' || !temporalGraph || !Array.isArray(temporalGraph.nodes) || !Array.isArray(temporalGraph.relations) || !analysis || !Array.isArray(analysis.nodeAnalysis)) throw new TypeError('Layer 12B3 Career evidence, Layer 12C temporal evidence, and Layer 12D analysis are required.');
  const currentRule = rule();
  const analysisIds = new Set(analysis.nodeAnalysis.map((item) => item.nodeId));
  const natal = (domainGraph.derivedRelations || []).filter((item) => NATAL_TYPES.has(item.relationType));
  const nodes = new Map(temporalGraph.nodes.map((item) => [item.id, item]));
  const relations = temporalGraph.relations.filter((item) => item.relationType === 'TEMPORALLY_ACTIVATES' && item.fact && item.fact.mechanism === 'active-vimshottari-period');
  const md = [...nodes.values()].filter((item) => dashaNode(item, 'mahadasha', 'Venus'));
  const ad = [...nodes.values()].filter((item) => dashaNode(item, 'antardasha', 'Saturn'));
  const missingDasha = (temporalGraph.missingData || []).some((item) => (item.fact && item.fact.dataKey) === 'dasha');
  const instant = temporalGraph.instant || null;
  const dashaRelations = (node) => relations.filter((item) => item.inputNodeIds.includes(node.id));
  const selectedNatalIds = natal.map((item) => item.id).sort();
  const mdRelations = md.flatMap(dashaRelations);
  const adRelations = ad.flatMap(dashaRelations);
  const hierarchyIntervalsContain = md.some((parent) => ad.some((child) => contains(parent, child)));
  const completeHierarchy = hierarchyIntervalsContain && (!instant || md.some((parent) => ad.some((child) => contains(parent, child) && within(parent.fact, instant) && within(child.fact, instant))));
  const anyMd = [...nodes.values()].some((item) => item.sourceLayer === '4' && item.fact && item.fact.dashaLevel === 'mahadasha');
  const anyAd = [...nodes.values()].some((item) => item.sourceLayer === '4' && item.fact && item.fact.dashaLevel === 'antardasha');
  const ids = [...new Set([...selectedNatalIds, ...md.map((item) => item.id), ...ad.map((item) => item.id), ...mdRelations.map((item) => item.id), ...adRelations.map((item) => item.id)])].sort();
  const selectedTraceability = traceability(analysis, ids);
  const traceable = ids.every((id) => analysisIds.has(id));
  let status;
  if (!natal.length && hasMissingNatalEvidence(domainGraph) || missingDasha || !traceable && ids.length > 0) status = 'INSUFFICIENT_EVIDENCE';
  else if (!natal.length && !hasMissingNatalEvidence(domainGraph)) status = 'NOT_APPLICABLE';
  else if (!anyMd || !anyAd) status = 'INSUFFICIENT_EVIDENCE';
  else if (!md.length || !ad.length) status = 'NOT_APPLICABLE';
  else if (!hierarchyIntervalsContain) status = 'INSUFFICIENT_EVIDENCE';
  else if (!completeHierarchy) status = 'NOT_APPLICABLE';
  else status = 'SUPPORTED';
  const contradictions = relevantContradictions(analysis, ids);
  if (contradictions.length) status = 'CONTRADICTED';
  const interval = md.find((parent) => ad.some((child) => contains(parent, child))) || null;
  const qualifyingAd = interval && ad.find((child) => contains(interval, child)) || null;
  const pd = [...nodes.values()].filter((item) => dashaNode(item, 'pratyantardasha', item.fact && item.fact.lord));
  const missingData = [
    ...(!natal.length && hasMissingNatalEvidence(domainGraph) ? (domainGraph.missingData || []).map((item) => item.id).filter(Boolean) : []),
    ...(missingDasha ? (temporalGraph.missingData || []).map((item) => item.id).filter(Boolean) : []),
    ...(!traceable && ids.length ? ids.filter((id) => !analysisIds.has(id)) : [])
  ];
  return Object.freeze([createConclusion({
    domain: 'CAREER', topic: currentRule.topic, rulesetId: currentRule.rulesetId, interpretiveRuleId: currentRule.id, ruleClassification: currentRule.classification, conclusionStatus: status,
    evidenceIds: ids, rootSourceIds: selectedTraceability.rootSourceIds, evidenceFamilyIds: selectedTraceability.evidenceFamilyIds, independentMechanismFamilies: ['NATAL_STRUCTURE', 'DASHA'], sourceStrengths: selectedTraceability.sourceStrengths,
    contradictions: contradictions.map((item) => item.contradictionGroupId), unresolvedEvidenceIds: status === 'INSUFFICIENT_EVIDENCE' ? missingData : [], missingData,
    temporalContext: { dashaIntervals: qualifyingAd ? [{ level: 'AD', lord: 'Saturn', startInstant: qualifyingAd.fact.startInstant, endInstant: qualifyingAd.fact.endInstant, temporalNodeId: qualifyingAd.id }]
      : [], gocharSnapshotInstant: null, transitEventIds: [], pratyantardashaContext: pd.map((item) => ({ lord: item.fact.lord, startInstant: item.fact.startInstant, endInstant: item.fact.endInstant, temporalNodeId: item.id })) },
    provenance: {
      analysisId: analysis.analysisId, sourceRefs: currentRule.sourceRefs, sourceStatus: currentRule.sourceStatus, sourcePredicateId: currentRule.sourcePredicateId,
      natalRelationIds: selectedNatalIds, natalBranchesPresent: [...new Set(natal.map((item) => item.relationType))].sort(), natalSourcePredicateProvenance: natal.map((item) => item.provenance && item.provenance.sourcePredicate).filter(Boolean), venusMahadashaTemporalNodeIds: md.map((item) => item.id).sort(), venusMahadashaTemporalRelationIds: mdRelations.map((item) => item.id).sort(), saturnAntardashaTemporalNodeIds: ad.map((item) => item.id).sort(), saturnAntardashaTemporalRelationIds: adRelations.map((item) => item.id).sort(),
      dashaHierarchy: completeHierarchy ? 'supplied-Saturn-AD-within-supplied-Venus-MD-half-open-interval' : 'not-established-from-supplied-evidence', pratyantardashaPolicy: 'optional-context-only', gocharPolicy: 'not-required-and-not-consumed', predicateMeaning: 'source-defined-classical-predicate-satisfied-not-guaranteed-outcome', layer5cYuti: 'not-consumed', noAstronomyCalculation: true, noDashaCalculation: true
    }
  })]);
}

module.exports = { buildCareerClassicalEventConclusions, CAREER_CLASSICAL_EVENT_RULE_ID: RULE_ID };
