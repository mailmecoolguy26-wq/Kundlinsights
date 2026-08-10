'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BPHS_PINDA_RULESET_ID, DEFAULT_PINDA_RULESET_ID, PHALADEEPIKA_PINDA_RULESET_ID, PINDA_RULESETS, RASHI_DEFINITIONS,
  calculateAshtakavargaPinda, validatePindaRulesets,
} = require('../../src/ashtakavarga');

const grahas = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const placements = Object.freeze({ Sun: { rashiIndex: 1 }, Moon: { rashiIndex: 2 }, Mars: { rashiIndex: 1 }, Mercury: { rashiIndex: 3 }, Jupiter: { rashiIndex: 4 }, Venus: { rashiIndex: 5 }, Saturn: { rashiIndex: 6 } });
function shodhita(values, targetBody = 'Sun') { return { targetBody, shodhanaRulesetId: 'parashari-ashtakavarga-shodhana-santhanam-v1', rashis: RASHI_DEFINITIONS.map((rashi, index) => ({ rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, rawFavorableMarkCount: values[index], afterTrikonaFavorableMarkCount: values[index], afterEkapadhipatyaFavorableMarkCount: values[index], favorableMarkCount: values[index] })) }; }
function calculate(values, options = {}) { return calculateAshtakavargaPinda({ shodhitaBav: shodhita(values, options.targetBody), natalPlacements: options.placements || placements, rulesetId: options.rulesetId }); }

test('locks both immutable versioned tables, their deliberate Kanya difference, and shared Graha table', () => {
  assert.equal(DEFAULT_PINDA_RULESET_ID, BPHS_PINDA_RULESET_ID);
  assert.equal(validatePindaRulesets(), true);
  for (const ruleset of Object.values(PINDA_RULESETS)) {
    assert.equal(Object.isFrozen(ruleset), true);
    assert.equal(Object.isFrozen(ruleset.rashiMultipliers), true);
    assert.equal(Object.isFrozen(ruleset.grahaMultipliers), true);
    assert.equal(ruleset.rashiMultipliers.length, 12);
    assert.deepEqual(Object.keys(ruleset.grahaMultipliers), grahas);
  }
  assert.equal(PINDA_RULESETS[BPHS_PINDA_RULESET_ID].rashiMultipliers[5], 6);
  assert.equal(PINDA_RULESETS[PHALADEEPIKA_PINDA_RULESET_ID].rashiMultipliers[5], 5);
  assert.deepEqual(PINDA_RULESETS[BPHS_PINDA_RULESET_ID].grahaMultipliers, PINDA_RULESETS[PHALADEEPIKA_PINDA_RULESET_ID].grahaMultipliers);
  const malformed = structuredClone(PINDA_RULESETS); malformed[BPHS_PINDA_RULESET_ID].rashiMultipliers[5] = 5;
  assert.throws(() => validatePindaRulesets(malformed), /Kanya/);
  const missingGraha = structuredClone(PINDA_RULESETS); delete missingGraha[BPHS_PINDA_RULESET_ID].grahaMultipliers.Sun;
  assert.throws(() => validatePindaRulesets(missingGraha), /Graha/);
});

test('calculates the audited synthetic fixture with complete individual evidence', () => {
  const result = calculate([2, 1, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.rulesetId, BPHS_PINDA_RULESET_ID);
  assert.equal(result.rashiPinda, 58);
  assert.equal(result.grahaPinda, 53);
  assert.equal(result.totalPinda, 111);
  assert.deepEqual(result.evidence.rashiContributions.map((entry) => entry.contribution), [14, 10, 24, 0, 10, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(result.evidence.grahaContributions.map((entry) => entry.contribution), [10, 5, 16, 15, 0, 7, 0]);
  assert.deepEqual(result.evidence.grahaContributions.map((entry) => entry.graha), grahas);
});

test('maps every one-hot Rashi vector through both Rashi multiplier tables', () => {
  for (const rulesetId of [BPHS_PINDA_RULESET_ID, PHALADEEPIKA_PINDA_RULESET_ID]) for (let index = 0; index < 12; index += 1) {
    const values = Array(12).fill(0); values[index] = 3;
    const result = calculate(values, { rulesetId });
    assert.equal(result.rashiPinda, 3 * PINDA_RULESETS[rulesetId].rashiMultipliers[index], `${rulesetId}/${index + 1}`);
    assert.equal(result.evidence.rashiContributions[index].contribution, result.rashiPinda);
  }
});

test('keeps the versioned Kanya difference confined to Rashi Pinda', () => {
  const values = Array(12).fill(0); values[5] = 4;
  const bphs = calculate(values, { rulesetId: BPHS_PINDA_RULESET_ID });
  const phala = calculate(values, { rulesetId: PHALADEEPIKA_PINDA_RULESET_ID });
  assert.equal(bphs.rashiPinda - phala.rashiPinda, 4);
  assert.equal(bphs.grahaPinda, phala.grahaPinda);
  assert.equal(bphs.totalPinda - phala.totalPinda, 4);
});

test('includes every Graha independently, including target self-participation and shared-Rashi occupants', () => {
  for (const [index, graha] of grahas.entries()) {
    const values = Array(12).fill(0); const sourcePlacements = Object.fromEntries(grahas.map((body, bodyIndex) => [body, { rashiIndex: bodyIndex + 1 }])); values[index] = 2;
    const result = calculate(values, { placements: sourcePlacements, targetBody: graha });
    assert.equal(result.evidence.grahaContributions[index].contribution, 2 * PINDA_RULESETS[BPHS_PINDA_RULESET_ID].grahaMultipliers[graha]);
  }
  const shared = calculate([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { placements: { ...placements, Sun: { rashiIndex: 1 }, Mars: { rashiIndex: 1 }, Mercury: { rashiIndex: 1 } } });
  assert.deepEqual(shared.evidence.grahaContributions.slice(0, 4).map((entry) => entry.contribution), [15, 0, 24, 15]);
  assert.equal(shared.grahaPinda, 54);
});

test('excludes nodes and Ascendant, validates all required contracts, and never accepts non-Shodhita BAV', () => {
  const source = shodhita(Array(12).fill(1));
  const baseline = calculateAshtakavargaPinda({ shodhitaBav: source, natalPlacements: placements });
  const withExtras = calculateAshtakavargaPinda({ shodhitaBav: source, natalPlacements: { ...placements, Ascendant: { rashiIndex: 12 }, Rahu: { rashiIndex: 1 }, Ketu: { rashiIndex: 7 } } });
  assert.deepEqual(withExtras, baseline);
  for (const targetBody of ['Ascendant', 'Rahu', 'Ketu', 'Unknown']) assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: shodhita(Array(12).fill(1), targetBody), natalPlacements: placements }), /Unsupported/);
  assert.throws(() => calculateAshtakavargaPinda({ natalPlacements: placements }), /shodhitaBav/);
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: { ...source, shodhanaRulesetId: undefined }, natalPlacements: placements }), /Layer 11B/);
  const tooFew = structuredClone(source); tooFew.rashis.pop();
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: tooFew, natalPlacements: placements }), /exactly 12/);
  const tooMany = structuredClone(source); tooMany.rashis.push({ ...tooMany.rashis[11] });
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: tooMany, natalPlacements: placements }), /exactly 12/);
  const wrongOrder = structuredClone(source); wrongOrder.rashis[0].rashiIndex = 2;
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: wrongOrder, natalPlacements: placements }), /canonical order/);
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: source, natalPlacements: { ...placements, Sun: undefined } }), /Sun/);
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: source, natalPlacements: { ...placements, Moon: { rashiIndex: 1, sanskritName: 'Karka' } } }), /contradictory/);
  assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: source, natalPlacements: placements, rulesetId: 'unknown' }), /Unsupported/);
  for (const invalidValue of [-1, 1.5, NaN, Infinity]) { const malformed = shodhita(Array(12).fill(1)); malformed.rashis[0].favorableMarkCount = invalidValue; malformed.rashis[0].afterEkapadhipatyaFavorableMarkCount = invalidValue; assert.throws(() => calculateAshtakavargaPinda({ shodhitaBav: malformed, natalPlacements: placements }), /post-Ekapadhipatya/); }
});

test('is deeply immutable, deterministic, provider independent, and preserves all zero contributions', () => {
  const values = Array(12).fill(0); const input = Object.freeze(shodhita(values)); const natalInput = Object.freeze(placements);
  const first = calculateAshtakavargaPinda({ shodhitaBav: input, natalPlacements: natalInput });
  const second = calculateAshtakavargaPinda({ shodhitaBav: input, natalPlacements: natalInput });
  assert.deepEqual(first, second);
  assert.equal(first.rashiPinda, 0); assert.equal(first.grahaPinda, 0); assert.equal(first.totalPinda, 0);
  assert.equal(first.evidence.rashiContributions.length, 12); assert.equal(first.evidence.grahaContributions.length, 7);
  for (const entry of [...first.evidence.rashiContributions, ...first.evidence.grahaContributions]) assert.equal(entry.contribution, 0);
  for (const value of [first, first.evidence, first.evidence.rashiContributions, first.evidence.rashiContributions[0], first.evidence.grahaContributions, first.provenance]) assert.equal(Object.isFrozen(value), true);
  assert.equal(first.provenance.astronomyCalculation, 'not-performed');
  assert.equal(first.provenance.panchangaCalculation, 'not-performed');
  assert.equal(first.provenance.terminology.classicalPrimaryName, 'Yoga Pinda');
});
