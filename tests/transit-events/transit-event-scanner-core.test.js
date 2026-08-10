'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AstronomicalEngine } = require('../../src/astronomy');
const { calculateRashiHouses } = require('../../src/bhava');
const { scanTransitEvents } = require('../../src/transit-events');
const { order, deduplicate } = require('../../src/transit-events/event-ordering');
const { DeterministicTransitProvider } = require('./fixtures/deterministic-transit-provider');

const START = '2024-01-01T00:00:00.000Z';
const END = '2024-01-01T04:00:00.000Z';
const COVERAGE_END = '2024-01-01T05:00:00.000Z';
const OBSERVER = { latitude: 17.385, longitude: 78.4867 };
const BODY_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

function body(longitude, motion = 'direct') {
  return { siderealLongitudeDegrees: longitude, motion, longitudeSpeedDegreesPerDay: motion === 'retrograde' ? -1 : 1 };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

const natalBodies = deepFreeze({
  Ascendant: body(330), Sun: body(210), Moon: body(300), Mars: body(30), Mercury: body(210),
  Jupiter: body(90), Venus: body(210), Saturn: body(240), Rahu: body(270, 'retrograde'), Ketu: body(90, 'retrograde'),
});
const natalHouses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: 330, bodies: natalBodies });

function engineFor(trajectories, fixtureOptions = {}) {
  return new AstronomicalEngine(new DeterministicTransitProvider({ trajectories, ...fixtureOptions }));
}

function scan({ trajectories = {}, fixtureOptions = {}, eventTypes = ['retrogradeStation', 'directStation'], options = {} } = {}) {
  return scanTransitEvents({
    startInstant: START,
    endInstant: END,
    natalBodies,
    natalHouses,
    astronomicalEngine: engineFor(trajectories, fixtureOptions),
    observer: OBSERVER,
    eventTypes,
    options,
  });
}

function linear(startInstant, endInstant, startLongitudeDegrees, longitudeRateDegreesPerDay) {
  return { type: 'linear', startInstant, endInstant, startLongitudeDegrees, longitudeRateDegreesPerDay };
}

function stationary(startInstant, endInstant, longitudeDegrees) {
  return { type: 'stationary', startInstant, endInstant, longitudeDegrees };
}

function milliseconds(instant) {
  return Date.parse(instant);
}

function assertWithinOneSecond(actual, expected) {
  assert.ok(Math.abs(milliseconds(actual) - milliseconds(expected)) <= 1000, `${actual} must be within one second of ${expected}`);
}

function onlyStation(result) {
  assert.equal(result.events.length, 1);
  return result.events[0];
}

test('emits one refined direct-to-retrograde station without a stationary provider state', () => {
  const transition = '2024-01-01T01:30:00.000Z';
  const result = scan({ trajectories: { Jupiter: [
    linear(START, transition, 20, 1),
    linear(transition, COVERAGE_END, 21.5, -1),
  ] } });
  const event = onlyStation(result);

  assert.deepEqual(Object.keys(event).sort(), [
    'body', 'directionConfirmationInstant', 'eventType', 'fromMotion', 'instant', 'longitudeSpeedDegreesPerDay',
    'providerMotionAtInstant', 'stationWindowEntryInstant', 'toMotion',
  ]);
  assert.equal(event.eventType, 'retrogradeStation');
  assert.equal(event.fromMotion, 'direct');
  assert.equal(event.toMotion, 'retrograde');
  assert.equal(event.stationWindowEntryInstant, null);
  assertWithinOneSecond(event.instant, transition);
  assertWithinOneSecond(event.directionConfirmationInstant, transition);
  assert.equal(event.providerMotionAtInstant, 'retrograde');
  assert.equal(event.longitudeSpeedDegreesPerDay, -1);
});

test('emits one refined retrograde-to-direct station without a stationary provider state', () => {
  const transition = '2024-01-01T01:30:00.000Z';
  const event = onlyStation(scan({ trajectories: { Jupiter: [
    linear(START, transition, 22, -1),
    linear(transition, COVERAGE_END, 20.5, 1),
  ] } }));

  assert.equal(event.eventType, 'directStation');
  assert.equal(event.fromMotion, 'retrograde');
  assert.equal(event.toMotion, 'direct');
  assert.equal(event.stationWindowEntryInstant, null);
  assertWithinOneSecond(event.instant, transition);
  assertWithinOneSecond(event.directionConfirmationInstant, transition);
  assert.equal(event.providerMotionAtInstant, 'direct');
});

test('coalesces direct-to-stationary-to-retrograde into one station with accurate entry and confirmation instants', () => {
  const entry = '2024-01-01T01:15:00.000Z';
  const confirmation = '2024-01-01T02:45:00.000Z';
  const event = onlyStation(scan({ trajectories: { Jupiter: [
    linear(START, entry, 20, 1),
    stationary(entry, confirmation, 21.25),
    linear(confirmation, COVERAGE_END, 21.25, -1),
  ] } }));

  assert.equal(event.eventType, 'retrogradeStation');
  assert.deepEqual({ fromMotion: event.fromMotion, toMotion: event.toMotion }, { fromMotion: 'direct', toMotion: 'retrograde' });
  assertWithinOneSecond(event.instant, entry);
  assertWithinOneSecond(event.stationWindowEntryInstant, entry);
  assertWithinOneSecond(event.directionConfirmationInstant, confirmation);
  assert.equal(event.providerMotionAtInstant, 'stationary');
  assert.equal(event.longitudeSpeedDegreesPerDay, 0);
});

test('coalesces retrograde-to-stationary-to-direct into one station with accurate entry and confirmation instants', () => {
  const entry = '2024-01-01T00:30:00.000Z';
  const confirmation = '2024-01-01T03:30:00.000Z';
  const event = onlyStation(scan({ trajectories: { Jupiter: [
    linear(START, entry, 22, -1),
    stationary(entry, confirmation, 20.75),
    linear(confirmation, COVERAGE_END, 20.75, 1),
  ] } }));

  assert.equal(event.eventType, 'directStation');
  assert.deepEqual({ fromMotion: event.fromMotion, toMotion: event.toMotion }, { fromMotion: 'retrograde', toMotion: 'direct' });
  assertWithinOneSecond(event.instant, entry);
  assertWithinOneSecond(event.stationWindowEntryInstant, entry);
  assertWithinOneSecond(event.directionConfirmationInstant, confirmation);
  assert.equal(event.providerMotionAtInstant, 'stationary');
  assert.equal(event.longitudeSpeedDegreesPerDay, 0);
});

test('does not duplicate a station through multiple stationary coarse samples', () => {
  const event = onlyStation(scan({ trajectories: { Jupiter: [
    linear(START, '2024-01-01T00:30:00.000Z', 20, 1),
    stationary('2024-01-01T00:30:00.000Z', '2024-01-01T03:30:00.000Z', 20.5),
    linear('2024-01-01T03:30:00.000Z', COVERAGE_END, 20.5, -1),
  ] } }));

  assert.equal(event.eventType, 'retrogradeStation');
  assertWithinOneSecond(event.stationWindowEntryInstant, '2024-01-01T00:30:00.000Z');
  assertWithinOneSecond(event.directionConfirmationInstant, '2024-01-01T03:30:00.000Z');
});

test('validates coarse scan and refinement options while retaining approved defaults', () => {
  for (const coarseScanStepMilliseconds of [3600000]) {
    assert.equal(scan({ options: { coarseScanStepMilliseconds } }).configuration.coarseScanStepMilliseconds, coarseScanStepMilliseconds);
  }
  for (const invalid of [3600001, 0, -1, NaN, Infinity]) {
    assert.throws(() => scan({ options: { coarseScanStepMilliseconds: invalid } }), RangeError);
  }
  assert.equal(scan({ options: { refinementToleranceMilliseconds: 250, maximumRefinementIterations: 8 } }).configuration.refinementToleranceMilliseconds, 250);
  assert.equal(scan({ options: { refinementToleranceMilliseconds: 250, maximumRefinementIterations: 8 } }).configuration.maximumRefinementIterations, 8);
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.throws(() => scan({ options: { refinementToleranceMilliseconds: invalid } }), RangeError);
  }
  for (const invalid of [0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => scan({ options: { maximumRefinementIterations: invalid } }), RangeError);
  }
  const result = scan();
  assert.deepEqual(result.configuration, {
    coarseScanStepMilliseconds: 3600000,
    refinementToleranceMilliseconds: 1000,
    maximumRefinementIterations: 32,
  });
});

test('rejects invalid provider results explicitly through the Layer 1 provider boundary', () => {
  const nativeMetadata = { ayanamshaSystem: 'fixture-native', calculationStatus: 'PROVISIONAL' };
  const invalidBodies = [
    { description: 'non-finite canonical longitude', output: { body: 'Jupiter', siderealLongitudeDegrees: NaN, siderealMetadata: nativeMetadata, motion: 'direct', longitudeSpeedDegreesPerDay: 1 } },
    { description: 'infinite canonical longitude', output: { body: 'Jupiter', siderealLongitudeDegrees: Infinity, siderealMetadata: nativeMetadata, motion: 'direct', longitudeSpeedDegreesPerDay: 1 } },
    { description: 'malformed body result', output: null },
    { description: 'unsupported provider state', output: { body: 'Jupiter', siderealLongitudeDegrees: 20, siderealMetadata: nativeMetadata, motion: 'unsupported', longitudeSpeedDegreesPerDay: 1 } },
    { description: 'invalid longitude speed', output: { body: 'Jupiter', siderealLongitudeDegrees: 20, siderealMetadata: nativeMetadata, motion: 'direct', longitudeSpeedDegreesPerDay: Infinity } },
    { description: 'missing longitude speed', output: { body: 'Jupiter', siderealLongitudeDegrees: 20, siderealMetadata: nativeMetadata, motion: 'direct' } },
  ];
  for (const invalid of invalidBodies) {
    assert.throws(() => scan({ trajectories: { Jupiter: [{ type: 'explicit-invalid', startInstant: START, endInstant: COVERAGE_END, output: invalid.output }] } }), undefined, invalid.description);
  }
  assert.throws(() => scan({ fixtureOptions: { omitBodies: ['Jupiter'] } }), /Jupiter/);
  assert.throws(() => scan({ fixtureOptions: { responseOverride: { bodies: null } } }));
});

test('preserves complete provisional Layer 1 provenance and is deeply immutable', () => {
  const result = scan({ trajectories: { Jupiter: [
    linear(START, '2024-01-01T01:00:00.000Z', 20, 1),
    linear('2024-01-01T01:00:00.000Z', COVERAGE_END, 21, -1),
  ] } });

  assert.deepEqual(result.provenance, {
    providerIndependent: false,
    astronomicalCalculation: 'delegated-to-layer-1',
    ayanamshaCalculation: 'delegated-to-layer-1',
    gocharCalculation: 'delegated-to-layer-9',
    eventScanning: 'layer10-transition-refinement-v1',
    coarseScanStepMilliseconds: 3600000,
    refinementToleranceMilliseconds: 1000,
    maximumRefinementIterations: 32,
    eventTimeSemantics: 'refined-first-instant-new-state-active',
    calculationStatus: 'PROVISIONAL',
    provider: {
      provider: 'deterministic-transit-test-provider', providerVersion: 'test-v1', ephemerisVersion: 'synthetic-piecewise',
      calculationMode: 'test-only', calculationStatus: 'PROVISIONAL',
    },
  });
  assert.equal(result.provenance.provider.calculationMode, 'test-only');
  for (const value of [result, result.events, result.events[0], result.provenance, result.provenance.provider, result.configuration]) {
    assert.equal(Object.isFrozen(value), true);
  }
});

test('does not mutate deeply frozen scan inputs and produces identical deterministic results', () => {
  const trajectories = Object.freeze({ Jupiter: Object.freeze([
    Object.freeze(linear(START, '2024-01-01T01:00:00.000Z', 20, 1)),
    Object.freeze(linear('2024-01-01T01:00:00.000Z', COVERAGE_END, 21, -1)),
  ]) });
  const options = Object.freeze({ coarseScanStepMilliseconds: 3600000, refinementToleranceMilliseconds: 1000, maximumRefinementIterations: 32 });
  const observer = Object.freeze({ ...OBSERVER });
  const input = Object.freeze({ startInstant: START, endInstant: END, natalBodies, natalHouses, observer, options });
  const execute = () => scanTransitEvents({
    ...input,
    astronomicalEngine: engineFor(trajectories),
    eventTypes: ['retrogradeStation'],
  });
  const first = execute();
  const second = execute();

  assert.deepEqual(first, second);
  assert.equal(input.startInstant, START);
  assert.equal(input.endInstant, END);
  assert.equal(natalBodies.Moon.siderealLongitudeDegrees, 300);
  assert.equal(natalHouses.houses[0].houseNumber, 1);
  assert.equal(trajectories.Jupiter[0].startLongitudeDegrees, 20);
  assert.equal(options.maximumRefinementIterations, 32);
  assert.equal(observer.longitude, 78.4867);
});

test('uses the approved event order and only deduplicates equal logical identities', () => {
  const instant = '2024-01-01T00:00:00.000Z';
  const allTypes = [
    'transitDrishtiStart', 'sameRashiAssociationStart', 'transitDrishtiEnd', 'sameRashiAssociationEnd',
    'sadeSatiPhaseChange', 'rashiIngress', 'directStation', 'retrogradeStation',
  ].map((eventType) => ({ eventType, instant, body: 'Jupiter' }));
  assert.deepEqual(allTypes.sort(order).map((event) => event.eventType), [
    'retrogradeStation', 'directStation', 'rashiIngress', 'sadeSatiPhaseChange',
    'sameRashiAssociationEnd', 'sameRashiAssociationStart', 'transitDrishtiEnd', 'transitDrishtiStart',
  ]);
  const deduplicated = deduplicate([
    { eventType: 'rashiIngress', instant, body: 'Jupiter' },
    { eventType: 'rashiIngress', instant, body: 'Jupiter' },
    { eventType: 'rashiIngress', instant, body: 'Saturn' },
  ]).sort(order);
  assert.equal(deduplicated.length, 2);
  assert.deepEqual(deduplicated.map((event) => event.body), ['Jupiter', 'Saturn']);
});
