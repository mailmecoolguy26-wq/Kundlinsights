'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAREER_TIMING_V2_RULESET_VERSION,
  careerPromise,
  buildCareerTimingV2,
  buildCareerTimingV2Agreement,
  selectCareerTimingV2Candidates,
  compareLegacyCareerTimingWithV2,
} = require('../../src/application/insights');

const START = '2026-01-01T00:00:00.000Z';
const MID = '2026-01-10T00:00:00.000Z';
const END = '2026-01-20T00:00:00.000Z';
const HORIZON_END = '2026-02-01T00:00:00.000Z';

function d1({ additionalConnection = true } = {}) {
  return {
    houses: Array.from({ length: 12 }, (_, index) => ({
      houseNumber: index + 1,
      rashi: { rashiIndex: index + 1 },
      rashiHouseLord: index === 9 ? 'Saturn' : 'Sun',
    })),
    planetaryAssignments: [{ body: 'Saturn', rashi: { rashiIndex: 10 }, rashiHouseNumber: additionalConnection ? 10 : 9 }],
  };
}
function dasha(md = 'Saturn', ad = 'Saturn', pd = 'Saturn', start = START, end = END) {
  return { start, end, activePeriods: [{ level: 'MD', lord: md }, { level: 'AD', lord: ad }, { level: 'PD', lord: pd }] };
}
function transit(planet, sign, start = START, end = END) { return { planet, sign, start, end, boundaryMethod: 'fixture-refined-ingress' }; }
function d10Confirms() { return { chart: 'D10', corroborates: 'CAREER_FOUNDATION', themes: [{ theme: 'STRUCTURE_OPERATIONS' }] }; }
function build({ d1Houses = d1(), dashas = [dasha()], transits = [transit('Jupiter', 10), transit('Saturn', 10)], d10Corroboration = d10Confirms(), referenceInstant = START } = {}) {
  return buildCareerTimingV2({ d1Houses, dashaIntervals: dashas, transitIntervals: transits, d10Corroboration, forecastStart: START, forecastEnd: HORIZON_END, calculationInstant: START, referenceInstant });
}

test('A: fully aligned D1, MD/AD/PD, D10 and dual major transit is SUPPORTIVE', () => {
  const value = build();
  assert.equal(value.rulesetVersion, CAREER_TIMING_V2_RULESET_VERSION);
  assert.equal(value.provenance.mode, 'SHADOW_ONLY');
  assert.equal(value.provenance.authoritative, false);
  assert.equal(value.promise.state, 'MODERATE');
  assert.equal(value.candidates.length, 1);
  const candidate = value.candidates[0];
  assert.equal(candidate.state, 'SUPPORTIVE');
  assert.equal(candidate.dasha.md.state, 'ALIGNED');
  assert.equal(candidate.dasha.ad.state, 'ALIGNED');
  assert.equal(candidate.dasha.pd.refinementState, 'PRIMARY_REFINEMENT');
  assert.equal(candidate.d10.state, 'CONFIRMS');
  assert.equal(candidate.transit.jupiter.state, 'ALIGNED');
  assert.equal(candidate.transit.saturn.state, 'ALIGNED');
  assert.equal(candidate.agreement.alignedCount, 7);
  assert.equal(value.selected.activeCandidateId, candidate.candidateId);
});
test('B: irrelevant PD or missing second major confirmation remains supported with conditions', () => {
  const value = build({ dashas: [dasha('Saturn', 'Saturn', 'Venus')], transits: [transit('Jupiter', 10), transit('Saturn', 5)] });
  assert.equal(value.candidates.length, 1);
  assert.equal(value.candidates[0].state, 'SUPPORTIVE_WITH_CONDITIONS');
  assert.equal(value.candidates[0].dasha.pd.refinementState, 'NOT_RELEVANT');
  assert.equal(value.candidates[0].transit.saturn.state, 'NEUTRAL');
});

test('C: a relevant PD cannot rescue unrelated MD and AD', () => {
  const value = build({ dashas: [dasha('Venus', 'Mercury', 'Saturn')] });
  assert.deepEqual(value.candidates, []);
  assert.equal(value.selected.activeCandidateId, null);
});

test('D: one aligned MD/AD primary period plus relevant PD is conservatively eligible', () => {
  const value = build({ dashas: [dasha('Saturn', 'Venus', 'Saturn')], transits: [transit('Jupiter', 10)] });
  assert.equal(value.candidates.length, 1);
  assert.equal(value.candidates[0].dasha.support, 'MODERATE_MD_AD_SUPPORT');
  assert.equal(value.candidates[0].dasha.pd.refinementState, 'CONFIRMING_REFINEMENT');
  assert.equal(value.candidates[0].state, 'SUPPORTIVE_WITH_CONDITIONS');
});

test('E: MD/AD eligibility without Jupiter or Saturn confirmation creates no bounded candidate', () => {
  assert.deepEqual(build({ transits: [] }).candidates, []);
});

test('F: D10 cannot rescue a limited D1 promise', () => {
  const limited = d1({ additionalConnection: false });
  assert.equal(careerPromise({ d1Houses: limited }).state, 'LIMITED');
  assert.deepEqual(build({ d1Houses: limited }).candidates, []);
});

test('G: Jupiter and Saturn boundaries create separate atomic evidence phases', () => {
  const value = build({ transits: [transit('Jupiter', 10), transit('Saturn', 10, MID, END)] });
  assert.deepEqual(value.candidates.map((item) => [item.start, item.end, item.state]), [
    [START, MID, 'SUPPORTIVE_WITH_CONDITIONS'],
    [MID, END, 'SUPPORTIVE'],
  ]);
});

test('H: adjacent materially equivalent phases coalesce while preserving internal phases', () => {
  const value = build({ transits: [transit('Jupiter', 10, START, MID), transit('Jupiter', 10, MID, END)] });
  assert.equal(value.candidates.length, 1);
  assert.equal(value.candidates[0].start, START);
  assert.equal(value.candidates[0].end, END);
  assert.equal(value.candidates[0].internalPhases.length, 2);
});

test('I: same customer state with materially different transit mechanism is not flattened', () => {
  const value = build({ transits: [transit('Jupiter', 10, START, MID), transit('Jupiter', 2, MID, END)] });
  assert.equal(value.candidates.length, 2);
  assert.equal(value.candidates[0].state, 'SUPPORTIVE_WITH_CONDITIONS');
  assert.equal(value.candidates[1].state, 'SUPPORTIVE_WITH_CONDITIONS');
  assert.notDeepEqual(
    value.candidates[0].transit.jupiter.activations.map((item) => item.activationType),
    value.candidates[1].transit.jupiter.activations.map((item) => item.activationType),
  );
});

test('J/K: central selector returns active or next using the explicit reference instant', () => {
  const value = build({ referenceInstant: '2025-12-20T00:00:00.000Z' });
  assert.equal(value.selected.activeCandidateId, null);
  assert.equal(value.selected.nextCandidateId, value.candidates[0].candidateId);
  const selected = selectCareerTimingV2Candidates({ candidates: value.candidates, referenceInstant: MID });
  assert.equal(selected.activeCandidateId, value.candidates[0].candidateId);
});

test('L: agreement excludes unavailable units from evaluatedCount without changing the seven-unit contract', () => {
  const agreement = buildCareerTimingV2Agreement({
    promiseState: 'MODERATE',
    dasha: { md: { state: 'ALIGNED' }, ad: { state: 'UNAVAILABLE' }, pd: { state: 'UNAVAILABLE', refinementState: 'NOT_RELEVANT' } },
    d10: { state: 'UNAVAILABLE' },
    transit: { jupiter: { state: 'ALIGNED' }, saturn: { state: 'UNAVAILABLE' } },
  });
  assert.equal(agreement.units.length, 7);
  assert.equal(agreement.evaluatedCount, 3);
  assert.equal(agreement.alignedCount, 3);
  assert.equal(agreement.unavailableCount, 4);
});

test('shadow comparison reports overlap and eligibility without changing legacy periods', () => {
  const v2 = build();
  const legacyPeriods = [{ startDate: START, endDate: MID, evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL' }];
  const original = JSON.stringify(legacyPeriods);
  const comparison = compareLegacyCareerTimingWithV2({ legacyPeriods, v2Result: v2, referenceInstant: START });
  assert.equal(comparison.mode, 'SHADOW_ONLY');
  assert.equal(comparison.activeOverlap.overlaps, true);
  assert.equal(comparison.eligibilityDifferences.legacyHasCandidate, true);
  assert.equal(comparison.eligibilityDifferences.v2HasCandidate, true);
  assert.equal(JSON.stringify(legacyPeriods), original);
});
