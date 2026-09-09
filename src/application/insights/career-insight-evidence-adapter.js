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
function publicAshtakavargaContext(relations) {
  return relations.flatMap((relation) => relation.fact && relation.fact.selections || [])
    .filter((selection) => ['SAV', 'BAV', 'LAGNA_BAV'].includes(selection.scoreType))
    .map((selection) => ({
      sourceFamily: 'ASHTAKAVARGA',
      scoreType: selection.scoreType,
      houseNumber: selection.houseNumber,
      rashiIndex: selection.rashiIndex,
      value: selection.rawValue,
      ...(selection.planet ? { planet: selection.planet } : {}),
    }))
    .sort((left, right) => `${left.scoreType}|${left.houseNumber}|${left.planet || ''}|${left.rashiIndex}`.localeCompare(`${right.scoreType}|${right.houseNumber}|${right.planet || ''}|${right.rashiIndex}`));
}
function adaptAshtakavargaEvidence(domainGraph) {
  const relations = domainGraph && Array.isArray(domainGraph.derivedRelations)
    ? domainGraph.derivedRelations.filter((relation) => relation.relationType === 'CAREER_ASHTAKAVARGA_CONTEXT')
    : [];
  const publicContext = publicAshtakavargaContext(relations);
  if (!publicContext.length) return null;
  const relationIds = relations.map((relation) => relation.id).sort();
  const inputNodeIds = [...new Set(relations.flatMap((relation) => relation.inputNodeIds || []))].sort();
  return createInsightEvidence({
    evidenceId: `ashtakavarga:${relationIds.join('|')}`,
    domain: 'CAREER',
    family: 'CAREER_FOUNDATION',
    sourceLayer: '12B',
    sourceRulesetId: domainGraph.rulesetId,
    sourceStrength: 'ENGINE_CONVENTION',
    subject: { entityType: 'NATAL_CHART', entityId: 'D1' },
    target: { entityType: 'DOMAIN', entityId: 'CAREER' },
    chart: 'D1',
    temporalContext: {},
    rawFacts: relations.map((relation) => ({ relationType: relation.relationType, fact: relation.fact })),
    rootSourceIds: inputNodeIds,
    evidenceFamilyIds: ['ASHTAKAVARGA_NATAL'],
    lineage: { sourceRelationIds: relationIds, inputNodeIds },
    status: 'SUPPORTED',
    explanationKey: 'career.evidence.career_foundation',
    provenance: { sourceFamily: 'ASHTAKAVARGA', publicContext },
  });
}
function adaptPlanetaryStateEvidence(domainGraph) {
  const relations = domainGraph && Array.isArray(domainGraph.derivedRelations)
    ? domainGraph.derivedRelations.filter((relation) => ['CAREER_HOUSE_LORD_STATE', 'CAREER_OCCUPANT_STATE'].includes(relation.relationType))
    : [];
  const labels = { ownSign: 'OWN_SIGN', exalted: 'EXALTED', debilitated: 'DEBILITATED', moolatrikona: 'MOOLATRIKONA', combust: 'COMBUST', retrograde: 'RETROGRADE' };
  const states = relations.flatMap((relation) => Object.entries(relation.fact && relation.fact.suppliedStateFlags || {}).filter(([, value]) => value === true).map(([state]) => ({ planet: relation.subject.entityId, state: labels[state], chart: 'D1' })).filter((item) => item.state));
  if (!states.length) return null;
  const relationIds = relations.map((relation) => relation.id).sort();
  const inputNodeIds = [...new Set(relations.flatMap((relation) => relation.inputNodeIds || []))].sort();
  return createInsightEvidence({ evidenceId: `planetary-state:${relationIds.join('|')}`, domain: 'CAREER', family: 'CAREER_FOUNDATION', sourceLayer: '12B', sourceRulesetId: domainGraph.rulesetId, sourceStrength: 'ENGINE_CONVENTION', subject: { entityType: 'NATAL_CHART', entityId: 'D1' }, target: { entityType: 'DOMAIN', entityId: 'CAREER' }, chart: 'D1', temporalContext: {}, rawFacts: relations.map((relation) => ({ relationType: relation.relationType, suppliedStateFlags: relation.fact.suppliedStateFlags })), rootSourceIds: inputNodeIds, evidenceFamilyIds: ['PLANETARY_STATE_NATAL'], lineage: { sourceRelationIds: relationIds, inputNodeIds }, status: 'SUPPORTED', explanationKey: 'career.evidence.career_foundation', provenance: { sourceFamily: 'PLANETARY_STATE', publicContext: states.sort((a, b) => `${a.planet}|${a.state}`.localeCompare(`${b.planet}|${b.state}`)) } });
}
function adaptPlanetaryRelationshipEvidence(domainGraph) {
  const relations = domainGraph && Array.isArray(domainGraph.derivedRelations) ? domainGraph.derivedRelations.filter((relation) => relation.relationType === 'CAREER_HOUSE_LORD_STATE' && Array.isArray(relation.fact && relation.fact.relationships)) : [];
  const publicContext = relations.flatMap((relation) => relation.fact.relationships).filter((item) => item && item.chart === 'D1' && typeof item.subjectPlanet === 'string' && typeof item.targetPlanet === 'string').flatMap((item) => [['NATURAL', item.natural], ['TEMPORARY', item.temporary], ['PANCHADHA', item.panchadha]].filter(([, relationship]) => typeof relationship === 'string').map(([relationshipType, relationship]) => ({ sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: item.subjectPlanet, targetPlanet: item.targetPlanet, relationshipType, relationship, chart: 'D1' }))).sort((a, b) => `${a.subjectPlanet}|${a.targetPlanet}|${a.relationshipType}`.localeCompare(`${b.subjectPlanet}|${b.targetPlanet}|${b.relationshipType}`));
  if (!publicContext.length) return null;
  const relationIds = relations.map((relation) => relation.id).sort(); const inputNodeIds = [...new Set(relations.flatMap((relation) => relation.inputNodeIds || []))].sort();
  return createInsightEvidence({ evidenceId: `planetary-relationship:${relationIds.join('|')}`, domain: 'CAREER', family: 'CAREER_FOUNDATION', sourceLayer: '12B', sourceRulesetId: domainGraph.rulesetId, sourceStrength: 'ENGINE_CONVENTION', subject: { entityType: 'NATAL_CHART', entityId: 'D1' }, target: { entityType: 'DOMAIN', entityId: 'CAREER' }, chart: 'D1', temporalContext: {}, rawFacts: relations.map((relation) => ({ relationships: relation.fact.relationships })), rootSourceIds: inputNodeIds, evidenceFamilyIds: ['PLANETARY_RELATIONSHIP_NATAL'], lineage: { sourceRelationIds: relationIds, inputNodeIds }, status: 'SUPPORTED', explanationKey: 'career.evidence.career_foundation', provenance: { sourceFamily: 'PLANETARY_RELATIONSHIP', publicContext } });
}
function adaptCareerInsightEvidence({ conclusions = [], analysis = {}, domainGraph = null, calibrationContext = null } = {}) {
  const adapted = conclusions.map((conclusion) => adaptConclusion({ conclusion, analysis })).filter(Boolean);
  const d10 = adaptD10Evidence(domainGraph); if (d10) adapted.push(d10);
  // Scores are factual context only. They can supplement an existing D1
  // foundation conclusion, never originate an Insight or alter its status.
  if (adapted.some((item) => item.family === 'CAREER_FOUNDATION')) {
    const ashtakavarga = adaptAshtakavargaEvidence(domainGraph); if (ashtakavarga) adapted.push(ashtakavarga);
    const planetaryState = adaptPlanetaryStateEvidence(domainGraph); if (planetaryState) adapted.push(planetaryState);
    const planetaryRelationship = adaptPlanetaryRelationshipEvidence(domainGraph); if (planetaryRelationship) adapted.push(planetaryRelationship);
  }
  if (calibrationContext && calibrationContext.calibrationLevel === 'CALIBRATED') {
    (calibrationContext.historicalEvidence || []).forEach((item) => adapted.push(calibrationEvidence(item, 'HISTORICAL_CALIBRATION_RECURRENCE', 'historical')));
    (calibrationContext.futureOccurrences || []).forEach((item) => adapted.push(calibrationEvidence(item, 'FUTURE_RECURRENCE_WINDOW', 'future')));
    (calibrationContext.composites || []).forEach((item) => adapted.push(calibrationEvidence(item, 'FUTURE_RECURRENCE_WINDOW', 'composite')));
  }
  return freeze([...new Map(adapted.map((item) => [item.evidenceId, item])).values()].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)));
}
module.exports = { adaptCareerInsightEvidence, familyForTopic, adaptD10Evidence, adaptAshtakavargaEvidence, adaptPlanetaryStateEvidence, adaptPlanetaryRelationshipEvidence };
