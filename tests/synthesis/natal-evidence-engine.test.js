'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const { assembleNatalEvidenceGraph } = require('../../src/synthesis');
function fixture(reverse = false) {
  const bodies = reverse ? { Saturn: { jyotishCoordinates: { rashi: { rashiIndex: 9 } } }, Jupiter: { jyotishCoordinates: { rashi: { rashiIndex: 4 } } } } : { Jupiter: { jyotishCoordinates: { rashi: { rashiIndex: 4 } } }, Saturn: { jyotishCoordinates: { rashi: { rashiIndex: 9 } } } };
  return { sourceIdentity: 'fixture', natal: { layer2Bodies: bodies, houses: { rulesetId: 'parashari-rashi-house-v1', houses: [{ houseNumber: 1, rashi: { rashiIndex: 12 } }], planetaryAssignments: [{ body: 'Jupiter', rashi: { rashiIndex: 4 }, rashiHouseNumber: 5 }] }, planetaryState: { rulesetId: 'state-v1', bodies: { Jupiter: { dignity: { isExalted: true } } }, }, grahaDrishti: { rulesetId: 'drishti-v1', rashiAspects: [{ fromBody: 'Jupiter', aspectNumber: 9, targetRashi: { rashiIndex: 12 } }] }, yogas: { rulesetId: 'yoga-v1', evaluations: [{ id: 'gaja-kesari', detected: false }] }, ashtakavarga: { rulesetId: 'raw-av-v1', total: 337 }, vargas: { D10: { rulesetId: 'd10-v1', bodies: {} } } } };
}

test('assembles generic upstream FACT nodes without domain or temporal synthesis', () => {
  const graph = assembleNatalEvidenceGraph(fixture());
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '2' && node.subject.entityId === 'Jupiter'));
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '5A' && node.subject.entityType === 'HOUSE'));
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '5B'));
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '6'));
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '7'));
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '11'));
  assert.ok(graph.nodes.some((node) => node.sourceLayer === '3'));
  assert.equal(graph.nodes.every((node) => node.domain === null && node.temporalContextId === null), true);
});

test('uses neutral missing-data nodes, detects upstream contradictions, and rejects temporal input', () => {
  const graph = assembleNatalEvidenceGraph({ natal: { layer2Bodies: { Jupiter: { jyotishCoordinates: { rashi: { rashiIndex: 4 } } } } } });
  assert.deepEqual(graph.missingData.map((node) => node.fact.status), Array(graph.missingData.length).fill('notProvided'));
  const inconsistent = fixture(); inconsistent.natal.houses.planetaryAssignments[0].rashi.rashiIndex = 9;
  assert.throws(() => assembleNatalEvidenceGraph(inconsistent), /contradiction/);
  assert.throws(() => assembleNatalEvidenceGraph({ natal: { temporal: {} } }), /temporal/);
});

test('is insertion-order deterministic, immutable, input-safe, and has no astronomy/provider dependency', () => {
  const first = assembleNatalEvidenceGraph(fixture()); const second = assembleNatalEvidenceGraph(fixture(true));
  assert.deepEqual(first, second); assert.equal(Object.isFrozen(first.provenance), true); assert.equal(first.provenance.astronomyCalculation, 'not-performed'); assert.equal(first.provenance.ashtakavargaCalculation, 'not-performed');
  const source = fs.readFileSync(path.join(__dirname, '../../src/synthesis/natal-evidence-engine.js'), 'utf8'); assert.equal(/astronomy|swiss-ephemeris|AstronomicalEngine/i.test(source), false);
});
