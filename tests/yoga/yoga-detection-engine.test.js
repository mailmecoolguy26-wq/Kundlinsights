'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRashiHouses } = require('../../src/bhava');
const { evaluatePlanetaryState } = require('../../src/dignity');
const { detectCoreYogas, YOGA_BUNDLE_ID, YOGA_DEFINITIONS } = require('../../src/yoga');

const BODY_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const MAHAPURUSHA = [
  ['ruchaka-mahapurusha-v1', 'Mars', 1],
  ['bhadra-mahapurusha-v1', 'Mercury', 3],
  ['hamsa-mahapurusha-v1', 'Jupiter', 9],
  ['malavya-mahapurusha-v1', 'Venus', 2],
  ['shasha-mahapurusha-v1', 'Saturn', 10]
];

function longitudeForRashi(rashiIndex, degreesWithinRashi = 1) { return ((rashiIndex - 1) * 30) + degreesWithinRashi; }
function rashiForHouse(ascendantRashi, house) { return ((ascendantRashi - 1 + house - 1) % 12) + 1; }
function yogaById(result, yogaId) { return result.yogaEvaluations.find((yoga) => yoga.yogaId === yogaId); }

function buildInput({ ascendantRashi = 1, rashis = {}, modifiers = {} } = {}) {
  const bodies = { Ascendant: { canonicalSiderealLongitudeDegrees: longitudeForRashi(ascendantRashi) } };
  for (const body of BODY_NAMES) {
    const canonicalSiderealLongitudeDegrees = longitudeForRashi(rashis[body] || 1);
    bodies[body] = {
      canonicalSiderealLongitudeDegrees,
      siderealLongitudeDegrees: canonicalSiderealLongitudeDegrees,
      motion: { providerState: modifiers[body] && modifiers[body].retrograde ? 'retrograde' : 'direct' }
    };
  }
  const houses = calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: bodies.Ascendant.canonicalSiderealLongitudeDegrees,
    bodies
  });
  const dignityResult = evaluatePlanetaryState({ bodies });
  return { bodies, houses, dignityResult };
}

function detect(options) { return detectCoreYogas(buildInput(options)); }

test('returns all nine definitions in stable declaration order with provider-independent D1 provenance', () => {
  const output = detect();
  assert.deepEqual(output.yogaEvaluations.map((yoga) => yoga.yogaId), YOGA_DEFINITIONS.map((definition) => definition.yogaId));
  assert.equal(output.rulesetBundleId, YOGA_BUNDLE_ID);
  assert.equal(output.chartContext.chartId, 'D1');
  assert.equal(output.provenance.providerIndependent, true);
  for (const yoga of output.yogaEvaluations) {
    assert.equal(yoga.provenance.providerIndependent, true);
    for (const forbidden of ['interpretation', 'strength', 'score', 'rank', 'prediction', 'effect', 'result', 'activationPeriod', 'good', 'bad']) assert.equal(Object.hasOwn(yoga, forbidden), false);
  }
});

test('detects Gaja Kesari for each Kendra offset and rejects every non-Kendra offset in Moon-to-Jupiter direction', () => {
  for (let offset = 0; offset < 12; offset += 1) {
    const moon = 11;
    const jupiter = ((moon - 1 + offset) % 12) + 1;
    const yoga = yogaById(detect({ rashis: { Moon: moon, Jupiter: jupiter } }), 'phaladeepika-gaja-kesari-kendra-from-moon-v1');
    assert.equal(yoga.detected, [0, 3, 6, 9].includes(offset), `offset ${offset}`);
    assert.equal(yoga.evidence.normalizedRashiOffset, offset);
    assert.equal(yoga.evidence.kendraOrdinal, [0, 3, 6, 9].includes(offset) ? offset + 1 : null);
  }
  const wrap = yogaById(detect({ rashis: { Moon: 12, Jupiter: 3 } }), 'phaladeepika-gaja-kesari-kendra-from-moon-v1');
  assert.equal(wrap.detected, true);
  assert.equal(wrap.evidence.normalizedRashiOffset, 3);
  assert.equal(yogaById(detect({ rashis: { Moon: 3, Jupiter: 11 } }), 'phaladeepika-gaja-kesari-kendra-from-moon-v1').detected, false);
});

test('detects every Panch Mahapurusha yoga in own and exalted Kendra placements without modifier cancellation', () => {
  for (const [id, planet, ownRashi] of MAHAPURUSHA) {
    for (const house of [1, 4, 7, 10]) {
      const ascendantRashi = ((ownRashi - house + 12) % 12) + 1;
      const yoga = yogaById(detect({ ascendantRashi, rashis: { [planet]: ownRashi } }), id);
      assert.equal(yoga.detected, true, `${id} own sign H${house}`);
      assert.equal(yoga.evidence.planetHouse, house);
    }
    const exaltedRashi = { Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7 }[planet];
    const exalted = yogaById(detect({ ascendantRashi: exaltedRashi, rashis: { [planet]: exaltedRashi } }), id);
    assert.equal(exalted.detected, true, `${id} exalted Kendra`);
    assert.equal(exalted.evidence.isExalted, true);
  }
  const ruchaka = yogaById(detect({ ascendantRashi: 1, rashis: { Sun: 7, Mars: 1 }, modifiers: { Mars: { retrograde: true } } }), 'ruchaka-mahapurusha-v1');
  assert.equal(ruchaka.detected, true);
  assert.equal(ruchaka.modifiers.retrograde, true);
  assert.equal(ruchaka.modifiers.combust, false);
});

test('rejects Panch Mahapurusha candidates with qualifying dignity outside a Kendra or a Kendra without own/exalted dignity', () => {
  for (const [id, planet, ownRashi] of MAHAPURUSHA) {
    const outside = yogaById(detect({ ascendantRashi: ownRashi, rashis: { [planet]: rashiForHouse(ownRashi, 2) } }), id);
    // The candidate remains in its own Rashi, so select an Ascendant that makes it H2.
    const ownOutside = yogaById(detect({ ascendantRashi: rashiForHouse(ownRashi, 12), rashis: { [planet]: ownRashi } }), id);
    assert.equal(ownOutside.detected, false, `${id} own-sign outside Kendra`);
    const nonQualifyingRashi = { Mars: 2, Mercury: 1, Jupiter: 1, Venus: 1, Saturn: 1 }[planet];
    const nonQualifying = yogaById(detect({ ascendantRashi: nonQualifyingRashi, rashis: { [planet]: nonQualifyingRashi } }), id);
    assert.equal(nonQualifying.evidence.planetHouse, 1);
    assert.equal(nonQualifying.detected, false, `${id} non-qualifying dignity`);
    assert.equal(outside.detected, false);
  }
});

test('detects each Vipareeta definition for its specific house-lord role in every Dusthana and rejects other houses', () => {
  const definitions = [
    ['phaladeepika-harsha-vipareeta-v1', 6],
    ['phaladeepika-sarala-vipareeta-v1', 8],
    ['phaladeepika-vimala-vipareeta-v1', 12]
  ];
  for (const [id, sourceHouse] of definitions) {
    const ascendantRashi = 1;
    const sourceRashi = rashiForHouse(ascendantRashi, sourceHouse);
    const sourceLord = { 6: 'Mercury', 8: 'Mars', 12: 'Jupiter' }[sourceHouse];
    for (const destinationHouse of [6, 8, 12]) {
      const yoga = yogaById(detect({ ascendantRashi, rashis: { [sourceLord]: rashiForHouse(ascendantRashi, destinationHouse) } }), id);
      assert.equal(yoga.detected, true, `${id} in H${destinationHouse}`);
      assert.equal(yoga.evidence.sourceHouse, sourceHouse);
      assert.equal(yoga.evidence.sourceHouseLord, sourceLord);
      assert.equal(yoga.evidence.lordHouse, destinationHouse);
      assert.equal(yoga.evidence.qualifyingDusthana, true);
      assert.equal(yoga.evidence.lordRashi.rashiIndex, rashiForHouse(ascendantRashi, destinationHouse));
      assert.equal(sourceRashi, rashiForHouse(ascendantRashi, sourceHouse));
    }
    const outside = yogaById(detect({ ascendantRashi, rashis: { [sourceLord]: rashiForHouse(ascendantRashi, 2) } }), id);
    assert.equal(outside.detected, false);
    assert.equal(outside.evidence.qualifyingDusthana, false);
  }
});

test('resolves Vipareeta lordships from Layer 5A across all twelve Lagnas and preserves dual lordships', () => {
  for (let ascendantRashi = 1; ascendantRashi <= 12; ascendantRashi += 1) {
    const raw = buildInput({ ascendantRashi });
    const result = detectCoreYogas(raw);
    for (const yoga of result.yogaEvaluations.filter((item) => item.yogaId.includes('vipareeta'))) {
      const expectedHouse = yoga.yogaId.includes('harsha') ? 6 : yoga.yogaId.includes('sarala') ? 8 : 12;
      assert.equal(yoga.evidence.sourceHouse, expectedHouse);
      assert.ok(yoga.evidence.sourceHouseLordships.includes(expectedHouse));
    }
  }
  const dual = yogaById(detect({ ascendantRashi: 1, rashis: { Mercury: 6 } }), 'phaladeepika-harsha-vipareeta-v1');
  assert.deepEqual(dual.evidence.sourceHouseLordships, [3, 6]);
  assert.equal(dual.detected, true);
});

test('rejects missing or internally inconsistent upstream facts and does not create node yoga roles', () => {
  const valid = buildInput();
  const missingMoon = { ...valid, bodies: { ...valid.bodies } };
  delete missingMoon.bodies.Moon;
  assert.throws(() => detectCoreYogas(missingMoon), /Moon/);
  const contradictoryBody = { ...valid, bodies: { ...valid.bodies, Moon: { ...valid.bodies.Moon, rashi: { rashiIndex: 9 } } } };
  assert.throws(() => detectCoreYogas(contradictoryBody), /contradicts/);
  const contradictoryHouses = { ...valid, houses: { ...valid.houses, planetaryAssignments: valid.houses.planetaryAssignments.map((assignment) => assignment.body === 'Mars' ? { ...assignment, rashiHouseNumber: 9 } : assignment) } };
  assert.throws(() => detectCoreYogas(contradictoryHouses), /contradicts/);
  const contradictoryDignity = { ...valid, dignityResult: { ...valid.dignityResult, bodies: { ...valid.dignityResult.bodies, Mars: { ...valid.dignityResult.bodies.Mars, canonicalSiderealLongitudeDegrees: 100 } } } };
  assert.throws(() => detectCoreYogas(contradictoryDignity), /contradicts/);
  assert.equal(detect().yogaEvaluations.some((yoga) => yoga.evidence.planet === 'Rahu' || yoga.evidence.planet === 'Ketu'), false);
  assert.throws(() => detectCoreYogas({ ...valid, chartId: 'D9' }), /Unsupported chart context/);
});

test('deep-freezes deterministic evaluations without mutating inputs', () => {
  const input = buildInput({ ascendantRashi: 1, rashis: { Moon: 1, Jupiter: 1 } });
  const originalMoonLongitude = input.bodies.Moon.canonicalSiderealLongitudeDegrees;
  const first = detectCoreYogas(input);
  const second = detectCoreYogas(input);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.yogaEvaluations), true);
  assert.equal(Object.isFrozen(first.yogaEvaluations[0].evidence), true);
  assert.equal(Object.isFrozen(first.yogaEvaluations[0].modifiers), true);
  assert.equal(Object.isFrozen(first.yogaEvaluations[0].provenance), true);
  assert.throws(() => { first.yogaEvaluations[0].evidence.normalizedRashiOffset = 7; }, TypeError);
  assert.equal(input.bodies.Moon.canonicalSiderealLongitudeDegrees, originalMoonLongitude);
});

test('evaluates the provisional coordinate fixture as nine independently false base conditions', () => {
  const input = buildInput({
    ascendantRashi: 12,
    rashis: { Sun: 8, Moon: 11, Mars: 2, Mercury: 8, Jupiter: 4, Venus: 8, Saturn: 9, Rahu: 10, Ketu: 4 },
    modifiers: { Mars: { retrograde: true } }
  });
  const output = detectCoreYogas(input);
  assert.equal(yogaById(output, 'phaladeepika-gaja-kesari-kendra-from-moon-v1').detected, false);
  assert.equal(yogaById(output, 'ruchaka-mahapurusha-v1').detected, false);
  assert.equal(yogaById(output, 'bhadra-mahapurusha-v1').detected, false);
  assert.equal(yogaById(output, 'hamsa-mahapurusha-v1').detected, false);
  assert.equal(yogaById(output, 'malavya-mahapurusha-v1').detected, false);
  assert.equal(yogaById(output, 'shasha-mahapurusha-v1').detected, false);
  assert.equal(yogaById(output, 'phaladeepika-harsha-vipareeta-v1').detected, false);
  assert.equal(yogaById(output, 'phaladeepika-sarala-vipareeta-v1').detected, false);
  assert.equal(yogaById(output, 'phaladeepika-vimala-vipareeta-v1').detected, false);
  assert.equal(yogaById(output, 'hamsa-mahapurusha-v1').evidence.isExalted, true);
  assert.equal(yogaById(output, 'hamsa-mahapurusha-v1').evidence.planetHouse, 5);
  assert.equal(yogaById(output, 'shasha-mahapurusha-v1').evidence.planetHouse, 10);
  assert.equal(yogaById(output, 'shasha-mahapurusha-v1').evidence.qualifiesByDignity, false);
});
