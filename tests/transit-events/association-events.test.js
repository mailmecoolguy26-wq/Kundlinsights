'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { START, COVERAGE_END, createScan, linear, stationary, withinSecond } = require('./fixtures/transit-scan-helpers');

function associations(segments, natalLongitudes = {}) {
  return createScan({
    trajectories: { Jupiter: segments },
    natalLongitudes,
    eventTypes: ['sameRashiAssociationEnd', 'sameRashiAssociationStart'],
  });
}

function assertEvent(event, transition, motion, instant, transitRashiIndex) {
  assert.equal(event.transition, transition);
  assert.equal(event.transitBody, 'Jupiter');
  assert.equal(event.providerMotion, motion);
  assert.equal(event.provenance, 'layer9-same-rashi-transition');
  assert.equal(event.transitRashi.rashiIndex, transitRashiIndex);
  assert.equal(event.natalRashi.rashiIndex, 2);
  assert.equal(typeof event.angularSeparationDegrees, 'number');
  assert.ok(withinSecond(event.instant, instant));
}

test('refines direct and retrograde same-Rashi association starts and ends without degree orbs', () => {
  const natalLongitudes = { Sun: 35 };
  const directStart = associations([linear(START, COVERAGE_END, 29, 12)], natalLongitudes).events.find((event) => event.natalBody === 'Sun');
  const directEnd = associations([linear(START, COVERAGE_END, 59, 12)], natalLongitudes).events.find((event) => event.natalBody === 'Sun');
  const retrogradeStart = associations([linear(START, COVERAGE_END, 61, -12)], natalLongitudes).events.find((event) => event.natalBody === 'Sun');
  const retrogradeEnd = associations([linear(START, COVERAGE_END, 31, -12)], natalLongitudes).events.find((event) => event.natalBody === 'Sun');

  assertEvent(directStart, 'start', 'direct', '2024-02-01T02:00:00.000Z', 2);
  assertEvent(directEnd, 'end', 'direct', '2024-02-01T02:00:00.000Z', 3);
  assertEvent(retrogradeStart, 'start', 'retrograde', '2024-02-01T02:00:00.000Z', 2);
  assertEvent(retrogradeEnd, 'end', 'retrograde', '2024-02-01T02:00:00.000Z', 1);
});

test('keeps multiple natal bodies in one Rashi independent and emits no empty association', () => {
  const multiple = associations([linear(START, COVERAGE_END, 29, 12)], { Sun: 35, Mercury: 45 }).events;
  const matching = multiple.filter((event) => ['Mercury', 'Sun'].includes(event.natalBody));
  assert.equal(matching.length, 2);
  assert.deepEqual(matching.map((event) => event.natalBody), ['Mercury', 'Sun']);

  const empty = associations([linear(START, COVERAGE_END, 29, 12)], {
    Sun: 90, Moon: 90, Mars: 90, Mercury: 90, Jupiter: 90, Venus: 90, Saturn: 90, Rahu: 90, Ketu: 90,
  }).events;
  assert.deepEqual(empty, []);
});

test('refines a Meena-to-Mesha wraparound association start without an intermediate Rashi', () => {
  const events = associations([linear(START, COVERAGE_END, 359, 12)], { Sun: 5 }).events
    .filter((event) => event.natalBody === 'Sun');
  assert.equal(events.length, 1);
  assert.equal(events[0].transition, 'start');
  assert.deepEqual([events[0].transitRashi.rashiIndex, events[0].natalRashi.rashiIndex], [1, 1]);
  assert.ok(withinSecond(events[0].instant, '2024-02-01T02:00:00.000Z'));
});

test('retains association start, end, and re-entry start as separate refined relationships', () => {
  const result = associations([
    linear(START, '2024-02-01T01:00:00.000Z', 29, 48),
    stationary('2024-02-01T01:00:00.000Z', '2024-02-01T01:15:00.000Z', 31),
    linear('2024-02-01T01:15:00.000Z', '2024-02-01T02:15:00.000Z', 31, -48),
    stationary('2024-02-01T02:15:00.000Z', '2024-02-01T02:30:00.000Z', 29),
    linear('2024-02-01T02:30:00.000Z', COVERAGE_END, 29, 48),
  ], { Sun: 35 });

  const events = result.events.filter((event) => event.natalBody === 'Sun');
  assert.deepEqual(events.map((event) => event.transition), ['start', 'end', 'start']);
  for (const [event, instant] of events.map((event, index) => [event, ['2024-02-01T00:30:00.000Z', '2024-02-01T01:45:00.000Z', '2024-02-01T03:00:00.000Z'][index]])) {
    assert.ok(withinSecond(event.instant, instant));
  }
});
