'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BAV_RULESET_ID, EKADHIPATYA_OCCUPANCY_POLICY_ID, RASHI_DEFINITIONS,
  calculateRawAshtakavarga, calculateTrikonaShodhana, calculateEkapadhipatyaShodhana,
  calculateShodhitaBhinnashtakavarga, calculateShodhitaAshtakavarga, occupiedRashiIndices,
} = require('../../src/ashtakavarga');

const placements = Object.freeze({
  Ascendant: { rashiIndex: 12, sanskritName: 'Meena' }, Sun: { rashiIndex: 8, sanskritName: 'Vrishchika' }, Moon: { rashiIndex: 11, sanskritName: 'Kumbha' }, Mars: { rashiIndex: 2, sanskritName: 'Vrishabha' },
  Mercury: { rashiIndex: 8, sanskritName: 'Vrishchika' }, Jupiter: { rashiIndex: 4, sanskritName: 'Karka' }, Venus: { rashiIndex: 8, sanskritName: 'Vrishchika' }, Saturn: { rashiIndex: 9, sanskritName: 'Dhanu' },
});
function raw(values, targetBody = 'Sun') { return { targetBody, rulesetId: BAV_RULESET_ID, rashis: RASHI_DEFINITIONS.map((rashi, index) => ({ rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, favorableMarkCount: values[index] })) }; }
function trikona(values, targetBody = 'Sun') { return { targetBody, rawBavRulesetId: BAV_RULESET_ID, trikonaShodhanaRulesetId: 'parashari-trikona-shodhana-santhanam-v1', rashis: RASHI_DEFINITIONS.map((rashi, index) => ({ rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, rawFavorableMarkCount: values[index], afterTrikonaFavorableMarkCount: values[index] })) }; }
function changedValues(result) { return result.rashis.map((rashi) => rashi.favorableMarkCount); }
function placementsFor(firstOccupied, secondOccupied, pair = [1, 8]) {
  const result = Object.fromEntries(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map((body) => [body, { rashiIndex: 4 }]));
  if (firstOccupied) result.Sun = { rashiIndex: pair[0] };
  if (secondOccupied) result.Moon = { rashiIndex: pair[1] };
  return result;
}

test('applies every Trikona branch in all four fixed groups without increasing marks', () => {
  const groups = [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]];
  for (const [groupIndex, indexes] of groups.entries()) {
    for (const [branch, values] of Object.entries({ equal: [4, 4, 4], unequal: [5, 3, 4], zeroFirst: [0, 4, 5], zeroSecond: [4, 0, 5], zeroThird: [4, 5, 0], twoZero: [0, 0, 5], allZero: [0, 0, 0] })) {
      const input = Array(12).fill(1); indexes.forEach((index, position) => { input[index] = values[position]; });
      const result = calculateTrikonaShodhana({ rawBav: raw(input) });
      const output = result.rashis.map((rashi) => rashi.afterTrikonaFavorableMarkCount);
      assert.equal(result.operations[groupIndex].decision, branch === 'equal' ? 'positive-equal-set-to-zero' : branch === 'unequal' ? 'minimum-subtracted' : 'zero-member-unchanged');
      if (branch === 'equal') indexes.forEach((index) => assert.equal(output[index], 0));
      if (branch === 'unequal') assert.deepEqual(indexes.map((index) => output[index]), [2, 0, 1]);
      if (!['equal', 'unequal'].includes(branch)) assert.deepEqual(indexes.map((index) => output[index]), values);
      output.forEach((value, index) => assert.ok(Number.isInteger(value) && value >= 0 && value <= input[index]));
    }
  }
});

test('applies all five Ekapadhipatya ownership pairs and all arithmetic branches', () => {
  const scenarios = [
    ['bothOccupied', [4, 6], true, true, [4, 6]], ['bothEmptyEqual', [4, 4], false, false, [0, 0]], ['bothEmptyUnequal', [4, 6], false, false, [4, 4]],
    ['firstOccupiedSmaller', [3, 6], true, false, [3, 3]], ['firstOccupiedEqual', [4, 4], true, false, [4, 0]], ['firstOccupiedGreater', [6, 3], true, false, [6, 0]],
    ['secondOccupiedSmaller', [6, 3], false, true, [3, 3]], ['secondOccupiedEqual', [4, 4], false, true, [0, 4]], ['secondOccupiedGreater', [3, 6], false, true, [0, 6]],
    ['firstZero', [0, 5], false, false, [0, 5]], ['secondZero', [5, 0], false, false, [5, 0]], ['bothZero', [0, 0], false, false, [0, 0]],
  ];
  const pairs = [[1, 8], [3, 6], [9, 12], [2, 7], [10, 11]];
  for (const pair of pairs) for (const [label, pairValues, firstOccupied, secondOccupied, expected] of scenarios) {
    const values = Array(12).fill(1); values[pair[0] - 1] = pairValues[0]; values[pair[1] - 1] = pairValues[1];
    const result = calculateEkapadhipatyaShodhana({ trikonaShodhana: trikona(values), rashiPlacements: placementsFor(firstOccupied, secondOccupied, pair) });
    const output = result.rashis.map((rashi) => rashi.favorableMarkCount);
    assert.deepEqual([output[pair[0] - 1], output[pair[1] - 1]], expected, `${pair}/${label}`);
    output.forEach((value, index) => assert.ok(Number.isInteger(value) && value >= 0 && value <= result.rashis[index].afterTrikonaFavorableMarkCount));
  }
});

test('uses only seven eligible Grahas for explicit Ekapadhipatya occupancy', () => {
  for (const body of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
    const input = placementsFor(false, false); input[body] = { rashiIndex: 1 };
    assert.equal(occupiedRashiIndices(input).has(1), true, body);
  }
  const withLagna = { ...placementsFor(false, false), Ascendant: { rashiIndex: 1 } };
  const withRahu = { ...placementsFor(false, false), Rahu: { rashiIndex: 1 } };
  const withKetu = { ...placementsFor(false, false), Ketu: { rashiIndex: 1 } };
  for (const input of [withLagna, withRahu, withKetu]) assert.equal(occupiedRashiIndices(input).has(1), false);
  const multi = { ...placementsFor(false, false), Sun: { rashiIndex: 1 }, Mars: { rashiIndex: 1 }, Rahu: { rashiIndex: 1 }, Ketu: { rashiIndex: 1 } };
  assert.equal(occupiedRashiIndices(multi).has(1), true);
});

test('runs raw BAV through Trikona then Ekapadhipatya with complete immutable evidence', () => {
  const values = [5, 1, 1, 0, 3, 1, 1, 6, 3, 1, 1, 0];
  const output = calculateShodhitaBhinnashtakavarga({ rawBav: raw(values), rashiPlacements: placementsFor(true, false) });
  assert.equal(output.shodhanaRulesetId, 'parashari-ashtakavarga-shodhana-santhanam-v1');
  assert.equal(output.occupancyPolicyId, EKADHIPATYA_OCCUPANCY_POLICY_ID);
  assert.deepEqual(output.trikonaShodhana.operations[0].afterValues, [2, 0, 0]);
  assert.deepEqual(output.ekadhipatyaShodhana.operations[0].beforeValues, [2, 6]);
  assert.deepEqual(output.ekadhipatyaShodhana.operations[0].afterValues, [2, 4]);
  const incorrectOrder = calculateEkapadhipatyaShodhana({ trikonaShodhana: trikona(values), rashiPlacements: placementsFor(true, false) });
  assert.notDeepEqual(incorrectOrder.operations[0].afterValues, output.ekadhipatyaShodhana.operations[0].afterValues);
  assert.equal(output.rashis[0].rawFavorableMarkCount, 5);
  assert.equal(output.rashis[0].afterTrikonaFavorableMarkCount, 2);
  assert.equal(output.rashis[0].favorableMarkCount, 2);
  for (const value of [output, output.rashis, output.rashis[0], output.trikonaShodhana.operations[0], output.ekadhipatyaShodhana.operations[0], output.ekadhipatyaShodhana.provenance]) assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(changedValues(output), changedValues(calculateShodhitaBhinnashtakavarga({ rawBav: raw(values), rashiPlacements: placementsFor(true, false) })));
});

test('shodhita collection includes Lagna BAV, preserves raw Layer 11A BAV/SAV, and does not produce corrected SAV', () => {
  const source = calculateRawAshtakavarga({ rashiPlacements: placements });
  const before = structuredClone(source);
  const result = calculateShodhitaAshtakavarga({ rawAshtakavarga: source, rashiPlacements: placements });
  assert.equal(result.lagnaBav.targetBody, 'Ascendant');
  assert.equal(result.lagnaBav.trikonaShodhana.operations.length, 4);
  assert.equal(result.lagnaBav.ekadhipatyaShodhana.operations.length, 5);
  assert.equal(result.rawSarvashtakavarga, source.rawSarvashtakavarga);
  assert.equal(result.provenance.rawSavTreatment, 'untouched-not-recomputed-not-corrected');
  assert.equal(Object.hasOwn(result, 'correctedSarvashtakavarga'), false);
  assert.deepEqual(source, before);
  assert.equal(Object.isFrozen(result), true);
});

test('rejects malformed raw evidence, canonical order errors, and malformed required occupancy placements', () => {
  assert.throws(() => calculateTrikonaShodhana({ rawBav: undefined }), /rawBav/);
  const tooFew = raw(Array(12).fill(1)); tooFew.rashis.pop();
  assert.throws(() => calculateTrikonaShodhana({ rawBav: tooFew }), /exactly 12/);
  const tooMany = raw(Array(12).fill(1)); tooMany.rashis.push({ ...tooMany.rashis[11] });
  assert.throws(() => calculateTrikonaShodhana({ rawBav: tooMany }), /exactly 12/);
  const wrongOrder = raw(Array(12).fill(1)); wrongOrder.rashis[0].rashiIndex = 2;
  assert.throws(() => calculateTrikonaShodhana({ rawBav: wrongOrder }), /canonical order/);
  const negative = raw(Array(12).fill(1)); negative.rashis[0].favorableMarkCount = -1;
  assert.throws(() => calculateTrikonaShodhana({ rawBav: negative }), /non-negative integers/);
  const fractional = raw(Array(12).fill(1)); fractional.rashis[0].favorableMarkCount = 1.5;
  assert.throws(() => calculateTrikonaShodhana({ rawBav: fractional }), /non-negative integers/);
  for (const nonFinite of [NaN, Infinity]) { const malformed = raw(Array(12).fill(1)); malformed.rashis[0].favorableMarkCount = nonFinite; assert.throws(() => calculateTrikonaShodhana({ rawBav: malformed }), /non-negative integers/); }
  const invalid = raw(Array(12).fill(1)); invalid.targetBody = 'Rahu';
  assert.throws(() => calculateTrikonaShodhana({ rawBav: invalid }), /Unsupported/);
  const source = calculateTrikonaShodhana({ rawBav: raw(Array(12).fill(1)) });
  assert.throws(() => calculateEkapadhipatyaShodhana({ trikonaShodhana: source, rashiPlacements: { ...placements, Sun: undefined } }), /Sun/);
  assert.throws(() => calculateEkapadhipatyaShodhana({ trikonaShodhana: source, rashiPlacements: { ...placements, Moon: { rashiIndex: 1, sanskritName: 'Karka' } } }), /contradictory/);
});
