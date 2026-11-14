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
  assert.deepEqual(event, { level: 'info', message: 'career_timing_v2_shadow', msg: 'career_timing_v2_shadow', category: 'aggregate_analytics', event: 'career_timing_v2_shadow', observedAt: '2026-11-13T00:00:00.000Z', properties: { mode: 'SHADOW', status: 'SUCCEEDED', duration_ms: 12 } });
  assert.equal(JSON.stringify(event).match(/user|profile|reading|ip|cookie|request|device/i), null);
});

test('rejects unsupported events and non-scalar payloads at the provider boundary', async () => {
  const provider = new StructuredLogAnalyticsProvider({ write() {} });
  await assert.rejects(provider.track('unknown_event', {}), /Unsupported/);
  await assert.rejects(provider.track('career_timing_v2_shadow', { nested: {} }), /scalar/);
});

test('provider write failures are rejectable for the recorder to contain', async () => {
  const provider = new StructuredLogAnalyticsProvider({ write() { throw new Error('sink unavailable'); } });
  await assert.rejects(provider.track('career_timing_v2_shadow', { mode: 'SHADOW' }), /sink unavailable/);
});
