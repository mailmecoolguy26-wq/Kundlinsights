'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRashiHouses } = require('../../src/bhava/calculate-rashi-houses');
const {
  MAJOR_WINDOW_PLANETS,
  REVIEW_ONLY_MAJOR_CONTEXT,
  SHORT_TRIGGER_PLANETS,
  FAST_CONTEXT_PLANETS,
  resolveCareerNatalFactors,
  evaluateCareerDashaActivation,
  evaluateCareerGocharActivations,
  evaluateCareerTimingWindow,
  scanCareerTimingWindows,
  buildCareerTemporalProjectionPlan,
} = require('../../src/application/insights');

const longitudeForSign = (sign) => ((sign - 1) * 30) + 10;
const lordByRashi = { 1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon', 5: 'Sun', 6: 'Mercury', 7: 'Venus', 8: 'Mars', 9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter' };

function chartWithTenthSign(tenthSign, { moonSign = 1, tenthLordSign = tenthSign } = {}) {
  // H10 is nine signs after H1 in the canonical rashi-house system.
  const ascendantSign = ((tenthSign - 10 + 12) % 12) + 1;
  const lord = lordByRashi[tenthSign];
  const signs = { Sun: 1, Moon: moonSign, Mars: 2, Mercury: 3, Jupiter: 4, Venus: 5, Saturn: 6, Rahu: 7, Ketu: 8, [lord]: tenthLordSign };
  return calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: longitudeForSign(ascendantSign),
    bodies: Object.fromEntries(Object.entries(signs).map(([body, sign]) => [body, longitudeForSign(sign)])),
  });
}

const periodFor = (lord) => [{ level: 'AD', lord }];
const interval = (planet, sign, start = '2026-01-01T00:00:00.000Z', end = '2026-02-01T00:00:00.000Z') => ({ planet, sign, start, end });

test('Phase 2G resolves H10 ownership dynamically from canonical D1 houses', () => {
  const fixtures = [
    ['Sagittarius', 9, 'Jupiter'],
    ['Gemini', 3, 'Mercury'],
    ['Aries', 1, 'Mars'],
    ['Capricorn', 10, 'Saturn'],
  ];
  for (const [, sign, lord] of fixtures) {
    const d1Houses = chartWithTenthSign(sign);
    const factors = resolveCareerNatalFactors({ d1Houses });
    assert.equal(factors.tenthHouseSign, sign);
    assert.equal(factors.tenthLord, lord);
    assert.ok(factors.relevantPlanets.some((item) => item.planet === lord && item.relevanceReasons.includes('D1_H10_LORD')));
  }
  assert.deepEqual(MAJOR_WINDOW_PLANETS, ['Jupiter', 'Saturn']);
  assert.deepEqual(REVIEW_ONLY_MAJOR_CONTEXT, ['Rahu', 'Ketu']);
  assert.deepEqual(SHORT_TRIGGER_PLANETS, ['Sun', 'Mars', 'Mercury', 'Venus']);
  assert.deepEqual(FAST_CONTEXT_PLANETS, ['Moon']);
});

test('Career Dasha activation is chart-specific and does not make a planet universally Career-active', () => {
  const d1Houses = chartWithTenthSign(3);
  const factors = resolveCareerNatalFactors({ d1Houses });
  assert.equal(evaluateCareerDashaActivation({ careerNatalFactors: factors, d1CareerRelevant: true, activePeriods: periodFor('Mercury') }).active, true);
  assert.equal(evaluateCareerDashaActivation({ careerNatalFactors: factors, d1CareerRelevant: true, activePeriods: periodFor('Jupiter') }).active, false);
  assert.equal(evaluateCareerDashaActivation({ careerNatalFactors: factors, d1CareerRelevant: false, activePeriods: periodFor('Mercury') }).active, false);
});

test('major transit activation uses dynamic Career targets and records transit planet separately from natal owner', () => {
  const d1Houses = chartWithTenthSign(3, { tenthLordSign: 6 });
  const factors = resolveCareerNatalFactors({ d1Houses });
  const dasha = evaluateCareerDashaActivation({ careerNatalFactors: factors, d1CareerRelevant: true, activePeriods: periodFor('Mercury') });
  const activations = evaluateCareerGocharActivations({
    careerNatalFactors: factors, d1Houses, careerDashaActivation: dasha, d1CareerRelevant: true,
    transitIntervals: [interval('Saturn', 6)],
  });
  assert.ok(activations.some((item) => item.transitPlanet === 'Saturn' && item.targetType === 'D1_H10_LORD' && item.targetPlanet === 'Mercury' && item.activationType === 'SIGN_OCCUPANCY'));
  assert.ok(activations.every((item) => item.transitPlanet === 'Saturn'));
});

test('the owner-approved gates require D1 relevance, Career Dasha, and a major Gochar target activation', () => {
  const d1Houses = chartWithTenthSign(9, { moonSign: 6, tenthLordSign: 9 });
  const factors = resolveCareerNatalFactors({ d1Houses });
  const base = { careerNatalFactors: factors, d1Houses, activePeriods: periodFor('Jupiter'), transitIntervals: [interval('Jupiter', 9)] };
  assert.equal(evaluateCareerTimingWindow({ ...base, d1CareerRelevant: false }).careerTimingEligible, false);
  assert.equal(evaluateCareerTimingWindow({ ...base, d1CareerRelevant: true, activePeriods: periodFor('Venus') }).careerTimingEligible, false);
  assert.equal(evaluateCareerTimingWindow({ ...base, d1CareerRelevant: true, transitIntervals: [interval('Rahu', 9)] }).careerTimingEligible, false);
  const d10Only = evaluateCareerTimingWindow({ ...base, d1CareerRelevant: false, d10Confirmation: true, ashtakavargaSupport: { sav: 99 }, historicalRecurrence: { match: true } });
  assert.equal(d10Only.careerTimingEligible, false);
  assert.equal(d10Only.classification, 'NO_V1_TIMING_WINDOW');
  const eligible = evaluateCareerTimingWindow({ ...base, d1CareerRelevant: true });
  assert.equal(eligible.careerTimingEligible, true);
  assert.equal(eligible.classification, 'BASE_TIMING_WINDOW');
  assert.equal(eligible.multiTargetActivation, true);
});

test('overlapping Jupiter and Saturn target activations create convergence; Moon/D10/SAV/history only reinforce valid windows', () => {
  const d1Houses = chartWithTenthSign(9, { moonSign: 1, tenthLordSign: 9 });
  const factors = resolveCareerNatalFactors({ d1Houses });
  const value = evaluateCareerTimingWindow({
    careerNatalFactors: factors, d1Houses, d1CareerRelevant: true, activePeriods: periodFor('Jupiter'),
    // Jupiter occupies H10. Saturn at Aries casts its 9th full aspect to Sagittarius/H10.
    transitIntervals: [interval('Jupiter', 9), interval('Saturn', 1), interval('Saturn', 3)],
    d10Confirmation: true, ashtakavargaSupport: { factual: true }, historicalRecurrence: { structuralMatch: true },
  });
  assert.equal(value.careerTimingEligible, true);
  assert.equal(value.majorDualActivation, true);
  assert.equal(value.classification, 'STRONG_CONVERGENCE_WINDOW');
  assert.equal(value.moonSupport.jupiterSupportive, true);
  assert.equal(value.moonSupport.saturnSupportive, true);
  assert.equal(value.d10Confirmation, true);
  assert.ok(value.limitations.includes('FUTURE_PROJECTION_DISABLED'));
  assert.equal(Object.isFrozen(value), true);
});

test('synthetic historical observation/control fixtures are deterministic and do not silently tune eligibility', () => {
  const d1Houses = chartWithTenthSign(1, { tenthLordSign: 1 });
  const factors = resolveCareerNatalFactors({ d1Houses });
  const supportedObservation = evaluateCareerTimingWindow({ careerNatalFactors: factors, d1Houses, d1CareerRelevant: true, activePeriods: periodFor('Mars'), transitIntervals: [interval('Jupiter', 1)] });
  const controlDate = evaluateCareerTimingWindow({ careerNatalFactors: factors, d1Houses, d1CareerRelevant: true, activePeriods: periodFor('Mars'), transitIntervals: [interval('Moon', 1)] });
  assert.equal(supportedObservation.careerTimingEligible, true);
  assert.equal(controlDate.careerTimingEligible, false);
  assert.equal(controlDate.classification, 'NO_V1_TIMING_WINDOW');
});

test('the internal 24-month scanner intersects supplied Dasha and major Gochar intervals without enabling projection', () => {
  const d1Houses = chartWithTenthSign(10, { tenthLordSign: 10 });
  const factors = resolveCareerNatalFactors({ d1Houses });
  const scan = scanCareerTimingWindows({
    careerNatalFactors: factors, d1Houses, d1CareerRelevant: true,
    horizonStart: '2026-01-01T00:00:00.000Z', horizonEnd: '2028-01-01T00:00:00.000Z',
    dashaIntervals: [{ start: '2026-03-01T00:00:00.000Z', end: '2026-06-01T00:00:00.000Z', activePeriods: periodFor('Saturn') }],
    transitIntervals: [
      interval('Jupiter', 10, '2026-04-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z'),
      interval('Jupiter', 10, '2026-05-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
    ],
  });
  assert.deepEqual(scan.windows.map((item) => [item.start, item.end, item.classification]), [['2026-04-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z', 'BASE_TIMING_WINDOW']]);
  assert.equal(scan.integrationGate.enabled, false);
  assert.ok(scan.limitations.includes('FUTURE_PROJECTION_DISABLED'));
});

test('Phase 2G does not enable the existing future-projection integration gate', () => {
  const plan = buildCareerTemporalProjectionPlan({
    domainGraph: { domain: 'CAREER', derivedRelations: [] },
    horizonStart: '2026-01-01T00:00:00.000Z', horizonEnd: '2028-01-01T00:00:00.000Z',
  });
  assert.equal(plan.integrationGate.enabled, false);
});
