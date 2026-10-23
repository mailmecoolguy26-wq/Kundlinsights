'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compareGoldenFixture, classifyThreeWay, classifyNodeConventionEvidence } = require('../../src/development');
const { GOLDEN_FIXTURES } = require('./golden-fixtures/manifest');
const currentProductionFixture = require('./golden-fixtures/current-production-profile.fixture.json');

function report() {
  return {
    astronomy: { planets: [{ body: 'Sun', longitude: 10 }, { body: 'Moon', longitude: 20 }, { body: 'Mars', longitude: 30 }, { body: 'Mercury', longitude: 40 }, { body: 'Jupiter', longitude: 50 }, { body: 'Venus', longitude: 60 }, { body: 'Saturn', longitude: 70 }, { body: 'Rahu', longitude: 80 }, { body: 'Ketu', longitude: 260 }], ascendant: { longitude: 90 }, nakshatra: { moon: 'Bharani', pada: 2 } },
    dasha: { currentMD: { lord: 'venus', start: '2026-01-01T00:00:00.000Z', end: '2046-01-01T00:00:00.000Z' }, currentAD: { lord: 'sun', start: '2026-01-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' }, currentPD: { lord: 'moon', start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z' } },
    vargas: Object.fromEntries(['D4', 'D9', 'D10', 'D16'].map((id) => [id, { ascendant: 1, bodies: {} }])),
    transits: { futureIngresses: [] }, ashtakavarga: { sav: [], bav: {} },
  };
}
function source(name, values) { return { provenance: { sourceName: name, sourceVersion: 'v1', ephemeris: 'independent', ayanamsa: 'Lahiri', zodiac: 'sidereal', nodeType: 'mean', yearConvention: 'declared', verifiedAt: '2026-10-17', notes: null }, values }; }

test('golden comparison reports verified pass, failure, and unverified fields without altering the report', () => {
  const fixture = { fixtureId: 'fixture', name: 'Fixture', tolerances: { longitudeArcseconds: 1, timestampSeconds: 2 }, sources: [source('A', { astronomy: { longitudes: { Sun: 10.0001 }, moonNakshatra: 'Bharani', moonPada: 2 }, dasha: { currentMD: { start: '2026-01-01T00:00:01.000Z' } } })] };
  const result = compareGoldenFixture({ fixture, report: report() });
  assert.equal(result.results.find((row) => row.field === 'astronomy.longitudes.Sun').status, 'PASS');
  assert.equal(result.results.find((row) => row.field === 'dasha.currentMD.start').status, 'PASS');
  assert.equal(result.results.find((row) => row.field === 'astronomy.longitudes.Mars').status, 'NOT_VERIFIED');
  const fail = compareGoldenFixture({ fixture: { ...fixture, sources: [source('A', { astronomy: { longitudes: { Sun: 11 } } })] }, report: report() });
  assert.equal(fail.results.find((row) => row.field === 'astronomy.longitudes.Sun').status, 'FAIL');
});

test('golden comparison refuses to reconcile conflicting external sources', () => {
  const fixture = { fixtureId: 'fixture', name: 'Fixture', tolerances: {}, sources: [source('A', { astronomy: { longitudes: { Sun: 10 } } }), source('B', { astronomy: { longitudes: { Sun: 11 } } })] };
  const result = compareGoldenFixture({ fixture, report: report() });
  const conflict = result.results.find((row) => row.field === 'astronomy.longitudes.Sun');
  assert.equal(conflict.status, 'EXTERNAL_SOURCE_CONFLICT');
  assert.deepEqual(conflict.expected.map((item) => item.sourceName), ['A', 'B']);
});

test('five fully shaped empty golden fixtures are registered and production input remains absent', () => {
  assert.equal(GOLDEN_FIXTURES.length, 5);
  for (const fixture of GOLDEN_FIXTURES) {
    assert.deepEqual(Object.keys(fixture.sources[0].values.astronomy.longitudes).sort(), ['Ascendant', 'Jupiter', 'Ketu', 'Mars', 'Mercury', 'Moon', 'Rahu', 'Saturn', 'Sun', 'Venus']);
    assert.deepEqual(Object.keys(fixture.sources[0].values.vargas).sort(), ['D10', 'D16', 'D4', 'D9']);
  }
  assert.equal(currentProductionFixture.input.birthProfileReference, 'ENTER_LOCALLY_DO_NOT_COMMIT_BIRTH_DATA');
  assert.equal(currentProductionFixture.sources[0].values.astronomy.longitudes.Sun, 220.0711111111111);
});

test('Drik Source A preserves supplied provenance and normalizes Hyderabad Dasha timestamps to UTC', () => {
  const source = currentProductionFixture.sources[0];
  assert.equal(source.provenance.sourceName, 'Drik Panchang');
  assert.equal(source.provenance.ayanamsa, 'Lahiri/Chitra Paksha');
  assert.equal(source.provenance.nodeType, 'True Rahu/Ketu');
  assert.equal(source.provenance.location, 'Hyderabad, India');
  assert.equal(source.values.astronomy.longitudes.Moon, 319.51694444444445);
  assert.equal(source.values.astronomy.nodeConventionLongitudes.MEAN.Rahu, 275.9741666666667);
  assert.equal(source.values.dasha.currentMD.start, '2026-07-22T11:30:00.000Z');
  assert.equal(source.values.dasha.currentPD.end, '2026-11-24T02:20:00.000Z');
  assert.equal(source.values.dasha.referencePeriods[1].end, '2027-06-10T00:30:00.000Z');
  assert.deepEqual(source.values.ashtakavarga.savBySign, { 1: 31, 2: 28, 3: 29, 4: 28, 5: 30, 6: 31, 7: 23, 8: 21, 9: 31, 10: 27, 11: 25, 12: 33 });
});

test('Source B preserves date-only Dasha precision without fabricating a timestamp', () => {
  const sourceB = currentProductionFixture.sources[1];
  assert.equal(sourceB.comparisonGranularity.dasha, 'DATE');
  assert.equal(sourceB.values.dasha.currentMD.start, '2026-07-21');
  assert.equal(sourceB.provenance.nodeTypeObserved, 'MEAN');
  assert.equal(sourceB.provenance.nodeTypeUiSetting, 'TRUE');
  assert.equal(sourceB.provenance.provenanceConflict, true);
  assert.equal(sourceB.values.astronomy.longitudes.Rahu, 275.96666666666664);
  const fixture = { fixtureId: 'fixture', name: 'Fixture', tolerances: {}, sources: [sourceB] };
  const sampleReport = report();
  sampleReport.dasha.timeline = [];
  const result = compareGoldenFixture({ fixture, report: sampleReport });
  const row = result.results.find((item) => item.field === 'dasha.currentMD.start');
  assert.equal(row.kind, 'date');
  assert.equal(row.tolerance, 'CALENDAR_DATE_EXACT');
});

test('node evidence compares true and mean conventions separately', () => {
  const rahu = classifyNodeConventionEvidence({
    taraVerse: 277.2888771562772,
    drikTrue: 277.2813888888889,
    drikMean: 275.9741666666667,
    sourceB: 275.96666666666664,
  });
  assert.equal(rahu.taraVerseDrikTrue, 'TARAVERSE_DRIK_TRUE_MATCH');
  assert.equal(rahu.sourceBDrikMean, 'SOURCE_B_DRIK_MEAN_MATCH');
  assert.equal(rahu.sourceBComparedToDrikTrue, 'SOURCE_B_DRIK_TRUE_DIFFER');
});

test('user-provided Drik and Source B Varga signs certify the current harness at sign level', () => {
  const sourceA = currentProductionFixture.sources[0];
  const sourceB = currentProductionFixture.sources[1];
  for (const id of ['D4', 'D9', 'D10', 'D16']) {
    assert.notEqual(sourceA.values.vargas[id].ascendant, null, id);
    assert.deepEqual(sourceA.values.vargas[id], sourceB.values.vargas[id], id);
    for (const body of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) assert.ok(Number.isInteger(sourceA.values.vargas[id].planets[body].rashi), `${id}.${body}`);
  }
});

test('three-way classification compares at the least precise declared resolution', () => {
  assert.equal(classifyThreeWay({ taraVerse: '2026-07-21T12:00:00.000Z', sourceA: '2026-07-21T00:00:00.000Z', sourceB: '2026-07-21', sourceBGranularity: 'DATE' }), 'MATCH_ALL_THREE');
  assert.equal(classifyThreeWay({ taraVerse: '2026-07-18T00:00:00.000Z', sourceA: '2026-07-22T00:00:00.000Z', sourceB: '2026-07-21', sourceBGranularity: 'DATE' }), 'ALL_DIFFER');
  assert.equal(classifyThreeWay({ taraVerse: 28, sourceA: 29, sourceB: 28 }), 'TARAVERSE_SOURCE_B_MATCH');
  assert.equal(classifyThreeWay({ taraVerse: null, sourceA: 1, sourceB: 1 }), 'NOT_VERIFIED');
});
