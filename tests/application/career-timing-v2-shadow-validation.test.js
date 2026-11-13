'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCareerTimingPeriods,
  buildCareerTimingV2,
  selectCareerTimingV2Candidates,
} = require('../../src/application/insights');

const START = '2026-01-01T00:00:00.000Z';
const SPLIT = '2026-01-10T00:00:00.000Z';
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

const dasha = (md, ad, pd, start = START, end = END) => ({
  start, end,
  activePeriods: [{ level: 'MD', lord: md }, { level: 'AD', lord: ad }, { level: 'PD', lord: pd }],
});
const transit = (planet, sign = 10, start = START, end = END) => ({ planet, sign, start, end, boundaryMethod: 'fixture-refined-boundary' });
const d10 = { chart: 'D10', corroborates: 'CAREER_FOUNDATION', themes: [{ theme: 'STRUCTURE_OPERATIONS' }] };

function compareFixture({ d1Houses = d1(), dashas, transits, referenceInstant = '2026-01-05T00:00:00.000Z' }) {
  const legacy = buildCareerTimingPeriods({
    d1Houses, dashaIntervals: dashas, transitIntervals: transits,
    horizonStart: START, horizonEnd: HORIZON_END, d10Confirmation: true,
  });
  const v2 = buildCareerTimingV2({
    d1Houses, dashaIntervals: dashas, transitIntervals: transits,
    d10Corroboration: d10, forecastStart: START, forecastEnd: HORIZON_END,
    calculationInstant: START, referenceInstant,
  });
  return { legacy, v2, atomicCount: v2.candidates.reduce((sum, candidate) => sum + candidate.internalPhases.length, 0) };
}

const fixtures = {
  PROFILE_A: () => compareFixture({ dashas: [dasha('Saturn', 'Saturn', 'Saturn')], transits: [transit('Jupiter'), transit('Saturn')] }),
  PROFILE_B: () => compareFixture({ dashas: [dasha('Venus', 'Mercury', 'Saturn')], transits: [transit('Jupiter'), transit('Saturn')] }),
  PROFILE_C: () => compareFixture({ dashas: [dasha('Saturn', 'Venus', 'Saturn')], transits: [transit('Jupiter')] }),
  PROFILE_D: () => compareFixture({ d1Houses: d1({ additionalConnection: false }), dashas: [dasha('Saturn', 'Saturn', 'Saturn')], transits: [transit('Jupiter'), transit('Saturn')] }),
  PROFILE_E: () => compareFixture({ dashas: [dasha('Saturn', 'Saturn', 'Saturn')], transits: [transit('Jupiter', 10, START, SPLIT), transit('Jupiter', 2, SPLIT, END)] }),
};

test('shadow cohort removes PD-only and limited-promise legacy windows without changing eligible cases', () => {
  const values = Object.fromEntries(Object.entries(fixtures).map(([key, build]) => [key, build()]));
  assert.deepEqual(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {
    legacy: value.legacy.periods.length,
    atomic: value.atomicCount,
    coalesced: value.v2.candidates.length,
  }])), {
    PROFILE_A: { legacy: 1, atomic: 1, coalesced: 1 },
    PROFILE_B: { legacy: 1, atomic: 0, coalesced: 0 },
    PROFILE_C: { legacy: 1, atomic: 1, coalesced: 1 },
    PROFILE_D: { legacy: 1, atomic: 0, coalesced: 0 },
    PROFILE_E: { legacy: 1, atomic: 2, coalesced: 2 },
  });
  assert.equal(values.PROFILE_B.legacy.periods[0].technicalDetails.dasha.periods.includes('PD:Saturn'), true);
  assert.equal(values.PROFILE_B.v2.candidates.length, 0);
  assert.equal(values.PROFILE_C.v2.candidates[0].dasha.support, 'MODERATE_MD_AD_SUPPORT');
});

test('agreement remains seven-unit, non-duplicated, and keeps Jupiter and Saturn independent', () => {
  const supportive = fixtures.PROFILE_A().v2.candidates[0];
  assert.deepEqual(supportive.agreement.units.map((unit) => unit.state), Array(7).fill('ALIGNED'));
  assert.deepEqual({
    evaluated: supportive.agreement.evaluatedCount,
    aligned: supportive.agreement.alignedCount,
    conditional: supportive.agreement.conditionalCount,
    contradicted: supportive.agreement.contradictedCount,
    unavailable: supportive.agreement.unavailableCount,
  }, { evaluated: 7, aligned: 7, conditional: 0, contradicted: 0, unavailable: 0 });
  const conditional = fixtures.PROFILE_C().v2.candidates[0];
  assert.equal(conditional.agreement.units.find((unit) => unit.unit === 'JUPITER_TRANSIT_CONFIRMATION').state, 'ALIGNED');
  assert.equal(conditional.agreement.units.find((unit) => unit.unit === 'SATURN_TRANSIT_CONFIRMATION').state, 'UNAVAILABLE');
  assert.equal(conditional.agreement.evaluatedCount, 6);
});

test('DAY, MONTH, and YEAR observations retain bounded coverage and are not inputs to V2 generation', () => {
  const value = fixtures.PROFILE_A().v2;
  const observations = [
    { precision: 'DAY', start: '2026-01-05T00:00:00.000Z', end: '2026-01-06T00:00:00.000Z' },
    { precision: 'MONTH', start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z' },
    { precision: 'YEAR', start: '2026-01-01T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' },
  ];
  const intersects = (event, window) => Date.parse(event.start) < Date.parse(window.end) && Date.parse(window.start) < Date.parse(event.end);
  assert.equal(observations.every((event) => value.candidates.some((candidate) => intersects(event, candidate))), true);
  assert.equal(value.provenance.historicalCalibrationIncluded, false);
});

test('atomic boundaries, repeated occupancy, material changes, and exact PD boundaries remain deterministic', () => {
  const material = fixtures.PROFILE_E().v2;
  assert.equal(material.candidates.length, 2);
  assert.equal(material.candidates[0].end, material.candidates[1].start);
  assert.notDeepEqual(material.candidates[0].transit.jupiter.activations, material.candidates[1].transit.jupiter.activations);

  const repeated = compareFixture({
    dashas: [dasha('Saturn', 'Saturn', 'Saturn')],
    transits: [transit('Jupiter', 10, START, '2026-01-05T00:00:00.000Z'), transit('Jupiter', 10, SPLIT, '2026-01-15T00:00:00.000Z')],
  }).v2;
  assert.deepEqual(repeated.candidates.map((candidate) => [candidate.start, candidate.end]), [[START, '2026-01-05T00:00:00.000Z'], [SPLIT, '2026-01-15T00:00:00.000Z']]);

  const boundary = compareFixture({
    dashas: [dasha('Saturn', 'Saturn', 'Saturn', START, SPLIT), dasha('Saturn', 'Saturn', 'Mars', SPLIT, END)],
    transits: [transit('Jupiter')],
  }).v2;
  assert.equal(boundary.candidates[0].end, SPLIT);
  assert.equal(boundary.candidates[1].start, SPLIT);
  assert.notEqual(boundary.candidates[0].dasha.pd.lord, boundary.candidates[1].dasha.pd.lord);
});

test('current/next uses the explicit request instant rather than a stale reading instant', () => {
  const value = fixtures.PROFILE_A().v2;
  assert.equal(selectCareerTimingV2Candidates({ candidates: value.candidates, referenceInstant: '2025-12-01T00:00:00.000Z' }).nextCandidateId, value.candidates[0].candidateId);
  assert.equal(selectCareerTimingV2Candidates({ candidates: value.candidates, referenceInstant: '2026-01-05T00:00:00.000Z' }).activeCandidateId, value.candidates[0].candidateId);
  assert.deepEqual(selectCareerTimingV2Candidates({ candidates: value.candidates, referenceInstant: '2026-01-25T00:00:00.000Z' }), { activeCandidateId: null, nextCandidateId: null });
});

test('one-primary-period eligibility and single-major-transit confirmation are symmetric', () => {
  const adAligned = compareFixture({ dashas: [dasha('Venus', 'Saturn', 'Saturn')], transits: [transit('Saturn')] }).v2;
  assert.equal(adAligned.candidates.length, 1);
  assert.equal(adAligned.candidates[0].dasha.md.state, 'NOT_RELEVANT');
  assert.equal(adAligned.candidates[0].dasha.ad.state, 'ALIGNED');
  assert.equal(adAligned.candidates[0].state, 'SUPPORTIVE_WITH_CONDITIONS');
  assert.equal(adAligned.candidates[0].transit.saturn.state, 'ALIGNED');
  assert.equal(adAligned.candidates[0].transit.jupiter.state, 'UNAVAILABLE');

  const noMajorTransit = compareFixture({ dashas: [dasha('Saturn', 'Saturn', 'Saturn')], transits: [] }).v2;
  assert.equal(noMajorTransit.candidates.length, 0);
});
