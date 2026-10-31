'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PropertyCalibrationAdapter, PROPERTY_CALIBRATION_ADAPTER_VERSION } = require('../../src/application/property');
const { retrospectiveSampleInstants, propertyCalibrationCandidates } = require('../../src/application/property');
const { LifeEventCalibrationCoordinator } = require('../../src/application/life-event-calibration');

const interval = (from, to) => ({ from, to, timezone: 'UTC' });
const event = (id, eventType = 'PROPERTY_PURCHASE', precision = 'DAY') => ({ lifeEventId: id, category: 'PROPERTY', eventType, eventDate: precision === 'DAY' ? { precision, year: 2020, month: 2, day: 2 } : precision === 'MONTH' ? { precision, year: 2020, month: 2 } : { precision, year: 2020 } });
const evidence = (precision) => ({ foundation: { classification: 'STRONG', coreConnectionCount: 1, acquisitionConnectionCount: 1 }, d4: { confirmation: 'CONFIRMS' }, dasha: [{ classification: 'STRONG', active: true, md: 'moon', ad: 'mars', pd: 'venus' }], transit: [{ active: true, majorPlanets: ['Jupiter'], supportPlanets: [] }], ashtakavarga: { policy: 'CONTEXT_ONLY_NO_THRESHOLDS' }, intervalSummary: { policy: precision === 'DAY' ? 'EXACT_DAY' : precision === 'MONTH' ? 'INTERVAL_START_MIDPOINT_END_MINUS_ONE' : 'BROAD_INTERVAL_START_MIDPOINT_END_MINUS_ONE', sampleInstants: [] } });
function fixture() {
  const calls = [];
  const adapter = new PropertyCalibrationAdapter({
    birthProfileService: { get: async () => ({ birthData: { timezone: 'Asia/Kolkata' } }) },
    astronomicalEngine: { calculate: () => ({}) },
    canonicalSiderealSunSampler: () => 0,
    retrospectiveEvidenceExtractor: async (input) => { calls.push(input); return evidence(input.datePrecision); },
  });
  return { adapter, calls };
}

test('keeps Property purchase and sale in separate canonical cohorts', async () => {
  const { adapter } = fixture();
  assert.equal(adapter.domainCalibrationVersion, PROPERTY_CALIBRATION_ADAPTER_VERSION);
  assert.equal(adapter.supports(event('purchase')), true);
  assert.equal(adapter.cohortFor(event('purchase')), 'PROPERTY_PURCHASE');
  assert.equal(adapter.cohortFor(event('sale', 'PROPERTY_SALE')), 'PROPERTY_SALE');
  assert.equal(adapter.supports({ ...event('bad'), eventType: 'OTHER' }), false);
  assert.equal(await adapter.resolveTimezone({ principal: {}, birthProfileId: 'profile-a' }), 'Asia/Kolkata');
});

test('passes exact DAY and interval-aware MONTH/YEAR data to the existing Property retrospective extractor', async () => {
  const { adapter, calls } = fixture();
  const events = [
    { event: event('day', 'PROPERTY_PURCHASE', 'DAY'), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'PROPERTY_PURCHASE' },
    { event: event('month', 'PROPERTY_PURCHASE', 'MONTH'), interval: interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), calibrationCohort: 'PROPERTY_PURCHASE' },
    { event: event('year', 'PROPERTY_PURCHASE', 'YEAR'), interval: interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), calibrationCohort: 'PROPERTY_PURCHASE' },
  ];
  const output = await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events });
  assert.deepEqual(calls.map((item) => [item.datePrecision, item.interval.from, item.interval.to]), [
    ['DAY', '2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'],
    ['MONTH', '2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'],
    ['YEAR', '2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'],
  ]);
  assert.deepEqual(output.fingerprints.map((item) => item.qualityFlags[0]), ['EXACT_DAY_INTERVAL', 'MONTH_INTERVAL_SUMMARIZED', 'YEAR_INTERVAL_SUMMARIZED']);
  assert.deepEqual(output.fingerprints[0].evidenceFamilies, ['FOUNDATION', 'DIVISIONAL_CHART', 'DASHA', 'TRANSIT', 'ASHTAKAVARGA']);
});

test('uses full interval samples rather than treating MONTH or YEAR as a fake first-day event', () => {
  assert.deepEqual(retrospectiveSampleInstants(interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), 'DAY'), ['2020-02-02T00:00:00.000Z']);
  const month = retrospectiveSampleInstants(interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), 'MONTH');
  const year = retrospectiveSampleInstants(interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'YEAR');
  assert.equal(month.length, 3); assert.notEqual(month[1], month[0]); assert.match(month.at(-1), /^2020-02-29T23:59:59\.999Z$/);
  assert.equal(year.length, 3); assert.notEqual(year[1], year[0]); assert.match(year.at(-1), /^2020-12-31T23:59:59\.999Z$/);
});

test('matches only structurally similar same-cohort Property evidence and flags contradictory history', async () => {
  const { adapter } = fixture();
  const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'PROPERTY_PURCHASE' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const candidate = [{ candidateId: 'property', primaryEvidenceFingerprint: { pd: 'venus', transitConfirmation: 'MAJOR_CONFIRMATION' } }];
  const matched = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: candidate, adapterContext: { intent: 'PROPERTY_PURCHASE_TIMING', primaryPropertyEvidence: { natal: { classification: 'STRONG' }, d4: { confirmation: 'CONFIRMS' } } } });
  assert.equal(matched[0].matchedEventIds.length, 3);
  assert.equal(matched[0].tieBreakEligible, true);
  const contradictory = structuredClone(fingerprints);
  contradictory.forEach((item) => { item.evidenceFingerprint.dasha[0].pd = 'saturn'; });
  const noMatch = await adapter.annotateCandidates({ events: entries, fingerprints: contradictory, primaryCandidates: candidate, adapterContext: { intent: 'PROPERTY_PURCHASE_TIMING', primaryPropertyEvidence: { natal: { classification: 'STRONG' }, d4: { confirmation: 'CONFIRMS' } } } });
  assert.equal(noMatch[0].matchedEventIds.length, 0);
  assert.deepEqual(noMatch[0].contradictionFlags, ['MATERIAL_PROPERTY_PATTERN_VARIATION']);
});

test('a sale does not contribute to a purchase calibration candidate and titles/notes have no matching role', async () => {
  const { adapter } = fixture();
  const purchase = { event: { ...event('purchase'), title: 'old', note: 'private' }, interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'PROPERTY_PURCHASE' };
  const sale = { event: { ...event('sale', 'PROPERTY_SALE'), title: 'changed', note: 'different' }, interval: interval('2021-02-02T00:00:00.000Z', '2021-02-03T00:00:00.000Z'), calibrationCohort: 'PROPERTY_SALE' };
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: [purchase, sale] })).fingerprints;
  const output = await adapter.annotateCandidates({ events: [purchase, sale], fingerprints, primaryCandidates: [{ candidateId: 'purchase', primaryEvidenceFingerprint: { pd: 'venus', transitConfirmation: 'MAJOR_CONFIRMATION' } }], adapterContext: { intent: 'PROPERTY_PURCHASE_TIMING', primaryPropertyEvidence: { natal: { classification: 'STRONG' }, d4: { confirmation: 'CONFIRMS' } } } });
  assert.deepEqual(output[0].matchedEventIds, ['purchase']);
  assert.equal(output[0].historicalConsistency, 'NONE');
});

test('converts existing primary Property windows into immutable annotation targets only', () => {
  const candidates = propertyCalibrationCandidates({ start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z', pd: 'venus', classification: 'MODERATE_CANDIDATE', transitConfirmation: 'MAJOR_CONFIRMATION', secondaryWindows: [] }, 'MIXED');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].primaryState, 'MIXED');
  assert.equal(candidates[0].primaryStrength, 'MODERATE_CANDIDATE');
  assert.equal(candidates[0].start, '2026-11-01T00:00:00.000Z');
  assert.equal(candidates[0].end, '2026-12-01T00:00:00.000Z');
});

test('uses only the active profile canonical set and recomputes purchase/sale cohorts after mutations', async () => {
  const { adapter } = fixture();
  let ownEvents = [
    event('purchase-1'),
    event('purchase-2'),
    event('purchase-3'),
  ];
  const foreignEvent = event('foreign-purchase');
  const loadedProfiles = [];
  const coordinator = new LifeEventCalibrationCoordinator({
    canonicalEventLoader: async ({ birthProfileId }) => {
      loadedProfiles.push(birthProfileId);
      return birthProfileId === 'profile-a' ? ownEvents : [foreignEvent];
    },
    clock: () => '2026-01-01T00:00:00.000Z',
  });
  const options = {
    principal: { subject: 'user-a' },
    birthProfileId: 'profile-a',
    adapter,
    primaryCandidates: [{ candidateId: 'property-candidate', primaryRank: 0, primaryState: 'MIXED', primaryStrength: 'MODERATE_CANDIDATE', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'venus', transitConfirmation: 'MAJOR_CONFIRMATION' } }],
    primaryDomainRulesVersion: 'property-rules-v1',
    adapterContext: { intent: 'PROPERTY_PURCHASE_TIMING', primaryPropertyEvidence: { natal: { classification: 'STRONG' }, d4: { confirmation: 'CONFIRMS' } } },
  };

  const initial = await coordinator.calibrate(options);
  assert.equal(initial.thresholdLevel, 'PATTERN_ELIGIBLE');
  assert.equal(initial.matchedEventCount, 3);
  assert.deepEqual(loadedProfiles, ['profile-a']);
  assert.equal(initial.annotations[0].candidateId, 'property-candidate');
  assert.equal(initial.annotations[0].primaryState, undefined, 'coordinator exposes annotations, never mutable primary state');

  // An edit from purchase to sale leaves the purchase cohort on the next dynamic calculation.
  ownEvents = [
    event('purchase-1'),
    event('purchase-2'),
    event('purchase-3', 'PROPERTY_SALE'),
  ];
  const edited = await coordinator.calibrate(options);
  assert.equal(edited.thresholdLevel, 'WEAK_PATTERN');
  assert.equal(edited.annotations.length, 0, 'below the shared threshold, no candidate annotation is produced');
  assert.deepEqual(edited.audit.cohorts, [
    { cohort: 'PROPERTY_PURCHASE', eventCount: 2 },
    { cohort: 'PROPERTY_SALE', eventCount: 1 },
  ]);

  // A soft deletion disappears entirely from the canonical source on the next calculation.
  ownEvents = [{ ...event('purchase-1'), deletedAt: '2025-01-01T00:00:00.000Z' }];
  const deleted = await coordinator.calibrate(options);
  assert.equal(deleted.status, 'NO_EVENTS');
  assert.equal(deleted.comparableEventCount, 0);
});

test('keeps primary Property output safe when optional retrospective extraction is unavailable', async () => {
  const adapter = new PropertyCalibrationAdapter({
    birthProfileService: { get: async () => ({ birthData: { timezone: 'UTC' } }) },
    astronomicalEngine: { calculate: () => ({}) },
    canonicalSiderealSunSampler: () => 0,
    retrospectiveEvidenceExtractor: async () => { throw Object.assign(new Error('unavailable'), { code: 'PROPERTY_RETROSPECTIVE_UNAVAILABLE' }); },
  });
  const candidate = { candidateId: 'unchanged-primary', primaryRank: 0, primaryState: 'MIXED', primaryStrength: 'MODERATE_CANDIDATE', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'venus' } };
  const coordinator = new LifeEventCalibrationCoordinator({
    canonicalEventLoader: async () => [event('one'), event('two'), event('three')],
    clock: () => '2026-01-01T00:00:00.000Z',
  });
  const calibration = await coordinator.calibrate({
    principal: { subject: 'user-a' },
    birthProfileId: 'profile-a',
    adapter,
    primaryCandidates: [candidate],
    primaryDomainRulesVersion: 'property-rules-v1',
  });
  assert.equal(calibration.status, 'CALIBRATION_UNAVAILABLE');
  assert.equal(calibration.audit.safeFailureCode, 'PROPERTY_RETROSPECTIVE_UNAVAILABLE');
  assert.equal(candidate.primaryState, 'MIXED');
  assert.equal(candidate.start, '2026-02-01T00:00:00.000Z');
  assert.equal(candidate.end, '2026-03-01T00:00:00.000Z');
});

test('does not count wildcard candidate dimensions as independent display evidence families', async () => {
  const { adapter } = fixture();
  const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'PROPERTY_PURCHASE' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const output = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: [{ candidateId: 'wildcard', primaryEvidenceFingerprint: {} }], adapterContext: { intent: 'PROPERTY_PURCHASE_TIMING', primaryPropertyEvidence: {} } });
  assert.equal(output[0].matchedEventIds.length, 3, 'internal matching remains permissive');
  assert.deepEqual(output[0].matchedEvidenceFamilies, []);
  assert.deepEqual(output[0].unmatchedEvidenceFamilies, ['DASHA', 'DIVISIONAL_CHART', 'FOUNDATION', 'TRANSIT']);
});
