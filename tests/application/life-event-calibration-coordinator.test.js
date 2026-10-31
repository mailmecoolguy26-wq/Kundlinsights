'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LifeEventCalibrationCoordinator, CALIBRATION_CONTRACT_VERSION, eventInterval } = require('../../src/application/life-event-calibration');

const reference = '2026-10-15T12:00:00.000Z';
const date = (precision, year, month = null, day = null) => ({ precision, year, month, day });
const event = (id, eventDate, extras = {}) => ({ lifeEventId: id, category: 'CAREER_BUSINESS', eventType: 'JOB_CHANGED', eventDate, ...extras });
function adapter(overrides = {}) {
  return {
    domainCalibrationVersion: 'test-adapter-v1',
    supports: (item) => item.category === 'CAREER_BUSINESS' && item.eventType !== 'OTHER',
    cohortFor: (item) => `TEST:${item.eventType}`,
    resolveTimezone: async () => 'UTC',
    customerDisplaySafety: () => ({ permitted: true, policy: 'TEST_NON_PREDICTIVE_HISTORY', minimumHighMediumMatches: 2 }),
    extractRetrospectiveEvidence: async ({ events }) => ({ fingerprints: events.map((item) => ({ eventId: item.event.lifeEventId, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: 'test-adapter-v1', evidenceFamilies: ['DASHA'], evidenceFingerprint: { deterministic: true }, qualityFlags: [] })) }),
    annotateCandidates: async ({ primaryCandidates, events }) => primaryCandidates.map((item) => ({ candidateId: item.candidateId, matchedEventIds: events.slice(0, 2).map((value) => value.event.lifeEventId), matchedEvidenceFamilies: ['DASHA'], patternStrength: 'WEAK', historicalConsistency: 'BOUNDED', tieBreakEligible: true, qualityFlags: [], contradictionFlags: [] })),
    ...overrides,
  };
}
function fixture(events, options = {}) {
  const calls = [];
  const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async (input) => { calls.push(input); return events; }, clock: () => options.reference || reference });
  return { calls, coordinator };
}
const candidates = [{ candidateId: 'candidate-a', primaryRank: 0, primaryState: 'MIXED', primaryStrength: 'MODERATE', start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z', primaryEvidenceFingerprint: 'primary-a' }];

test('uses interval-aware DAY, MONTH, and YEAR semantics without invented event days', () => {
  assert.deepEqual(eventInterval(date('DAY', 2020, 2, 2), 'UTC'), { from: '2020-02-02T00:00:00.000Z', to: '2020-02-03T00:00:00.000Z', timezone: 'UTC' });
  assert.deepEqual(eventInterval(date('MONTH', 2020, 2), 'UTC'), { from: '2020-02-01T00:00:00.000Z', to: '2020-03-01T00:00:00.000Z', timezone: 'UTC' });
  assert.deepEqual(eventInterval(date('YEAR', 2020), 'UTC'), { from: '2020-01-01T00:00:00.000Z', to: '2021-01-01T00:00:00.000Z', timezone: 'UTC' });
});

test('filters profile-scoped events by completed historical interval and applies shared thresholds', async () => {
  for (const [events, expected] of [
    [[], ['NO_EVENTS', 'NONE']],
    [[event('one', date('DAY', 2020, 1, 1))], ['CONTEXT_ONLY', 'CONTEXT_ONLY']],
    [[event('one', date('DAY', 2020, 1, 1)), event('two', date('DAY', 2021, 1, 1))], ['PATTERN_EVALUATED', 'WEAK_PATTERN']],
    [[event('one', date('DAY', 2020, 1, 1)), event('two', date('DAY', 2021, 1, 1)), event('three', date('DAY', 2022, 1, 1))], ['PATTERN_EVALUATED', 'PATTERN_ELIGIBLE']],
  ]) {
    const { coordinator, calls } = fixture(events);
    const result = await coordinator.calibrate({ principal: { id: 'user-a' }, birthProfileId: 'profile-a', adapter: adapter(), primaryCandidates: candidates, primaryDomainRulesVersion: 'career-primary-v1' });
    assert.equal(result.status, expected[0]);
    assert.equal(result.thresholdLevel, expected[1]);
    assert.equal(result.calibrationContractVersion, CALIBRATION_CONTRACT_VERSION);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].birthProfileId, 'profile-a');
  }
});

test('excludes soft-deleted, future, and ongoing MONTH/YEAR intervals', async () => {
  const { coordinator } = fixture([
    event('past-day', date('DAY', 2020, 1, 1)),
    event('deleted', date('DAY', 2021, 1, 1), { deletedAt: '2022-01-01T00:00:00.000Z' }),
    event('future', date('DAY', 2027, 1, 1)),
    event('ongoing-month', date('MONTH', 2026, 10)),
    event('ongoing-year', date('YEAR', 2026)),
  ]);
  const result = await coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter(), primaryCandidates: candidates });
  assert.deepEqual(result.audit.relevantEventIds, ['past-day']);
  assert.equal(result.comparableEventCount, 1);
  assert.equal(result.thresholdLevel, 'CONTEXT_ONLY');
});

test('keeps cohorts separate and does not turn three unrelated event types into a pattern', async () => {
  const { coordinator } = fixture([
    event('change', date('DAY', 2020, 1, 1)),
    event('promotion', date('DAY', 2021, 1, 1), { eventType: 'PROMOTION' }),
    event('loss', date('DAY', 2022, 1, 1), { eventType: 'JOB_LOSS' }),
  ]);
  const result = await coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter(), primaryCandidates: candidates });
  assert.equal(result.comparableEventCount, 1);
  assert.equal(result.thresholdLevel, 'CONTEXT_ONLY');
  assert.deepEqual(result.annotations, []);
});

test('returns annotations only and rejects an adapter attempt to replace primary candidate fields', async () => {
  const events = [event('a', date('DAY', 2020, 1, 1)), event('b', date('DAY', 2021, 1, 1)), event('c', date('DAY', 2022, 1, 1))];
  const { coordinator } = fixture(events);
  const original = structuredClone(candidates);
  const result = await coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter({ annotateCandidates: async () => [{ candidateId: 'candidate-a', primaryState: 'SUPPORTIVE' }] }), primaryCandidates: candidates });
  assert.equal(result.status, 'CALIBRATION_UNAVAILABLE');
  assert.deepEqual(candidates, original);
  assert.deepEqual(result.annotations, []);
  assert.equal(result.audit.safeFailureCode, 'INVALID_CALIBRATION_ANNOTATION');
});

test('does not use event title or note as calibration evidence', async () => {
  const inputs = [event('a', date('DAY', 2020, 1, 1), { title: 'Old title', note: 'private note' }), event('b', date('DAY', 2021, 1, 1), { title: 'Other', note: 'another note' }), event('c', date('DAY', 2022, 1, 1))];
  const first = await fixture(inputs).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter(), primaryCandidates: candidates });
  const second = await fixture(inputs.map((item) => ({ ...item, title: 'changed title', note: 'different free text' }))).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter(), primaryCandidates: candidates });
  assert.deepEqual(first.annotations, second.annotations);
  assert.deepEqual(first.fingerprints, second.fingerprints);
});

test('returns a non-fatal unavailable envelope when adapter extraction fails', async () => {
  const { coordinator } = fixture([event('a', date('DAY', 2020, 1, 1)), event('b', date('DAY', 2021, 1, 1))]);
  const result = await coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter({ extractRetrospectiveEvidence: async () => { const error = new Error('down'); error.code = 'RETROSPECTIVE_FAILURE'; throw error; } }), primaryCandidates: candidates });
  assert.equal(result.status, 'CALIBRATION_UNAVAILABLE');
  assert.equal(result.audit.safeFailureCode, 'RETROSPECTIVE_FAILURE');
});

test('recomputes from the current canonical event set after create, edit, and delete mutations', async () => {
  const records = [event('a', date('DAY', 2020, 1, 1)), event('b', date('DAY', 2021, 1, 1))];
  const { coordinator } = fixture(records);
  const input = { principal: {}, birthProfileId: 'profile-a', adapter: adapter(), primaryCandidates: candidates };
  assert.equal((await coordinator.calibrate(input)).thresholdLevel, 'WEAK_PATTERN');
  records.push(event('c', date('DAY', 2022, 1, 1)));
  assert.equal((await coordinator.calibrate(input)).thresholdLevel, 'PATTERN_ELIGIBLE');
  records[2].eventDate = date('DAY', 2027, 1, 1);
  assert.equal((await coordinator.calibrate(input)).thresholdLevel, 'WEAK_PATTERN');
  records[1].deletedAt = '2026-10-15T12:00:00.000Z';
  assert.equal((await coordinator.calibrate(input)).thresholdLevel, 'CONTEXT_ONLY');
});

test('keeps YEAR-only history internally pattern eligible but blocks customer display readiness', async () => {
  const records = [event('a', date('YEAR', 2020)), event('b', date('YEAR', 2021)), event('c', date('YEAR', 2022))];
  const displayAdapter = adapter({
    extractRetrospectiveEvidence: async ({ events }) => ({ fingerprints: events.map((item) => ({ eventId: item.event.lifeEventId, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, evidenceFamilies: ['FOUNDATION', 'DASHA'], evidenceFingerprint: {}, qualityFlags: [] })) }),
    annotateCandidates: async () => [{ candidateId: 'candidate-a', matchedEventIds: ['a', 'b', 'c'], matchedEvidenceFamilies: ['FOUNDATION', 'DASHA'], unmatchedEvidenceFamilies: ['TRANSIT'], patternStrength: 'MODERATE', historicalConsistency: 'BOUNDED', tieBreakEligible: true, qualityFlags: [], contradictionFlags: [] }],
  });
  const result = await fixture(records).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: displayAdapter, primaryCandidates: candidates });
  assert.equal(result.thresholdLevel, 'PATTERN_ELIGIBLE');
  assert.equal(result.customerDisplayEligible, false);
  assert.deepEqual(result.customerDisplayReadiness[0].reasonCodes, ['INSUFFICIENT_PRECISE_MATCHES']);
  assert.deepEqual(result.audit.unmatchedEvidenceFamilies, ['TRANSIT']);
});

test('requires two HIGH or MEDIUM matching events and two independent matched families for display readiness', async () => {
  const displayAdapter = adapter({
    extractRetrospectiveEvidence: async ({ events }) => ({ fingerprints: events.map((item) => ({ eventId: item.event.lifeEventId, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, evidenceFamilies: ['FOUNDATION', 'DASHA'], evidenceFingerprint: {}, qualityFlags: [] })) }),
    annotateCandidates: async ({ events }) => [{ candidateId: 'candidate-a', matchedEventIds: events.map((item) => item.event.lifeEventId), matchedEvidenceFamilies: ['FOUNDATION', 'DASHA'], unmatchedEvidenceFamilies: ['TRANSIT'], patternStrength: 'MODERATE', historicalConsistency: 'BOUNDED', tieBreakEligible: true, qualityFlags: [], contradictionFlags: [] }],
  });
  for (const [precisions, expected] of [
    [['DAY', 'DAY', 'YEAR'], true],
    [['DAY', 'YEAR', 'YEAR'], false],
    [['MONTH', 'MONTH', 'YEAR'], true],
    [['DAY', 'MONTH', 'YEAR'], true],
  ]) {
    const records = precisions.map((precision, index) => event(String(index + 1), date(precision, 2020 + index, precision === 'YEAR' ? null : 1, precision === 'DAY' ? 1 : null)));
    const result = await fixture(records).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: displayAdapter, primaryCandidates: candidates });
    assert.equal(result.customerDisplayEligible, expected, precisions.join('/'));
  }
  const oneFamilyAdapter = adapter({
    extractRetrospectiveEvidence: displayAdapter.extractRetrospectiveEvidence,
    annotateCandidates: async ({ events }) => [{ candidateId: 'candidate-a', matchedEventIds: events.map((item) => item.event.lifeEventId), matchedEvidenceFamilies: ['DASHA'], unmatchedEvidenceFamilies: ['TRANSIT'], patternStrength: 'MODERATE', historicalConsistency: 'BOUNDED', tieBreakEligible: true, qualityFlags: [], contradictionFlags: [] }],
  });
  const preciseRecords = ['a', 'b', 'c'].map((id, index) => event(id, date('DAY', 2020 + index, 1, 1)));
  const oneFamily = await fixture(preciseRecords).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: oneFamilyAdapter, primaryCandidates: candidates });
  assert.equal(oneFamily.customerDisplayEligible, false);
  assert.deepEqual(oneFamily.customerDisplayReadiness[0].reasonCodes, ['INSUFFICIENT_MATCHED_EVIDENCE_FAMILIES']);
});

test('blocks display readiness for contradictions or missing domain safety and records coarse exclusions and timings', async () => {
  const records = [event('a', date('DAY', 2020, 1, 1)), event('b', date('DAY', 2021, 1, 1)), event('c', date('DAY', 2022, 1, 1)), event('deleted', date('DAY', 2023, 1, 1), { deletedAt: '2024-01-01T00:00:00.000Z' }), event('future', date('DAY', 2027, 1, 1))];
  const result = await fixture(records).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: adapter({
    customerDisplaySafety: () => ({ permitted: false, policy: null }),
    annotateCandidates: async () => [{ candidateId: 'candidate-a', matchedEventIds: ['a', 'b'], matchedEvidenceFamilies: ['FOUNDATION', 'DASHA'], unmatchedEvidenceFamilies: [], patternStrength: 'WEAK', historicalConsistency: 'LIMITED', tieBreakEligible: false, qualityFlags: [], contradictionFlags: ['MATERIAL_VARIATION'] }],
  }), primaryCandidates: candidates });
  assert.equal(result.customerDisplayEligible, false);
  assert.deepEqual(result.customerDisplayReadiness[0].reasonCodes, ['MATERIAL_CONTRADICTION', 'DOMAIN_SAFETY_RESTRICTION']);
  assert.equal(result.audit.exclusionCounts.DELETED, 1);
  assert.equal(result.audit.exclusionCounts.FUTURE_EVENT, 1);
  assert.equal(Number.isFinite(result.audit.timing.totalMilliseconds), true);
  assert.equal(Number.isFinite(result.audit.timing.extractionMilliseconds), true);
});

test('supports the stricter Family-style three precise-match policy without changing internal eligibility', async () => {
  const familyAdapter = adapter({
    customerDisplaySafety: () => ({ permitted: true, policy: 'NON_MEDICAL_FAMILY_TIMING_ONLY', minimumHighMediumMatches: 3 }),
    extractRetrospectiveEvidence: async ({ events }) => ({ fingerprints: events.map((item) => ({ eventId: item.event.lifeEventId, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, evidenceFamilies: ['FOUNDATION', 'DASHA'], evidenceFingerprint: {}, qualityFlags: [] })) }),
    annotateCandidates: async ({ events }) => [{ candidateId: 'candidate-a', matchedEventIds: events.map((item) => item.event.lifeEventId), matchedEvidenceFamilies: ['FOUNDATION', 'DASHA'], unmatchedEvidenceFamilies: [], patternStrength: 'MODERATE', historicalConsistency: 'BOUNDED', tieBreakEligible: true, qualityFlags: [], contradictionFlags: [] }],
  });
  const mixed = [event('a', date('DAY', 2020, 1, 1)), event('b', date('MONTH', 2021, 1)), event('c', date('YEAR', 2022))];
  const blocked = await fixture(mixed).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: familyAdapter, primaryCandidates: candidates });
  assert.equal(blocked.thresholdLevel, 'PATTERN_ELIGIBLE');
  assert.equal(blocked.customerDisplayEligible, false);
  assert.deepEqual(blocked.customerDisplayReadiness[0].reasonCodes, ['INSUFFICIENT_PRECISE_MATCHES']);
  const precise = [event('a', date('DAY', 2020, 1, 1)), event('b', date('MONTH', 2021, 1)), event('c', date('DAY', 2022, 1, 1))];
  const allowed = await fixture(precise).coordinator.calibrate({ principal: {}, birthProfileId: 'profile-a', adapter: familyAdapter, primaryCandidates: candidates });
  assert.equal(allowed.customerDisplayEligible, true);
});
