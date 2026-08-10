'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateGrahaDrishti, CASTING_GRAHAS, FULL_ASPECTS_BY_GRAHA, GRAHA_DRISHTI_RULESET_ID } = require('../../src/drishti');
const { calculateRashiHouses } = require('../../src/bhava');

function body(longitude, metadata = {}) { return { canonicalSiderealLongitudeDegrees: longitude, ...metadata }; }
function calculate(bodies, options = {}) { return calculateGrahaDrishti({ bodies, ...options }); }

test('maps every full-aspect caster table across all twelve source Rashis with inclusive offsets and wraparound', () => {
  for (const caster of CASTING_GRAHAS) {
    for (let sourceRashiIndex = 1; sourceRashiIndex <= 12; sourceRashiIndex += 1) {
      const aspects = calculate({ [caster]: body((sourceRashiIndex - 1) * 30) }).rashiAspects;
      assert.equal(aspects.length, FULL_ASPECTS_BY_GRAHA[caster].length);
      assert.deepEqual(aspects.map((aspect) => [aspect.aspectNumber, aspect.rashiOffset, aspect.targetRashi.rashiIndex]), FULL_ASPECTS_BY_GRAHA[caster].map((definition) => [definition.aspectNumber, definition.rashiOffset, ((sourceRashiIndex - 1 + definition.rashiOffset) % 12) + 1]));
      assert.ok(aspects.every((aspect) => aspect.strengthClass === 'full'));
    }
  }
});

test('implements exactly the approved general and special full-aspect tables', () => {
  const result = calculate({ Sun: body(0), Moon: body(0), Mars: body(0), Mercury: body(0), Jupiter: body(0), Venus: body(0), Saturn: body(0) });
  assert.deepEqual(Object.fromEntries(CASTING_GRAHAS.map((bodyName) => [bodyName, result.rashiAspects.filter((aspect) => aspect.fromBody === bodyName).map((aspect) => aspect.aspectNumber)])), {
    Sun: [7], Moon: [7], Mars: [4, 7, 8], Mercury: [7], Jupiter: [5, 7, 9], Venus: [7], Saturn: [3, 7, 10]
  });
  assert.deepEqual(result.rashiAspects.filter((aspect) => aspect.fromBody === 'Mars').map((aspect) => aspect.aspectType), ['specialFull', 'generalFull', 'specialFull']);
});

test('uses canonical longitude as authority and validates supplied Layer 2 Rashi metadata', () => {
  const result = calculate({ Sun: body(360, { rashi: { rashiIndex: 1 }, degreesWithinRashi: 0 }), Moon: body(-1), Mercury: body(721) });
  assert.equal(result.rashiAspects.find((aspect) => aspect.fromBody === 'Sun').sourceRashi.rashiIndex, 1);
  assert.equal(result.rashiAspects.find((aspect) => aspect.fromBody === 'Moon').sourceRashi.sanskritName, 'Meena');
  assert.equal(result.rashiAspects.find((aspect) => aspect.fromBody === 'Mercury').sourceRashi.rashiIndex, 1);
  assert.throws(() => calculate({ Sun: body(0, { rashi: { rashiIndex: 2 } }) }), /contradicts/);
  assert.throws(() => calculate({ Sun: body(0, { degreesWithinRashi: 0.01 }) }), /contradicts/);
});

test('is directional and preserves empty targets as primary Graha-to-Rashi edges', () => {
  const result = calculate({ Mars: body(30), Saturn: body(240) });
  const marsToSagittarius = result.rashiAspects.find((aspect) => aspect.fromBody === 'Mars' && aspect.targetRashi.sanskritName === 'Dhanu');
  assert.deepEqual(marsToSagittarius.targetBodies.map((target) => target.body), ['Saturn']);
  assert.equal(result.rashiAspects.some((aspect) => aspect.fromBody === 'Saturn' && aspect.targetBodies.some((target) => target.body === 'Mars')), false);
  const empty = result.rashiAspects.find((aspect) => aspect.fromBody === 'Mars' && aspect.targetRashi.sanskritName === 'Simha');
  assert.deepEqual(empty.targetBodies, []);
  assert.equal(empty.targetsAscendant, false);
});

test('retains multiple planetary targets including nodes while nodes never cast in this ruleset', () => {
  const result = calculate({ Sun: body(210), Mars: body(30), Mercury: body(210), Venus: body(210), Rahu: body(210), Ketu: body(120) });
  const marsSeventh = result.rashiAspects.find((aspect) => aspect.fromBody === 'Mars' && aspect.aspectNumber === 7);
  assert.deepEqual(marsSeventh.targetBodies.map((target) => target.body), ['Sun', 'Mercury', 'Venus', 'Rahu']);
  assert.equal(result.rashiAspects.some((aspect) => aspect.fromBody === 'Rahu' || aspect.fromBody === 'Ketu'), false);
});

test('marks the Ascendant as a target but never a caster', () => {
  const result = calculate({ Jupiter: body(90), Ascendant: body(330) });
  const ninth = result.rashiAspects.find((aspect) => aspect.fromBody === 'Jupiter' && aspect.aspectNumber === 9);
  assert.equal(ninth.targetRashi.sanskritName, 'Meena');
  assert.equal(ninth.targetsAscendant, true);
  assert.equal(result.rashiAspects.some((aspect) => aspect.fromBody === 'Ascendant'), false);
});

test('decorates targets only from a supplied valid Layer 5A house result', () => {
  const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: 330, bodies: { Mars: { siderealLongitudeDegrees: 30 } } });
  const decorated = calculate({ Sun: body(210), Mars: body(30), Ascendant: body(330) }, { houses });
  assert.equal(decorated.rashiAspects[0].targetRashi.sanskritName, 'Vrishabha');
  assert.equal(decorated.rashiAspects[0].targetHouseNumber, 3);
  assert.equal(calculate({ Sun: body(210) }).rashiAspects[0].targetHouseNumber, null);
  assert.throws(() => calculate({ Sun: body(210), Ascendant: body(0) }, { houses }), /contradicts/);
  assert.throws(() => calculate({ Sun: body(210) }, { houses }), /requires Ascendant/);
  const inconsistentHouses = { ...houses, houses: houses.houses.map((house, index) => index === 0 ? { ...house, rashi: { ...house.rashi, rashiIndex: 1 } } : house) };
  assert.throws(() => calculate({ Sun: body(210), Ascendant: body(330) }, { houses: inconsistentHouses }), /inconsistent/);
});

test('retains degree separation only as metadata and never uses it to decide full Drishti', () => {
  const result = calculate({ Sun: body(210.9), Mars: body(30.1) });
  const aspect = result.rashiAspects[0];
  assert.equal(aspect.targetRashi.sanskritName, 'Vrishabha');
  assert.equal(aspect.targetBodies[0].body, 'Mars');
  assert.ok(aspect.geometricMetadata.targetBodySeparations[0].circularLongitudeSeparationDegrees < 180);
  assert.equal(aspect.provenance.degreeAspectDecision, 'not-used-for-full-positional-drishti');
});

test('rejects unsupported chart contexts and deferred Graha Drishti rulesets', () => {
  const bodies = { Sun: body(0) };
  assert.throws(() => calculate(bodies, { chartId: 'D9' }), /Unsupported chart context/);
  for (const rulesetId of ['parashari-node-drishti-v1', 'parashari-graha-drishti-fractional-v1', 'parashari-sphuta-drishti-v1', 'parashari-rashi-drishti-v1']) {
    assert.throws(() => calculate(bodies, { rulesetId }), /Unsupported Graha Drishti ruleset/);
  }
});

test('returns the approved provisional D1 fixture with deterministic deeply immutable provenance', () => {
  const fixture = Object.freeze({
    Sun: body(220.07832286620908), Moon: body(319.5242361817203), Mars: body(42.18360596946707),
    Mercury: body(238.76444202398272), Jupiter: body(109.84178231392207), Venus: body(226.22342533572362),
    Saturn: body(268.1543474448998), Rahu: body(277.2888771562772), Ketu: body(97.28887715627718), Ascendant: body(331.212553397423)
  });
  const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: fixture.Ascendant.canonicalSiderealLongitudeDegrees, bodies: Object.fromEntries(Object.entries(fixture).filter(([bodyName]) => bodyName !== 'Ascendant').map(([bodyName, value]) => [bodyName, { siderealLongitudeDegrees: value.canonicalSiderealLongitudeDegrees }])) });
  const first = calculate(fixture, { houses });
  const second = calculate(fixture, { houses });
  assert.deepEqual(first, second);
  assert.equal(first.rulesetId, GRAHA_DRISHTI_RULESET_ID);
  assert.equal(first.rashiAspects.length, 13);
  assert.deepEqual(first.rashiAspects.map((aspect) => [aspect.fromBody, aspect.targetRashi.sanskritName, aspect.aspectNumber, aspect.targetHouseNumber, aspect.targetBodies.map((target) => target.body), aspect.targetsAscendant]), [
    ['Sun', 'Vrishabha', 7, 3, ['Mars'], false], ['Moon', 'Simha', 7, 6, [], false],
    ['Mars', 'Simha', 4, 6, [], false], ['Mars', 'Vrishchika', 7, 9, ['Sun', 'Mercury', 'Venus'], false], ['Mars', 'Dhanu', 8, 10, ['Saturn'], false],
    ['Mercury', 'Vrishabha', 7, 3, ['Mars'], false], ['Jupiter', 'Vrishchika', 5, 9, ['Sun', 'Mercury', 'Venus'], false], ['Jupiter', 'Makara', 7, 11, ['Rahu'], false], ['Jupiter', 'Meena', 9, 1, [], true],
    ['Venus', 'Vrishabha', 7, 3, ['Mars'], false], ['Saturn', 'Kumbha', 3, 12, ['Moon'], false], ['Saturn', 'Mithuna', 7, 4, [], false], ['Saturn', 'Kanya', 10, 7, [], false]
  ]);
  assert.equal(first.provenance.providerIndependent, true);
  assert.equal(first.provenance.ayanamshaCalculation, 'not-performed');
  assert.equal(first.provenance.astronomicalCalculation, 'not-performed');
  assert.equal(first.provenance.houseCalculation, 'not-performed');
  assert.equal(first.provenance.vargaCalculation, 'not-performed');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.rashiAspects), true);
  assert.equal(Object.isFrozen(first.rashiAspects[0].targetBodies), true);
  assert.throws(() => { first.rashiAspects.push('mutation'); }, TypeError);
  assert.equal(fixture.Sun.canonicalSiderealLongitudeDegrees, 220.07832286620908);
});
