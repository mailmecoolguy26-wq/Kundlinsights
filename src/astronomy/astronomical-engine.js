'use strict';

const { localDateTimeToUtc } = require('./time');
const { InputValidationError } = require('./errors');
const { InterimLahiriSiderealCalculator } = require('./sidereal-calculator');

function validCoordinate(value, min, max, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new InputValidationError(`${name} must be a finite WGS84 value in [${min}, ${max}].`, 'INVALID_COORDINATE');
}

class AstronomicalEngine {
  constructor(provider, siderealCalculator = new InterimLahiriSiderealCalculator()) { if (!provider || typeof provider.calculate !== 'function') throw new TypeError('AstronomicalEngine requires an EphemerisProvider.'); if (!siderealCalculator || typeof siderealCalculator.calculateSiderealLongitude !== 'function') throw new TypeError('AstronomicalEngine requires a SiderealCalculator.'); this.provider = provider; this.siderealCalculator = siderealCalculator; }
  calculate(input) {
    if (!input || typeof input !== 'object') throw new InputValidationError('Input is required.', 'INVALID_INPUT');
    validCoordinate(input.latitude, -90, 90, 'latitude');
    validCoordinate(input.longitude, -180, 180, 'longitude');
    const instant = localDateTimeToUtc(input);
    const calculated = this.provider.calculate(instant);
    let siderealMetadata;
    const bodies = Object.fromEntries(Object.entries(calculated.bodies).map(([body, raw]) => {
      const sidereal = this.siderealCalculator.calculateSiderealLongitude({ tropicalLongitudeDegrees: raw.tropicalLongitudeDegrees, instant, ayanamshaSystem: 'Lahiri / Chitrapaksha' });
      siderealMetadata = sidereal.metadata;
      return [body, Object.freeze({ ...raw, siderealLongitudeDegrees: sidereal.siderealLongitudeDegrees, siderealMetadata: sidereal.metadata })];
    }));
    return Object.freeze({ input: Object.freeze({ date: input.date, time: input.time, timezone: input.timezone, latitude: input.latitude, longitude: input.longitude, coordinateReference: 'WGS84' }), instant: Object.freeze({ utc: instant.toISOString(), unixMilliseconds: instant.getTime() }), bodies: Object.freeze(bodies), sidereal: Object.freeze(siderealMetadata), provider: calculated.provider, calculationStatus: siderealMetadata.calculationStatus });
  }
}

module.exports = { AstronomicalEngine };
