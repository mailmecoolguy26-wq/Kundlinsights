'use strict';

const { EphemerisProvider } = require('../../../src/astronomy/ephemeris-provider');

const BODIES = Object.freeze([
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant',
]);

function normalize(longitudeDegrees) {
  return ((longitudeDegrees % 360) + 360) % 360;
}

function milliseconds(utcInstant) {
  const result = Date.parse(utcInstant);
  if (!Number.isFinite(result)) throw new TypeError('Trajectory instant must be valid UTC.');
  return result;
}

// Every non-final segment is half-open: [startInstant, endInstant).
function segmentValue(segment, time) {
  const start = milliseconds(segment.startInstant);
  const end = milliseconds(segment.endInstant);
  if (time < start || time >= end) return null;

  if (segment.type === 'explicit-invalid') return segment.output;
  if (segment.type === 'stationary') {
    return { longitude: segment.longitudeDegrees, speed: 0, motion: 'stationary' };
  }
  if (segment.type === 'linear') {
    const rate = segment.longitudeRateDegreesPerDay;
    return {
      longitude: segment.startLongitudeDegrees + rate * ((time - start) / 86400000),
      speed: rate,
      motion: rate < 0 ? 'retrograde' : 'direct',
    };
  }
  throw new TypeError(`Unsupported trajectory type: ${segment.type}`);
}

class DeterministicTransitProvider extends EphemerisProvider {
  constructor({
    trajectories = {},
    provider = 'deterministic-transit-test-provider',
    omitBodies = [],
    responseOverride = null,
  } = {}) {
    super();
    this.trajectories = trajectories;
    this.omitBodies = omitBodies;
    this.responseOverride = responseOverride;
    this.requestedBodies = [];
    this.metadata = Object.freeze({
      provider,
      providerVersion: 'test-v1',
      ephemerisVersion: 'synthetic-piecewise',
      calculationMode: 'test-only',
      calculationStatus: 'PROVISIONAL',
    });
  }

  calculate({ instant, observer, bodies: requestedBodies }) { // observer is accepted to match the Layer 1 provider contract.
    if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
      throw new TypeError('instant is required.');
    }

    const time = instant.getTime();
    const bodies = {};
    const selectedBodies = requestedBodies === undefined ? BODIES : requestedBodies;
    this.requestedBodies.push([...selectedBodies]);
    for (const body of selectedBodies) {
      const segments = this.trajectories[body] || [{
        type: 'stationary',
        startInstant: '2000-01-01T00:00:00.000Z',
        endInstant: '2100-01-01T00:00:00.000Z',
        longitudeDegrees: 0,
      }];
      let value = null;
      for (const segment of segments) {
        value = segmentValue(segment, time);
        if (value !== null) break;
      }
      if (value === null) throw new RangeError(`No trajectory segment covers ${body} at requested instant.`);
      if (value && value.body) {
        bodies[body] = value;
        continue;
      }

      const longitude = normalize(value.longitude);
      bodies[body] = {
        body,
        tropicalLongitudeDegrees: longitude,
        siderealLongitudeDegrees: longitude,
        siderealMetadata: {
          ayanamshaSystem: 'fixture-native',
          calculationStatus: 'PROVISIONAL',
          provisional: true,
        },
        longitudeSpeedDegreesPerDay: value.speed,
        motion: value.motion,
        coordinateSystem: 'synthetic-canonical-sidereal',
      };
    }

    for (const body of this.omitBodies) delete bodies[body];
    const response = { bodies, provider: this.metadata };
    return this.responseOverride || response;
  }
}

module.exports = { DeterministicTransitProvider, BODIES, normalize };
