'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CAREER_NATAL_RULES, createInterpretiveRuleRegistry, buildCareerTemporalCoactivationConclusions } = require('../../src/interpretation');

function fixture({ subject = 'c:h10Lord', transitSubject = subject, transitLayer = '9', classification = 'INDEPENDENT', instant = '2024-06-01T00:00:00.000Z', dashaEnd = '2025-01-01T00:00:00.000Z', missing = [], contradiction = false, dashaLevels = ['mahadasha', 'antardasha'] } = {}) {
  const dashaNodes = dashaLevels.map((level) => ({ id: `d:${level}`, sourceLayer: '4', temporalContext: { instant }, fact: { dashaLevel: level, lord: 'Jupiter', startInstant: { utc: '2024-01-01T00:00:00.000Z' }, endInstant: { utc: dashaEnd } } }));
  const transitNode = { id: transitLayer === '9' ? 'g:1' : 'e:1', sourceLayer: transitLayer, temporalContext: { instant }, fact: transitLayer === '10' ? { eventType: 'rashiIngress', instant } : {} };
  const relations = [
    ...dashaNodes.map((node) => ({ id: `r:${node.id}`, relationType: 'TEMPORALLY_ACTIVATES', fact: { mechanism: 'active-vimshottari-period' }, inputNodeIds: [subject, node.id] })),
    { id: `r:${transitNode.id}`, relationType: 'TEMPORALLY_ACTIVATES', fact: { mechanism: transitLayer === '9' ? 'supplied-gochar-snapshot' : 'supplied-transit-event' }, inputNodeIds: [transitSubject, transitNode.id] }
  ];
  const allIds = [subject, transitSubject, ...dashaNodes.map((node) => node.id), transitNode.id, ...relations.map((relation) => relation.id)];
  const nodeAnalysis = [...new Set(allIds)].map((id) => ({ nodeId: id, rootSourceIds: [`root:${id}`], sourceStrengths: ['ENGINE_CONVENTION'] }));
  const dashaConclusion = { conclusionId: 'conclusion:dasha', interpretiveRuleId: 'career-h10-connected-dasha-activation-v1', conclusionStatus: 'SUPPORTED', evidenceIds: relations.filter((relation) => relation.id.startsWith('r:d:')).map((relation) => relation.id) };
  const gocharConclusion = { conclusionId: 'conclusion:gochar', interpretiveRuleId: transitLayer === '9' ? 'career-gochar-structural-connection-v1' : 'career-transit-event-timing-context-v1', conclusionStatus: 'SUPPORTED', evidenceIds: [`r:${transitNode.id}`] };
  return {
    domainGraph: { domain: 'CAREER', derivedRelations: [{ id: subject, subject: { entityType: 'HOUSE', entityId: subject.includes('h11') ? '11' : subject.includes('h2') ? '2' : '10' }, target: { entityType: 'GRAHA', entityId: 'Jupiter' } }, ...(transitSubject === subject ? [] : [{ id: transitSubject, subject: { entityType: 'HOUSE', entityId: '11' }, target: { entityType: 'GRAHA', entityId: 'Saturn' } }])] },
    temporalGraph: { nodes: [...dashaNodes, transitNode], relations, missingData: missing.map((dataKey) => ({ fact: { dataKey } })) },
    analysis: { analysisId: 'analysis:coactivation', nodeAnalysis, evidenceFamilies: [{ familyId: 'family:all', memberNodeIds: allIds }], pairwiseRelations: dashaNodes.map((node) => ({ leftNodeId: [node.id, transitNode.id].sort()[0], rightNodeId: [node.id, transitNode.id].sort()[1], classification, sharedRootSourceIds: [] })), contradictionGroups: contradiction ? [{ contradictionGroupId: 'contradiction:required', memberNodeIds: [subject, relations[0].id] }] : [] },
    dashaConclusions: missing.includes('dasha') ? [] : [dashaConclusion],
    gocharConclusions: missing.includes('gochar') || missing.includes('transitEvents') ? [] : [gocharConclusion]
  };
}

test('allowlists exactly the authorized ENGINE_CONVENTION production rule and rejects an unauthorized co-activation rule', () => {
  const registry = createInterpretiveRuleRegistry({ rules: CAREER_NATAL_RULES });
  assert.ok(registry.productionRules.includes('career-temporal-coactivation-v1'));
  assert.throws(() => createInterpretiveRuleRegistry({ rules: [{ ...CAREER_NATAL_RULES.find((rule) => rule.id === 'career-temporal-coactivation-v1'), id: 'career-unauthorized-coactivation-v1' }] }), /allowlisted/);
});

test('supports independent same-subject Dasha plus Gochar/transit co-activation, including H2/H11 without outcomes', () => {
  const h10 = buildCareerTemporalCoactivationConclusions(fixture());
  assert.equal(h10[0].conclusionStatus, 'SUPPORTED');
  assert.deepEqual(h10[0].independentMechanismFamilies, ['DASHA', 'GOCHAR_SNAPSHOT']);
  assert.equal(h10[0].temporalContext.transitPointWithinDashaInterval, true);
  const event = buildCareerTemporalCoactivationConclusions(fixture({ transitLayer: '10' }));
  assert.equal(event[0].conclusionStatus, 'SUPPORTED');
  assert.deepEqual(event[0].temporalContext.transitEventIds, ['e:1']);
  assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ subject: 'c:h10Occupant', transitLayer: '10' }))[0].conclusionStatus, 'SUPPORTED');
  for (const subject of ['c:h2', 'c:h11']) assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ subject }))[0].conclusionStatus, 'SUPPORTED');
  const text = JSON.stringify([h10, event]);
  for (const forbidden of ['salary', 'promotion', 'jobChange', 'jobLoss', 'outcome', 'score', 'probability', 'confidence']) assert.equal(text.includes(`\"${forbidden}\"`), false, forbidden);
});

test('requires a same subject, independent temporal lineage, supplied compatible time, and exposes contradictions', () => {
  assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ transitSubject: 'c:h11' }))[0].conclusionStatus, 'NOT_APPLICABLE');
  for (const classification of ['IDENTICAL', 'FULLY_DEPENDENT', 'PARTIALLY_OVERLAPPING']) assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ classification }))[0].conclusionStatus, 'NOT_APPLICABLE', classification);
  assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ instant: '2025-01-01T00:00:00.000Z' }))[0].conclusionStatus, 'NOT_APPLICABLE');
  const contradicted = buildCareerTemporalCoactivationConclusions(fixture({ contradiction: true }))[0];
  assert.equal(contradicted.conclusionStatus, 'CONTRADICTED');
  assert.deepEqual(contradicted.contradictions, ['contradiction:required']);
});

test('keeps MD/AD hierarchy one Dasha family, preserves multiple qualifying transit paths without weighting, and handles missing data neutrally', () => {
  const hierarchical = buildCareerTemporalCoactivationConclusions(fixture({ dashaLevels: ['mahadasha', 'antardasha', 'pratyantardasha'] }));
  assert.equal(hierarchical.length, 1);
  assert.deepEqual(hierarchical[0].independentMechanismFamilies, ['DASHA', 'GOCHAR_SNAPSHOT']);
  assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ missing: ['dasha'] }))[0].conclusionStatus, 'INSUFFICIENT_EVIDENCE');
  assert.equal(buildCareerTemporalCoactivationConclusions(fixture({ missing: ['gochar', 'transitEvents'] }))[0].conclusionStatus, 'INSUFFICIENT_EVIDENCE');
  const duplicate = fixture(); duplicate.gocharConclusions.push({ ...duplicate.gocharConclusions[0] });
  assert.equal(buildCareerTemporalCoactivationConclusions(duplicate).length, 1);
});

test('is deterministic, deeply immutable, frozen-input safe, traceable, and provider independent', () => {
  const input = fixture(); const before = JSON.stringify(input); const first = buildCareerTemporalCoactivationConclusions(input); const second = buildCareerTemporalCoactivationConclusions({ ...input, temporalGraph: { ...input.temporalGraph, relations: [...input.temporalGraph.relations].reverse() } });
  assert.deepEqual(first, second); assert.equal(JSON.stringify(input), before); assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first[0].provenance.independenceRelation), true);
  assert.equal(first[0].provenance.dashaConclusionId, 'conclusion:dasha'); assert.equal(first[0].provenance.gocharOrTransitConclusionId, 'conclusion:gochar');
  assert.equal(/swiss|astronomy|ayanamsha|provider/i.test(require('node:fs').readFileSync(require.resolve('../../src/interpretation/career-coactivation-engine'), 'utf8')), false);
});
