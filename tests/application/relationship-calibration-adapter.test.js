'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RelationshipCalibrationAdapter, RELATIONSHIP_CALIBRATION_ADAPTER_VERSION, retrospectiveSampleInstants, relationshipCalibrationCandidates } = require('../../src/application/relationships');
const { LifeEventCalibrationCoordinator } = require('../../src/application/life-event-calibration');

const interval = (from, to) => ({ from, to, timezone: 'UTC' });
const event = (id, eventType = 'ENGAGEMENT', precision = 'DAY') => ({ lifeEventId: id, category: 'RELATIONSHIPS_FAMILY', eventType, eventDate: precision === 'DAY' ? { precision, year: 2020, month: 2, day: 2 } : precision === 'MONTH' ? { precision, year: 2020, month: 2 } : { precision, year: 2020 } });
const evidence = (precision) => ({ foundation: { state: 'CONSTRUCTIVE', constructiveSignals: ['venus', 'jupiter'], cautionSignals: [], seventhLord: 'moon' }, d9: { available: true, confirmation: 'Reinforcing', rulesetId: 'bphs-chapter-6-v1' }, dasha: [{ state: 'RELATIONSHIP_RELEVANT', eligible: true, md: 'moon', ad: 'venus', pd: 'jupiter', pdRefinement: 'Strengthening' }], transit: [{ jupiter: true, saturn: false, venus: true, caution: 0, major: true }], ashtakavarga: { confirmation: 'AVAILABLE_CONTEXT', policy: 'CONTEXT_ONLY' }, intervalSummary: { policy: precision === 'DAY' ? 'EXACT_DAY' : precision === 'MONTH' ? 'INTERVAL_START_MIDPOINT_END_MINUS_ONE' : 'BROAD_INTERVAL_START_MIDPOINT_END_MINUS_ONE', sampleInstants: [] } });
function fixture({ extractor = null } = {}) {
  const calls = [];
  const adapter = new RelationshipCalibrationAdapter({
    birthProfileService: { get: async () => ({ birthData: { timezone: 'Asia/Kolkata' } }) },
    astronomicalEngine: { calculate: () => ({}) },
    canonicalSiderealSunSampler: () => 0,
    retrospectiveEvidenceExtractor: extractor || (async (input) => { calls.push(input); return evidence(input.datePrecision); }),
  });
  return { adapter, calls };
}

test('supports only Engagement and Marriage canonical cohorts, never Child Birth', async () => {
  const { adapter } = fixture();
  assert.equal(adapter.domainCalibrationVersion, RELATIONSHIP_CALIBRATION_ADAPTER_VERSION);
  assert.equal(adapter.supports(event('engagement')), true);
  assert.equal(adapter.cohortFor(event('engagement')), 'ENGAGEMENT');
  assert.equal(adapter.cohortFor(event('marriage', 'MARRIAGE')), 'MARRIAGE');
  assert.equal(adapter.supports(event('child', 'CHILD_BIRTH')), false);
  assert.equal(await adapter.resolveTimezone({ principal: {}, birthProfileId: 'profile-a' }), 'Asia/Kolkata');
});

test('passes exact DAY and whole MONTH/YEAR intervals to existing Relationship evidence extraction', async () => {
  const { adapter, calls } = fixture();
  const events = [
    { event: event('day', 'ENGAGEMENT', 'DAY'), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'ENGAGEMENT' },
    { event: event('month', 'ENGAGEMENT', 'MONTH'), interval: interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), calibrationCohort: 'ENGAGEMENT' },
    { event: event('year', 'ENGAGEMENT', 'YEAR'), interval: interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), calibrationCohort: 'ENGAGEMENT' },
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

test('samples full MONTH/YEAR intervals without fabricating a first-day relationship event', () => {
  assert.deepEqual(retrospectiveSampleInstants(interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), 'DAY'), ['2020-02-02T00:00:00.000Z']);
  const month = retrospectiveSampleInstants(interval('2020-02-01T00:00:00.000Z', '2020-03-01T00:00:00.000Z'), 'MONTH');
  const year = retrospectiveSampleInstants(interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), 'YEAR');
  assert.equal(month.length, 3); assert.notEqual(month[1], month[0]); assert.match(month.at(-1), /^2020-02-29T23:59:59\.999Z$/);
  assert.equal(year.length, 3); assert.notEqual(year[1], year[0]); assert.match(year.at(-1), /^2020-12-31T23:59:59\.999Z$/);
});

test('matches only structured same-cohort evidence and records contradictory history', async () => {
  const { adapter } = fixture();
  const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id), interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'ENGAGEMENT' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const candidate = [{ candidateId: 'engagement', primaryEvidenceFingerprint: { pd: 'jupiter', majorRegime: 'JUPITER' } }];
  const context = { intent: 'RELATIONSHIP_OUTLOOK', primaryRelationshipEvidence: { d1: { state: 'CONSTRUCTIVE' }, d9: { confirmation: 'Reinforcing' } } };
  const matched = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: candidate, adapterContext: context });
  assert.equal(matched[0].matchedEventIds.length, 3); assert.equal(matched[0].tieBreakEligible, true);
  const contradictory = structuredClone(fingerprints);
  contradictory.forEach((item) => { item.evidenceFingerprint.dasha[0].pd = 'saturn'; });
  const noMatch = await adapter.annotateCandidates({ events: entries, fingerprints: contradictory, primaryCandidates: candidate, adapterContext: context });
  assert.equal(noMatch[0].matchedEventIds.length, 0);
  assert.deepEqual(noMatch[0].contradictionFlags, ['MATERIAL_RELATIONSHIP_PATTERN_VARIATION']);
});

test('keeps Engagement and Marriage separate and never uses titles, notes, Child Birth, or inferred status', async () => {
  const { adapter } = fixture();
  const engagement = { event: { ...event('engagement'), title: 'old', note: 'private' }, interval: interval('2020-02-02T00:00:00.000Z', '2020-02-03T00:00:00.000Z'), calibrationCohort: 'ENGAGEMENT' };
  const marriage = { event: { ...event('marriage', 'MARRIAGE'), title: 'changed', note: 'different' }, interval: interval('2021-02-02T00:00:00.000Z', '2021-02-03T00:00:00.000Z'), calibrationCohort: 'MARRIAGE' };
  const child = { event: event('child', 'CHILD_BIRTH'), interval: interval('2022-02-02T00:00:00.000Z', '2022-02-03T00:00:00.000Z'), calibrationCohort: null };
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: [engagement, marriage] })).fingerprints;
  const engagementOutput = await adapter.annotateCandidates({ events: [engagement, marriage, child], fingerprints, primaryCandidates: [{ candidateId: 'engagement', primaryEvidenceFingerprint: { pd: 'jupiter', majorRegime: 'JUPITER' } }], adapterContext: { intent: 'RELATIONSHIP_OUTLOOK', primaryRelationshipEvidence: { d1: { state: 'CONSTRUCTIVE' }, d9: { confirmation: 'Reinforcing' } } } });
  const marriageOutput = await adapter.annotateCandidates({ events: [engagement, marriage, child], fingerprints, primaryCandidates: [{ candidateId: 'marriage', primaryEvidenceFingerprint: { pd: 'jupiter', majorRegime: 'JUPITER' } }], adapterContext: { intent: 'MARRIAGE_OUTLOOK', primaryRelationshipEvidence: { d1: { state: 'CONSTRUCTIVE' }, d9: { confirmation: 'Reinforcing' } } } });
  assert.deepEqual(engagementOutput[0].matchedEventIds, ['engagement']);
  assert.deepEqual(marriageOutput[0].matchedEventIds, ['marriage']);
});

test('applies shared count thresholds separately to Engagement and Marriage and recomputes mutations per profile', async () => {
  const { adapter, calls } = fixture();
  let ownEvents = [event('engagement-1')];
  const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async ({ birthProfileId }) => birthProfileId === 'profile-a' ? ownEvents : [event('foreign')], clock: () => '2026-01-01T00:00:00.000Z' });
  const options = { principal: { subject: 'user-a' }, birthProfileId: 'profile-a', adapter, primaryCandidates: [{ candidateId: 'candidate', primaryRank: 0, primaryState: 'Supportive', primaryStrength: 'Supportive', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'jupiter', majorRegime: 'JUPITER' } }], primaryDomainRulesVersion: 'relationship-marriage-rules-v1', adapterContext: { intent: 'RELATIONSHIP_OUTLOOK', primaryRelationshipEvidence: { d1: { state: 'CONSTRUCTIVE' }, d9: { confirmation: 'Reinforcing' } } } };
  assert.equal((await coordinator.calibrate(options)).thresholdLevel, 'CONTEXT_ONLY');
  ownEvents = [event('engagement-1'), event('engagement-2')];
  assert.equal((await coordinator.calibrate(options)).thresholdLevel, 'WEAK_PATTERN');
  ownEvents = [event('engagement-1'), event('engagement-2'), event('engagement-3')];
  assert.equal((await coordinator.calibrate(options)).thresholdLevel, 'PATTERN_ELIGIBLE');
  ownEvents = [event('engagement-1'), event('engagement-2'), event('engagement-3', 'MARRIAGE', 'MONTH')];
  const edited = await coordinator.calibrate(options);
  assert.equal(edited.thresholdLevel, 'WEAK_PATTERN'); assert.equal(calls.some((call) => call.datePrecision === 'MONTH'), true);
  ownEvents = [event('marriage-1', 'MARRIAGE'), event('marriage-2', 'MARRIAGE'), event('marriage-3', 'MARRIAGE')];
  const marriageOptions = { ...options, adapterContext: { ...options.adapterContext, intent: 'MARRIAGE_OUTLOOK' } };
  assert.equal((await coordinator.calibrate(marriageOptions)).thresholdLevel, 'PATTERN_ELIGIBLE');
  ownEvents = [{ ...event('marriage-1', 'MARRIAGE'), deletedAt: '2025-01-01T00:00:00.000Z' }];
  assert.equal((await coordinator.calibrate(marriageOptions)).status, 'NO_EVENTS');
});

test('is non-fatal when Relationship retrospective extraction fails', async () => {
  const { adapter } = fixture({ extractor: async () => { throw Object.assign(new Error('unavailable'), { code: 'RELATIONSHIP_RETROSPECTIVE_UNAVAILABLE' }); } });
  const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async () => [event('one'), event('two'), event('three')], clock: () => '2026-01-01T00:00:00.000Z' });
  const candidate = { candidateId: 'unchanged-primary', primaryRank: 0, primaryState: 'Supportive', primaryStrength: 'Supportive', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: { pd: 'jupiter' } };
  const result = await coordinator.calibrate({ principal: { subject: 'user-a' }, birthProfileId: 'profile-a', adapter, primaryCandidates: [candidate], primaryDomainRulesVersion: 'relationship-marriage-rules-v1' });
  assert.equal(result.status, 'CALIBRATION_UNAVAILABLE'); assert.equal(result.audit.safeFailureCode, 'RELATIONSHIP_RETROSPECTIVE_UNAVAILABLE'); assert.equal(candidate.primaryState, 'Supportive');
});

test('converts existing Relationship candidates into immutable annotation targets only', () => {
  const candidates = relationshipCalibrationCandidates([{ start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z', state: 'Supportive', parent: { md: 'moon', ad: 'venus' }, pd: { lord: 'jupiter' }, d9: { confirmation: 'Reinforcing' }, transit: { majorRegime: 'JUPITER' } }]);
  assert.equal(candidates.length, 1); assert.equal(candidates[0].primaryState, 'Supportive'); assert.equal(candidates[0].start, '2026-11-01T00:00:00.000Z'); assert.equal(candidates[0].end, '2026-12-01T00:00:00.000Z');
});

test('keeps exact Relationship cohorts and reports only actual evidence-family comparisons', async () => {
  const { adapter } = fixture();
  const entries = ['a', 'b', 'c'].map((id) => ({ event: event(id, 'MARRIAGE', 'YEAR'), interval: interval('2020-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z'), calibrationCohort: 'MARRIAGE' }));
  const fingerprints = (await adapter.extractRetrospectiveEvidence({ principal: {}, birthProfileId: 'profile-a', events: entries })).fingerprints;
  const output = await adapter.annotateCandidates({ events: entries, fingerprints, primaryCandidates: [{ candidateId: 'marriage', primaryEvidenceFingerprint: {} }], adapterContext: { intent: 'MARRIAGE_OUTLOOK', primaryRelationshipEvidence: {} } });
  assert.equal(output[0].matchedEventIds.length, 3);
  assert.deepEqual(output[0].matchedEvidenceFamilies, []);
  assert.deepEqual(output[0].unmatchedEvidenceFamilies, ['DASHA', 'DIVISIONAL_CHART', 'FOUNDATION', 'TRANSIT']);
});
