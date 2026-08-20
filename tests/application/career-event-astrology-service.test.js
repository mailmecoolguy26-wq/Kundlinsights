'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerEventAstrologyService } = require('../../src/application/career-events');
const { calculateRashiHouses } = require('../../src/bhava');
const { AstronomicalEngine } = require('../../src/astronomy');
const { DeterministicTransitProvider } = require('../transit-events/fixtures/deterministic-transit-provider');
const { createScan, linear, stationary, START, COVERAGE_END, withinSecond } = require('../transit-events/fixtures/transit-scan-helpers');

const END_OF_DAY = '2024-02-02T00:00:00.000Z';
const BIRTH = '2000-01-01T00:00:00.000Z';

function canonical(value) {
  return ((value % 360) + 360) % 360;
}

test('projects a real scanner-generated Jupiter rashi ingress into a career event astrology snapshot', async () => {
  const astronomicalEngine = new AstronomicalEngine(new DeterministicTransitProvider({
    trajectories: {
      Jupiter: [
        stationary(BIRTH, START, 29),
        linear(START, COVERAGE_END, 29, 12),
        linear(COVERAGE_END, END_OF_DAY, 31.5, 12),
        stationary(END_OF_DAY, '2100-01-01T00:00:00.000Z', 41.5),
      ],
    },
  }));
  const profile = Object.freeze({
    id: 'profile-a',
    birthData: Object.freeze({
      localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0,
    }),
  });
  const service = new CareerEventAstrologyService({
    careerEventService: Object.freeze({
      async get() {
        return Object.freeze({ id: 'event-a', birthProfileId: 'profile-a', eventDate: Object.freeze({ precision: 'DAY', year: 2024, month: 2, day: 1 }) });
      },
    }),
    birthProfileService: Object.freeze({ async get() { return profile; } }),
    astronomicalEngine,
    canonicalSiderealSunSampler: Object.freeze({
      sampleCanonicalSiderealSun: ({ instantUtc }) => Object.freeze({
        canonicalSiderealLongitudeDegrees: canonical((Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * 86_400_000)),
        provenance: Object.freeze({ providerId: 'career-event-service-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-native-sidereal' }),
      }),
    }),
    divisionalChartService: Object.freeze({ async get() { return Object.freeze({ chartType: 'D10' }); } }),
    ashtakavargaService: Object.freeze({ async get() { return Object.freeze({ sav: Object.freeze({ signScores: [] }), lagnaBav: Object.freeze({ signScores: [] }), bav: [] }); } }),
  });

  const snapshot = await service.get({ principal: Object.freeze({ subject: 'user-a' }), birthProfileId: 'profile-a', eventId: 'event-a' });
  const jupiter = snapshot.transitCoverage.bodies.find((body) => body.body === 'Jupiter');
  const ingress = jupiter.transitions.find((transition) => transition.eventType === 'rashiIngress');

  assert.ok(jupiter);
  assert.ok(ingress);
  assert.equal(ingress.body, 'Jupiter');
  assert.ok(withinSecond(ingress.instant, '2024-02-01T02:00:00.000Z'));
  assert.ok(snapshot.temporalCoverage.from <= ingress.instant);
  assert.ok(ingress.instant < snapshot.temporalCoverage.to);
  assert.equal(ingress.provenance, 'layer2-rashi-transition');
});

test('projects a real scanner-generated Jupiter retrograde station into a career event astrology snapshot', async () => {
  const stationStart = '2024-01-01T00:00:00.000Z';
  const stationEntry = '2024-01-01T01:15:00.000Z';
  const stationConfirmation = '2024-01-01T02:45:00.000Z';
  const stationCoverageEnd = '2024-01-01T05:00:00.000Z';
  const stationEndOfDay = '2024-01-02T00:00:00.000Z';
  const astronomicalEngine = new AstronomicalEngine(new DeterministicTransitProvider({
    trajectories: {
      Jupiter: [
        stationary(BIRTH, stationStart, 20),
        linear(stationStart, stationEntry, 20, 1),
        stationary(stationEntry, stationConfirmation, 21.25),
        linear(stationConfirmation, stationCoverageEnd, 21.25, -1),
        linear(stationCoverageEnd, stationEndOfDay, 21.1875, -1),
        stationary(stationEndOfDay, '2100-01-01T00:00:00.000Z', 20.395833333333332),
      ],
    },
  }));
  const profile = Object.freeze({
    id: 'profile-a',
    birthData: Object.freeze({
      localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0,
    }),
  });
  const service = new CareerEventAstrologyService({
    careerEventService: Object.freeze({
      async get() {
        return Object.freeze({ id: 'event-a', birthProfileId: 'profile-a', eventDate: Object.freeze({ precision: 'DAY', year: 2024, month: 1, day: 1 }) });
      },
    }),
    birthProfileService: Object.freeze({ async get() { return profile; } }),
    astronomicalEngine,
    canonicalSiderealSunSampler: Object.freeze({
      sampleCanonicalSiderealSun: ({ instantUtc }) => Object.freeze({
        canonicalSiderealLongitudeDegrees: canonical((Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * 86_400_000)),
        provenance: Object.freeze({ providerId: 'career-event-service-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-native-sidereal' }),
      }),
    }),
    divisionalChartService: Object.freeze({ async get() { return Object.freeze({ chartType: 'D10' }); } }),
    ashtakavargaService: Object.freeze({ async get() { return Object.freeze({ sav: Object.freeze({ signScores: [] }), lagnaBav: Object.freeze({ signScores: [] }), bav: [] }); } }),
  });

  const snapshot = await service.get({ principal: Object.freeze({ subject: 'user-a' }), birthProfileId: 'profile-a', eventId: 'event-a' });
  const jupiter = snapshot.transitCoverage.bodies.find((body) => body.body === 'Jupiter');
  const station = jupiter.transitions.find((transition) => transition.eventType === 'retrogradeStation');

  assert.ok(jupiter);
  assert.ok(station);
  assert.equal(station.body, 'Jupiter');
  assert.equal(station.fromMotion, 'direct');
  assert.equal(station.toMotion, 'retrograde');
  assert.ok(withinSecond(station.instant, stationEntry));
  assert.ok(snapshot.temporalCoverage.from <= station.instant);
  assert.ok(station.instant < snapshot.temporalCoverage.to);
});

test('projects a real scanner-generated Jupiter same-Rashi association start into a career event astrology snapshot', async () => {
  const astronomicalEngine = new AstronomicalEngine(new DeterministicTransitProvider({
    trajectories: {
      Sun: [stationary(BIRTH, '2100-01-01T00:00:00.000Z', 35)],
      Jupiter: [
        stationary(BIRTH, START, 29),
        linear(START, COVERAGE_END, 29, 12),
        linear(COVERAGE_END, END_OF_DAY, 31.5, 12),
        stationary(END_OF_DAY, '2100-01-01T00:00:00.000Z', 41.5),
      ],
    },
  }));
  const profile = Object.freeze({
    id: 'profile-a',
    birthData: Object.freeze({
      localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0,
    }),
  });
  const service = new CareerEventAstrologyService({
    careerEventService: Object.freeze({
      async get() {
        return Object.freeze({ id: 'event-a', birthProfileId: 'profile-a', eventDate: Object.freeze({ precision: 'DAY', year: 2024, month: 2, day: 1 }) });
      },
    }),
    birthProfileService: Object.freeze({ async get() { return profile; } }),
    astronomicalEngine,
    canonicalSiderealSunSampler: Object.freeze({
      sampleCanonicalSiderealSun: ({ instantUtc }) => Object.freeze({
        canonicalSiderealLongitudeDegrees: canonical(35 + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * 86_400_000)),
        provenance: Object.freeze({ providerId: 'career-event-service-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-native-sidereal' }),
      }),
    }),
    divisionalChartService: Object.freeze({ async get() { return Object.freeze({ chartType: 'D10' }); } }),
    ashtakavargaService: Object.freeze({ async get() { return Object.freeze({ sav: Object.freeze({ signScores: [] }), lagnaBav: Object.freeze({ signScores: [] }), bav: [] }); } }),
  });

  const snapshot = await service.get({ principal: Object.freeze({ subject: 'user-a' }), birthProfileId: 'profile-a', eventId: 'event-a' });
  const jupiter = snapshot.transitCoverage.bodies.find((body) => body.body === 'Jupiter');
  const association = jupiter.transitions.find((transition) => transition.eventType === 'sameRashiAssociationStart' && transition.natalBody === 'Sun');

  assert.ok(jupiter);
  assert.ok(association);
  assert.equal(association.body, 'Jupiter');
  assert.equal(association.transitBody, 'Jupiter');
  assert.equal(association.natalBody, 'Sun');
  assert.equal(association.transition, 'start');
  assert.ok(withinSecond(association.instant, '2024-02-01T02:00:00.000Z'));
  assert.ok(snapshot.temporalCoverage.from <= association.instant);
  assert.ok(association.instant < snapshot.temporalCoverage.to);
  for (const field of ['favorable', 'unfavorable', 'careerPositive', 'careerNegative', 'score', 'prediction', 'interpretation']) {
    assert.equal(Object.hasOwn(association, field), false);
  }
});

test('passes a calendar-bounded YEAR range to the real scanner and projects only in-range transitions', async () => {
  const yearStart = '2024-01-01T00:00:00.000Z';
  const yearEnd = '2025-01-01T00:00:00.000Z';
  const afterYearEnd = '2025-01-02T00:00:00.000Z';
  const astronomicalEngine = new AstronomicalEngine(new DeterministicTransitProvider({
    trajectories: {
      Jupiter: [
        stationary(BIRTH, yearStart, 29),
        linear(yearStart, '2024-01-02T00:00:00.000Z', 29, 12),
        stationary('2024-01-02T00:00:00.000Z', yearEnd, 41),
        linear(yearEnd, afterYearEnd, 41, 12),
        stationary(afterYearEnd, '2100-01-01T00:00:00.000Z', 53),
      ],
    },
  }));
  const transitEvents = require('../../src/transit-events');
  const originalScanTransitEvents = transitEvents.scanTransitEvents;
  const servicePath = require.resolve('../../src/application/career-events/career-event-astrology-service');
  let scannerRange;
  transitEvents.scanTransitEvents = (input) => {
    scannerRange = Object.freeze({ startInstant: input.startInstant, endInstant: input.endInstant });
    return originalScanTransitEvents(input);
  };
  delete require.cache[servicePath];
  const { CareerEventAstrologyService: ObservedCareerEventAstrologyService } = require('../../src/application/career-events/career-event-astrology-service');
  try {
    const profile = Object.freeze({
      id: 'profile-a',
      birthData: Object.freeze({
        localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0,
      }),
    });
    const service = new ObservedCareerEventAstrologyService({
      careerEventService: Object.freeze({
        async get() {
          return Object.freeze({ id: 'event-a', birthProfileId: 'profile-a', eventDate: Object.freeze({ precision: 'YEAR', year: 2024 }) });
        },
      }),
      birthProfileService: Object.freeze({ async get() { return profile; } }),
      astronomicalEngine,
      canonicalSiderealSunSampler: Object.freeze({
        sampleCanonicalSiderealSun: ({ instantUtc }) => Object.freeze({
          canonicalSiderealLongitudeDegrees: canonical((Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * 86_400_000)),
          provenance: Object.freeze({ providerId: 'career-event-service-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-native-sidereal' }),
        }),
      }),
      divisionalChartService: Object.freeze({ async get() { return Object.freeze({ chartType: 'D10' }); } }),
      ashtakavargaService: Object.freeze({ async get() { return Object.freeze({ sav: Object.freeze({ signScores: [] }), lagnaBav: Object.freeze({ signScores: [] }), bav: [] }); } }),
    });
    const snapshot = await service.get({ principal: Object.freeze({ subject: 'user-a' }), birthProfileId: 'profile-a', eventId: 'event-a' });
    const transitions = snapshot.transitCoverage.bodies.flatMap((body) => body.transitions);
    const ingress = transitions.find((transition) => transition.eventType === 'rashiIngress' && transition.body === 'Jupiter');

    assert.deepEqual(snapshot.temporalCoverage, { from: yearStart, to: yearEnd, timezone: 'UTC' });
    assert.deepEqual(scannerRange, { startInstant: yearStart, endInstant: yearEnd });
    assert.equal(snapshot.sourcePrecision, 'YEAR');
    assert.ok(ingress);
    assert.ok(transitions.every((transition) => transition.instant >= snapshot.temporalCoverage.from));
    assert.ok(transitions.every((transition) => transition.instant < snapshot.temporalCoverage.to));
  } finally {
    transitEvents.scanTransitEvents = originalScanTransitEvents;
    delete require.cache[servicePath];
  }
});
