'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { HOUSE_SYSTEM_ID, calculateRashiHouses } = require('../../src/bhava');

const PROVISIONAL_ASCENDANT = 331.212553397423;

function calculate(ascendantCanonicalSiderealLongitude, bodies = {}) {
  return calculateRashiHouses({ ascendantCanonicalSiderealLongitude, bodies });
}

test('maps all twelve possible Lagna Rashis to a complete cyclic Rashi-house sequence', () => {
  for (let ascendantRashiIndex = 1; ascendantRashiIndex <= 12; ascendantRashiIndex += 1) {
    const result = calculate((ascendantRashiIndex - 1) * 30);
    assert.equal(result.houses.length, 12);
    assert.deepEqual(result.houses.map((house) => house.rashi.rashiIndex), Array.from({ length: 12 }, (_, offset) => ((ascendantRashiIndex - 1 + offset) % 12) + 1));
    assert.equal(new Set(result.houses.map((house) => house.houseNumber)).size, 12);
    assert.equal(new Set(result.houses.map((house) => house.rashi.rashiIndex)).size, 12);
  }
});

test('uses half-open Rashi boundaries for exact, below, and above every 30-degree boundary', () => {
  for (let boundary = 0; boundary < 360; boundary += 30) {
    const at = calculate(boundary);
    assert.equal(at.ascendant.rashi.rashiIndex, (boundary / 30) + 1);
    if (boundary > 0) assert.equal(calculate(boundary - 1e-10).ascendant.rashi.rashiIndex, boundary / 30);
    assert.equal(calculate(boundary + 1e-10).ascendant.rashi.rashiIndex, (boundary / 30) + 1);
  }
  assert.equal(calculate(360).ascendant.normalizedCanonicalSiderealLongitude, 0);
  assert.equal(calculate(360).ascendant.rashi.rashiIndex, 1);
});

test('normalizes negative and oversized inputs for classification while preserving canonical input values', () => {
  const result = calculate(-28, { Rahu: -1, Ketu: 719 });
  assert.equal(result.ascendant.canonicalSiderealLongitude, -28);
  assert.equal(result.ascendant.normalizedCanonicalSiderealLongitude, 332);
  assert.equal(result.ascendant.rashi.sanskritName, 'Meena');
  assert.deepEqual(result.planetaryAssignments.map((assignment) => [assignment.body, assignment.canonicalSiderealLongitude, assignment.normalizedCanonicalSiderealLongitude, assignment.bhavaNumber]), [
    ['Rahu', -1, 359, 1], ['Ketu', 719, 359, 1]
  ]);
});

test('produces the approved provisional Meena-Lagna house order and house lords', () => {
  const result = calculate(PROVISIONAL_ASCENDANT);
  assert.equal(result.ascendant.rashi.sanskritName, 'Meena');
  assert.deepEqual(result.houses.map((house) => house.rashi.sanskritName), ['Meena', 'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha']);
  assert.deepEqual(result.houses.map((house) => house.rashiHouseLord.name), ['Jupiter', 'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn']);
  assert.equal(result.houses[0].startLongitude, 330);
  assert.equal(result.houses[0].endLongitude, 360);
  assert.equal(result.houses[1].startLongitude, 0);
  assert.equal(result.houses[1].bhavaMadhyaLongitude, null);
});

test('assigns canonical bodies exactly once while keeping Rahu and Ketu normal and Ascendant an angle', () => {
  const bodies = Object.freeze({ Sun: Object.freeze({ siderealLongitudeDegrees: 5 }), Moon: Object.freeze({ siderealLongitudeDegrees: 35 }), Mars: Object.freeze({ siderealLongitudeDegrees: 65 }), Mercury: Object.freeze({ siderealLongitudeDegrees: 95 }), Jupiter: Object.freeze({ siderealLongitudeDegrees: 125 }), Venus: Object.freeze({ siderealLongitudeDegrees: 155 }), Saturn: Object.freeze({ siderealLongitudeDegrees: 185 }), Rahu: Object.freeze({ siderealLongitudeDegrees: 215 }), Ketu: Object.freeze({ siderealLongitudeDegrees: 245 }), Ascendant: Object.freeze({ siderealLongitudeDegrees: PROVISIONAL_ASCENDANT }) });
  const result = calculate(PROVISIONAL_ASCENDANT, bodies);
  assert.deepEqual(result.planetaryAssignments.map((assignment) => assignment.body), ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
  assert.equal(result.planetaryAssignments.length, 9);
  assert.ok(result.planetaryAssignments.every((assignment) => assignment.bhavaNumber === assignment.rashiHouseNumber));
  assert.equal(result.ascendant.role, 'ascendant-angle');
  assert.equal(result.ascendant.definesBhava, 1);
  assert.equal(result.planetaryAssignments.some((assignment) => assignment.body === 'Ascendant'), false);
  assert.equal(bodies.Rahu.siderealLongitudeDegrees, 215);
});

test('is deterministic and immutable, carries only provider-neutral house provenance, and rejects unsupported systems', () => {
  const first = calculate(PROVISIONAL_ASCENDANT, { Jupiter: 102.5 });
  const second = calculate(PROVISIONAL_ASCENDANT, { Jupiter: 102.5 });
  assert.deepEqual(first, second);
  assert.equal(first.rulesetId, HOUSE_SYSTEM_ID);
  assert.equal(first.provenance.providerIndependent, true);
  assert.equal(first.provenance.coordinateFrame, 'canonical-sidereal');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.houses), true);
  assert.equal(Object.isFrozen(first.houses[0]), true);
  assert.equal(Object.isFrozen(first.planetaryAssignments[0]), true);
  assert.throws(() => { first.houses.push('mutation'); }, TypeError);
  assert.throws(() => calculateRashiHouses({ ascendantCanonicalSiderealLongitude: 0, houseSystemId: 'sripati-madhya-quadrant-v1' }), RangeError);
});
