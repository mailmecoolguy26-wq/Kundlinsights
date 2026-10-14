'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TransitSnapshotService } = require('../../src/application/transit-snapshot');

const BODIES = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
const birthData = Object.freeze({ localDate: '1990-01-01', localTime: '12:00:00', timezone: 'Asia/Kolkata', latitude: 17.385, longitude: 78.4867 });

function engine() {
  return Object.freeze({
    calculate() {
      return Object.freeze({
        bodies: Object.freeze({
          Ascendant: Object.freeze({ siderealLongitudeDegrees: 0, longitudeSpeedDegreesPerDay: 0, motion: 'direct' }),
          ...Object.fromEntries(BODIES.map((body, index) => [body, Object.freeze({ siderealLongitudeDegrees: index * 30 + 1, longitudeSpeedDegreesPerDay: body === 'Rahu' || body === 'Ketu' ? -0.1 : 0.1, motion: body === 'Rahu' || body === 'Ketu' ? 'retrograde' : 'direct' })])),
        }),
      });
    },
  });
}

test('passes a requested node ingress scan through to the existing transit scanner', async () => {
  let input = null;
  const service = new TransitSnapshotService({
    birthProfileService: { get: async () => ({ id: 'profile-a', status: 'active', birthData }) },
    astronomicalEngine: engine(),
    transitScanner: (value) => {
      input = value;
      return Object.freeze({ events: Object.freeze([]) });
    },
  });

  await service.contextForTara({
    principal: {},
    birthProfileId: 'profile-a',
    at: '2026-10-14T00:00:00.000Z',
    horizonDays: 400,
    scanBodies: ['Rahu'],
    scanEventTypes: ['rashiIngress'],
    scanOptions: { coarseScanStepMilliseconds: 86_400_000 },
  });

  assert.deepEqual(input.bodies, ['Rahu']);
  assert.deepEqual(input.eventTypes, ['rashiIngress']);
  assert.deepEqual(input.options, { coarseScanStepMilliseconds: 86_400_000 });
  assert.equal(input.startInstant, '2026-10-14T00:00:00.000Z');
  assert.equal(input.endInstant, '2027-11-18T00:00:00.000Z');
});
