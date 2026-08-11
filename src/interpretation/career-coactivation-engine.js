'use strict';

const { createConclusion } = require('./conclusion-model');
const { CAREER_NATAL_RULES } = require('./career-rulebook');

const DASHA_RULE = 'career-h10-connected-dasha-activation-v1';
const GOCHAR_RULES = new Set(['career-gochar-structural-connection-v1', 'career-transit-event-timing-context-v1']);
const COACTIVATION_RULE = 'career-temporal-coactivation-v1';

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function utc(value) { const text = value && (value.utc || value); return typeof text === 'string' && text.endsWith('Z') && !Number.isNaN(Date.parse(text)) ? text : null; }
function pair(analysis, left, right) { return (analysis.pairwiseRelations || []).find((entry) => entry.leftNodeId === [left, right].sort()[0] && entry.rightNodeId === [left, right].sort()[1]) || null; }
function rule() { const value = CAREER_NATAL_RULES.find((item) => item.id === COACTIVATION_RULE); if (!value) throw new RangeError('Career temporal co-activation rule is not registered.'); return value; }
function contradictionGroups(analysis, ids) { return (analysis.contradictionGroups || []).filter((group) => group.memberNodeIds.some((id) => ids.includes(id))); }
function subjectOf(relation) { return relation && relation.subject ? { entityType: relation.subject.entityType, entityId: relation.subject.entityId } : null; }
function intervalOf(node) { const fact = node && node.fact || {}; const start = utc(fact.startInstant); const end = utc(fact.endInstant); return start && end ? { startInstant: start, endInstant: end } : null; }
function pointOf(node) { return utc(node && node.temporalContext && node.temporalContext.instant) || utc(node && node.fact && node.fact.instant); }
function pointInside(interval, point) { const value = Date.parse(point); return Date.parse(interval.startInstant) <= value && value < Date.parse(interval.endInstant); }

function buildCareerTemporalCoactivationConclusions({ domainGraph, temporalGraph, analysis, dashaConclusions, gocharConclusions } = {}) {
  if (!domainGraph || domainGraph.domain !== 'CAREER' || !temporalGraph || !analysis || !Array.isArray(dashaConclusions) || !Array.isArray(gocharConclusions)) throw new TypeError('Career graph, Layer 12C graph, Layer 12D analysis, and Layer 13B2/B3 conclusions are required.');
  const coRule = rule(); const careerIds = new Set((domainGraph.derivedRelations || []).map((item) => item.id));
  const nodes = new Map((temporalGraph.nodes || []).map((item) => [item.id, item])); const relations = new Map((temporalGraph.relations || []).map((item) => [item.id, item]));
  const analysisNodes = new Map((analysis.nodeAnalysis || []).map((item) => [item.nodeId, item]));
  function candidates(conclusions, isDasha) {
    const allowed = isDasha ? new Set([DASHA_RULE]) : GOCHAR_RULES;
    const result = [];
    conclusions.filter((conclusion) => conclusion && conclusion.conclusionStatus === 'SUPPORTED' && allowed.has(conclusion.interpretiveRuleId)).forEach((conclusion) => {
      (conclusion.evidenceIds || []).forEach((relationId) => {
        const relation = relations.get(relationId); if (!relation || relation.relationType !== 'TEMPORALLY_ACTIVATES') return;
        const careerId = relation.inputNodeIds.find((id) => careerIds.has(id)); const temporalId = relation.inputNodeIds.find((id) => nodes.has(id)); const node = nodes.get(temporalId);
        if (!careerId || !node || (isDasha ? node.sourceLayer !== '4' : !['9', '10'].includes(node.sourceLayer))) return;
        if (!analysisNodes.has(relationId) || !analysisNodes.has(temporalId)) throw new RangeError('Co-activation requires Layer 12D traceability for every selected temporal relation.');
        result.push({ conclusionId: conclusion.conclusionId, relationId, careerId, temporalId, node, mechanismFamily: isDasha ? 'DASHA' : node.sourceLayer === '9' ? 'GOCHAR_SNAPSHOT' : 'TRANSIT_EVENT' });
      });
    });
    return [...new Map(result.map((item) => [`${item.conclusionId}|${item.relationId}`, item])).values()].sort((left, right) => `${left.careerId}|${left.relationId}`.localeCompare(`${right.careerId}|${right.relationId}`));
  }
  const rawDashas = candidates(dashaConclusions, true);
  const dashas = [...rawDashas.reduce((groups, item) => {
    const key = `${item.conclusionId}|${item.careerId}`;
    const group = groups.get(key) || { ...item, relationIds: [], temporalIds: [], nodes: [] };
    group.relationIds.push(item.relationId); group.temporalIds.push(item.temporalId); group.nodes.push(item.node); groups.set(key, group); return groups;
  }, new Map()).values()].map((item) => ({ ...item, relationIds: [...new Set(item.relationIds)].sort(), temporalIds: [...new Set(item.temporalIds)].sort(), nodes: item.nodes.sort((left, right) => left.id.localeCompare(right.id)) }));
  const transits = candidates(gocharConclusions, false);
  const missing = (temporalGraph.missingData || []).map((node) => node.fact && node.fact.dataKey).filter(Boolean).sort();
  function absent(status) { return createConclusion({ domain: 'CAREER', topic: coRule.topic, rulesetId: coRule.rulesetId, interpretiveRuleId: coRule.id, ruleClassification: coRule.classification, conclusionStatus: status, evidenceIds: [], rootSourceIds: [], evidenceFamilyIds: [], independentMechanismFamilies: [], sourceStrengths: [], contradictions: [], unresolvedEvidenceIds: [], missingData: missing, temporalContext: { careerSubject: null, dashaIntervals: [], gocharSnapshotInstant: null, transitEventIds: [], coactivationInterval: null }, provenance: { analysisId: analysis.analysisId, sourceRefs: coRule.sourceRefs, sourceStatus: coRule.sourceStatus, independencePolicy: 'Layer-12D-temporal-node-INDEPENDENT-required; partial-overlap-does-not-qualify' } }); }
  if (missing.includes('dasha') || dashas.length === 0) return Object.freeze([absent('INSUFFICIENT_EVIDENCE')]);
  if (missing.includes('gochar') && missing.includes('transitEvents') || transits.length === 0) return Object.freeze([absent('INSUFFICIENT_EVIDENCE')]);
  const output = [];
  dashas.forEach((dasha) => transits.filter((transit) => transit.careerId === dasha.careerId).forEach((transit) => {
    const temporalPair = pair(analysis, dasha.temporalId, transit.temporalId); if (!temporalPair) throw new RangeError('Co-activation requires a Layer 12D temporal independence classification.');
    const intervals = dasha.nodes.map(intervalOf).filter(Boolean); const interval = intervals[0] || null; const point = pointOf(transit.node); const compatible = intervals.length > 0 && point ? intervals.every((value) => pointInside(value, point)) : false;
    const ids = [dasha.careerId, ...dasha.relationIds, ...dasha.temporalIds, transit.relationId, transit.temporalId].sort();
    const contradictions = contradictionGroups(analysis, ids);
    const qualifies = temporalPair.classification === 'INDEPENDENT' && compatible && contradictions.length === 0;
    const status = contradictions.length ? 'CONTRADICTED' : qualifies ? 'SUPPORTED' : 'NOT_APPLICABLE';
    const selected = ids.map((id) => analysisNodes.get(id)).filter(Boolean);
    const dashaIntervals = intervals;
    output.push(createConclusion({ domain: 'CAREER', topic: coRule.topic, rulesetId: coRule.rulesetId, interpretiveRuleId: coRule.id, ruleClassification: coRule.classification, conclusionStatus: status, evidenceIds: ids, rootSourceIds: [...new Set(selected.flatMap((item) => item.rootSourceIds || []))], evidenceFamilyIds: (analysis.evidenceFamilies || []).filter((family) => family.memberNodeIds.some((id) => ids.includes(id))).map((family) => family.familyId), independentMechanismFamilies: ['DASHA', transit.mechanismFamily], sourceStrengths: [...new Set(selected.flatMap((item) => item.sourceStrengths || []))], contradictions: contradictions.map((group) => group.contradictionGroupId), unresolvedEvidenceIds: temporalPair.classification === 'INDEPENDENT' ? [] : [temporalPair.leftNodeId, temporalPair.rightNodeId].sort(), missingData: [], temporalContext: { careerSubject: subjectOf((domainGraph.derivedRelations || []).find((item) => item.id === dasha.careerId)), dashaIntervals, gocharSnapshotInstant: transit.mechanismFamily === 'GOCHAR_SNAPSHOT' ? point : null, transitEventIds: transit.mechanismFamily === 'TRANSIT_EVENT' ? [transit.temporalId] : [], coactivationInterval: null, transitPointWithinDashaInterval: compatible }, provenance: { analysisId: analysis.analysisId, sourceRefs: coRule.sourceRefs, sourceStatus: coRule.sourceStatus, careerRelationId: dasha.careerId, dashaConclusionId: dasha.conclusionId, gocharOrTransitConclusionId: transit.conclusionId, dashaRelationIds: dasha.relationIds, gocharOrTransitRelationId: transit.relationId, temporalIndependence: temporalPair.classification, independenceRelation: temporalPair, temporalCompatibility: compatible ? 'supplied-point-inside-supplied-half-open-dasha-interval' : 'not-simultaneously-supplied', noOutcomeInference: true } }));
  }));
  if (!output.length) return Object.freeze([absent('NOT_APPLICABLE')]);
  return Object.freeze([...new Map(output.map((item) => [item.conclusionId, item])).values()].sort((left, right) => left.conclusionId.localeCompare(right.conclusionId)));
}

module.exports = { buildCareerTemporalCoactivationConclusions };
