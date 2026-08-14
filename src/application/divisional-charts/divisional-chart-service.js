'use strict';

const { calculateRashiHouses } = require('../../bhava');
const { deriveVargaFromSiderealLongitude } = require('../../varga');
const { repositoryError } = require('../../persistence/contracts');
const { toDivisionalChartDto } = require('./divisional-chart-dto');

const CHART_TYPES = Object.freeze({ d9: 'D9', d10: 'D10' });

function fail(code) { throw repositoryError(code); }

function layer1Request(birth) {
  return {
    date: birth.localDate,
    time: birth.localTime,
    timezone: birth.timezone,
    latitude: birth.latitude,
    longitude: birth.longitude,
  };
}

function resultingRashiLongitude(coordinates) {
  const rashi = coordinates.derivedVargaRashi;
  const longitude = rashi.startDegrees + rashi.degreesWithinResultingRashi;
  if (!Number.isFinite(longitude)) {
    throw new TypeError('Varga result must provide a finite resulting-Rashi coordinate.');
  }
  return ((longitude % 360) + 360) % 360;
}

function calculateChartCoordinates(layer1Result, chartType) {
  const vargaId = CHART_TYPES[chartType];
  if (!vargaId) throw new RangeError(`Unsupported divisional chart: ${chartType}.`);

  const coordinates = Object.fromEntries(
    Object.entries(layer1Result.bodies).map(([body, result]) => {
      const varga = deriveVargaFromSiderealLongitude(
        vargaId,
        result.siderealLongitudeDegrees,
      );
      return [body, Object.freeze({ varga, siderealLongitudeDegrees: resultingRashiLongitude(varga) })];
    }),
  );
  const houses = calculateRashiHouses({
    ascendantCanonicalSiderealLongitude:
        coordinates.Ascendant.siderealLongitudeDegrees,
    bodies: Object.fromEntries(
      Object.entries(coordinates).map(([body, value]) => [
        body,
        { siderealLongitudeDegrees: value.siderealLongitudeDegrees },
      ]),
    ),
  });
  return Object.freeze({ vargaId, coordinates: Object.freeze(coordinates), houses });
}

class DivisionalChartService {
  constructor({ birthProfileService, astronomicalEngine } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function') {
      throw new TypeError(
        'DivisionalChartService requires SecureBirthProfileService.get.',
      );
    }
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') {
      throw new TypeError(
        'DivisionalChartService requires an injected astronomicalEngine.',
      );
    }
    this.birthProfileService = birthProfileService;
    this.astronomicalEngine = astronomicalEngine;
    Object.freeze(this);
  }

  async get({ principal, birthProfileId, chartType } = {}) {
    if (!CHART_TYPES[chartType]) fail('DIVISIONAL_CHART_CALCULATION_FAILED');
    const profile = await this.birthProfileService.get({ principal, birthProfileId });
    if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    try {
      const layer1Result = this.astronomicalEngine.calculate(
        layer1Request(profile.birthData),
      );
      const chart = calculateChartCoordinates(layer1Result, chartType);
      return toDivisionalChartDto({
        birthProfileId: profile.id,
        chartType: chart.vargaId,
        coordinates: chart.coordinates,
        houses: chart.houses,
      });
    } catch (_) {
      fail('DIVISIONAL_CHART_CALCULATION_FAILED');
    }
  }
}

module.exports = { CHART_TYPES, DivisionalChartService, calculateChartCoordinates };
