'use strict';

const { calculateRashiHouses } = require('../../bhava');
const { calculateGocharSnapshot } = require('../../gochar');
const { repositoryError } = require('../../persistence/contracts');
const { toTransitSnapshotDto } = require('./transit-snapshot-dto');
const { scanTransitEvents } = require('../../transit-events');
const { adaptTransitInsight } = require('./transit-insight-adapter');

const TRANSIT_TIMELINE_HORIZON_DAYS = 30;
const MAX_TARA_TRANSIT_HORIZON_DAYS = 400;

function fail(code) { throw repositoryError(code); }

function birthRequest(birth) {
  return {
    date: birth.localDate,
    time: birth.localTime,
    timezone: birth.timezone,
    latitude: birth.latitude,
    longitude: birth.longitude,
  };
}

function parseUtcInstant(value) {
  const match = typeof value === 'string' &&
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) fail('INVALID_TRANSIT_INSTANT');
  const epochMilliseconds = Date.parse(value);
  if (!Number.isSafeInteger(epochMilliseconds)) fail('INVALID_TRANSIT_INSTANT');
  const utc = new Date(epochMilliseconds).toISOString();
  const canonicalInput = `${match[1]}.${(match[2] || '').padEnd(3, '0')}Z`;
  if (utc !== canonicalInput) fail('INVALID_TRANSIT_INSTANT');
  return Object.freeze({ utc, epochMilliseconds });
}

function transitRequest(instant, birth) {
  return Object.freeze({
    date: instant.utc.slice(0, 10),
    time: instant.utc.slice(11, 23),
    timezone: 'UTC',
    latitude: birth.latitude,
    longitude: birth.longitude,
  });
}

class TransitSnapshotService {
  constructor({ birthProfileService, astronomicalEngine, transitScanner = scanTransitEvents, careerInsightSource = null } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function') {
      throw new TypeError('TransitSnapshotService requires SecureBirthProfileService.get.');
    }
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') {
      throw new TypeError('TransitSnapshotService requires an injected astronomicalEngine.');
    }
    this.birthProfileService = birthProfileService;
    this.astronomicalEngine = astronomicalEngine;
    if (typeof transitScanner !== 'function') throw new TypeError('TransitSnapshotService transitScanner must be a function.');
    if (careerInsightSource && typeof careerInsightSource.latestForProfile !== 'function') throw new TypeError('TransitSnapshotService careerInsightSource must provide latestForProfile.');
    this.transitScanner = transitScanner;
    this.careerInsightSource = careerInsightSource;
    Object.freeze(this);
  }

  async contextForTara({ principal, birthProfileId, at, horizonDays = TRANSIT_TIMELINE_HORIZON_DAYS, scanBodies, scanEventTypes, scanOptions } = {}) {
    const instant = parseUtcInstant(at);
    if (!Number.isInteger(horizonDays) || horizonDays <= 0 || horizonDays > MAX_TARA_TRANSIT_HORIZON_DAYS) fail('INVALID_TRANSIT_HORIZON');
    const profile = await this.birthProfileService.get({ principal, birthProfileId });
    if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    try {
      const natal = this.astronomicalEngine.calculate(birthRequest(profile.birthData));
      const natalHouses = calculateRashiHouses({
        ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees,
        bodies: natal.bodies,
      });
      const transit = this.astronomicalEngine.calculate(transitRequest(instant, profile.birthData));
      const snapshot = calculateGocharSnapshot({
        snapshotInstant: instant.utc,
        natalBodies: natal.bodies,
        natalHouses,
        transitBodies: transit.bodies,
      });
      let source = null;
      if (this.careerInsightSource) {
        try { source = await this.careerInsightSource.latestForProfile({ principal, birthProfileId: profile.id }); }
        catch (_) { source = null; }
      }
      const horizon = { from: instant.utc, to: new Date(instant.epochMilliseconds + horizonDays * 86_400_000).toISOString() };
      let scan = null;
      try {
        scan = this.transitScanner({
          startInstant: horizon.from,
          endInstant: horizon.to,
          natalBodies: natal.bodies,
          natalHouses,
          astronomicalEngine: this.astronomicalEngine,
          observer: { latitude: profile.birthData.latitude, longitude: profile.birthData.longitude },
          ...(scanBodies === undefined ? {} : { bodies: scanBodies }),
          ...(scanEventTypes === undefined ? {} : { eventTypes: scanEventTypes }),
          ...(scanOptions === undefined ? {} : { options: scanOptions }),
        });
      } catch (_) { scan = null; }
      const insightContext = adaptTransitInsight({ snapshot, insights: source && source.birthProfileId === profile.id ? source.insights : [], scan, horizon });
      return Object.freeze({ birthProfileId: profile.id, snapshot, natalBodies: natal.bodies, natalHouses, insightContext });
    } catch (_) {
      fail('TRANSIT_SNAPSHOT_CALCULATION_FAILED');
    }
  }
  async get({ principal, birthProfileId, at } = {}) {
    const context = await this.contextForTara({ principal, birthProfileId, at });
    return toTransitSnapshotDto({ birthProfileId: context.birthProfileId, snapshot: context.snapshot, insightContext: context.insightContext });
  }
}

module.exports = { TransitSnapshotService, parseUtcInstant, TRANSIT_TIMELINE_HORIZON_DAYS, MAX_TARA_TRANSIT_HORIZON_DAYS };
