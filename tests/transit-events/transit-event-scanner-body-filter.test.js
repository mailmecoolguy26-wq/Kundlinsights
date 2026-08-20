'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine } = require('../../src/astronomy');
const { calculateRashiHouses } = require('../../src/bhava');
const { scanTransitEvents } = require('../../src/transit-events');
const { DeterministicTransitProvider } = require('./fixtures/deterministic-transit-provider');

const START = '2024-01-01T00:00:00.000Z';
const END = '2024-01-01T02:00:00.000Z';
const COVERAGE_END = '2024-01-01T03:00:00.000Z';
const NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const OBSERVER = { latitude: 17.385, longitude: 78.4867 };
const body = (longitude, motion = 'direct') => ({ siderealLongitudeDegrees: longitude, motion, longitudeSpeedDegreesPerDay: motion === 'retrograde' ? -1 : 1 });
const natalBodies = Object.freeze({ Ascendant: body(330), Sun: body(210), Moon: body(300), Mars: body(30), Mercury: body(210), Jupiter: body(90), Venus: body(210), Saturn: body(240), Rahu: body(270, 'retrograde'), Ketu: body(90, 'retrograde') });
const natalHouses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: 330, bodies: natalBodies });

function ingress(startLongitude) {
  return [{ type: 'linear', startInstant: START, endInstant: COVERAGE_END, startLongitudeDegrees: startLongitude, longitudeRateDegreesPerDay: 48 }];
}

function scan({ bodies } = {}) {
  const provider = new DeterministicTransitProvider({ trajectories: { Jupiter: ingress(29), Saturn: ingress(59) } });
  const result = scanTransitEvents({
    startInstant: START,
    endInstant: END,
    natalBodies,
    natalHouses,
    astronomicalEngine: new AstronomicalEngine(provider),
    observer: OBSERVER,
    eventTypes: ['rashiIngress'],
    ...(bodies === undefined ? {} : { bodies }),
  });
  return { result, provider };
}

test('omitted body filter retains full supported-body scanning', () => {
  const { result, provider } = scan();
  assert.deepEqual(result.events.map((event) => event.body), ['Jupiter', 'Saturn']);
  assert.ok(provider.requestedBodies.every((bodies) => JSON.stringify(bodies) === JSON.stringify(NAMES)));
});

test('single selected body scans only Jupiter', () => {
  const { result, provider } = scan({ bodies: ['Jupiter'] });
  assert.deepEqual(result.events.map((event) => event.body), ['Jupiter']);
  assert.ok(provider.requestedBodies.every((bodies) => JSON.stringify(bodies) === JSON.stringify(['Jupiter'])));
});

test('multiple selected bodies scan only selected canonical bodies', () => {
  const { result, provider } = scan({ bodies: ['Saturn', 'Jupiter'] });
  assert.deepEqual(result.events.map((event) => event.body), ['Jupiter', 'Saturn']);
  assert.ok(provider.requestedBodies.every((bodies) => JSON.stringify(bodies) === JSON.stringify(['Jupiter', 'Saturn'])));
});

test('duplicate selected bodies are deterministically deduplicated without duplicate events', () => {
  const duplicate = scan({ bodies: ['Jupiter', 'Jupiter', 'Saturn'] });
  const canonical = scan({ bodies: ['Saturn', 'Jupiter'] });
  assert.deepEqual(duplicate.result, canonical.result);
  assert.deepEqual(duplicate.provider.requestedBodies, canonical.provider.requestedBodies);
});

test('unsupported selected body is rejected', () => {
  assert.throws(() => scan({ bodies: ['Pluto'] }), /Unsupported transit body/);
});

test('empty selected body list is rejected', () => {
  assert.throws(() => scan({ bodies: [] }), /non-empty array/);
});

test('unselected bodies never enter scanner event output', () => {
  const { result } = scan({ bodies: ['Jupiter'] });
  assert.equal(result.events.some((event) => NAMES.filter((name) => name !== 'Jupiter').includes(event.body)), false);
});
