'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCareerAshtakavargaStructure, inclusiveHouseOffset } = require('../../src/application/ashtakavarga/career-ashtakavarga-structure');
const { calculateRashiHouses } = require('../../src/bhava');

function fixture({ h10LordHouse = 1, h7LordHouse = 6, missingSav = false } = {}) {
  const houses = {
    houses: Array.from({ length: 12 }, (_, index) => ({
      houseNumber: index + 1,
      rashi: { rashiIndex: index + 1 },
      rashiHouseLord: index + 1 === 10
        ? 'Mars'
        : index + 1 === 7
        ? 'Saturn'
        : 'Sun',
    })),
    planetaryAssignments: [
      { body: 'Mars', rashiHouseNumber: h10LordHouse },
      { body: 'Saturn', rashiHouseNumber: h7LordHouse },
      { body: 'Rahu', rashiHouseNumber: 3 },
    ],
  };
  const rawAshtakavarga = {
    rawSarvashtakavarga: {
      rashis: Array.from({ length: 12 }, (_, index) => ({
        rashiIndex: index + 1,
        favorableMarkCount: missingSav && index + 1 === h10LordHouse ? null : 20 + index,
      })),
    },
  };
  return { houses, rawAshtakavarga };
}

function canonicalFixture() {
  const bodies = {
    Sun: 30, Moon: 60, Mars: 120, Mercury: 150, Jupiter: 180,
    Venus: 90, Saturn: 0, Rahu: 210, Ketu: 30,
  };
  const houses = calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: 0,
    bodies,
  });
  const rawAshtakavarga = {
    rawSarvashtakavarga: {
      rashis: Array.from({ length: 12 }, (_, index) => ({
        rashiIndex: index + 1,
        favorableMarkCount: 20 + index,
      })),
    },
  };
  return { houses, rawAshtakavarga };
}

test('projects exact factual D1 SAV structure without thresholds or interpretation', () => {
  const value = buildCareerAshtakavargaStructure(fixture({ h10LordHouse: 7, h7LordHouse: 6 }));
  assert.deepEqual(value, {
    h10: { house: 10, sav: 29 },
    h10Lord: { planet: 'Mars', house: 7, houseSav: 26 },
    h7: { house: 7, sav: 26 },
    h7Lord: { planet: 'Saturn', house: 6, houseSav: 25 },
    tenthFromH10Lord: { house: 4, sav: 23 },
  });
  assert.equal(JSON.stringify(value).match(/strong|weak|threshold|score|rank|favorable|unfavorable/i), null);
});

test('uses inclusive 10th-house counting and wraps from H12 to H9', () => {
  assert.equal(inclusiveHouseOffset(12, 10), 9);
  assert.equal(buildCareerAshtakavargaStructure(fixture({ h10LordHouse: 12 })).tenthFromH10Lord.house, 9);
  assert.equal(buildCareerAshtakavargaStructure(fixture({ h10LordHouse: 1 })).tenthFromH10Lord.house, 10);
  assert.equal(buildCareerAshtakavargaStructure(fixture({ h10LordHouse: 4 })).tenthFromH10Lord.house, 1);
  assert.equal(buildCareerAshtakavargaStructure(fixture({ h10LordHouse: 10 })).tenthFromH10Lord.house, 7);
});

test('keeps known facts when an optional SAV value is malformed or absent', () => {
  const value = buildCareerAshtakavargaStructure(fixture({ h10LordHouse: 12, missingSav: true }));
  assert.deepEqual(value.h10Lord, { planet: 'Mars', house: 12 });
  assert.deepEqual(value.tenthFromH10Lord, { house: 9, sav: 28 });
  assert.equal(value.h10Lord.planet, 'Mars');
  assert.equal(value.h7Lord.planet, 'Saturn');
  assert.equal(JSON.stringify(value).includes('Rahu'), false);
});

test('uses the real calculateRashiHouses output for lord placements and SAV facts', () => {
  const { houses, rawAshtakavarga } = canonicalFixture();
  // This directly exercises the canonical house calculator, rather than a
  // hand-shaped approximation of its rashiHouseLord field.
  assert.equal(typeof houses.houses[9].rashiHouseLord, 'object');
  assert.equal(houses.houses[9].rashiHouseLord.name, 'Saturn');
  const value = buildCareerAshtakavargaStructure({ houses, rawAshtakavarga });
  assert.deepEqual(value, {
    h10: { house: 10, sav: 29 },
    h10Lord: { planet: 'Saturn', house: 1, houseSav: 20 },
    h7: { house: 7, sav: 26 },
    h7Lord: { planet: 'Venus', house: 4, houseSav: 23 },
    tenthFromH10Lord: { house: 10, sav: 29 },
  });
});
