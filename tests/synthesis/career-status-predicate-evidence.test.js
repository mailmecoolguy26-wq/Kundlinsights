'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EvidenceGraphBuilder, buildCareerEvidence } = require('../../src/synthesis');

function statusGraph({ saturnHouse = 8, relativeHouse = 8, includeH9 = true, includeVenus = true, duplicateSaturn = false, reverse = false, contradictoryH9 = false } = {}) {
  const builder = new EvidenceGraphBuilder({ sourceIdentity: 'career-status-predicate-fixture' });
  const add = (input) => builder.addFact({ sourceStrength: 'ENGINE_CONVENTION', ...input });
  const entries = [
    { subject: { entityType: 'HOUSE', entityId: '10' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'houses.10', fact: { houseNumber: 10, rashi: { rashiIndex: 9 }, rashiHouseLord: { name: 'Jupiter' } } },
    { subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'placements.Jupiter', fact: { body: 'Jupiter', rashi: { rashiIndex: 4 }, rashiHouseNumber: 5 } },
    { subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5B', sourceRulesetId: 'state-v1', sourceIdentity: 'state.Jupiter', fact: { dignity: { isExalted: true }, combustion: { isCombust: false }, motion: { isRetrograde: false } } }
  ];
  if (includeH9) {
    entries.push({ subject: { entityType: 'HOUSE', entityId: '9' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'houses.9', fact: { houseNumber: 9, rashi: { rashiIndex: 8 }, rashiHouseLord: { name: 'Mars' } } });
    entries.push({ subject: { entityType: 'GRAHA', entityId: 'Mars' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'placements.Mars', fact: { body: 'Mars', rashi: { rashiIndex: 9 }, rashiHouseNumber: 10 } });
  }
  if (contradictoryH9) entries.push({ subject: { entityType: 'HOUSE', entityId: '9' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'houses.9.conflict', fact: { houseNumber: 9, rashi: { rashiIndex: 8 }, rashiHouseLord: { name: 'Venus' } } });
  if (includeVenus) entries.push({ subject: { entityType: 'GRAHA', entityId: 'Venus' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'placements.Venus', fact: { body: 'Venus', rashi: { rashiIndex: 1 }, rashiHouseNumber: 2 } });
  const saturnRashiIndex = ((relativeHouse - 1) % 12) + 1;
  const saturn = { subject: { entityType: 'GRAHA', entityId: 'Saturn' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'placements.Saturn', fact: { body: 'Saturn', rashi: { rashiIndex: saturnRashiIndex }, rashiHouseNumber: saturnHouse } };
  entries.push(saturn);
  if (duplicateSaturn) entries.push({ ...saturn, sourceIdentity: 'placements.Saturn.duplicate' });
  (reverse ? [...entries].reverse() : entries).forEach(add);
  return builder.build();
}

function relations(result, type) { return result.derivedRelations.filter((item) => item.relationType === type); }

test('preserves the narrow H9 structural facts and the existing supplied H10-lord state', () => {
  const result = buildCareerEvidence({ natalGraph: statusGraph() });
  const h9Lord = relations(result, 'CAREER_STATUS_H9_LORD').at(0);
  const placement = relations(result, 'CAREER_STATUS_H9_LORD_PLACEMENT').at(0);
  const connection = relations(result, 'CAREER_STATUS_H9_LORD_H10_CONNECTION').at(0);
  const state = relations(result, 'CAREER_HOUSE_LORD_STATE').at(0);
  assert.equal(h9Lord.target.entityId, 'Mars');
  assert.deepEqual([placement.subject.entityId, placement.target.entityId], ['Mars', '10']);
  assert.deepEqual([connection.subject.entityId, connection.target.entityId, connection.fact.lord], ['9', '10', 'Mars']);
  assert.equal(state.fact.suppliedStateFlags.exalted, true);
  assert.equal(h9Lord.provenance.sourcePredicate.sourcePredicateId, 'bphs-h10-honour-natal-v1');
});

test('does not invent H10-lord/Jupiter conjunction evidence when upstream lacks a conjunction FACT', () => {
  const result = buildCareerEvidence({ natalGraph: statusGraph() });
  assert.equal(result.derivedRelations.some((item) => item.relationType.includes('CONJUNCTION')), false);
  const missing = result.missingData.find((item) => item.dataKey === 'H10Lord.Jupiter.conjunction');
  assert.deepEqual([missing.status, missing.neutrality], ['notProvided', 'absence-is-not-negative-evidence']);
});

test('preserves only source-listed Saturn natal-house and Saturn-from-Venus relationships', () => {
  for (const house of [8, 11, 12]) {
    const result = buildCareerEvidence({ natalGraph: statusGraph({ saturnHouse: house, relativeHouse: house }) });
    assert.equal(relations(result, 'CAREER_STATUS_SATURN_NATAL_HOUSE').at(0).fact.natalHouseNumber, house);
    assert.equal(relations(result, 'CAREER_STATUS_SATURN_FROM_VENUS').at(0).fact.relativeHouse, house);
  }
  const other = buildCareerEvidence({ natalGraph: statusGraph({ saturnHouse: 6, relativeHouse: 6 }) });
  assert.equal(relations(other, 'CAREER_STATUS_SATURN_NATAL_HOUSE').length, 0);
  assert.equal(relations(other, 'CAREER_STATUS_SATURN_FROM_VENUS').length, 0);
  assert.equal(other.derivedRelations.some((item) => item.target.entityType === 'HOUSE' && item.target.entityId === '6'), false);
});

test('keeps missing data neutral, rejects contradictions, and rejects temporal input', () => {
  const missing = buildCareerEvidence({ natalGraph: statusGraph({ includeH9: false }) });
  assert.deepEqual(missing.missingData.filter((item) => item.dataKey.startsWith('H9') || item.dataKey.includes('conjunction')).map((item) => item.neutrality), ['absence-is-not-negative-evidence', 'absence-is-not-negative-evidence']);
  assert.throws(() => buildCareerEvidence({ natalGraph: statusGraph({ contradictoryH9: true }) }), /contradictory/);
  assert.throws(() => buildCareerEvidence({ natalGraph: statusGraph(), temporal: {} }), /no temporal activation/);
});

test('deduplicates equivalent Saturn facts, is input-order stable, immutable, and does not mutate frozen input', () => {
  const graph = statusGraph({ duplicateSaturn: true });
  const before = JSON.stringify(graph); Object.freeze(graph);
  const duplicate = buildCareerEvidence({ natalGraph: graph });
  const reordered = buildCareerEvidence({ natalGraph: statusGraph({ duplicateSaturn: true, reverse: true }) });
  assert.equal(relations(duplicate, 'CAREER_STATUS_SATURN_NATAL_HOUSE').length, 1);
  assert.equal(relations(duplicate, 'CAREER_STATUS_SATURN_FROM_VENUS').length, 1);
  assert.deepEqual(duplicate, reordered);
  assert.equal(Object.isFrozen(duplicate), true);
  assert.equal(Object.isFrozen(duplicate.derivedRelations), true);
  assert.equal(JSON.stringify(graph), before);
});

test('does not add provider dependencies, conclusions, D10 expansion, or altered H2/H11 relations', () => {
  const result = buildCareerEvidence({ natalGraph: statusGraph() });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('provider'), false);
  assert.equal(Object.hasOwn(result, 'conclusions'), false);
  assert.equal(result.derivedRelations.some((item) => item.relationType === 'CAREER_D10_PLACEMENT'), false);
  assert.equal(result.derivedRelations.some((item) => ['CAREER_RESOURCE_HOUSE', 'CAREER_GAIN_HOUSE'].includes(item.relationType)), false);
  assert.equal(result.provenance.statusPredicateEvidencePolicy.includes('no evaluated conclusion'), true);
});
