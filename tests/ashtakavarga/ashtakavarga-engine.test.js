'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRawAshtakavarga } = require('../../src/ashtakavarga');

const fixture = Object.freeze({
  Ascendant: { rashiIndex: 12, sanskritName: 'Meena' }, Sun: { rashiIndex: 8, sanskritName: 'Vrishchika' }, Moon: { rashiIndex: 11, sanskritName: 'Kumbha' }, Mars: { rashiIndex: 2, sanskritName: 'Vrishabha' },
  Mercury: { rashiIndex: 8, sanskritName: 'Vrishchika' }, Jupiter: { rashiIndex: 4, sanskritName: 'Karka' }, Venus: { rashiIndex: 8, sanskritName: 'Vrishchika' }, Saturn: { rashiIndex: 9, sanskritName: 'Dhanu' },
});
const expected = {
  Sun:[3,5,4,4,5,3,3,4,6,4,3,4], Moon:[4,6,3,4,6,4,4,2,2,5,6,3], Mars:[5,3,4,2,4,4,2,1,5,3,1,5], Mercury:[3,3,5,5,4,5,4,4,6,5,3,7], Jupiter:[5,4,4,5,7,5,2,5,6,3,5,5], Venus:[6,3,4,5,3,5,5,3,2,5,4,7], Saturn:[5,4,4,3,3,4,4,2,4,1,3,2], Ascendant:[4,4,2,4,4,3,4,3,5,5,5,4], SAV:[31,28,28,28,32,30,24,21,31,26,25,33],
};

test('produces the locked PROVISIONAL_COORDINATE_FIXTURE raw BAV and SAV result', () => {
  const result = calculateRawAshtakavarga({ rashiPlacements: fixture });
  for (const [target, values] of Object.entries(expected)) {
    const source = target === 'SAV' ? result.rawSarvashtakavarga : target === 'Ascendant' ? result.lagnaBav : result.planetaryBavs[target];
    assert.deepEqual(source.rashis.map((rashi) => rashi.favorableMarkCount), values);
  }
  assert.equal(result.rawSarvashtakavarga.totalFavorableMarks, 337);
  assert.equal(result.lagnaBav.totalFavorableMarks, 47);
  assert.equal(result.provenance.providerIndependent, true);
  assert.equal(result.provenance.modernPositiveBinduTerminology, 'later-convention-not-used-as-canonical-field');
});

test('is deeply immutable, deterministic, provider independent, and does not mutate frozen input', () => {
  const first = calculateRawAshtakavarga({ rashiPlacements: fixture });
  const second = calculateRawAshtakavarga({ rashiPlacements: fixture });
  assert.deepEqual(first, second);
  for (const value of [first, first.planetaryBavs, first.planetaryBavs.Sun, first.planetaryBavs.Sun.rashis, first.planetaryBavs.Sun.rashis[0], first.planetaryBavs.Sun.rashis[0].contributors, first.rawSarvashtakavarga, first.rawSarvashtakavarga.rashis[0].byTargetBav, first.provenance]) assert.equal(Object.isFrozen(value), true);
  assert.equal(fixture.Sun.rashiIndex, 8);
  assert.equal(first.provenance.astronomyCalculation, 'not-performed');
  assert.equal(first.provenance.longitudeCalculation, 'not-performed');
  assert.equal(first.provenance.transitCalculation, 'not-performed');
});
