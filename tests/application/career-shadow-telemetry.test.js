'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { AnalyticsEventRecorder } = require('../../src/analytics/analytics-event-recorder');
const { shadowComparison, normalizeShadowError, SHADOW_DASHBOARD_METRICS } = require('../../src/application/career-timing');

const START = '2026-01-01T00:00:00.000Z';
const MID = '2026-01-10T00:00:00.000Z';
const END = '2026-01-20T00:00:00.000Z';

test('shadow comparison emits categories and counts without dates or identifiers', () => {
  const result = shadowComparison({
    referenceInstant: MID,
    legacyTiming: { periods: [{ startDate: START, endDate: END, evidenceState: 'SUPPORTIVE' }] },
    careerTiming: { periods: [{ strongestWindow: {} }], current: { eligiblePeriod: { start: START, end: END, internalState: 'SUPPORTIVE' } }, next: null },
  });
  assert.equal(result.currentComparison, 'CURRENT_MATCH');
  assert.equal(result.nextComparison, 'NEXT_MATCH');
  assert.equal(result.canonicalStrongestPresent, true);
  assert.equal(JSON.stringify(result).includes('2026-'), false);
  assert.equal(JSON.stringify(result).match(/profile|user|birth|dasha|transit/i), null);
});

test('shadow comparison classifies availability and state differences', () => {
  const legacyOnly = shadowComparison({ referenceInstant: MID, legacyTiming: { periods: [{ startDate: START, endDate: END, evidenceState: 'LEGACY' }] }, careerTiming: { periods: [], current: null, next: null } });
  assert.equal(legacyOnly.currentComparison, 'CURRENT_LEGACY_ONLY');
  const different = shadowComparison({ referenceInstant: MID, legacyTiming: { periods: [{ startDate: START, endDate: END, evidenceState: 'LEGACY' }] }, careerTiming: { periods: [{ strongestWindow: null }], current: { eligiblePeriod: { start: START, end: END, internalState: 'CANONICAL' } }, next: null } });
  assert.equal(different.currentComparison, 'CURRENT_STATE_DIFFERENT');
});

test('shadow failures normalize to the closed safe error-code allowlist', () => {
  assert.equal(normalizeShadowError({ code: 'CAREER_V2_ELIGIBILITY_FAILURE' }), 'CAREER_V2_ELIGIBILITY_FAILURE');
  assert.equal(normalizeShadowError({ code: 'private-db-message' }), 'CAREER_V2_CONSUMER_ADAPTATION_FAILURE');
  assert.ok(SHADOW_DASHBOARD_METRICS.includes('career_timing_v2_shadow.duration_ms.p95'));
});

test('analytics recorder forwards only aggregate shadow properties', async () => {
  const calls = [];
  const recorder = new AnalyticsEventRecorder({ provider: { track: async (name, properties) => calls.push({ name, properties }) } });
  await recorder.record('career_timing_v2_shadow', {
    mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12, parent_count: 2,
    current_comparison: 'CURRENT_MATCH', fallback_occurred: false,
    birth_profile_id: 'must-not-be-supplied-by-shadow-observer',
    rawDasha: 'secret', prompt: 'secret', stack: 'secret',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].properties.rawDasha, undefined);
  assert.equal(calls[0].properties.prompt, undefined);
  assert.equal(calls[0].properties.stack, undefined);
  assert.equal(calls[0].properties.birth_profile_id, undefined);
  assert.equal(calls[0].properties.mode, 'SHADOW');
});

test('analytics recorder omits undefined optional shadow fields', async () => {
  const calls = [];
  const recorder = new AnalyticsEventRecorder({ provider: { track: async (name, properties) => calls.push({ name, properties }) } });
  await recorder.record('career_timing_v2_shadow', {
    mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12,
    error_code: undefined,
  });
  assert.deepEqual(calls, [{
    name: 'career_timing_v2_shadow',
    properties: { mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12 },
  }]);
});

test('career shadow event schema rejects every prohibited scalar or nested property', async () => {
  const calls = [];
  const recorder = new AnalyticsEventRecorder({ provider: { track: async (name, properties) => calls.push({ name, properties }) } });
  await recorder.record('career_timing_v2_shadow', {
    mode: 'SHADOW', status: 'SUCCEEDED', contract_version: 'career-timing-production-v1', timing_engine_version: 'career-timing-v2-production-1',
    user_id: 'user', birth_profile_id: 'profile', reading_id: 'reading', name: 'name',
    email: 'email', phone: 'phone', company: 'company', salary: 1, priorities: 'priority',
    start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z',
    prompt: 'prompt', exception: 'exception', stack: 'stack', raw_periods: 'periods',
    nested: { birthData: {}, d1: {}, d10: {}, dasha: {}, transit: {}, historicalEvents: [] },
  });
  assert.deepEqual(calls[0].properties, { mode: 'SHADOW', status: 'SUCCEEDED', contract_version: 'career-timing-production-v1', timing_engine_version: 'career-timing-v2-production-1' });
});

test('telemetry provider failure is contained at the analytics boundary', async () => {
  const recorder = new AnalyticsEventRecorder({ provider: { async track() { throw new Error('provider unavailable'); } } });
  await assert.doesNotReject(recorder.record('career_timing_v2_shadow', { mode: 'SHADOW', status: 'FAILED', fallback_occurred: true }));
});
