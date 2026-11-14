'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { StructuredLogAnalyticsProvider } = require('../../src/infrastructure/analytics');

test('writes one structured aggregate event without automatic identity enrichment', async () => {
  const lines = [];
  const provider = new StructuredLogAnalyticsProvider({ write: (line) => lines.push(line), clock: () => '2026-11-13T00:00:00.000Z' });
  await provider.track('career_timing_v2_shadow', { mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12 });
  assert.equal(lines.length, 1);
  const event = JSON.parse(lines[0]);
  assert.deepEqual(event, { level: 'info', message: 'career_timing_v2_shadow', msg: 'career_timing_v2_shadow', category: 'aggregate_analytics', event: 'career_timing_v2_shadow', observedAt: '2026-11-13T00:00:00.000Z', mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12, properties: { mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12 } });
  assert.equal(JSON.stringify(event).match(/user|profile|reading|ip|cookie|request|device/i), null);
});

test('rejects unsupported events and non-scalar payloads at the provider boundary', async () => {
  const provider = new StructuredLogAnalyticsProvider({ write() {} });
  await assert.rejects(provider.track('unknown_event', {}), /Unsupported/);
  await assert.rejects(provider.track('career_timing_v2_shadow', { nested: {} }), /scalar/);
  await assert.rejects(provider.track('career_timing_v2_shadow', { duration_ms: Number.NaN }), /finite scalar/);
});

test('default writer emits one complete JSON object through the console logging path', async () => {
  const original = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    await new StructuredLogAnalyticsProvider({ clock: () => '2026-11-13T00:00:00.000Z' }).track('career_timing_v2_shadow', { mode: 'SHADOW', status: 'SUCCEEDED' });
  } finally { console.log = original; }
  assert.equal(lines.length, 1);
  assert.equal(lines[0].includes('\n'), false);
  assert.equal(JSON.parse(lines[0]).event, 'career_timing_v2_shadow');
});

test('provider write failures are rejectable for the recorder to contain', async () => {
  const provider = new StructuredLogAnalyticsProvider({ write() { throw new Error('sink unavailable'); } });
  await assert.rejects(provider.track('career_timing_v2_shadow', { mode: 'SHADOW' }), /sink unavailable/);
});
