'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EvidenceGraphBuilder, buildCareerEvidence } = require('../../src/synthesis');

function graphFixture({ occupants = ['Saturn'], includeState = true, includeDrishti = true, includeD10 = true, includeAshtaka = true, duplicateH10Lord = null, contradictoryD10 = false, includeContexts = false, reverseContexts = false, missingContexts = false, duplicateH2Lord = null } = {}) {
  const builder = new EvidenceGraphBuilder({ sourceIdentity: 'career-provisional-meena-lagna-fixture' });
  const add = (input) => builder.addFact({ sourceStrength: 'ENGINE_CONVENTION', ...input });
  const h10 = { houseNumber: 10, rashi: { rashiIndex: 9, rashiName: 'Dhanu' }, rashiHouseLord: { name: 'Jupiter' } };
  add({ subject: { entityType: 'HOUSE', entityId: '10' }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: 'houses.10', fact: h10 });
  if (includeContexts) {
    const contexts = [
      { number: 2, rashiIndex: 1, lord: 'Mars' },
      { number: 11, rashiIndex: 10, lord: 'Saturn' }
    ];
    (reverseContexts ? [...contexts].reverse() : contexts).forEach(({ number, rashiIndex, lord }) => add({ subject: { entityType: 'HOUSE', entityId: String(number) }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: `houses.${number}`, fact: { houseNumber: number, rashi: { rashiIndex }, rashiHouseLord: { name: lord } } }));
    if (duplicateH2Lord) add({ subject: { entityType: 'HOUSE', entityId: '2' }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: 'houses.2.conflict', fact: { houseNumber: 2, rashi: { rashiIndex: 1 }, rashiHouseLord: { name: duplicateH2Lord } } });
  }
  if (missingContexts) [2, 11].forEach((number) => builder.addMissingData({ subject: { entityType: 'NATAL_CHART', entityId: 'natal' }, sourceLayer: '12A', sourceRulesetId: 'parashari-evidence-graph-v1', sourceIdentity: `missing:H${number}`, sourceStrength: 'ENGINE_CONVENTION', dataKey: `H${number}`, status: 'notProvided' }));
  if (duplicateH10Lord) add({ subject: { entityType: 'HOUSE', entityId: '10' }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: 'houses.10.conflict', fact: { ...h10, rashiHouseLord: { name: duplicateH10Lord } } });
  add({ subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: 'planetaryAssignments.Jupiter', fact: { body: 'Jupiter', rashi: { rashiIndex: 4, rashiName: 'Karka' }, rashiHouseNumber: 5 } });
  occupants.forEach((body, index) => add({ subject: { entityType: 'GRAHA', entityId: body }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: `planetaryAssignments.${body}`, fact: { body, rashi: { rashiIndex: index + 9 }, rashiHouseNumber: 10 } }));
  if (includeContexts) {
    const contextAssignments = [
      { body: 'Mars', rashiIndex: 9, house: 10 },
      { body: 'Saturn', rashiIndex: 1, house: 2 },
      { body: 'Venus', rashiIndex: 10, house: 11 }
    ];
    (reverseContexts ? [...contextAssignments].reverse() : contextAssignments).forEach(({ body, rashiIndex, house }) => add({ subject: { entityType: 'GRAHA', entityId: body }, sourceLayer: '5A', sourceRulesetId: 'parashari-rashi-house-v1', sourceIdentity: `planetaryAssignments.context.${body}`, fact: { body, rashi: { rashiIndex }, rashiHouseNumber: house } }));
  }
  if (includeState) {
    add({ subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5B', sourceRulesetId: 'parashari-planetary-state-v1', sourceIdentity: 'planetaryState.Jupiter', fact: { dignity: { isExalted: true, isOwnSign: false, isDebilitated: false, isMoolatrikona: false }, combustion: { isCombust: false }, motion: { isRetrograde: false } } });
    occupants.forEach((body) => add({ subject: { entityType: 'GRAHA', entityId: body }, sourceLayer: '5B', sourceRulesetId: 'parashari-planetary-state-v1', sourceIdentity: `planetaryState.${body}`, fact: { dignity: { isExalted: false }, combustion: { isCombust: false }, motion: { isRetrograde: true } } }));
    if (includeContexts) ['Mars', 'Saturn', 'Venus'].forEach((body) => add({ subject: { entityType: 'GRAHA', entityId: body }, sourceLayer: '5B', sourceRulesetId: 'parashari-planetary-state-v1', sourceIdentity: `planetaryState.context.${body}`, fact: { dignity: { isExalted: body === 'Venus', isOwnSign: false, isDebilitated: false, isMoolatrikona: false }, combustion: { isCombust: false }, motion: { isRetrograde: body === 'Saturn' } } }));
  }
  if (includeDrishti) {
    add({ subject: { entityType: 'GRAHA', entityId: 'Mars' }, sourceLayer: '6', sourceRulesetId: 'parashari-graha-drishti-v1', sourceIdentity: 'rashiAspects.Mars.4.9', sourceStrength: 'DIRECT_CLASSICAL', fact: { fromBody: 'Mars', aspectNumber: 4, targetRashi: { rashiIndex: 9 }, targetHouseNumber: 10, targetBodies: [{ body: 'Saturn' }] } });
    add({ subject: { entityType: 'GRAHA', entityId: 'Saturn' }, sourceLayer: '6', sourceRulesetId: 'parashari-graha-drishti-v1', sourceIdentity: 'rashiAspects.Saturn.10.4', sourceStrength: 'DIRECT_CLASSICAL', fact: { fromBody: 'Saturn', aspectNumber: 10, targetRashi: { rashiIndex: 4 }, targetHouseNumber: 5, targetBodies: [{ body: 'Jupiter' }] } });
    if (includeContexts) add({ subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '6', sourceRulesetId: 'parashari-graha-drishti-v1', sourceIdentity: 'rashiAspects.Jupiter.5.1', sourceStrength: 'DIRECT_CLASSICAL', fact: { fromBody: 'Jupiter', aspectNumber: 5, targetRashi: { rashiIndex: 1 }, targetHouseNumber: 2, targetBodies: [{ body: 'Mars' }] } });
  }
  if (includeD10) {
    add({ subject: { entityType: 'VARGA', entityId: 'D10' }, sourceLayer: '3', sourceRulesetId: 'parashari-varga-engine-v1', sourceIdentity: 'vargas.D10', fact: { bodies: { Jupiter: { rashi: { rashiIndex: 7 } }, Saturn: { rashi: { rashiIndex: 10 } }, Ascendant: { rashi: { rashiIndex: 1 } } } } });
    if (contradictoryD10) add({ subject: { entityType: 'VARGA', entityId: 'D10' }, sourceLayer: '3', sourceRulesetId: 'parashari-varga-engine-v1', sourceIdentity: 'vargas.D10.conflict', fact: { bodies: { Jupiter: { rashi: { rashiIndex: 8 } } } } });
  }
  if (includeAshtaka) add({ subject: { entityType: 'NATAL_CHART', entityId: 'natal' }, sourceLayer: '11', sourceRulesetId: 'ashtakavarga-composite', sourceIdentity: 'ashtakavarga', fact: { rawSarvashtakavarga: { rashis: [{ rashiIndex: 9, favorableMarkCount: 28 }] }, planetaryBavs: { Jupiter: { rashis: [{ rashiIndex: 4, favorableMarkCount: 6 }] } }, shodhita: { planetaryBavs: { Jupiter: { rashis: [{ rashiIndex: 4, favorableMarkCount: 4 }] } } }, pindaByTarget: { Jupiter: { targetBody: 'Jupiter', totalPinda: 111 } } } });
  return builder.build();
}
function types(result) { return result.derivedRelations.map((relation) => relation.relationType); }

test('builds a traceable H10-only Career overlay from the provisional Meena-lagna fixture', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture() });
  assert.equal(result.domain, 'CAREER'); assert.equal(result.rulesetId, 'parashari-career-domain-evidence-v1');
  assert.deepEqual(types(result).sort(), ['CAREER_ASHTAKAVARGA_CONTEXT', 'CAREER_ASHTAKAVARGA_CONTEXT', 'CAREER_D10_PLACEMENT', 'CAREER_D10_PLACEMENT', 'CAREER_HOUSE_ASPECT', 'CAREER_HOUSE_LORD', 'CAREER_HOUSE_LORD_ASPECT', 'CAREER_HOUSE_LORD_STATE', 'CAREER_HOUSE_OCCUPANT', 'CAREER_OCCUPANT_STATE', 'CAREER_PRIMARY_HOUSE'].sort());
  assert.equal(result.derivedRelations.find((item) => item.relationType === 'CAREER_HOUSE_LORD').target.entityId, 'Jupiter');
  assert.equal(result.derivedRelations.find((item) => item.relationType === 'CAREER_HOUSE_OCCUPANT').subject.entityId, 'Saturn');
  const state = result.derivedRelations.find((item) => item.relationType === 'CAREER_HOUSE_LORD_STATE'); assert.equal(state.fact.suppliedStateFlags.exalted, true);
  assert.equal(result.derivedRelations.find((item) => item.relationType === 'CAREER_PRIMARY_HOUSE').sourceStrength, 'CLASSICAL_TRANSLATION');
  assert.equal(result.derivedRelations.find((item) => item.relationType === 'CAREER_HOUSE_ASPECT').sourceStrength, 'DIRECT_CLASSICAL');
  assert.equal(result.provenance.primaryHousePolicy, 'H10-only; H2-H6-H11 deferred');
});

test('keeps D10 strictly to supplied Rashi placement facts and never derives D10 houses', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture() });
  const d10 = result.derivedRelations.filter((item) => item.relationType === 'CAREER_D10_PLACEMENT');
  assert.deepEqual(d10.map((item) => item.subject.entityId).sort(), ['Jupiter', 'Saturn']);
  assert.equal(JSON.stringify(d10).includes('houseNumber'), false);
  assert.equal(JSON.stringify(result).includes('Ascendant'), false);
});

test('attaches direct supplied Drishti to H10 and separate Drishti to the H10 lord', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture() });
  const houseAspect = result.derivedRelations.find((item) => item.relationType === 'CAREER_HOUSE_ASPECT');
  const lordAspect = result.derivedRelations.find((item) => item.relationType === 'CAREER_HOUSE_LORD_ASPECT');
  assert.equal(houseAspect.subject.entityId, 'Mars'); assert.equal(houseAspect.fact.targetHouseNumber, 10);
  assert.equal(lordAspect.subject.entityId, 'Saturn'); assert.equal(lordAspect.target.entityId, 'Jupiter');
});

test('supports multiple or no H10 occupants without recomputing placements', () => {
  const multiple = buildCareerEvidence({ natalGraph: graphFixture({ occupants: ['Saturn', 'Mars'] }) });
  assert.deepEqual(multiple.derivedRelations.filter((item) => item.relationType === 'CAREER_HOUSE_OCCUPANT').map((item) => item.subject.entityId).sort(), ['Mars', 'Saturn']);
  const none = buildCareerEvidence({ natalGraph: graphFixture({ occupants: [] }) });
  assert.equal(none.derivedRelations.some((item) => item.relationType === 'CAREER_HOUSE_OCCUPANT'), false);
});

test('records absent optional natal modules neutrally', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture({ includeState: false, includeDrishti: false, includeD10: false, includeAshtaka: false }) });
  assert.deepEqual(result.missingData.map((item) => item.dataKey).sort(), ['D10', 'ashtakavarga', 'grahaDrishti', 'planetaryState'].sort());
  assert.equal(result.missingData.every((item) => item.status === 'notProvided' && item.neutrality === 'absence-is-not-negative-evidence'), true);
});

test('retains neutral raw SAV, BAV, Shodhita, and Pinda values without thresholds or ranking', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture() });
  const facts = result.derivedRelations.filter((item) => item.relationType === 'CAREER_ASHTAKAVARGA_CONTEXT').map((item) => item.fact);
  assert.deepEqual(facts.flatMap((fact) => fact.selections.map((item) => item.rawValue)).sort((a, b) => a - b), [4, 6, 28, 111]);
  assert.equal(facts.every((fact) => fact.thresholdOrRanking === 'not-performed'), true);
});

test('is deterministic, immutable, accepts frozen input, and leaves it unchanged', () => {
  const graph = graphFixture(); const before = JSON.stringify(graph); const first = buildCareerEvidence({ natalGraph: graph }); const second = buildCareerEvidence({ natalGraph: graph });
  assert.deepEqual(first, second); assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.derivedRelations[0]), true); assert.equal(JSON.stringify(graph), before);
});

test('rejects contradictions and temporal input rather than reconciling or activating it', () => {
  assert.throws(() => buildCareerEvidence({ natalGraph: graphFixture({ duplicateH10Lord: 'Mars' }) }), /contradictory/);
  assert.throws(() => buildCareerEvidence({ natalGraph: graphFixture({ contradictoryD10: true }) }), /contradictory supplied D10/);
  assert.throws(() => buildCareerEvidence({ natalGraph: graphFixture(), temporal: {} }), /temporal/);
});

test('contains no outcome, scoring, prediction, or temporal semantics', () => {
  const text = JSON.stringify(buildCareerEvidence({ natalGraph: graphFixture() }));
  for (const forbidden of ['careerScore', 'prediction', 'confidence', 'support', 'weakness', 'dasha', 'transit']) assert.equal(text.includes(`\"${forbidden}\"`), false, forbidden);
});

test('adds neutral H2 resource and H11 gain contexts without salary, promotion, H6, D10, or Ashtakavarga expansion', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture({ occupants: [], includeContexts: true }) });
  const byType = (type) => result.derivedRelations.filter((item) => item.relationType === type);
  assert.equal(byType('CAREER_RESOURCE_HOUSE').length, 1);
  assert.equal(byType('CAREER_RESOURCE_HOUSE')[0].subject.entityId, '2');
  assert.equal(byType('CAREER_RESOURCE_HOUSE')[0].fact.careerDomainRole, 'RESOURCE_CONTEXT');
  assert.equal(byType('CAREER_GAIN_HOUSE').length, 1);
  assert.equal(byType('CAREER_GAIN_HOUSE')[0].subject.entityId, '11');
  assert.equal(byType('CAREER_GAIN_HOUSE')[0].fact.careerDomainRole, 'GAIN_CONTEXT');
  assert.deepEqual(byType('CAREER_CONTEXT_HOUSE_LORD').map((item) => [item.subject.entityId, item.target.entityId]).sort(), [['11', 'Saturn'], ['2', 'Mars']]);
  assert.deepEqual(byType('CAREER_CONTEXT_HOUSE_OCCUPANT').map((item) => [item.subject.entityId, item.target.entityId]).sort(), [['Saturn', '2'], ['Venus', '11']]);
  assert.equal(byType('CAREER_D10_PLACEMENT').every((item) => ['Jupiter'].includes(item.subject.entityId)), true);
  assert.equal(byType('CAREER_ASHTAKAVARGA_CONTEXT').every((item) => item.subject.entityId === '10' || item.subject.entityId === 'Jupiter'), true);
  const text = JSON.stringify(result);
  for (const forbidden of ['salary', 'compensation', 'promotion', 'advancement', 'success', 'failure', 'obstruction', 'outcome', 'dasha', 'transit', 'score', 'probability', 'confidence']) assert.equal(text.includes(`\"${forbidden}\"`), false, forbidden);
  assert.equal(result.derivedRelations.some((item) => item.relationType.includes('SERVICE') || item.relationType.includes('EMPLOYMENT') || item.subject.entityId === '6' || item.target.entityId === '6'), false);
});

test('keeps H2/H11 lords, occupants, state, Drishti, and house-domain connections traceable and structural', () => {
  const result = buildCareerEvidence({ natalGraph: graphFixture({ occupants: [], includeContexts: true }) });
  const byType = (type) => result.derivedRelations.filter((item) => item.relationType === type);
  const state = byType('CAREER_CONTEXT_HOUSE_LORD_STATE');
  assert.deepEqual(state.map((item) => [item.fact.contextualHouseNumber, item.subject.entityId]).sort((a, b) => a[0] - b[0]), [[2, 'Mars'], [11, 'Saturn']]);
  assert.equal(state.find((item) => item.subject.entityId === 'Saturn').fact.suppliedStateFlags.retrograde, true);
  const aspects = byType('CAREER_CONTEXT_HOUSE_ASPECT');
  assert.equal(aspects.length, 1);
  assert.equal(aspects[0].target.entityId, '2');
  assert.deepEqual(byType('CAREER_CONTEXT_HOUSE_LORD_ASPECT').map((item) => item.target.entityId).sort(), ['Mars', 'Saturn']);
  const connections = byType('CAREER_HOUSE_DOMAIN_CONNECTION');
  assert.deepEqual(connections.map((item) => [item.fact.fromHouseNumber, item.fact.toHouseNumber, item.fact.lord]).sort((a, b) => a[0] - b[0]), [[2, 10, 'Mars'], [11, 2, 'Saturn']]);
  assert.equal(connections.every((item) => item.inputNodeIds.length === 2 && item.fact.connection === 'supplied-house-lord-placement-only'), true);
});

test('retains only supplied H2/H11 occupants, remains deterministic across input order, and preserves frozen inputs', () => {
  const graph = graphFixture({ occupants: [], includeContexts: true, includeState: false, includeDrishti: false });
  const before = JSON.stringify(graph);
  const result = buildCareerEvidence({ natalGraph: graph });
  const reversed = buildCareerEvidence({ natalGraph: graphFixture({ occupants: [], includeContexts: true, includeState: false, includeDrishti: false, reverseContexts: true }) });
  assert.deepEqual(result.derivedRelations.filter((item) => item.relationType === 'CAREER_CONTEXT_HOUSE_OCCUPANT').map((item) => item.subject.entityId).sort(), ['Saturn', 'Venus']);
  assert.equal(result.missingData.some((item) => item.dataKey === 'planetaryState'), true);
  assert.equal(result.missingData.some((item) => item.dataKey === 'grahaDrishti'), true);
  assert.equal(JSON.stringify(graph), before);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.derivedRelations[0].fact), true);
  assert.deepEqual(result.derivedRelations.map((item) => [item.relationType, item.fact]).sort(), reversed.derivedRelations.map((item) => [item.relationType, item.fact]).sort());
});

test('keeps explicit missing H2/H11 neutral and rejects contradictory supplied context-house lordship', () => {
  const missing = buildCareerEvidence({ natalGraph: graphFixture({ occupants: [], missingContexts: true }) });
  assert.deepEqual(missing.missingData.filter((item) => ['H2', 'H11'].includes(item.dataKey)).map((item) => [item.dataKey, item.status, item.neutrality]).sort(), [['H11', 'notProvided', 'absence-is-not-negative-evidence'], ['H2', 'notProvided', 'absence-is-not-negative-evidence']]);
  assert.equal(missing.derivedRelations.some((item) => ['CAREER_RESOURCE_HOUSE', 'CAREER_GAIN_HOUSE'].includes(item.relationType)), false);
  assert.throws(() => buildCareerEvidence({ natalGraph: graphFixture({ occupants: [], includeContexts: true, duplicateH2Lord: 'Venus' }) }), /contradictory/);
});
