'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { VehicleCalibrationAdapter, VEHICLE_CALIBRATION_ADAPTER_VERSION, retrospectiveSampleInstants, vehicleCalibrationCandidates } = require('../../src/application/vehicle');
const { LifeEventCalibrationCoordinator } = require('../../src/application/life-event-calibration');

const interval = (from, to) => ({ from, to, timezone: 'UTC' });
const event = (id, eventType = 'VEHICLE_PURCHASE', precision = 'DAY') => ({ lifeEventId: id, category: 'VEHICLE', eventType, eventDate: precision === 'DAY' ? { precision, year: 2020, month: 2, day: 2 } : precision === 'MONTH' ? { precision, year: 2020, month: 2 } : { precision, year: 2020 } });
const evidence = (precision) => ({ foundation: { classification: 'STRONG', d1Seed: true, coreConnectionCount: 1, acquisitionConnectionCount: 1 }, d16: { confirmation: 'CONFIRMS', coreConnectionCount: 1, acquisitionConnectionCount: 1 }, dasha: [{ classification: 'STRONG_MD_AD_SUPPORT', eligible: true, md: 'moon', ad: 'mars', pd: 'venus', pdRefinement: 'PRIMARY_REFINEMENT' }], transit: [{ majorConfirmation: 'MAJOR_CONFIRMATION', hasMajorConfirmation: true, majorPlanets: ['Jupiter'], supportPlanets: [] }], ashtakavarga: { policy: 'CONTEXT_ONLY_NO_THRESHOLDS' }, intervalSummary: { policy: precision === 'DAY' ? 'EXACT_DAY' : precision === 'MONTH' ? 'INTERVAL_START_MIDPOINT_END_MINUS_ONE' : 'BROAD_INTERVAL_START_MIDPOINT_END_MINUS_ONE', sampleInstants: [] } });
function fixture({ extractor = null } = {}) {
  const calls = [];
  const adapter = new VehicleCalibrationAdapter({
    birthProfileService: { get: async () => ({ birthData: { timezone: 'Asia/Kolkata' } }) },
    astronomicalEngine: { calculate: () => ({}) },
    canonicalSiderealSunSampler: () => 0,
    retrospectiveEvidenceExtractor: extractor || (async (input) => { calls.push(input); return evidence(input.datePrecision); }),
  });
  return { adapter, calls };
}

test('keeps Vehicle purchase and sale as distinct canonical cohorts', async () => {
  const { adapter } = fixture();
  assert.equal(adapter.domainCalibrationVersion, VEHICLE_CALIBRATION_ADAPTER_VERSION);
  assert.equal(adapter.supports(event('purchase')), true);
  assert.equal(adapter.cohortFor(event('purchase')), 'VEHICLE_PURCHASE');
  assert.equal(adapter.cohortFor(event('sale', 'VEHICLE_SALE')), 'VEHICLE_SALE');
  assert.equal(adapter.supports({ ...event('bad'), eventType: 'OTHER' }), false);
  assert.equal(await adapter.resolveTimezone({ principal: {}, birthProfileId: 'profile-a' }), 'Asia/Kolkata');
});

test('passes exact DAY and interval-aware MONTH/YEAR evidence to the existing Vehicle extractor', async () => {
  const { adapter, calls } = fixture();
  const events = [
    { event: event('day', 'VEHICLE_PURCHASE', 'DAY'), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'VEHICLE_PURCHASE' },
    { event: event('month', 'VEHICLE_PURCHASE', 'MONTH'), interval: interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), calibrationCohort: 'VEHICLE_PURCHASE' },
    { event: event('year', 'VEHICLE_PURCHASE', 'YEAR'), interval: interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), calibrationCohort: 'VEHICLE_PURCHASE' },
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

test('uses deterministic full-interval samples instead of inventing MONTH or YEAR event days', () => {
  assert.deepEqual(retrospectiveSampleInstants(interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), 'DAY'), ['2020-02-02T00:00:00.000Z']);
  const month = retrospectiveSampleInstants(interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), 'MONTH');
  const year = retrospectiveSampleInstants(interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'YEAR');
  assert.equal(month.length, 3); assert.notEqual(month[1], month[0]); assert.match(month.at(-1), /^2020-02-29T23:59:59\.999Z$/);
  assert.equal(year.length, 3); assert.notEqual(year[1], year[0]); assert.match(year.at(-1), /^2020-12-31T23:59:59\.999Z$/);
});

test('matches structured Vehicle evidence only and flags materially contradictory purchase history', async () => {
  const { adapter } = fixture();
  const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'VEHICLE_PURCHASE' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const candidate = [{ candidateId: 'vehicle', primaryEvidenceFingerprint: { pd: 'venus', majorConfirmation: 'MAJOR_CONFIRMATION' } }];
  const context = { intent: 'VEHICLE_PURCHASE_TIMING', primaryVehicleEvidence: { d1: { classification: 'STRONG' }, d16: { confirmation: 'CONFIRMS' } } };
  const matched = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: candidate, adapterContext: context });
  assert.equal(matched[0].matchedEventIds.length, 3);
  assert.equal(matched[0].tieBreakEligible, true);
  const contradictory = structuredClone(fingerprints);
  contradictory.forEach((item) => { item.evidenceFingerprint.dasha[0].pd = 'saturn'; });
  const noMatch = await adapter.annotateCandidates({ events: entries, fingerprints: contradictory, primaryCandidates: candidate, adapterContext: context });
  assert.equal(noMatch[0].matchedEventIds.length, 0);
  assert.deepEqual(noMatch[0].contradictionFlags, ['MATERIAL_VEHICLE_PATTERN_VARIATION']);
});

test('excludes sale events from purchase matching and never uses titles or notes', async () => {
  const { adapter } = fixture();
  const purchase = { event: { ...event('purchase'), title: 'old label', note: 'private detail' }, interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'VEHICLE_PURCHASE' };
  const sale = { event: { ...event('sale', 'VEHICLE_SALE'), title: 'changed label', note: 'different detail' }, interval: interval('2021-02-02T00:00:00.000Z', '2021-02-03T00:00:00.000Z'), calibrationCohort: 'VEHICLE_SALE' };
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: [purchase, sale] })).fingerprints;
  const output = await adapter.annotateCandidates({ events: [purchase, sale], fingerprints, primaryCandidates: [{ candidateId: 'purchase', primaryEvidenceFingerprint: { pd: 'venus', majorConfirmation: 'MAJOR_CONFIRMATION' } }], adapterContext: { intent: 'VEHICLE_PURCHASE_TIMING', primaryVehicleEvidence: { d1: { classification: 'STRONG' }, d16: { confirmation: 'CONFIRMS' } } } });
  assert.deepEqual(output[0].matchedEventIds, ['purchase']);
  assert.equal(output[0].historicalConsistency, 'NONE');
});

test('recomputes active-profile Vehicle cohorts dynamically after create, edit, precision change, and delete', async () => {
  const { adapter, calls } = fixture();
  let ownEvents = [event('purchase-1'), event('purchase-2'), event('purchase-3')];
  const coordinator = new LifeEventCalibrationCoordinator({
    canonicalEventLoader: async ({ birthProfileId }) => birthProfileId === 'profile-a' ? ownEvents : [event('foreign')],
    clock: () => '2026-01-01T00:00:00.000Z',
  });
  const options = { principal: { subject: 'user-a' }, birthProfileId: 'profile-a', adapter, primaryCandidates: [{ candidateId: 'vehicle-candidate', primaryRank: 0, primaryState: 'MODERATE_CANDIDATE', primaryStrength: 'MODERATE_CANDIDATE', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'venus', majorConfirmation: 'MAJOR_CONFIRMATION' } }], primaryDomainRulesVersion: 'vehicle-rules-v1', adapterContext: { intent: 'VEHICLE_PURCHASE_TIMING', primaryVehicleEvidence: { d1: { classification: 'STRONG' }, d16: { confirmation: 'CONFIRMS' } } } };
  const initial = await coordinator.calibrate(options);
  assert.equal(initial.thresholdLevel, 'PATTERN_ELIGIBLE'); assert.equal(initial.matchedEventCount, 3);
  ownEvents = [event('purchase-1'), event('purchase-2', 'VEHICLE_PURCHASE', 'MONTH'), event('purchase-3', 'VEHICLE_SALE')];
  const edited = await coordinator.calibrate(options);
  assert.equal(edited.thresholdLevel, 'WEAK_PATTERN'); assert.equal(edited.annotations.length, 0);
  assert.equal(calls.some((call) => call.datePrecision === 'MONTH'), true);
  ownEvents = [{ ...event('purchase-1'), deletedAt: '2025-01-01T00:00:00.000Z' }];
  const deleted = await coordinator.calibrate(options);
  assert.equal(deleted.status, 'NO_EVENTS'); assert.equal(deleted.comparableEventCount, 0);
});

test('is non-fatal when Vehicle retrospective extraction is unavailable', async () => {
  const { adapter } = fixture({ extractor: async () => { throw Object.assign(new Error('unavailable'), { code: 'VEHICLE_RETROSPECTIVE_UNAVAILABLE' }); } });
  const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async () => [event('one'), event('two'), event('three')], clock: () => '2026-01-01T00:00:00.000Z' });
  const candidate = { candidateId: 'unchanged-primary', primaryRank: 0, primaryState: 'MODERATE_CANDIDATE', primaryStrength: 'MODERATE_CANDIDATE', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'venus' } };
  const result = await coordinator.calibrate({ principal: { subject: 'user-a' }, birthProfileId: 'profile-a', adapter, primaryCandidates: [candidate], primaryDomainRulesVersion: 'vehicle-rules-v1' });
  assert.equal(result.status, 'CALIBRATION_UNAVAILABLE');
  assert.equal(result.audit.safeFailureCode, 'VEHICLE_RETROSPECTIVE_UNAVAILABLE');
  assert.equal(candidate.primaryState, 'MODERATE_CANDIDATE');
});

test('converts existing Vehicle windows into immutable annotation targets only', () => {
  const candidates = vehicleCalibrationCandidates({ start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z', candidateStrength: 'MODERATE_CANDIDATE', internalPhases: [{ majorGocharConfirmation: 'MAJOR_CONFIRMATION', refinement: { pd: 'venus' } }], secondaryWindows: [] }, 'MODERATE_CANDIDATE');
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].primaryState, 'MODERATE_CANDIDATE');
  assert.equal(candidates[0].primaryStrength, 'MODERATE_CANDIDATE');
  assert.equal(candidates[0].start, '2026-11-01T00:00:00.000Z');
  assert.equal(candidates[0].end, '2026-12-01T00:00:00.000Z');
});

test('counts D16 plus another actual candidate comparison family, not omitted wildcard fields', async () => {
  const { adapter } = fixture();
  const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'VEHICLE_PURCHASE' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const output = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: [{ candidateId: 'vehicle', primaryEvidenceFingerprint: { pd: 'venus' } }], adapterContext: { intent: 'VEHICLE_PURCHASE_TIMING', primaryVehicleEvidence: { d16: { confirmation: 'CONFIRMS' } } } });
  assert.deepEqual(output[0].matchedEvidenceFamilies, ['DASHA', 'DIVISIONAL_CHART']);
  assert.deepEqual(output[0].unmatchedEvidenceFamilies, ['FOUNDATION', 'TRANSIT']);
});
