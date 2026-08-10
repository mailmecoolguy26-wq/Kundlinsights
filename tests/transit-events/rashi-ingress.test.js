'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { START, END, COVERAGE_END, createScan, linear, stationary, withinSecond } = require('./fixtures/transit-scan-helpers');

function ingressScan(segments) {
  return createScan({ trajectories: { Jupiter: segments }, eventTypes: ['rashiIngress'] });
}

test('refines direct and retrograde Rashi ingress at the Layer 2 half-open boundary', () => {
  const boundary = '2024-02-01T02:00:00.000Z';
  const direct = ingressScan([linear(START, COVERAGE_END, 29, 12)]).events;
  const retrograde = ingressScan([linear(START, COVERAGE_END, 31, -12)]).events;

  assert.equal(direct.length, 1);
  assert.deepEqual(
    { from: direct[0].fromRashi.rashiIndex, to: direct[0].toRashi.rashiIndex, direction: direct[0].direction, motion: direct[0].providerMotion },
    { from: 1, to: 2, direction: 'direct', motion: 'direct' },
  );
  assert.equal(direct[0].provenance, 'layer2-rashi-transition');
  assert.ok(withinSecond(direct[0].instant, boundary));
  assert.equal(retrograde.length, 1);
  assert.deepEqual(
    { from: retrograde[0].fromRashi.rashiIndex, to: retrograde[0].toRashi.rashiIndex, direction: retrograde[0].direction },
    { from: 2, to: 1, direction: 'retrograde' },
  );
  assert.ok(withinSecond(retrograde[0].instant, boundary));
});

test('handles direct and retrograde zodiac wraparound without phantom Rashis', () => {
  const boundary = '2024-02-01T02:00:00.000Z';
  const direct = ingressScan([linear(START, COVERAGE_END, 359, 12)]).events;
  const retrograde = ingressScan([linear(START, COVERAGE_END, 1, -12)]).events;

  assert.deepEqual(direct.map((event) => [event.fromRashi.rashiIndex, event.toRashi.rashiIndex]), [[12, 1]]);
  assert.deepEqual(retrograde.map((event) => [event.fromRashi.rashiIndex, event.toRashi.rashiIndex]), [[1, 12]]);
  assert.ok(withinSecond(direct[0].instant, boundary));
  assert.ok(withinSecond(retrograde[0].instant, boundary));
});

test('retains repeated direct and retrograde re-entry crossings as distinct ingress events', () => {
  const result = ingressScan([
    linear(START, '2024-02-01T01:00:00.000Z', 29, 48),
    stationary('2024-02-01T01:00:00.000Z', '2024-02-01T01:15:00.000Z', 31),
    linear('2024-02-01T01:15:00.000Z', '2024-02-01T02:15:00.000Z', 31, -48),
    stationary('2024-02-01T02:15:00.000Z', '2024-02-01T02:30:00.000Z', 29),
    linear('2024-02-01T02:30:00.000Z', COVERAGE_END, 29, 48),
  ]);

  assert.equal(result.events.length, 3);
  assert.deepEqual(result.events.map((event) => [event.fromRashi.rashiIndex, event.toRashi.rashiIndex]), [[1, 2], [2, 1], [1, 2]]);
  assert.deepEqual(result.events.map((event) => event.direction), ['direct', 'retrograde', 'direct']);
  for (const [event, expected] of result.events.map((event, index) => [event, ['2024-02-01T00:30:00.000Z', '2024-02-01T01:45:00.000Z', '2024-02-01T03:00:00.000Z'][index]])) {
    assert.ok(withinSecond(event.instant, expected));
  }
});

test('does not collapse multiple genuine crossings occurring in separate approved coarse intervals', () => {
  const result = ingressScan([linear(START, COVERAGE_END, 29, 720)]);
  assert.equal(result.events.length, 4);
  assert.deepEqual(result.events.map((event) => event.toRashi.rashiIndex), [2, 3, 4, 5]);
  assert.ok(result.events.every((event) => Date.parse(event.instant) <= Date.parse(END)));
});
