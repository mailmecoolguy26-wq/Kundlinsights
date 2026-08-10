'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VIMSHOTTARI_LORDS,
  VIMSHOTTARI_TOTAL_YEARS,
  VIMSHOTTARI_NAKSHATRA_MAPPING,
  cyclicLordsStartingAt,
  SAVANA_MILLISECONDS_PER_YEAR,
  calculateVimshottariDasha
} = require('../../src/dasha');
const { NAKSHATRA_SPAN_DEGREES } = require('../../src/jyotish/reference-data');

const BIRTH_INSTANT = '1990-11-26T08:10:00.000Z';
const PROVISIONAL_MOON = 319.5242361817203;

function calculate(longitude) {
  return calculateVimshottariDasha({ birthInstant: BIRTH_INSTANT, moonCanonicalSiderealLongitude: longitude });
}

function assertTessellates(periods, parent) {
  assert.equal(periods[0].startInstant.epochMilliseconds, parent.startInstant.epochMilliseconds);
  assert.equal(periods.at(-1).endInstant.epochMilliseconds, parent.endInstant.epochMilliseconds);
  for (let index = 1; index < periods.length; index += 1) assert.equal(periods[index - 1].endInstant.epochMilliseconds, periods[index].startInstant.epochMilliseconds);
}

test('defines the complete 27-Nakshatra Vimshottari mapping and nine weights', () => {
  assert.equal(VIMSHOTTARI_LORDS.reduce((total, lord) => total + lord.years, 0), VIMSHOTTARI_TOTAL_YEARS);
  assert.equal(VIMSHOTTARI_NAKSHATRA_MAPPING.length, 27);
  for (const mapping of VIMSHOTTARI_NAKSHATRA_MAPPING) {
    const expected = VIMSHOTTARI_LORDS[(mapping.nakshatraIndex - 1) % 9];
    assert.equal(mapping.lord.id, expected.id);
    assert.equal(mapping.years, expected.years);
  }
});

test('maps every exact Nakshatra boundary to its new lord and normalizes 360 degrees', () => {
  for (let index = 0; index < 27; index += 1) {
    const result = calculate(index * NAKSHATRA_SPAN_DEGREES);
    assert.equal(result.birthContext.nakshatraIndex, index + 1);
    assert.equal(result.birthContext.lord.id, VIMSHOTTARI_LORDS[index % 9].id);
    assert.equal(result.birthContext.elapsedRatio, 0);
    assert.equal(result.birthContext.remainingRatio, 1);
  }
  const zero = calculate(0);
  const threeSixty = calculate(360);
  assert.equal(threeSixty.moonCanonicalSiderealLongitude, zero.moonCanonicalSiderealLongitude);
  assert.equal(threeSixty.birthContext.lord.id, 'ketu');
});

test('keeps immediately below and above Nakshatra boundaries in their half-open intervals', () => {
  for (let index = 1; index < 27; index += 1) {
    const boundary = index * NAKSHATRA_SPAN_DEGREES;
    assert.equal(calculate(boundary - 1e-10).birthContext.nakshatraIndex, index);
    assert.equal(calculate(boundary).birthContext.nakshatraIndex, index + 1);
    assert.equal(calculate(boundary + 1e-10).birthContext.nakshatraIndex, index + 1);
  }
});

test('calculates the approved longitude-proportional birth balance without rounding', () => {
  const result = calculate(PROVISIONAL_MOON);
  assert.equal(result.birthContext.nakshatra, 'Shatabhisha');
  assert.equal(result.birthContext.lord.id, 'rahu');
  assert.ok(Math.abs(result.birthContext.elapsedRatio - 0.964317713629022) < 1e-15);
  assert.ok(Math.abs(result.birthContext.remainingRatio - 0.035682286370978) < 1e-15);
  assert.ok(Math.abs(result.birthContext.remainingMahadashaYears - 0.642281154677605) < 1e-14);
  assert.equal(result.ruleset.balanceMethodId, 'longitude-proportional-balance-v1');
  assert.equal(result.ruleset.timeConventionId, 'savana-360-day-v1');
});

test('generates a complete 120-year Mahadasha cycle for every possible starting lord', () => {
  for (let index = 0; index < 9; index += 1) {
    const result = calculate(index * NAKSHATRA_SPAN_DEGREES);
    assert.equal(result.periods.length, 9);
    assert.deepEqual(result.periods.map((period) => period.lord.id), cyclicLordsStartingAt(VIMSHOTTARI_LORDS[index].id).map((lord) => lord.id));
    const start = BigInt(result.periods[0].startInstant.epochMilliseconds);
    const end = BigInt(result.periods.at(-1).endInstant.epochMilliseconds);
    assert.equal(end - start, SAVANA_MILLISECONDS_PER_YEAR * 120n);
  }
});

test('creates cyclic AD and PD orders rooted at their parent lords', () => {
  const result = calculate(PROVISIONAL_MOON);
  for (const md of result.periods) {
    assert.equal(md.children.length, 9);
    assert.deepEqual(md.children.map((period) => period.lord.id), cyclicLordsStartingAt(md.lord.id).map((lord) => lord.id));
    for (const ad of md.children) {
      assert.equal(ad.children.length, 9);
      assert.deepEqual(ad.children.map((period) => period.lord.id), cyclicLordsStartingAt(ad.lord.id).map((lord) => lord.id));
    }
  }
});

test('tessellates every MD and AD exactly with no gaps, overlaps, or end drift', () => {
  const result = calculate(PROVISIONAL_MOON);
  for (const md of result.periods) {
    assertTessellates(md.children, md);
    for (const ad of md.children) assertTessellates(ad.children, ad);
  }
});

test('identifies the provisional real-chart Rahu/Mars/Saturn hierarchy deterministically', () => {
  const result = calculate(PROVISIONAL_MOON);
  assert.equal(result.activeAtBirth.mahadasha.lord.id, 'rahu');
  assert.equal(result.activeAtBirth.antardasha.lord.id, 'mars');
  assert.equal(result.activeAtBirth.pratyantardasha.lord.id, 'saturn');
  assert.equal(result.activeAtBirth.mahadasha.endInstant.utc, '1991-07-15T13:28:33.035Z');
  assert.equal(result.activeAtBirth.pratyantardasha.startInstant.utc, '1990-11-08T17:04:33.035Z');
});

test('returns immutable provider-independent results and deterministic repeated calculations', () => {
  const first = calculate(PROVISIONAL_MOON);
  const second = calculate(PROVISIONAL_MOON);
  assert.deepEqual(first, second);
  assert.equal(first.provenance.providerIndependent, true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.periods), true);
  assert.equal(Object.isFrozen(first.periods[0]), true);
  assert.equal(Object.isFrozen(first.periods[0].children[0].children[0]), true);
  assert.throws(() => { first.periods.push('mutation'); }, TypeError);
  assert.throws(() => calculateVimshottariDasha({ birthInstant: BIRTH_INSTANT, moonCanonicalSiderealLongitude: NaN }), TypeError);
});
