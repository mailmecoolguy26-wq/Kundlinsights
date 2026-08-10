'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePanchangaAtInstant, TITHI_NAMES, NITYA_YOGA_NAMES, MOVABLE_KARANAS } = require('../../src/panchanga');
function calculate(sun, moon) { return calculatePanchangaAtInstant({ sunCanonicalSiderealLongitudeDegrees: sun, moonCanonicalSiderealLongitudeDegrees: moon }); }

test('classifies all 30 Tithis and Pakshas with exact half-open 12-degree boundaries', () => {
  for (let index = 1; index <= 30; index += 1) {
    const start = (index - 1) * 12;
    const at = calculate(0, start);
    assert.equal(at.tithi.tithiIndex, index); assert.equal(at.tithi.name, TITHI_NAMES[index - 1]);
    assert.equal(at.paksha.name, index <= 15 ? 'Shukla' : 'Krishna');
    assert.equal(at.tithi.boundaryStatus, 'exactBoundary');
    assert.equal(at.tithi.degreesElapsed, 0);
    if (start > 0) assert.equal(calculate(0, start - 1e-10).tithi.tithiIndex, index - 1);
    assert.equal(calculate(0, start + 1e-10).tithi.tithiIndex, index);
  }
  assert.equal(calculate(0, 0).paksha.name, 'Shukla'); assert.equal(calculate(0, 180).paksha.name, 'Krishna'); assert.equal(calculate(0, 360).tithi.tithiIndex, 1);
});

test('distinguishes exact New/Full Moon from waxing and waning states', () => {
  assert.equal(calculate(0, 0).lunarPhaseState.state, 'newMoon');
  assert.equal(calculate(0, 0.1).lunarPhaseState.state, 'waxing');
  assert.equal(calculate(0, 180).lunarPhaseState.state, 'fullMoon');
  assert.equal(calculate(0, 180.1).lunarPhaseState.state, 'waning');
  assert.equal(calculate(0, 359.9).lunarPhaseState.state, 'waning');
});

test('maps all 60 Karana positions, eight movable cycles, aliases, and each 6-degree boundary', () => {
  for (let position = 1; position <= 60; position += 1) {
    const start = (position - 1) * 6; const at = calculate(0, start);
    assert.equal(at.karana.positionIndex, position); assert.equal(at.karana.degreesElapsed, 0);
    if (position === 1) assert.equal(at.karana.name, 'Kimstughna');
    else if (position === 58) assert.equal(at.karana.name, 'Shakuni');
    else if (position === 59) assert.equal(at.karana.name, 'Chatushpada');
    else if (position === 60) assert.equal(at.karana.name, 'Naga');
    else assert.equal(at.karana.name, MOVABLE_KARANAS[(position - 2) % 7]);
    if (start > 0) assert.equal(calculate(0, start - 1e-10).karana.positionIndex, position - 1);
    assert.equal(calculate(0, start + 1e-10).karana.positionIndex, position);
  }
  assert.deepEqual(calculate(0, 30).karana.aliases, ['Gara']);
  assert.deepEqual(calculate(0, 42).karana.aliases, ['Bhadra']);
});

test('maps all 27 Nitya Yogas without cumulative boundary drift', () => {
  const width = 360 / 27;
  for (let index = 1; index <= 27; index += 1) {
    const boundary = (index - 1) * 360 / 27;
    const at = calculate(boundary, 0);
    assert.equal(at.nityaYoga.yogaIndex, index, `exact ${index}`); assert.equal(at.nityaYoga.name, NITYA_YOGA_NAMES[index - 1]);
    assert.equal(at.nityaYoga.boundaryStatus, 'exactBoundary');
    if (index > 1) assert.equal(calculate(boundary - 1e-10, 0).nityaYoga.yogaIndex, index - 1);
    assert.equal(calculate(boundary + 1e-10, 0).nityaYoga.yogaIndex, index);
  }
  assert.equal(calculate(360, 0).nityaYoga.yogaIndex, 1);
  assert.equal(calculate(350, 20).nityaYoga.normalizedLongitudeSumDegrees, 10);
  assert.equal(width, 40 / 3);
});

test('normalizes zero, 360, negative, oversized, and wrapped canonical inputs', () => {
  assert.deepEqual(calculate(0, 0).tithi, calculate(360, 360).tithi);
  assert.equal(calculate(10, -10).tithi.elongationDegrees, 340);
  assert.equal(calculate(10, 730).tithi.elongationDegrees, 0);
  assert.equal(calculate(-140, 220).tithi.elongationDegrees, 0);
  assert.throws(() => calculate(0, Infinity), TypeError);
});

test('preserves Tithi and Karana under common offsets but makes no such assumption for Nitya Yoga', () => {
  const first = calculate(20, 115); const shifted = calculate(120, 215);
  assert.equal(first.tithi.tithiIndex, shifted.tithi.tithiIndex); assert.equal(first.karana.positionIndex, shifted.karana.positionIndex);
  assert.notEqual(first.nityaYoga.yogaIndex, shifted.nityaYoga.yogaIndex);
});

test('is immutable, deterministic, provider-independent, and does not mutate inputs', () => {
  const input = { sunCanonicalSiderealLongitudeDegrees: 220.078322866209, moonCanonicalSiderealLongitudeDegrees: 319.524236181720 };
  const first = calculatePanchangaAtInstant(input), second = calculatePanchangaAtInstant(input);
  assert.deepEqual(first, second); assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.karana.aliases), true);
  assert.throws(() => { first.tithi.name = 'x'; }, TypeError); assert.equal(input.sunCanonicalSiderealLongitudeDegrees, 220.078322866209);
  assert.equal(first.provenance.providerIndependent, true); assert.equal(first.provenance.astronomicalCalculation, 'not-performed'); assert.equal(first.provenance.sunriseCalculation, 'not-performed');
});

test('retains the provisional coordinate fixture as an arithmetic-only regression', () => {
  const result = calculate(220.078322866209, 319.524236181720);
  assert.equal(result.tithi.elongationDegrees, 99.445913315511); assert.equal(result.tithi.tithiIndex, 9); assert.equal(result.tithi.name, 'Navami');
  assert.equal(result.paksha.name, 'Shukla'); assert.equal(result.lunarPhaseState.state, 'waxing');
  assert.equal(result.karana.positionIndex, 17); assert.equal(result.karana.name, 'Balava');
  assert.ok(Math.abs(result.nityaYoga.normalizedLongitudeSumDegrees - 179.602559047929) < 1e-12); assert.equal(result.nityaYoga.yogaIndex, 14); assert.equal(result.nityaYoga.name, 'Harshana');
});
