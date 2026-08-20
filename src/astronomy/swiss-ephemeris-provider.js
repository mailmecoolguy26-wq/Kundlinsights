'use strict';

const { EphemerisProvider } = require('./ephemeris-provider');
const { ProductionLicenseGateError } = require('./errors');
const { normalizeLongitude } = require('./sidereal-calculator');
const { SwissNativeAdapter, motionFromSpeed } = require('./swiss-native-adapter');
const { SWISS_BINDING, CALCULATION_STATUS, BODY_CONSTANT_NAMES } = require('./swiss-reference-data');

function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); return value; }

function nativeSiderealMetadata(status) {
  return deepFreeze({ ayanamshaSystem: 'Lahiri / Chitrapaksha', siderealMode: 'SE_SIDM_LAHIRI', calculationMethod: 'Swiss Ephemeris native sidereal calculation', calculationStatus: status, coordinateFrame: 'native-sidereal' });
}

function bodyResult(body, native, status, extra = {}) {
  const speed = native.speed;
  return deepFreeze({ body, siderealLongitudeDegrees: native.longitude, siderealMetadata: nativeSiderealMetadata(status), tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: speed, motion: speed === null ? null : motionFromSpeed(speed), coordinateSystem: 'geocentric-ecliptic-of-date; native-sidereal-lahiri', provenance: deepFreeze({ coordinateProvenance: 'provider-native', speedUnit: speed === null ? null : 'degrees-per-day', ...extra }) });
}

class SwissEphemerisProvider extends EphemerisProvider {
  constructor(configuration) {
    super();
    if (!configuration) throw new ProductionLicenseGateError('SwissEphemerisProvider requires explicit license-gated validation configuration.');
    const { nativeAdapter, ephemerisPath, manifest, binding, manifestVerifier, productionLicenseGate = false } = configuration;
    this.nativeAdapter = nativeAdapter || new SwissNativeAdapter({ ephemerisPath, manifest, binding, manifestVerifier });
    if (!this.nativeAdapter || typeof this.nativeAdapter.julianDayUt !== 'function' || typeof this.nativeAdapter.calculateBody !== 'function' || typeof this.nativeAdapter.calculateAscendant !== 'function') throw new TypeError('SwissEphemerisProvider requires a SwissNativeAdapter.');
    this.productionLicenseGate = productionLicenseGate === true;
    this.metadata = deepFreeze({ provider: 'Swiss Ephemeris', providerId: 'swiss-ephemeris', calculationStatus: CALCULATION_STATUS, swissVersion: this.nativeAdapter.swissVersion, binding: SWISS_BINDING, ephemerisMode: 'SWIEPH', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', coordinateFrame: 'native-sidereal', ephemerisManifestStatus: 'VERIFIED', productionAuthority: false });
    Object.freeze(this);
  }

  calculate({ instant, observer, bodies: requestedBodies }) {
    const jdUt = this.nativeAdapter.julianDayUt(instant);
    const bodies = {};
    const returnedFlagsByBody = {};
    const requested = requestedBodies === undefined ? [...Object.keys(BODY_CONSTANT_NAMES), 'Ketu', 'Ascendant'] : requestedBodies;
    for (const body of Object.keys(BODY_CONSTANT_NAMES).filter((body) => requested.includes(body))) {
      const native = this.nativeAdapter.calculateBody(jdUt, body);
      returnedFlagsByBody[body] = native.returnedFlags;
      bodies[body] = bodyResult(body, native, this.metadata.calculationStatus, body === 'Rahu' ? { nodeModel: 'MEAN_NODE', swissConstant: 'SE_MEAN_NODE' } : { swissConstant: BODY_CONSTANT_NAMES[body] });
    }
    if (requested.includes('Ketu')) {
      const rahu = bodies.Rahu || bodyResult('Rahu', this.nativeAdapter.calculateBody(jdUt, 'Rahu'), this.metadata.calculationStatus, { nodeModel: 'MEAN_NODE', swissConstant: 'SE_MEAN_NODE' });
      bodies.Ketu = deepFreeze({ ...rahu, body: 'Ketu', siderealLongitudeDegrees: normalizeLongitude(rahu.siderealLongitudeDegrees + 180), provenance: deepFreeze({ coordinateProvenance: 'derived-normalized-rahu-plus-180', ketuDerivation: 'NORMALIZED_RAHU_PLUS_180', longitudeSpeedSource: 'Rahu', speedUnit: 'degrees-per-day' }) });
    }
    if (requested.includes('Ascendant')) {
      const ascendant = this.nativeAdapter.calculateAscendant(jdUt, observer);
      bodies.Ascendant = deepFreeze({ body: 'Ascendant', siderealLongitudeDegrees: ascendant.longitude, siderealMetadata: nativeSiderealMetadata(this.metadata.calculationStatus), tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: null, motion: null, coordinateSystem: 'observer-aware-ecliptic-horizon-intersection; native-sidereal-lahiri', provenance: deepFreeze({ coordinateProvenance: 'provider-native', api: ascendant.api, houseSystemCarrier: ascendant.houseSystemCarrier, observer: deepFreeze({ latitude: observer.latitude, longitude: observer.longitude, coordinateReference: observer.coordinateReference }), houseCuspsExposed: false }) });
    }
    return deepFreeze({ bodies, provider: deepFreeze({ ...this.metadata, requestedFlags: this.nativeAdapter.requestedFlags, returnedFlagsByBody, jdUt, productionLicenseGate: this.productionLicenseGate }) });
  }
}

module.exports = { SwissEphemerisProvider };
