'use strict';

const { assertCanonicalUtcInstant, validateCanonicalSiderealSunSample, sunSampleError, deepFreeze } = require('./canonical-sidereal-sun-sampler');
const { SWISS_BINDING, CALCULATION_STATUS } = require('./swiss-reference-data');

class SwissCanonicalSiderealSunSampler {
  constructor({ nativeAdapter, calculationStatus = CALCULATION_STATUS, productionAuthority = false } = {}) {
    if (!nativeAdapter || typeof nativeAdapter.julianDayUt !== 'function' || typeof nativeAdapter.calculateBody !== 'function') throw new TypeError('SwissCanonicalSiderealSunSampler requires a SwissNativeAdapter.');
    if (!['LICENSE_GATED_VALIDATION', 'PRODUCTION'].includes(calculationStatus)) throw new TypeError('SwissCanonicalSiderealSunSampler calculationStatus is invalid.');
    if (productionAuthority === true && calculationStatus !== 'PRODUCTION') throw new TypeError('SwissCanonicalSiderealSunSampler production authority requires production status.');
    this.nativeAdapter = nativeAdapter;
    this.calculationStatus = calculationStatus;
    this.productionAuthority = productionAuthority === true;
    Object.freeze(this);
  }

  sampleCanonicalSiderealSun({ instantUtc } = {}) {
    try {
      const instant = assertCanonicalUtcInstant(instantUtc);
      const jdUt = this.nativeAdapter.julianDayUt(instant);
      const native = this.nativeAdapter.calculateBody(jdUt, 'Sun');
      const result = deepFreeze({
        canonicalSiderealLongitudeDegrees: native.longitude,
        provenance: deepFreeze({
          provider: 'Swiss Ephemeris', providerId: 'swiss-ephemeris', swissVersion: this.nativeAdapter.swissVersion,
          binding: SWISS_BINDING, calculationStatus: this.calculationStatus, ephemerisMode: 'SWIEPH',
          siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-ecliptic-of-date; native-sidereal-lahiri',
          coordinateProvenance: 'provider-native', body: 'Sun', requestedFlags: this.nativeAdapter.requestedFlags,
          returnedFlags: native.returnedFlags, productionAuthority: this.productionAuthority
        })
      });
      return validateCanonicalSiderealSunSample(result);
    } catch (error) { if (error && error.code === 'INVALID_SUN_SAMPLE') throw error; throw sunSampleError(`Swiss native Sun sample failed: ${error && error.message ? error.message : 'unknown error'}`); }
  }
}

module.exports = { SwissCanonicalSiderealSunSampler };
