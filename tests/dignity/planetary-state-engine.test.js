'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluatePlanetaryState, SEVEN_CLASSICAL_BODIES, SEVEN_GRAHA_DIGNITIES,
  NODE_DIGNITY_RULESET_ID, COMBUSTION_RULESET_ID
} = require('../../src/dignity');

function body(longitude, providerState = 'direct', metadata = {}) {
  return { canonicalSiderealLongitudeDegrees: longitude, motion: { providerState }, ...metadata };
}

function evaluate(bodies, options = {}) { return evaluatePlanetaryState({ bodies, ...options }); }

test('derives canonical Rashi facts from longitude and rejects contradictory supplied Layer 2 metadata', () => {
  const result = evaluate({ Jupiter: body(95) });
  assert.equal(result.bodies.Jupiter.rashi.sanskritName, 'Karka');
  assert.equal(result.bodies.Jupiter.degreesWithinRashi, 5);
  assert.throws(() => evaluate({ Jupiter: body(95, 'direct', { rashi: { rashiIndex: 5 } }) }), /contradicts/);
  assert.throws(() => evaluate({ Jupiter: body(95, 'direct', { degreesWithinRashi: 4.999999 }) }), /contradicts/);
});

test('validates all seven-graha own signs, Moolatrikona intervals, exaltation, debilitation, and exact points', () => {
  for (const planet of SEVEN_CLASSICAL_BODIES) {
    const definition = SEVEN_GRAHA_DIGNITIES[planet];
    for (const rashiIndex of definition.ownRashis) {
      const state = evaluate({ [planet]: body((rashiIndex - 1) * 30 + 0.5) }).bodies[planet];
      assert.equal(state.dignity.isOwnSign, true, `${planet} own sign ${rashiIndex}`);
    }
    const moola = definition.moolatrikona;
    const start = (moola.rashiIndex - 1) * 30 + moola.startDegrees;
    const end = (moola.rashiIndex - 1) * 30 + moola.endDegrees;
    assert.equal(evaluate({ [planet]: body(start) }).bodies[planet].dignity.isMoolatrikona, true, `${planet} Moola start`);
    assert.equal(evaluate({ [planet]: body(end - 1e-10) }).bodies[planet].dignity.isMoolatrikona, true, `${planet} before Moola end`);
    assert.equal(evaluate({ [planet]: body(end) }).bodies[planet].dignity.isMoolatrikona, false, `${planet} Moola end`);
    if (moola.startDegrees > 0) assert.equal(evaluate({ [planet]: body(start - 1e-10) }).bodies[planet].dignity.isMoolatrikona, false, `${planet} before Moola start`);
    const exaltation = (definition.exaltationRashiIndex - 1) * 30 + definition.exaltationPointDegreesWithinRashi;
    const debilitation = (definition.debilitationRashiIndex - 1) * 30 + definition.debilitationPointDegreesWithinRashi;
    const exalted = evaluate({ [planet]: body(exaltation) }).bodies[planet].dignity;
    const debilitated = evaluate({ [planet]: body(debilitation) }).bodies[planet].dignity;
    assert.equal(exalted.isExalted, true);
    assert.equal(exalted.exactExaltationPoint, true);
    assert.equal(exalted.distanceFromExactExaltationDegrees, 0);
    assert.equal(debilitated.isDebilitated, true);
    assert.equal(debilitated.exactDebilitationPoint, true);
    assert.equal(debilitated.distanceFromExactDebilitationDegrees, 0);
    assert.equal(evaluate({ [planet]: body(exaltation - 1e-10) }).bodies[planet].dignity.exactExaltationPoint, false);
    assert.equal(evaluate({ [planet]: body(exaltation + 1e-10) }).bodies[planet].dignity.exactExaltationPoint, false);
  }
});

test('classifies every Rashi for every classical planet from canonical longitude', () => {
  for (const planet of SEVEN_CLASSICAL_BODIES) {
    const definition = SEVEN_GRAHA_DIGNITIES[planet];
    for (let rashiIndex = 1; rashiIndex <= 12; rashiIndex += 1) {
      const dignity = evaluate({ [planet]: body((rashiIndex - 1) * 30 + 22.5) }).bodies[planet].dignity;
      assert.equal(dignity.isOwnSign, definition.ownRashis.includes(rashiIndex), `${planet} own sign at Rashi ${rashiIndex}`);
      assert.equal(dignity.isExalted, rashiIndex === definition.exaltationRashiIndex, `${planet} exalted at Rashi ${rashiIndex}`);
      assert.equal(dignity.isDebilitated, rashiIndex === definition.debilitationRashiIndex, `${planet} debilitated at Rashi ${rashiIndex}`);
    }
  }
});

test('keeps overlapping dignity facts independent and normalizes standalone canonical longitudes', () => {
  const mercury = evaluate({ Mercury: body(165) }).bodies.Mercury.dignity;
  assert.equal(mercury.isOwnSign, true);
  assert.equal(mercury.isMoolatrikona, true);
  assert.equal(mercury.isExalted, true);
  assert.equal(mercury.exactExaltationPoint, true);
  assert.equal('primaryDignity' in mercury, false);
  assert.equal(evaluate({ Sun: body(360) }).bodies.Sun.normalizedCanonicalSiderealLongitudeDegrees, 0);
  assert.equal(evaluate({ Sun: body(-1) }).bodies.Sun.rashi.sanskritName, 'Meena');
  assert.equal(evaluate({ Sun: body(721) }).bodies.Sun.normalizedCanonicalSiderealLongitudeDegrees, 1);
});

test('uses the default optional node dignity ruleset and can explicitly disable it', () => {
  const enabled = evaluate({ Rahu: body(30), Ketu: body(240) });
  assert.equal(enabled.rulesets.nodeDignityRulesetId, NODE_DIGNITY_RULESET_ID);
  assert.equal(enabled.bodies.Rahu.dignity.isExalted, true);
  assert.equal(enabled.bodies.Ketu.dignity.isMoolatrikona, true);
  assert.equal(enabled.bodies.Rahu.dignity.exactExaltationPoint, null);
  assert.equal(enabled.bodies.Ketu.dignity.distanceFromExactDebilitationDegrees, null);
  assert.equal(enabled.bodies.Rahu.relationships.signLordRelationshipStatus, 'notDefinedByRuleset');
  const disabled = evaluate({ Rahu: body(30), Ketu: body(240) }, { nodeDignityRulesetId: null });
  assert.equal(disabled.bodies.Rahu.dignity.status, 'notDefinedByRuleset');
  assert.equal(disabled.bodies.Rahu.dignity.isExalted, null);
});

test('implements the complete directional natural Maitri matrix without self pairs', () => {
  const longitudes = { Sun: 0, Moon: 30, Mars: 60, Mercury: 90, Jupiter: 120, Venus: 150, Saturn: 180 };
  const result = evaluate(Object.fromEntries(Object.entries(longitudes).map(([name, longitude]) => [name, body(longitude)])));
  const expected = {
    Sun: { Moon: 'friend', Mars: 'friend', Mercury: 'neutral', Jupiter: 'friend', Venus: 'enemy', Saturn: 'enemy' },
    Moon: { Sun: 'friend', Mars: 'neutral', Mercury: 'friend', Jupiter: 'neutral', Venus: 'neutral', Saturn: 'neutral' },
    Mars: { Sun: 'friend', Moon: 'friend', Mercury: 'enemy', Jupiter: 'friend', Venus: 'neutral', Saturn: 'neutral' },
    Mercury: { Sun: 'friend', Moon: 'enemy', Mars: 'neutral', Jupiter: 'neutral', Venus: 'friend', Saturn: 'neutral' },
    Jupiter: { Sun: 'friend', Moon: 'friend', Mars: 'friend', Mercury: 'enemy', Venus: 'enemy', Saturn: 'neutral' },
    Venus: { Sun: 'enemy', Moon: 'enemy', Mars: 'neutral', Mercury: 'friend', Jupiter: 'neutral', Saturn: 'friend' },
    Saturn: { Sun: 'enemy', Moon: 'enemy', Mars: 'enemy', Mercury: 'friend', Jupiter: 'neutral', Venus: 'friend' }
  };
  for (const planet of SEVEN_CLASSICAL_BODIES) {
    assert.deepEqual(result.bodies[planet].relationships.naturalByBody, expected[planet]);
    assert.equal(Object.hasOwn(result.bodies[planet].relationships.naturalByBody, planet), false);
  }
});

test('classifies all twelve temporary Rashi offsets and all Panchadha combinations', () => {
  const expectedTemporary = ['enemy', 'friend', 'friend', 'friend', 'enemy', 'enemy', 'enemy', 'enemy', 'enemy', 'friend', 'friend', 'friend'];
  for (let offset = 0; offset < 12; offset += 1) {
    const result = evaluate({ Sun: body(0), Moon: body(offset * 30) });
    assert.equal(result.bodies.Sun.relationships.temporaryByBody.Moon, expectedTemporary[offset]);
  }
  const matrix = [
    ['friend', 'friend', 'greatFriend'], ['friend', 'enemy', 'neutral'],
    ['neutral', 'friend', 'friend'], ['neutral', 'enemy', 'enemy'],
    ['enemy', 'friend', 'neutral'], ['enemy', 'enemy', 'greatEnemy']
  ];
  const { compoundRelationship } = require('../../src/dignity');
  for (const [natural, temporary, compound] of matrix) assert.equal(compoundRelationship(natural, temporary), compound);
});

test('returns sign-lord Maitri when available and an explicit self status for own-sign placement', () => {
  const result = evaluate({ Sun: body(210), Mars: body(30), Jupiter: body(240) });
  assert.equal(result.bodies.Sun.relationships.naturalToSignLord, 'friend');
  assert.equal(result.bodies.Sun.relationships.temporaryToSignLord, 'enemy');
  assert.equal(result.bodies.Sun.relationships.compoundToSignLord, 'neutral');
  assert.equal(result.bodies.Jupiter.relationships.signLordRelationshipStatus, 'notApplicableSelf');
  assert.equal(result.bodies.Jupiter.relationships.naturalToSignLord, null);
});

test('uses approved combustion thresholds and exact equality with minimum circular separation', () => {
  const thresholds = { Moon: [12, 12], Mars: [17, 8], Mercury: [14, 12], Jupiter: [11, 11], Venus: [10, 8], Saturn: [16, 16] };
  for (const [planet, [direct, retrograde]] of Object.entries(thresholds)) {
    for (const [motion, threshold] of [['direct', direct], ['retrograde', retrograde]]) {
      const at = evaluate({ Sun: body(0), [planet]: body(threshold, motion) }).bodies[planet].combustion;
      const below = evaluate({ Sun: body(0), [planet]: body(threshold - 1e-10, motion) }).bodies[planet].combustion;
      const above = evaluate({ Sun: body(0), [planet]: body(threshold + 1e-10, motion) }).bodies[planet].combustion;
      assert.equal(below.combust, true, `${planet} ${motion} below threshold`);
      assert.equal(at.combust, true, `${planet} ${motion} at threshold`);
      assert.equal(above.combust, false, `${planet} ${motion} above threshold`);
      assert.equal(at.rulesetId, COMBUSTION_RULESET_ID);
    }
  }
  assert.equal(evaluate({ Sun: body(359), Venus: body(1) }).bodies.Venus.combustion.angularDistanceFromSunDegrees, 2);
});

test('handles stationary and unknown combustion motion without guessing', () => {
  const stationaryMars = evaluate({ Sun: body(0), Mars: body(17, 'stationary') }).bodies.Mars.combustion;
  assert.equal(stationaryMars.status, 'determined');
  assert.equal(stationaryMars.thresholdDegrees, 17);
  assert.equal(stationaryMars.combust, true);
  const unknownMars = evaluate({ Sun: body(0), Mars: body(9, 'unknown') }).bodies.Mars.combustion;
  assert.equal(unknownMars.status, 'indeterminateUnknownMotion');
  assert.equal(unknownMars.combust, null);
  const unknownJupiter = evaluate({ Sun: body(0), Jupiter: body(11, 'unknown') }).bodies.Jupiter.combustion;
  assert.equal(unknownJupiter.status, 'determined');
  assert.equal(unknownJupiter.combust, true);
});

test('marks non-applicable combustion bodies and preserves provider motion without astronomical work', () => {
  const result = evaluate({ Sun: body(0), Ascendant: body(2, 'stationary'), Rahu: body(3, 'retrograde'), Ketu: body(4, 'retrograde') });
  for (const bodyName of ['Sun', 'Ascendant', 'Rahu', 'Ketu']) {
    assert.equal(result.bodies[bodyName].combustion.applicable, false);
    assert.equal(result.bodies[bodyName].combustion.combust, null);
  }
  assert.equal(result.bodies.Rahu.motion.isRetrograde, true);
  assert.equal(result.provenance.providerIndependent, true);
  assert.equal(result.provenance.astronomicalCalculation, 'not-performed');
  assert.equal(result.provenance.ayanamshaCalculation, 'not-performed');
});

test('returns immutable deterministic output for the provisional coordinate fixture', () => {
  const fixture = Object.freeze({
    Sun: body(220.07832286620908), Moon: body(319.5242361817203), Mars: body(42.18360596946707, 'retrograde'),
    Mercury: body(238.76444202398272), Jupiter: body(109.84178231392207), Venus: body(226.22342533572362),
    Saturn: body(268.1543474448998), Rahu: body(277.2888771562772, 'retrograde'), Ketu: body(97.28887715627718, 'retrograde')
  });
  const first = evaluate(fixture);
  const second = evaluate(fixture);
  assert.deepEqual(first, second);
  assert.equal(first.bodies.Jupiter.rashi.sanskritName, 'Karka');
  assert.equal(first.bodies.Jupiter.dignity.isExalted, true);
  assert.equal(first.bodies.Venus.combustion.combust, true);
  assert.ok(Math.abs(first.bodies.Venus.combustion.angularDistanceFromSunDegrees - 6.145102469514541) < 1e-12);
  assert.equal(first.bodies.Mars.motion.isRetrograde, true);
  assert.equal(first.bodies.Mars.combustion.combust, false);
  assert.equal(first.bodies.Rahu.combustion.status, 'notApplicable');
  assert.equal(first.bodies.Ketu.dignity.exactExaltationPoint, null);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.bodies), true);
  assert.equal(Object.isFrozen(first.bodies.Jupiter), true);
  assert.throws(() => { first.bodies.Jupiter.dignity.isExalted = false; }, TypeError);
  assert.equal(fixture.Venus.canonicalSiderealLongitudeDegrees, 226.22342533572362);
});
