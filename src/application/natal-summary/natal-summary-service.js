'use strict';

const { classifyLayer1Bodies } = require('../../jyotish');
const { calculateRashiHouses } = require('../../bhava');
const { repositoryError } = require('../../persistence/contracts');
const { toNatalSummaryDto } = require('./natal-summary-dto');

function fail(code) { throw repositoryError(code); }

class NatalSummaryService {
  constructor({ birthProfileService, astronomicalEngine } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function') {
      throw new TypeError('NatalSummaryService requires SecureBirthProfileService.get.');
    }
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') {
      throw new TypeError('NatalSummaryService requires an injected astronomicalEngine.');
    }
    this.birthProfileService = birthProfileService;
    this.astronomicalEngine = astronomicalEngine;
    Object.freeze(this);
  }

  async get({ principal, birthProfileId } = {}) {
    const profile = await this.birthProfileService.get({ principal, birthProfileId });
    if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    const birth = profile.birthData;
    try {
      const layer1Result = this.astronomicalEngine.calculate({
        date: birth.localDate,
        time: birth.localTime,
        timezone: birth.timezone,
        latitude: birth.latitude,
        longitude: birth.longitude,
      });
      const layer2Bodies = classifyLayer1Bodies(layer1Result);
      const houses = calculateRashiHouses({
        ascendantCanonicalSiderealLongitude: layer1Result.bodies.Ascendant.siderealLongitudeDegrees,
        bodies: layer1Result.bodies,
      });
      return toNatalSummaryDto({
        birthProfileId: profile.id,
        layer1Result,
        layer2Bodies,
        houses,
      });
    } catch (_) {
      fail('NATAL_SUMMARY_CALCULATION_FAILED');
    }
  }
}

module.exports = { NatalSummaryService };
