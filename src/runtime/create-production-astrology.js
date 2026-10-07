'use strict';

const {
  AstronomicalEngine,
  SwissNativeAdapter,
  SwissEphemerisProvider,
  SwissCanonicalSiderealSunSampler,
  isProductionAstronomicalAuthority,
} = require('../astronomy');
const { createDevelopmentAstrology } = require('./create-development-astrology');
const { loadProductionConfig } = require('./production-config');

function unavailable(cause) {
  const error = new Error('Production astronomy authority is unavailable.');
  error.code = 'PRODUCTION_ASTRONOMY_UNAVAILABLE';
  error.cause = cause;
  return error;
}

// This is deliberately the sole production selection point.  The provisional
// path is explicit, tagged, and non-authoritative; it is not a Swiss fallback.
function createProductionAstrology({ env = process.env, config, dependencies = {} } = {}) {
  const resolved = config || (dependencies.loadProductionConfig || loadProductionConfig)(env);
  if (!resolved || !resolved.astronomy || resolved.astronomy.authority === 'provisional') {
    const provisional = (dependencies.createDevelopmentAstrology || createDevelopmentAstrology)();
    return Object.freeze({ ...provisional, authorityMode: 'provisional', productionAuthority: false });
  }
  if (resolved.astronomy.authority !== 'swiss') throw unavailable();
  try {
    const Adapter = dependencies.SwissNativeAdapter || SwissNativeAdapter;
    const Provider = dependencies.SwissEphemerisProvider || SwissEphemerisProvider;
    const Engine = dependencies.AstronomicalEngine || AstronomicalEngine;
    const Sampler = dependencies.SwissCanonicalSiderealSunSampler || SwissCanonicalSiderealSunSampler;
    const nativeAdapter = new Adapter({
      ephemerisPath: resolved.astronomy.ephemerisPath,
      manifest: resolved.astronomy.manifest,
      ...(dependencies.binding ? { binding: dependencies.binding } : {}),
      ...(dependencies.manifestVerifier ? { manifestVerifier: dependencies.manifestVerifier } : {}),
    });
    const provider = new Provider({ nativeAdapter, productionLicenseGate: true });
    const astronomicalEngine = new Engine(provider);
    const canonicalSiderealSunSampler = new Sampler({ nativeAdapter, productionAuthority: true });
    // Exercise every authority predicate before accepting a runtime.  This
    // detects an invalid native configuration before it can create a reading.
    const probe = astronomicalEngine.calculate({ date: '2000-01-01', time: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0 });
    if (!isProductionAstronomicalAuthority(probe)) throw new Error('Swiss authority predicate failed.');
    return Object.freeze({ astronomicalEngine, canonicalSiderealSunSampler, authorityMode: 'swiss', productionAuthority: true });
  } catch (error) { throw unavailable(error); }
}

module.exports = { createProductionAstrology };
