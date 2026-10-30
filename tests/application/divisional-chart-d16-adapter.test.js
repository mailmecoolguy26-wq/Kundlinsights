'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const goldenFixture = require('../development/golden-fixtures/current-production-profile.fixture.json');
const { calculateChartCoordinates } = require('../../src/application/divisional-charts');

function goldenLayer1() {
  const longitudes = goldenFixture.sources[0].values.astronomy.longitudes;
  return Object.freeze({ bodies: Object.freeze(Object.fromEntries(Object.entries(longitudes).map(([body, siderealLongitudeDegrees]) => [body, Object.freeze({ siderealLongitudeDegrees })]))) });
}

function placementSigns(chart) {
  return Object.fromEntries(Object.entries(chart.coordinates).map(([body, coordinate]) => [body, coordinate.varga.derivedVargaRashi.rashiIndex]));
}

test('the divisional-chart adapter delegates D4/D9/D10/D16 to validated Varga projections for the current golden fixture', () => {
  const layer1 = goldenLayer1();
  for (const id of ['D4', 'D9', 'D10', 'D16']) {
    const chart = calculateChartCoordinates(layer1, id.toLowerCase());
    const expected = goldenFixture.sources[0].values.vargas[id];
    const actual = placementSigns(chart);
    assert.equal(actual.Ascendant, expected.ascendant, `${id} Ascendant`);
    for (const [planet, expectedPlacement] of Object.entries(expected.planets)) assert.equal(actual[planet], expectedPlacement.rashi, `${id} ${planet}`);
  }
});

test('D7 is available only as the validated Saptamsha application adapter', () => {
  const chart = calculateChartCoordinates(goldenLayer1(), 'd7');
  assert.equal(chart.vargaId, 'D7');
  assert.equal(chart.coordinates.Ascendant.varga.varga.rulesetVersion, 'parashari-saptamsha-v1');
  assert.ok(chart.houses.planetaryAssignments.length > 0);
});

test('D16 is accepted internally while unsupported Varga identifiers still fail safely', () => {
  assert.equal(calculateChartCoordinates(goldenLayer1(), 'd16').vargaId, 'D16');
  assert.throws(() => calculateChartCoordinates(goldenLayer1(), 'd12'), /Unsupported divisional chart: d12/);
});
