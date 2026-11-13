'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAREER_TIMING_V2_RULESET_VERSION,
  CAREER_TIMING_V2_1_RULESET_VERSION,
  buildCareerTimingV2,
  buildCareerTimingV21,
  dashaConvergence,
  buildCareerTimingV21Agreement,
} = require('../../src/application/insights');

const START = '2026-01-01T00:00:00.000Z';
const MID = '2026-01-10T00:00:00.000Z';
const END = '2026-01-20T00:00:00.000Z';
const HORIZON_END = '2026-02-01T00:00:00.000Z';

function d1() {
  return {
    houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashi: { rashiIndex: index + 1 }, rashiHouseLord: index === 9 ? 'Saturn' : 'Sun' })),
    planetaryAssignments: [
      { body: 'Saturn', rashi: { rashiIndex: 10 }, rashiHouseNumber: 10 },
      { body: 'Mars', rashi: { rashiIndex: 7 }, rashiHouseNumber: 7 },
    ],
  };
}
function dasha(md = 'Saturn', ad = 'Saturn', pd = 'Saturn', start = START, end = END) { return { start, end, activePeriods: [{ level: 'MD', lord: md }, { level: 'AD', lord: ad }, { level: 'PD', lord: pd }] }; }
function transit(planet, sign = 10, start = START, end = END) { return { planet, sign, start, end, boundaryMethod: 'fixture-refined' }; }
function build({ dashas = [dasha()], transits = [transit('Jupiter'), transit('Saturn')], history = undefined } = {}) {
  return buildCareerTimingV21({ d1Houses: d1(), dashaIntervals: dashas, transitIntervals: transits, d10Corroboration: { chart: 'D10', themes: [{ theme: 'STRUCTURE' }] }, forecastStart: START, forecastEnd: HORIZON_END, calculationInstant: START, referenceInstant: START, historicalEvents: history });
}
function hierarchy(md, ad, pd = 'Saturn') {
  const promise = build().promise;
  return dashaConvergence({ promise, activePeriods: [{ level: 'MD', lord: md }, { level: 'AD', lord: ad }, { level: 'PD', lord: pd }] });
}

test('A-C: direct/direct is strong and direct/connected is symmetric partial eligibility', () => {
  assert.equal(hierarchy('Saturn', 'Saturn').convergence, 'STRONG_CONVERGENCE');
  assert.equal(hierarchy('Saturn', 'Mars').convergence, 'PARTIAL_CONVERGENCE');
  assert.equal(hierarchy('Mars', 'Saturn').convergence, 'PARTIAL_CONVERGENCE');
  assert.equal(hierarchy('Saturn', 'Mars').primaryEligible, true);
  assert.equal(hierarchy('Mars', 'Saturn').primaryEligible, true);
});

test('D-F: direct/unrelated and unrelated/unrelated are internal-only and PD cannot rescue them', () => {
  for (const row of [dasha('Saturn', 'Venus', 'Saturn'), dasha('Venus', 'Saturn', 'Saturn'), dasha('Venus', 'Mercury', 'Saturn')]) {
    const value = build({ dashas: [row] });
    assert.equal(value.candidates.length, 0);
    assert.equal(value.backgroundActivations.length > 0, row.activePeriods.filter((item) => ['MD', 'AD'].includes(item.level)).some((item) => ['Saturn', 'Mars'].includes(item.lord)));
  }
});

test('G-H: eligible hierarchy uses PD only as refinement and remains valid with unrelated PD', () => {
  const aligned = build({ dashas: [dasha('Saturn', 'Saturn', 'Saturn')] }).candidates[0];
  const unrelated = build({ dashas: [dasha('Saturn', 'Saturn', 'Venus')] }).candidates[0];
  assert.equal(aligned.dasha.pd.refinementState, 'PRIMARY_REFINEMENT');
  assert.equal(unrelated.dasha.pd.refinementState, 'NOT_RELEVANT');
  assert.ok(unrelated);
});

test('I-L: dual confirmation is strongest, either single is conditional, and none creates no candidate', () => {
  const dual = build().candidates[0];
  const jupiter = build({ transits: [transit('Jupiter')] }).candidates[0];
  const saturn = build({ transits: [transit('Saturn')] }).candidates[0];
  assert.equal(dual.transitConfirmation, 'DUAL_CONFIRMATION');
  assert.equal(dual.state, 'SUPPORTIVE');
  assert.equal(jupiter.transitConfirmation, 'SINGLE_CONFIRMATION');
  assert.equal(jupiter.state, 'SUPPORTIVE_WITH_CONDITIONS');
  assert.equal(saturn.transitConfirmation, 'SINGLE_CONFIRMATION');
  assert.equal(saturn.state, 'SUPPORTIVE_WITH_CONDITIONS');
  assert.deepEqual(build({ transits: [] }).candidates, []);
});

test('M: D10 confirmation cannot rescue failed MD/AD convergence', () => {
  assert.deepEqual(build({ dashas: [dasha('Saturn', 'Venus', 'Saturn')] }).candidates, []);
});

test('N-O: PD-only phase changes coalesce but material convergence changes remain separate', () => {
  const pdChange = build({ dashas: [dasha('Saturn', 'Saturn', 'Saturn', START, MID), dasha('Saturn', 'Saturn', 'Venus', MID, END)] });
  assert.equal(pdChange.candidates.length, 1);
  assert.equal(pdChange.candidates[0].internalPhases.length, 2);
  const convergenceChange = build({ dashas: [dasha('Saturn', 'Saturn', 'Saturn', START, MID), dasha('Saturn', 'Mars', 'Saturn', MID, END)] });
  assert.equal(convergenceChange.candidates.length, 2);
  assert.notEqual(convergenceChange.candidates[0].dasha.convergence, convergenceChange.candidates[1].dasha.convergence);
});

test('P: SINGLE to DUAL transit confirmation preserves separate customer phases', () => {
  const value = build({ transits: [transit('Jupiter'), transit('Saturn', 10, MID, END)] });
  assert.deepEqual(value.candidates.map((item) => item.transitConfirmation), ['SINGLE_CONFIRMATION', 'DUAL_CONFIRMATION']);
});

test('Q: agreement stays seven-unit and excludes unavailable evidence from denominator', () => {
  const agreement = buildCareerTimingV21Agreement({ promiseState: 'MODERATE', dasha: { md: { relationship: 'DIRECTLY_ALIGNED' }, ad: { relationship: 'CONNECTED' }, pd: { relationship: 'UNAVAILABLE', refinementState: 'NOT_RELEVANT' } }, d10: { state: 'UNAVAILABLE' }, transit: { jupiter: { state: 'ALIGNED' }, saturn: { state: 'UNAVAILABLE' } } });
  assert.equal(agreement.units.length, 7);
  assert.equal(agreement.evaluatedCount, 4);
  assert.equal(agreement.unavailableCount, 3);
});

test('R: historical event input cannot change V2.1 candidates', () => {
  const without = build();
  const withHistory = build({ history: [{ type: 'JOB_JOINED', year: 2025 }] });
  assert.deepEqual(withHistory.candidates, without.candidates);
  assert.equal(withHistory.provenance.historicalCalibrationIncluded, false);
});

test('S: V2 Phase 1 remains unchanged and V2.1 has an independent shadow ruleset', () => {
  const input = { d1Houses: d1(), dashaIntervals: [dasha('Saturn', 'Venus', 'Saturn')], transitIntervals: [transit('Jupiter')], forecastStart: START, forecastEnd: HORIZON_END, calculationInstant: START, referenceInstant: START };
  const v2 = buildCareerTimingV2(input);
  const v21 = buildCareerTimingV21(input);
  assert.equal(v2.rulesetVersion, CAREER_TIMING_V2_RULESET_VERSION);
  assert.equal(v2.candidates.length, 1);
  assert.equal(v21.rulesetVersion, CAREER_TIMING_V2_1_RULESET_VERSION);
  assert.equal(v21.candidates.length, 0);
  assert.equal(v21.provenance.productionIntegrated, false);
});
