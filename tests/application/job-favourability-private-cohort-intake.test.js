'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PRIVATE_COHORT_SCHEMA_ID, normalizeJobFavourabilityPrivateCohort } = require('../../src/application/research/job-favourability-private-cohort-intake');
const { PRIVATE_ARTIFACT_ROOT } = require('../../src/application/research/job-favourability-report');
const { runPrivateCuratedCohort } = require('../../scripts/research/run-job-favourability-private-cohort');

function fixture() {
  return {
    schemaId: PRIVATE_COHORT_SCHEMA_ID,
    cohortSalt: 'private-fixture-salt',
    profiles: [{
      pseudonymousProfileId: 'fictional-profile-a',
      birth: { localDate: '1992-03-14', localTime: '09:45:00', timezone: 'UTC', latitude: 28.6139, longitude: 77.209 },
      events: [
        { eventId: 'first-job', eventFamily: 'FIRST_JOB', observations: [{ observationId: 'first-job-month', type: 'EVENT_DATE', precision: 'MONTH', date: '2014-07', metadata: { source: 'FICTIONAL', curationNote: 'Never a model feature.' } }] },
        { eventId: 'offer', eventFamily: 'OFFER', transitionId: 'switch-2018', transitionFamily: 'JOB_SWITCH', observations: [{ observationId: 'offer-day', type: 'OFFER', precision: 'DAY', date: '2018-03-12', metadata: { source: 'FICTIONAL' } }] },
        { eventId: 'joining', eventFamily: 'JOINING', transitionId: 'switch-2018', transitionFamily: 'JOB_SWITCH', observations: [{ observationId: 'joining-day', type: 'JOINING', precision: 'DAY', date: '2018-04-02', metadata: { source: 'FICTIONAL' } }] },
        { eventId: 'promotion', eventFamily: 'PROMOTION', observations: [{ observationId: 'promotion-year', type: 'PROMOTION', precision: 'YEAR', date: '2020', metadata: { source: 'FICTIONAL' } }] },
      ],
      factualInputs: {},
    }],
  };
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fakeEngine() {
  const body = (longitude) => ({ siderealLongitudeDegrees: longitude });
  return { calculate: () => ({ bodies: { Ascendant: body(330), Sun: body(130), Moon: body(40), Mars: body(70), Mercury: body(100), Jupiter: body(250), Venus: body(130), Saturn: body(160), Rahu: body(190), Ketu: body(220) }, provider: { providerId: 'test-private-engine', nodePolicy: 'MEAN_RAHU_PLUS_180_KETU' }, sidereal: { ayanamshaSystem: 'LAHIRI' }, calculationStatus: 'TEST_ONLY' }) };
}

test('normalizes fictional curated input with explicit OFFER/JOINING linkage and strips notes from canonical events', () => {
  const result = normalizeJobFavourabilityPrivateCohort(fixture()); const profile = result.profiles[0];
  assert.equal(profile.canonicalEvents.length, 3);
  const transition = profile.canonicalEvents.find((event) => event.careerEventId === 'transition:switch-2018');
  assert.equal(transition.eventType, 'JOB_SWITCH'); assert.deepEqual(transition.observations.map((item) => item.type), ['OFFER', 'JOINING']);
  assert.equal(transition.observations.some((item) => Object.hasOwn(item, 'metadata')), false);
  assert.equal(profile.canonicalEvents.find((event) => event.careerEventId === 'first-job').observations[0].date.precision, 'MONTH');
  assert.equal(profile.canonicalEvents.find((event) => event.careerEventId === 'promotion').observations[0].date.precision, 'YEAR');
});

test('rejects missing required birth inputs, impossible dates, fake DAY precision, and unknown families', () => {
  const missingBirth = clone(fixture()); delete missingBirth.profiles[0].birth.localTime;
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(missingBirth), /birth\.localTime/);
  const impossible = clone(fixture()); impossible.profiles[0].events[0].observations[0].precision = 'DAY'; impossible.profiles[0].events[0].observations[0].date = '2014-02-30';
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(impossible), /impossible date/);
  const fakeDay = clone(fixture()); fakeDay.profiles[0].events[0].observations[0].precision = 'DAY'; fakeDay.profiles[0].events[0].observations[0].date = '2014-07';
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(fakeDay), /date\/DAY/);
  const unknown = clone(fixture()); unknown.profiles[0].events[0].eventFamily = 'UNSUPPORTED';
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(unknown), /event\.eventFamily/);
});

test('rejects duplicate observations and inferred or conflicting OFFER/JOINING linkage', () => {
  const duplicate = clone(fixture()); const second = clone(duplicate.profiles[0].events[1].observations[0]); second.observationId = 'duplicate-id'; duplicate.profiles[0].events[1].observations.push(second);
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(duplicate), /duplicate observation/);
  const unlinked = clone(fixture()); delete unlinked.profiles[0].events[1].transitionId; delete unlinked.profiles[0].events[1].transitionFamily;
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(unlinked), /explicit linkage/);
  const conflicting = clone(fixture()); conflicting.profiles[0].events[2].transitionFamily = 'FIRST_JOB';
  assert.throws(() => normalizeJobFavourabilityPrivateCohort(conflicting), /conflicting transitionFamily/);
});

test('keeps an explicitly linked transition and its OFFER/JOINING observations in one unit', () => {
  const input = clone(fixture());
  input.profiles[0].events.push({
    eventId: 'switch-record', eventFamily: 'JOB_SWITCH', transitionId: 'switch-2018',
    observations: [{ observationId: 'switch-record-date', type: 'EVENT_DATE', precision: 'MONTH', date: '2018-04' }],
  });
  const profile = normalizeJobFavourabilityPrivateCohort(input).profiles[0];
  const transitions = profile.canonicalEvents.filter((event) => event.eventType === 'JOB_SWITCH');
  assert.equal(transitions.length, 1);
  assert.deepEqual(transitions[0].observations.map((item) => item.type), ['OFFER', 'EVENT_DATE', 'JOINING']);
});

test('runs the private-only command seam over validated input and writes only ignored artifacts', () => {
  const inputPath = path.join(PRIVATE_ARTIFACT_ROOT, 'TEST-JOB-FAVOURABILITY-CURATED-COHORT.json');
  const artifactName = 'TEST-JOB-FAVOURABILITY-CURATED-COHORT';
  fs.mkdirSync(PRIVATE_ARTIFACT_ROOT, { recursive: true, mode: 0o700 });
  fs.writeFileSync(inputPath, `${JSON.stringify(fixture(), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    const result = runPrivateCuratedCohort({ inputPath, astronomicalEngine: fakeEngine(), artifactName });
    assert.equal(result.report.pipelineLabel, 'CURATED_COHORT_RESEARCH_ONLY');
    assert.equal(result.featureRowCount > 0, true);
    assert.equal(result.cohortSummary.units.filter((unit) => unit.unitKind === 'EMPLOYMENT_TRANSITION').length, 2);
    assert.equal(fs.existsSync(result.paths.jsonPath), true); assert.equal(fs.existsSync(result.paths.featureRowsPath), true);
    assert.equal(fs.readFileSync(result.paths.featureRowsPath, 'utf8').includes('Never a model feature.'), false);
  } finally {
    [inputPath, path.join(PRIVATE_ARTIFACT_ROOT, `${artifactName}.json`), path.join(PRIVATE_ARTIFACT_ROOT, `${artifactName}.md`), path.join(PRIVATE_ARTIFACT_ROOT, `${artifactName}-FEATURE-ROWS.json`), path.join(PRIVATE_ARTIFACT_ROOT, `${artifactName}-COHORT-SUMMARY.json`)].forEach((file) => { if (fs.existsSync(file)) fs.unlinkSync(file); });
  }
});
