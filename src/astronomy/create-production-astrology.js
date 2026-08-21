'use strict';

const { AstronomicalEngine } = require('./astronomical-engine');
const { SwissNativeAdapter } = require('./swiss-native-adapter');
const { SwissEphemerisProvider } = require('./swiss-ephemeris-provider');
const { SwissCanonicalSiderealSunSampler } = require('./swiss-canonical-sidereal-sun-sampler');
const { isProductionAstronomicalAuthority } = require('./swiss-production-authority');
const { ProductionLicenseGateError } = require('./errors');

function createProductionAstrology({ swissEphemeris, dependencies = {} } = {}) {
  if (!swissEphemeris || swissEphemeris.licenseConfirmed !== true) throw new ProductionLicenseGateError('Swiss Ephemeris production use requires explicit commercial license confirmation.');
  const NativeAdapter = dependencies.SwissNativeAdapter || SwissNativeAdapter;
  const Provider = dependencies.SwissEphemerisProvider || SwissEphemerisProvider;
  const SunSampler = dependencies.SwissCanonicalSiderealSunSampler || SwissCanonicalSiderealSunSampler;
  const Engine = dependencies.AstronomicalEngine || AstronomicalEngine;
  const authority = dependencies.isProductionAstronomicalAuthority || isProductionAstronomicalAuthority;
  const nativeAdapter = new NativeAdapter({ ephemerisPath: swissEphemeris.ephemerisPath, manifest: swissEphemeris.manifest });
  const provider = new Provider({ nativeAdapter, productionLicenseGate: true, calculationStatus: 'PRODUCTION', productionAuthority: true });
  const astronomicalEngine = new Engine(provider);
  const canonicalSiderealSunSampler = new SunSampler({ nativeAdapter, calculationStatus: 'PRODUCTION', productionAuthority: true });
  const sample = astronomicalEngine.calculate({ date: '2000-01-01', time: '12:00:00', timezone: 'UTC', latitude: 0, longitude: 0 });
  if (!authority(sample)) throw new ProductionLicenseGateError('Swiss Ephemeris production authority verification failed.');
  return Object.freeze({ nativeAdapter, astronomicalEngine, canonicalSiderealSunSampler, productionAuthority: true });
}

module.exports = { createProductionAstrology };
