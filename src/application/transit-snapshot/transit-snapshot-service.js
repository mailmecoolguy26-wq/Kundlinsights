'use strict';

const { calculateRashiHouses } = require('../../bhava');
const { calculateGocharSnapshot } = require('../../gochar');
const { repositoryError } = require('../../persistence/contracts');
const { toTransitSnapshotDto } = require('./transit-snapshot-dto');

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
  constructor({ birthProfileService, astronomicalEngine } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function') {
      throw new TypeError('TransitSnapshotService requires SecureBirthProfileService.get.');
    }
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') {
      throw new TypeError('TransitSnapshotService requires an injected astronomicalEngine.');
    }
    this.birthProfileService = birthProfileService;
    this.astronomicalEngine = astronomicalEngine;
    Object.freeze(this);
  }

  async get({ principal, birthProfileId, at } = {}) {
    const instant = parseUtcInstant(at);
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
      return toTransitSnapshotDto({ birthProfileId: profile.id, snapshot });
    } catch (_) {
      fail('TRANSIT_SNAPSHOT_CALCULATION_FAILED');
    }
  }
}

module.exports = { TransitSnapshotService, parseUtcInstant };
