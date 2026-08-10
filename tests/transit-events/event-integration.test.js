'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { START, COVERAGE_END, createScan, linear, withinSecond } = require('./fixtures/transit-scan-helpers');

function scan() {
  return createScan({
    trajectories: { Jupiter: [linear(START, COVERAGE_END, 29, 12)] },
    natalLongitudes: { Sun: 35, Mercury: 155, Mars: 5, Venus: 5, Saturn: 5, Rahu: 5, Ketu: 5, Moon: 300, Jupiter: 5 },
    eventTypes: ['rashiIngress', 'sameRashiAssociationStart', 'sameRashiAssociationEnd', 'transitDrishtiStart', 'transitDrishtiEnd'],
  });
}

test('orders simultaneous Layer 10B event families and keeps their logical identities separate', () => {
  const result = scan();
  const instant = '2024-02-01T02:00:00.000Z';
  const atBoundary = result.events.filter((event) => withinSecond(event.instant, instant) && event.body === 'Jupiter');

  const order = ['rashiIngress', 'sameRashiAssociationEnd', 'sameRashiAssociationStart', 'transitDrishtiEnd', 'transitDrishtiStart'];
  assert.ok(atBoundary.every((event, index) => index === 0 || order.indexOf(atBoundary[index - 1].eventType) <= order.indexOf(event.eventType)));
  const selected = atBoundary.filter((event) => event.eventType === 'rashiIngress'
    || (event.eventType === 'sameRashiAssociationStart' && event.natalBody === 'Sun')
    || (event.eventType === 'transitDrishtiStart' && event.natalBody === 'Mercury'));
  assert.deepEqual(selected.map((event) => [event.eventType, event.natalBody || null]), [
    ['rashiIngress', null], ['sameRashiAssociationStart', 'Sun'], ['transitDrishtiStart', 'Mercury'],
  ]);
  assert.equal(new Set(selected.map((event) => `${event.eventType}:${event.natalBody || ''}`)).size, 3);
});

test('deep-freezes new family evidence and remains deterministic without input mutation', () => {
  const first = scan();
  const second = scan();
  assert.deepEqual(first, second);
  for (const event of first.events) {
    assert.equal(Object.isFrozen(event), true);
    for (const value of Object.values(event)) if (value && typeof value === 'object') assert.equal(Object.isFrozen(value), true);
  }
  assert.equal(Object.isFrozen(first.provenance.eventFamilies), true);
  assert.deepEqual(first.provenance.eventFamilies, {
    rashiIngress: 'layer2-rashi-transition',
    sadeSatiPhaseChange: 'layer9-sade-sati-transition',
    sameRashiAssociation: 'layer9-same-rashi-transition',
    transitDrishti: 'layer9-layer6-drishti-transition',
  });
});

test('keeps a same-instant station and ingress as separate ordered events', () => {
  const boundary = '2024-02-01T02:00:00.000Z';
  const result = createScan({
    trajectories: { Jupiter: [
      linear(START, boundary, 29, 12),
      linear(boundary, COVERAGE_END, 31, -12),
    ] },
    eventTypes: ['retrogradeStation', 'rashiIngress'],
  });
  const simultaneous = result.events.filter((event) => withinSecond(event.instant, boundary));
  assert.deepEqual(simultaneous.map((event) => event.eventType), ['retrogradeStation', 'rashiIngress']);
  assert.equal(new Set(simultaneous.map((event) => event.eventType)).size, 2);
});
