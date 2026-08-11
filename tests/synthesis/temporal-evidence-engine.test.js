'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EvidenceGraphBuilder, buildCareerEvidence, buildTemporalEvidence } = require('../../src/synthesis');

const INSTANT = '2024-06-01T12:00:00.000Z'; const START = '2024-01-01T00:00:00.000Z'; const END = '2025-01-01T00:00:00.000Z';
function staticFixture() {
  const builder = new EvidenceGraphBuilder({ sourceIdentity: 'temporal-fixture' });
  const add = (input) => builder.addFact({ sourceStrength: 'ENGINE_CONVENTION', ...input });
  add({ subject: { entityType: 'HOUSE', entityId: '10' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'houses.10', fact: { houseNumber: 10, rashi: { rashiIndex: 9 }, rashiHouseLord: { name: 'Jupiter' } } });
  add({ subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'placements.Jupiter', fact: { body: 'Jupiter', rashi: { rashiIndex: 4 }, rashiHouseNumber: 5 } });
  add({ subject: { entityType: 'GRAHA', entityId: 'Saturn' }, sourceLayer: '5A', sourceRulesetId: 'house-v1', sourceIdentity: 'placements.Saturn', fact: { body: 'Saturn', rashi: { rashiIndex: 9 }, rashiHouseNumber: 10 } });
  add({ subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5B', sourceRulesetId: 'state-v1', sourceIdentity: 'state.Jupiter', fact: { dignity: { isExalted: true } } });
  return builder.build();
}
function dasha(lords = ['Jupiter', 'Saturn', 'Mercury']) { const levels = ['mahadasha', 'antardasha', 'pratyantardasha']; return { ruleset: { id: 'vimshottari-v1' }, provenance: { layer: '4' }, periods: levels.map((level, index) => ({ id: `D:${level}`, level, lord: { id: lords[index] }, rulesetId: 'vimshottari-v1', startInstant: { utc: START }, endInstant: { utc: END }, children: [] })) }; }
function gochar(body = 'Jupiter', house = 10) { return { snapshotInstant: INSTANT, rulesets: { transitHouse: 'gochar-v1' }, provenance: { layer: '9' }, transitBodies: { [body]: { body, transitCanonicalSiderealLongitudeDegrees: 250.25, transitRashi: { rashiIndex: 9 }, transitNatalHouseNumber: house, motion: { providerState: 'direct' }, sameRashiNatalBodies: [{ body: 'Saturn' }], aspectsNatalBodies: [{ natalBody: 'Jupiter' }] } } }; }
function events() { return { provenance: { layer: '10' }, events: [
  { eventType: 'rashiIngress', instant: INSTANT, body: 'Jupiter', targetHouseNumber: 10 },
  { eventType: 'retrogradeStation', instant: INSTANT, body: 'Saturn' },
  { eventType: 'transitDrishtiStart', instant: INSTANT, body: 'Mars', natalBody: 'Jupiter', aspectOrdinal: 4 },
  { eventType: 'transitDrishtiEnd', instant: INSTANT, body: 'Mars', natalBody: 'Jupiter', aspectOrdinal: 4 },
  { eventType: 'sameRashiAssociationStart', instant: INSTANT, body: 'Jupiter', natalBody: 'Saturn' },
  { eventType: 'sameRashiAssociationEnd', instant: INSTANT, body: 'Jupiter', natalBody: 'Saturn' },
  { eventType: 'sadeSatiPhaseChange', instant: INSTANT, body: 'Saturn' }
] }; }
function input(overrides = {}) { const natalGraph = staticFixture(); return { natalGraph, domainGraph: buildCareerEvidence({ natalGraph }), dasha: dasha(), gochar: gochar(), transitEvents: events(), instant: INSTANT, ...overrides }; }

test('adapts active Vimshottari Mahadasha, Antardasha, and Pratyantardasha using half-open intervals', () => {
  const result = buildTemporalEvidence(input({ gochar: undefined, transitEvents: undefined }));
  assert.deepEqual(result.nodes.filter((item) => item.sourceLayer === '4').map((item) => item.fact.dashaLevel).sort(), ['antardasha', 'mahadasha', 'pratyantardasha'].sort());
  assert.equal(result.nodes.find((item) => item.sourceLayer === '4').temporalContext.type, 'INTERVAL');
  assert.throws(() => buildTemporalEvidence(input({ instant: END })), /match|active/);
});

test('connects Dasha lords to supplied natal facts and the existing H10 Career relation', () => {
  const result = buildTemporalEvidence(input({ gochar: undefined, transitEvents: undefined }));
  const active = result.relations.filter((item) => item.relationType === 'TEMPORALLY_ACTIVATES' && item.fact.mechanism === 'active-vimshottari-period');
  assert.ok(active.some((item) => item.subject.entityId === 'Jupiter'));
  assert.ok(active.some((item) => item.inputNodeIds.some((id) => id.startsWith('career-relation:'))));
});

test('adapts supplied Layer 9 Gochar facts and links supplied house/body associations only', () => {
  const result = buildTemporalEvidence(input({ dasha: undefined, transitEvents: undefined }));
  const gocharNode = result.nodes.find((item) => item.sourceLayer === '9');
  assert.equal(gocharNode.fact.natalHouseNumber, 10); assert.equal(gocharNode.fact.rashi.rashiIndex, 9);
  assert.ok(result.relations.some((item) => item.fact.mechanism === 'supplied-gochar-snapshot' && item.subject.entityId === '10'));
});

test('adapts every approved Layer 10 event family without renaming it', () => {
  const result = buildTemporalEvidence(input({ dasha: undefined, gochar: undefined }));
  assert.deepEqual(result.nodes.filter((item) => item.sourceLayer === '10').map((item) => item.fact.eventType).sort(), events().events.map((item) => item.eventType).sort());
  assert.ok(result.relations.some((item) => item.fact.eventType === 'transitDrishtiStart' && item.subject.entityId === 'Jupiter'));
});

test('records neutral Dasha and transit co-activation only for independently matched static subjects', () => {
  const result = buildTemporalEvidence(input());
  const co = result.relations.filter((item) => item.relationType === 'TEMPORAL_CO_ACTIVATION');
  assert.ok(co.length > 0); assert.ok(co.every((item) => item.inputNodeIds.length === 2));
  const different = buildTemporalEvidence(input({ gochar: gochar('Venus', 3), transitEvents: { events: [] } }));
  assert.equal(different.relations.some((item) => item.relationType === 'TEMPORAL_CO_ACTIVATION' && item.subject.entityId === 'Mercury'), false);
});

test('uses neutral Layer 12A missing-data nodes when optional temporal modules are omitted', () => {
  const result = buildTemporalEvidence(input({ dasha: undefined, gochar: undefined, transitEvents: undefined, domainGraph: undefined }));
  assert.deepEqual(result.missingData.map((item) => item.fact.dataKey).sort(), ['careerDomainGraph', 'dasha', 'gochar', 'transitEvents']);
  assert.equal(result.missingData.every((item) => item.fact.neutrality === 'absence-is-not-negative-evidence'), true);
});

test('rejects contradictory Dasha, Gochar, event identity, and incompatible Career graph input', () => {
  assert.throws(() => buildTemporalEvidence(input({ dasha: dasha(['Jupiter', 'Mars', 'Mercury']).periods ? { periods: [...dasha().periods, { ...dasha().periods[0], id: 'other', lord: { id: 'Mars' } }] } : null })), /Contradictory active/);
  assert.throws(() => buildTemporalEvidence(input({ gochar: { ...gochar(), transitBodies: { Jupiter: { body: 'Saturn' } } } })), /Contradictory Gochar/);
  const duplicate = events(); duplicate.events.push({ ...duplicate.events[0], targetHouseNumber: 9 }); assert.throws(() => buildTemporalEvidence(input({ transitEvents: duplicate })), /Contradictory transit event identity/);
  assert.throws(() => buildTemporalEvidence({ ...input(), domainGraph: { ...input().domainGraph, sourceGraphId: 'graph:other' } }), /reference/);
});

test('is immutable, accepts frozen inputs, does not mutate them, and is reverse-order deterministic', () => {
  const source = input(); const before = JSON.stringify(source); const first = buildTemporalEvidence(source); const reverse = { ...source, transitEvents: { ...source.transitEvents, events: [...source.transitEvents.events].reverse() } };
  assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.nodes[0]), true); assert.equal(JSON.stringify(source), before); assert.deepEqual(first, buildTemporalEvidence(reverse));
});

test('retains exact temporal provenance and contains no interpretation or outcome fields', () => {
  const result = buildTemporalEvidence(input());
  assert.equal(result.provenance.astronomyCalculation, 'not-performed'); assert.equal(result.provenance.dashaCalculation, 'not-performed'); assert.equal(result.provenance.transitScanning, 'not-performed');
  const text = JSON.stringify(result); for (const forbidden of ['score', 'probability', 'confidence', 'promotion', 'recommendation', 'remedy', 'favorable', 'unfavorable']) assert.equal(text.includes(`\"${forbidden}\"`), false, forbidden);
});
