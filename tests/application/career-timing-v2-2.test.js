'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CAREER_TIMING_V2_RULESET_VERSION,
  CAREER_TIMING_V2_1_RULESET_VERSION,
  CAREER_TIMING_V2_2_RULESET_VERSION,
  buildCareerTimingV2,
  buildCareerTimingV21,
  buildCareerTimingV22,
} = require('../../src/application/insights');

const START = '2026-01-01T00:00:00.000Z';
const END = '2026-01-20T00:00:00.000Z';
const HORIZON_END = '2026-02-01T00:00:00.000Z';

function d1() {
  return {
    houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashi: { rashiIndex: index + 1 }, rashiHouseLord: index === 9 ? 'Saturn' : 'Sun' })),
    planetaryAssignments: [
      { body: 'Saturn', rashi: { rashiIndex: 8 }, rashiHouseNumber: 8 },
      { body: 'Moon', rashi: { rashiIndex: 10 }, rashiHouseNumber: 10 },
      { body: 'Mars', rashi: { rashiIndex: 7 }, rashiHouseNumber: 7 },
      { body: 'Venus', rashi: { rashiIndex: 8 }, rashiHouseNumber: 8 },
      { body: 'Jupiter', rashi: { rashiIndex: 12 }, rashiHouseNumber: 12 },
      { body: 'Sun', rashi: { rashiIndex: 2 }, rashiHouseNumber: 2 },
    ],
  };
}

function dasha(md, ad, pd = 'Saturn') { return { start: START, end: END, activePeriods: [{ level: 'MD', lord: md }, { level: 'AD', lord: ad }, { level: 'PD', lord: pd }] }; }
function transit(planet) { return { planet, sign: 10, start: START, end: END, boundaryMethod: 'fixture-refined' }; }
function input(md, ad, pd = 'Saturn') { return { d1Houses: d1(), dashaIntervals: [dasha(md, ad, pd)], transitIntervals: [transit('Jupiter'), transit('Saturn')], d10Corroboration: { chart: 'D10', themes: [{ theme: 'STRUCTURE' }] }, forecastStart: START, forecastEnd: HORIZON_END, calculationInstant: START, referenceInstant: START }; }
function v22(md, ad, pd) { return buildCareerTimingV22(input(md, ad, pd)); }

test('A-C: H10 lord, occupant, and approved full aspect to H10 are directly aligned', () => {
  assert.equal(v22('Saturn', 'Saturn').candidates[0].dasha.md.relationship, 'DIRECTLY_ALIGNED');
  assert.equal(v22('Moon', 'Saturn').candidates[0].dasha.md.relationship, 'DIRECTLY_ALIGNED');
  assert.equal(v22('Saturn', 'Mars').candidates[0].dasha.ad.relationship, 'DIRECTLY_ALIGNED');
});

test('D-E: H10-lord conjunction and full aspect remain connected', () => {
  const conjunction = v22('Venus', 'Saturn').candidates[0];
  const lordAspect = v22('Jupiter', 'Saturn').candidates[0];
  assert.equal(conjunction.dasha.md.relationship, 'CONNECTED');
  assert.equal(lordAspect.dasha.md.relationship, 'CONNECTED');
});

test('F-G: H2/H11 context and lordship alone do not create direct or connected relationships', () => {
  const value = v22('Saturn', 'Mercury');
  assert.equal(value.candidates.length, 0);
  assert.equal(value.backgroundActivations[0].dasha.ad.relationship, 'UNRELATED');
});

test('H-I: direct H10 aspect forms strong or partial convergence with an eligible counterpart', () => {
  assert.equal(v22('Mars', 'Saturn').candidates[0].dasha.convergence, 'STRONG_CONVERGENCE');
  assert.equal(v22('Mars', 'Venus').candidates[0].dasha.convergence, 'PARTIAL_CONVERGENCE');
});

test('J-M: unrelated counterpart, connected/connected, PD, and D10 cannot rescue convergence', () => {
  assert.equal(v22('Mars', 'Mercury').candidates.length, 0);
  assert.equal(v22('Venus', 'Jupiter').candidates.length, 0);
  assert.equal(v22('Mercury', 'Jupiter', 'Mars').candidates.length, 0);
  assert.equal(v22('Mercury', 'Jupiter', 'Saturn').candidates.length, 0);
});

test('N-O: V2 and V2.1 remain reproducible while V2.2 is an independent shadow ruleset', () => {
  const fixture = input('Mars', 'Mars');
  const oldV2 = buildCareerTimingV2(fixture);
  const oldV21 = buildCareerTimingV21(fixture);
  const next = buildCareerTimingV22(fixture);
  assert.equal(oldV2.rulesetVersion, CAREER_TIMING_V2_RULESET_VERSION);
  assert.equal(oldV21.rulesetVersion, CAREER_TIMING_V2_1_RULESET_VERSION);
  assert.equal(oldV21.candidates.length, 0);
  assert.equal(next.rulesetVersion, CAREER_TIMING_V2_2_RULESET_VERSION);
  assert.equal(next.candidates[0].dasha.convergence, 'STRONG_CONVERGENCE');
  assert.equal(next.provenance.productionIntegrated, false);
});
