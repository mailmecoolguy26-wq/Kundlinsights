'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRashiHouses } = require('../../src/bhava/calculate-rashi-houses');
const {
  BACKTEST_RULESET_ID,
  EVENT_RADIUS_DAYS,
  NEAR_MATCH_DAYS,
  WEAK_NEAR_MATCH_DAYS,
  publicObservations,
  deterministicControls,
  runCareerTimingBacktest,
  OWNER_COHORT_SCHEMA_ID,
  normalizePrivateOwnerCohort,
} = require('../../src/application/insights');

const longitudeForSign = (sign) => ((sign - 1) * 30) + 10;
function d1() {
  return calculateRashiHouses({
    // Pisces Lagna makes Sagittarius the D1 H10; its lord Jupiter is placed in H10.
    ascendantCanonicalSiderealLongitude: longitudeForSign(12),
    bodies: { Sun: longitudeForSign(1), Moon: longitudeForSign(2), Mars: longitudeForSign(3), Mercury: longitudeForSign(4), Jupiter: longitudeForSign(9), Venus: longitudeForSign(5), Saturn: longitudeForSign(6), Rahu: longitudeForSign(7), Ketu: longitudeForSign(8) },
  });
}

const date = (year, month, day) => ({ precision: 'DAY', year, month, day });
const transit = (start, end) => ({ planet: 'Jupiter', sign: 9, start, end });
const dasha = { start: '2023-01-01T00:00:00.000Z', end: '2026-01-01T00:00:00.000Z', activePeriods: [{ level: 'MD', lord: 'Jupiter' }] };

function fixtureProfile() {
  return {
    birthProfileId: 'profile-a', d1Houses: d1(), d1CareerRelevant: true, dashaIntervals: [dasha],
    transitIntervals: [
      transit('2024-01-15T00:00:00.000Z', '2024-02-15T00:00:00.000Z'),
      transit('2024-10-15T00:00:00.000Z', '2024-11-15T00:00:00.000Z'),
    ],
    events: [
      { careerEventId: 'transition-1', birthProfileId: 'profile-a', eventType: 'JOB_SWITCH', observations: [{ type: 'OFFER', date: date(2024, 2, 1) }, { type: 'JOINING', date: date(2024, 2, 2) }] },
      { careerEventId: 'transition-2', birthProfileId: 'profile-a', eventType: 'ROLE_CHANGE', observations: [{ type: 'ROLE_CHANGE', date: date(2024, 11, 1) }] },
    ],
  };
}

test('Phase 2H preserves every multi-observation Career event independently', () => {
  const observations = publicObservations(fixtureProfile().events[0]);
  assert.deepEqual(observations.map((item) => [item.observationType, item.eventInstant]), [['OFFER', '2024-02-01T00:00:00.000Z'], ['JOINING', '2024-02-02T00:00:00.000Z']]);
  assert.equal(observations.every((item) => item.birthProfileId === 'profile-a'), true);
});

test('Phase 2H reports exact observation and transition coverage while retaining a deterministic clear control', () => {
  const report = runCareerTimingBacktest({ profiles: [fixtureProfile()] });
  assert.equal(report.rulesetId, BACKTEST_RULESET_ID);
  assert.equal(report.status, 'READY_FOR_REVIEW');
  assert.equal(report.aggregate.historicalObservations, 3);
  assert.equal(report.aggregate.exactMatches, 3);
  assert.equal(report.aggregate.nearMatches, 0);
  assert.equal(report.aggregate.misses, 0);
  assert.equal(report.aggregate.transitions.filter((item) => item.status === 'TRANSITION_MATCHED').length, 2);
  assert.equal(report.aggregate.controlPeriods, 1);
  assert.equal(report.aggregate.controlFalsePositives, 0);
  assert.equal(report.profiles[0].controls[0].match.status, 'CONTROL_CLEAR');
  assert.equal(report.profiles[0].observations.every((item) => item.windows.every((window) => window.historicalRecurrence === null)), true);
  assert.equal(report.profiles[0].granularityAudit.dasha.ANY_MD_AD_PD.exactMatches, 3);
  assert.equal(report.profiles[0].granularityAudit.dasha.AD_OR_PD.candidateWindows, 0);
  assert.equal(report.profiles[0].granularityAudit.dasha.MD_AND_AD.candidateWindows, 0);
  assert.equal(report.profiles[0].granularityAudit.dasha.AD_AND_PD.candidateWindows, 0);
  assert.equal(report.profiles[0].granularityAudit.gochar.H10_SIGN_ONLY.exactMatches, 3);
  assert.equal(report.profiles[0].granularityAudit.classification.BASE_TIMING_WINDOW.controlMatches, 0);
  assert.equal(report.profiles[0].historicalRecurrenceAudit.affectsPrimaryEligibility, false);
  assert.equal(report.configuration.futureProjectionEnabled, false);
});

test('deterministic controls require enough separation from every known observation', () => {
  const values = fixtureProfile().events.flatMap(publicObservations);
  // The helper receives observations, not events, and only admits a midpoint with >=120 days on either side.
  const controls = deterministicControls([values[0], values[2]]);
  assert.equal(controls.length, 1);
  assert.ok(Date.parse(controls[0].eventInstant) - Date.parse(values[0].eventInstant) >= 120 * 24 * 60 * 60 * 1000);
  assert.ok(Date.parse(values[2].eventInstant) - Date.parse(controls[0].eventInstant) >= 120 * 24 * 60 * 60 * 1000);
  assert.deepEqual([EVENT_RADIUS_DAYS, NEAR_MATCH_DAYS, WEAK_NEAR_MATCH_DAYS], [90, 30, 60]);
});

test('missing owned cohort is reported as insufficient rather than fabricated from a profile', () => {
  const report = runCareerTimingBacktest({ profiles: [{ birthProfileId: 'profile-empty', d1Houses: d1(), d1CareerRelevant: true }] });
  assert.equal(report.status, 'INSUFFICIENT_HISTORICAL_DATA');
  assert.equal(report.aggregate.historicalObservations, 0);
  assert.equal(report.aggregate.coverageDensityPercent, null);
  assert.ok(report.limitations.includes('SUPPLIED_OWNED_COHORT_REQUIRED'));
});

test('private owner-cohort input keeps month and approximate observations bounded without inventing a day', () => {
  const cohort = normalizePrivateOwnerCohort({
    schemaId: OWNER_COHORT_SCHEMA_ID,
    profile: { birthProfileId: 'local-owner-profile', birthData: { localDate: '1990-01-01' } },
    transitions: [{ id: 't1', type: 'JOB_CHANGE', observations: [
      { type: 'OFFER', precision: 'MONTH', date: '2018-03' },
      { type: 'JOINING', precision: 'APPROXIMATE', from: '2018-04-01T00:00:00.000Z', to: '2018-04-16T00:00:00.000Z' },
    ] }],
  });
  assert.deepEqual(cohort.transitions[0].observations[0].date, { precision: 'MONTH', year: 2018, month: 3, day: null });
  assert.deepEqual(cohort.transitions[0].observations[1].temporalCoverage, { start: '2018-04-01T00:00:00.000Z', end: '2018-04-16T00:00:00.000Z' });
  assert.throws(() => normalizePrivateOwnerCohort({ schemaId: OWNER_COHORT_SCHEMA_ID, profile: { birthProfileId: 'x', birthData: {} }, transitions: [{ id: 'bad', type: 'JOB_CHANGE', observations: [{ type: 'OFFER', precision: 'MONTH', date: '2018-03-15' }] }] }));
});

test('Phase 2I-B keeps supplied month coverage bounded and reports adjacent timing windows without inventing an event day', () => {
  const profile = fixtureProfile();
  profile.events = [{
    careerEventId: 'month-transition', birthProfileId: 'profile-a', eventType: 'JOB_CHANGE',
    observations: [{ type: 'OFFER', date: { precision: 'MONTH', year: 2024, month: 3, day: null }, temporalCoverage: { start: '2024-03-01T00:00:00.000Z', end: '2024-04-01T00:00:00.000Z' } }],
  }];
  const report = runCareerTimingBacktest({ profiles: [profile] });
  const result = report.profiles[0].observations[0];
  assert.equal(result.match.status, 'MISS');
  assert.deepEqual(result.match.nearestWindowBefore, { start: '2024-01-15T00:00:00.000Z', end: '2024-02-15T00:00:00.000Z' });
  assert.equal(result.match.nearestWindowAfter, null);
  assert.equal(report.profiles[0].granularityAudit.classification.BASE_TIMING_WINDOW.monthOverlaps, 0);
});
