'use strict';

const { AstronomicalEngine } = require('../../../src/astronomy');
const { calculateRashiHouses } = require('../../../src/bhava');
const { scanTransitEvents } = require('../../../src/transit-events');
const { DeterministicTransitProvider } = require('./deterministic-transit-provider');

const START = '2024-02-01T00:00:00.000Z';
const END = '2024-02-01T04:00:00.000Z';
const COVERAGE_END = '2024-02-01T05:00:00.000Z';
const OBSERVER = Object.freeze({ latitude: 17.385, longitude: 78.4867 });
const BODY_NAMES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

function nativeBody(longitude, motion = 'direct') {
  return { siderealLongitudeDegrees: longitude, motion, longitudeSpeedDegreesPerDay: motion === 'retrograde' ? -1 : 1 };
}

function natalContext(longitudes = {}) {
  const defaults = { Ascendant: 330, Sun: 210, Moon: 300, Mars: 30, Mercury: 150, Jupiter: 90, Venus: 240, Saturn: 270, Rahu: 60, Ketu: 120 };
  const bodies = Object.fromEntries(Object.entries({ ...defaults, ...longitudes }).map(([body, longitude]) => [body, nativeBody(longitude, body === 'Rahu' || body === 'Ketu' ? 'retrograde' : 'direct')]));
  return { bodies, houses: calculateRashiHouses({ ascendantCanonicalSiderealLongitude: bodies.Ascendant.siderealLongitudeDegrees, bodies }) };
}

function linear(startInstant, endInstant, startLongitudeDegrees, longitudeRateDegreesPerDay) {
  return { type: 'linear', startInstant, endInstant, startLongitudeDegrees, longitudeRateDegreesPerDay };
}

function stationary(startInstant, endInstant, longitudeDegrees) {
  return { type: 'stationary', startInstant, endInstant, longitudeDegrees };
}

function createScan({ trajectories = {}, natalLongitudes = {}, eventTypes, startInstant = START, endInstant = END, bodies, options = {}, provider } = {}) {
  const natal = natalContext(natalLongitudes);
  const astronomicalEngine = new AstronomicalEngine(provider || new DeterministicTransitProvider({ trajectories }));
  return scanTransitEvents({
    startInstant,
    endInstant,
    natalBodies: natal.bodies,
    natalHouses: natal.houses,
    astronomicalEngine,
    observer: OBSERVER,
    eventTypes,
    ...(bodies === undefined ? {} : { bodies }),
    options,
  });
}

function withinSecond(actual, expected) {
  return Math.abs(Date.parse(actual) - Date.parse(expected)) <= 1000;
}

module.exports = { START, END, COVERAGE_END, BODY_NAMES, createScan, linear, stationary, withinSecond };
