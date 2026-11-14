'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerV2CertificationHarness, validateCertificationInput, SCHEMA_VERSION } = require('../../src/development/career-v2-certification-harness');

const START = '2026-01-01T00:00:00.000Z'; const MID = '2026-01-10T00:00:00.000Z'; const END = '2026-01-20T00:00:00.000Z'; const HORIZON_END = '2026-02-01T00:00:00.000Z';
function d1(extra = true) { return { houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashi: { rashiIndex: index + 1 }, rashiHouseLord: index === 9 ? 'Saturn' : 'Sun' })), planetaryAssignments: [{ body: 'Saturn', rashi: { rashiIndex: 10 }, rashiHouseNumber: extra ? 10 : 9 }] }; }
const dasha = (md, ad, pd) => ({ start: START, end: END, activePeriods: [{ level: 'MD', lord: md }, { level: 'AD', lord: ad }, { level: 'PD', lord: pd }] });
const transit = (planet, start = START, end = END) => ({ planet, sign: 10, start, end, boundaryMethod: 'fixture-refined' });
const d10 = { chart: 'D10', themes: [{ theme: 'STRUCTURE' }] };
const birthData = { date: '1990-01-01', time: '12:00:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 };
const event = (eventId, type, datePrecision, year, month, day) => ({ eventId, type, datePrecision, year, ...(month ? { month } : {}), ...(day ? { day } : {}) });
function input() {
  return {
    schemaVersion: SCHEMA_VERSION,
    consent: { ownerSupplied: true, explicitHistoricalValidation: true },
    profiles: [
      { profileId: 'PROFILE_FULL', birthData, evaluationInstants: ['2025-12-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z'], events: [event('EVENT_DAY', 'JOB_JOINED', 'DAY', 2026, 1, 5), event('EVENT_OUTSIDE', 'CAREER_SETBACK', 'DAY', 2026, 1, 25)] },
      { profileId: 'PROFILE_PD_ONLY', birthData, evaluationInstants: [START], events: [event('EVENT_MONTH', 'JOB_CHANGED', 'MONTH', 2026, 1)] },
      { profileId: 'PROFILE_LIMITED', birthData, evaluationInstants: [START], events: [event('EVENT_YEAR', 'PROMOTION', 'YEAR', 2026)] },
      { profileId: 'PROFILE_MD_ONLY', birthData, evaluationInstants: [START], events: [event('EVENT_MD', 'ROLE_CHANGED', 'DAY', 2026, 1, 6)] },
      { profileId: 'PROFILE_AD_ONLY', birthData, evaluationInstants: [START], events: [event('EVENT_AD', 'SALARY_CHANGED', 'DAY', 2026, 1, 7)] },
      { profileId: 'PROFILE_NO_TRANSIT', birthData, evaluationInstants: [START], events: [event('EVENT_NO_TRANSIT', 'BUSINESS_STARTED', 'DAY', 2026, 1, 8)] },
    ],
  };
}
function packet({ extra = true, md = 'Saturn', ad = 'Saturn', pd = 'Saturn', transits = [transit('Jupiter'), transit('Saturn')] } = {}) { return { d1Houses: d1(extra), dashaIntervals: [dasha(md, ad, pd)], transitIntervals: transits, d10Corroboration: d10, forecastStart: START, forecastEnd: HORIZON_END, calculationInstant: START }; }
const evidence = {
  PROFILE_FULL: packet(),
  PROFILE_PD_ONLY: packet({ md: 'Venus', ad: 'Mercury' }),
  PROFILE_LIMITED: packet({ extra: false }),
  PROFILE_MD_ONLY: packet({ ad: 'Venus', transits: [transit('Jupiter')] }),
  PROFILE_AD_ONLY: packet({ md: 'Venus', transits: [transit('Saturn')] }),
  PROFILE_NO_TRANSIT: packet({ transits: [] }),
};

test('strict input accepts anonymized DAY/MONTH/YEAR events and rejects identity, free-text, malformed, or missing-consent input', () => {
  const value = validateCertificationInput(input());
  assert.equal(value.profiles.length, 6);
  assert.deepEqual(value.profiles.slice(0, 3).map((profile) => profile.events[0].datePrecision), ['DAY', 'MONTH', 'YEAR']);
  assert.throws(() => validateCertificationInput({ ...input(), consent: { ownerSupplied: false, explicitHistoricalValidation: true } }), /consent/i);
  const named = input(); named.profiles[0].name = 'Not allowed'; assert.throws(() => validateCertificationInput(named), /prohibited/i);
  const malformed = input(); malformed.profiles[0].events[0].month = 13; assert.throws(() => validateCertificationInput(malformed), /month/i);
  const notes = input(); notes.profiles[0].events[0].notes = 'private'; assert.throws(() => validateCertificationInput(notes), /prohibited/i);
});

test('certification compares legacy/V2, classifies rejection reasons, cohorts, coverage and evaluations', async () => {
  const harness = new CareerV2CertificationHarness({ evidenceProvider: async ({ profileId }) => evidence[profileId] });
  const { result } = await harness.run(input());
  assert.equal(result.mode, 'LOCAL_CERTIFICATION_ONLY');
  assert.deepEqual(result.aggregate.eventCoverage, { total: 7, legacyCovered: 5, v2Covered: 3, retained: 3, lost: 2, gained: 0 });
  const byId = new Map(result.profiles.map((profile) => [profile.profileId, profile]));
  assert.equal(byId.get('PROFILE_PD_ONLY').events[0].rejectionReason, 'PD_ONLY_LEGACY');
  assert.equal(byId.get('PROFILE_LIMITED').events[0].rejectionReason, 'LIMITED_D1');
  assert.equal(byId.get('PROFILE_NO_TRANSIT').events[0].rejectionReason, 'NO_MAJOR_TRANSIT');
  assert.equal(result.aggregate.specialCohorts.mdOnlyEligible, 1);
  assert.equal(result.aggregate.specialCohorts.adOnlyEligible, 1);
  assert.equal(result.aggregate.specialCohorts.jupiterOnly, 1);
  assert.equal(result.aggregate.specialCohorts.saturnOnly, 1);
  assert.equal(result.aggregate.specialCohorts.bothTransits, 1);
  assert.equal(result.aggregate.specialCohorts.pdOnlyLegacy.total, 1);
  assert.equal(result.aggregate.specialCohorts.limitedD1.profiles, 1);
  assert.equal(typeof result.aggregate.v21.windows.coalescedCount, 'number');
  assert.equal(typeof result.aggregate.v21.eventCoverage.covered, 'number');
  assert.equal(typeof result.aggregate.v22.windows.coalescedCount, 'number');
  assert.equal(typeof result.aggregate.v22.eventCoverage.covered, 'number');
  assert.equal(Object.values(result.aggregate.threeWayCoverage).reduce((sum, value) => sum + value, 0), 7);
  assert.equal(result.profiles.every((profile) => profile.v21 && Array.isArray(profile.v21.candidates)), true);
  assert.equal(result.profiles.every((profile) => profile.v22 && Array.isArray(profile.v22.candidates)), true);
  assert.ok(byId.get('PROFILE_FULL').legacy.evaluations[0].next);
  assert.ok(byId.get('PROFILE_FULL').v2.evaluations[1].active);
  assert.equal(byId.get('PROFILE_FULL').events[1].comparison, 'NEITHER');
});

test('results include machine-readable agreement/state/window metrics and an anonymized human report', async () => {
  const { result, markdown } = await new CareerV2CertificationHarness({ evidenceProvider: ({ profileId }) => evidence[profileId] }).run(input());
  assert.equal(result.profiles[0].v2.candidates[0].agreement.units.length, 7);
  assert.equal(result.aggregate.windows.highOverlap >= 1, true);
  assert.equal(result.aggregate.windows.v2AtomicCount >= result.aggregate.windows.v2CoalescedCount, true);
  assert.equal(result.aggregate.stateDistribution.SUPPORTIVE, 1);
  assert.match(markdown, /V2\.1 Shadow Summary/);
  assert.match(markdown, /V2\.2 Shadow Summary/);
  assert.match(markdown, /PROFILE_FULL/);
  assert.doesNotMatch(markdown, /17\.385|78\.4867|1990-01-01|Asia\/Kolkata/);
  assert.doesNotMatch(markdown, /prediction accuracy/i);
  assert.equal(JSON.stringify(result).includes('"birthData":'), false);
});

test('methodology review flags are reports only and do not mutate deterministic candidates', async () => {
  const supplied = input();
  supplied.profiles.find((profile) => profile.profileId === 'PROFILE_PD_ONLY').events.push(event('EVENT_PD_SECOND', 'JOB_LOSS', 'DAY', 2026, 1, 9));
  const before = JSON.stringify(evidence);
  const { result } = await new CareerV2CertificationHarness({ evidenceProvider: ({ profileId }) => evidence[profileId] }).run(supplied);
  assert.ok(result.aggregate.methodologyReviewFlags.includes('REVIEW_PD_ONLY_REMOVAL_WITH_MULTIPLE_OBSERVED_EVENTS'));
  assert.equal(JSON.stringify(evidence), before);
});
