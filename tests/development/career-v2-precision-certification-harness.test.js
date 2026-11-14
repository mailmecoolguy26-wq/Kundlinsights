'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePrecisionCertificationInput, eventInterval, mergeIntervals, subtractIntervals, deterministicControlSamples, CareerV2PrecisionCertificationHarness } = require('../../src/development/career-v2-precision-certification-harness');

const event = (eventId, datePrecision, year, month, day) => ({ eventId, type: 'JOB_CHANGED', datePrecision, year, ...(month ? { month } : {}), ...(day ? { day } : {}) });
const input = (events = []) => ({ schemaVersion: 'career-v2-precision-certification-input-v1', consent: { ownerSupplied: true, explicitHistoricalValidation: true }, profiles: [{ profileId: 'PROFILE_TEST', birthData: { date: '1990-01-01', time: '12:00:00', timezone: 'UTC', latitude: 0, longitude: 0 }, observationPeriod: { start: '2020-01-01', end: '2023-01-01' }, events }] });

test('requires explicit owner-supplied observation bounds and rejects unknown fields', () => {
  const missing = input(); delete missing.profiles[0].observationPeriod;
  assert.throws(() => validatePrecisionCertificationInput(missing), /explicit owner-supplied observationPeriod/);
  const unknown = input(); unknown.profiles[0].unexpected = true;
  assert.throws(() => validatePrecisionCertificationInput(unknown), /unsupported fields/);
});

test('uses canonical DAY, MONTH, and YEAR event match intervals', () => {
  assert.deepEqual(eventInterval(event('EVENT_DAY', 'DAY', 2021, 5, 4)), { start: '2021-05-04T00:00:00.000Z', end: '2021-05-05T00:00:00.000Z' });
  assert.deepEqual(eventInterval(event('EVENT_MONTH', 'MONTH', 2021, 5)), { start: '2021-05-01T00:00:00.000Z', end: '2021-06-01T00:00:00.000Z' });
  assert.deepEqual(eventInterval(event('EVENT_YEAR', 'YEAR', 2021)), { start: '2021-01-01T00:00:00.000Z', end: '2022-01-01T00:00:00.000Z' });
  assert.equal(validatePrecisionCertificationInput(input([event('EVENT_DAY', 'DAY', 2021, 5, 4), event('EVENT_MONTH', 'MONTH', 2022, 3), event('EVENT_YEAR', 'YEAR', 2020)])).profiles[0].events.length, 3);
});

test('merges duplicate/overlapping event intervals and subtracts their union from background', () => {
  const observed = { start: '2021-01-01T00:00:00.000Z', end: '2021-01-10T00:00:00.000Z' };
  const associated = mergeIntervals([{ start: '2021-01-03T00:00:00.000Z', end: '2021-01-06T00:00:00.000Z' }, { start: '2021-01-05T00:00:00.000Z', end: '2021-01-08T00:00:00.000Z' }]);
  assert.deepEqual(associated, [{ start: '2021-01-03T00:00:00.000Z', end: '2021-01-08T00:00:00.000Z' }]);
  assert.deepEqual(subtractIntervals(observed, associated), [{ start: '2021-01-01T00:00:00.000Z', end: '2021-01-03T00:00:00.000Z' }, { start: '2021-01-08T00:00:00.000Z', end: '2021-01-10T00:00:00.000Z' }]);
});

test('control sampling is deterministic, stratified, and remains inside background', () => {
  const observation = { start: '2020-01-01T00:00:00.000Z', end: '2023-01-01T00:00:00.000Z' };
  const background = [{ start: '2020-01-01T00:00:00.000Z', end: '2020-12-31T00:00:00.000Z' }, { start: '2021-01-01T00:00:00.000Z', end: '2021-12-31T00:00:00.000Z' }, { start: '2022-01-01T00:00:00.000Z', end: '2023-01-01T00:00:00.000Z' }];
  const first = deterministicControlSamples(background, observation); const second = deterministicControlSamples(background, observation);
  assert.deepEqual(first, second);
  assert.ok(first.some((sample) => sample.days === 90 && sample.stratum === 'EARLY'));
  assert.ok(first.every((sample) => background.some((value) => Date.parse(value.start) <= Date.parse(sample.start) && Date.parse(value.end) >= Date.parse(sample.end))));
});

test('validation and a failed evidence run do not mutate supplied input or methodology', async () => {
  const value = input([event('EVENT_DAY', 'DAY', 2021, 5, 4)]); const snapshot = JSON.stringify(value);
  validatePrecisionCertificationInput(value); assert.equal(JSON.stringify(value), snapshot);
  const harness = new CareerV2PrecisionCertificationHarness({ evidenceProvider: async () => ({}) });
  await assert.rejects(() => harness.run(value)); assert.equal(JSON.stringify(value), snapshot);
});

test('full comparison calculates candidate time, background counts, and four unchanged rulesets', async () => {
  const value = input([event('EVENT_DAY', 'DAY', 2021, 5, 4)]);
  const houses = {
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
  const evidenceProvider = async () => ({
    d1Houses: houses,
    dashaIntervals: [{ start: '2020-01-01T00:00:00.000Z', end: '2023-01-01T00:00:00.000Z', activePeriods: [{ level: 'MD', lord: 'Saturn' }, { level: 'AD', lord: 'Moon' }, { level: 'PD', lord: 'Saturn' }] }],
    transitIntervals: [
      { planet: 'Jupiter', sign: 10, start: '2020-01-01T00:00:00.000Z', end: '2023-01-01T00:00:00.000Z' },
      { planet: 'Saturn', sign: 10, start: '2020-01-01T00:00:00.000Z', end: '2023-01-01T00:00:00.000Z' },
    ],
    d10Corroboration: { chart: 'D10', themes: [{ theme: 'STRUCTURE' }] },
  });
  const { result, markdown } = await new CareerV2PrecisionCertificationHarness({ evidenceProvider }).run(value);
  assert.deepEqual(Object.keys(result.aggregate.rulesets), ['legacy', 'v2', 'v21', 'v22']);
  assert.equal(result.aggregate.v23.eligibilityMatchesV22, true);
  assert.equal(result.aggregate.v23.parentWindows, result.aggregate.rulesets.v22.coalescedWindows);
  assert.ok(result.aggregate.v23.childWindows >= result.aggregate.v23.parentWindows);
  assert.deepEqual(Object.keys(result.aggregate.v23.tiers), ['PEAK', 'STRONG', 'MODERATE', 'BASE']);
  assert.equal(Object.values(result.aggregate.v23.eventDistribution).reduce((sum, count) => sum + count, 0), 1);
  assert.equal(result.aggregate.v23.eventDistribution.NO_V22_ELIGIBILITY, 1 - result.aggregate.rulesets.v22.eventsCovered);
  assert.ok(result.aggregate.v23.tiers.PEAK.backgroundObservationPercent >= 0);
  assert.ok(result.aggregate.rulesets.v2.candidateDays > 0);
  assert.ok(result.aggregate.rulesets.v2.backgroundCandidateDays >= 0);
  assert.ok(result.aggregate.rulesets.v2.timeInWindowPercent >= 0);
  assert.match(markdown, /Background means no recorded Career event/);
  assert.match(markdown, /V2\.3 shadow refinements/);
  assert.equal(result.safeguards.methodologyMutation, false);
  assert.equal(Object.hasOwn(result.profiles[0], 'birthData'), false);
});
