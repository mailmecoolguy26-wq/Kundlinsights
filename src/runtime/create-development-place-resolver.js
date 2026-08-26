'use strict';

const { GoogleGeocodingProvider, BirthPlaceResolver, TimezoneRuntimeArtifactResolver } = require('../place');

function invalid() { const error = new Error('Invalid development place resolver configuration.'); error.code = 'INVALID_DEVELOPMENT_CONFIGURATION'; throw error; }

function createDevelopmentPlaceResolver({ config, dependencies = {} } = {}) {
  if (config === null) return null;
  if (!config || typeof config !== 'object' || typeof config.googleMapsApiKey !== 'string' || typeof config.timeoutMilliseconds !== 'number' || typeof config.manifestPath !== 'string' || typeof config.binaryPath !== 'string') invalid();
  const GoogleProvider = dependencies.GoogleGeocodingProvider || GoogleGeocodingProvider;
  const TimezoneResolver = dependencies.TimezoneRuntimeArtifactResolver || TimezoneRuntimeArtifactResolver;
  const Resolver = dependencies.BirthPlaceResolver || BirthPlaceResolver;
  let timezoneResolver;
  try {
    timezoneResolver = new TimezoneResolver({ manifestPath: config.manifestPath, binaryPath: config.binaryPath });
    return Object.freeze({ resolver: new Resolver({ placeProvider: new GoogleProvider({ apiKey: config.googleMapsApiKey, timeoutMilliseconds: config.timeoutMilliseconds }), timezoneResolver }), close: () => { if (typeof timezoneResolver.close === 'function') timezoneResolver.close(); } });
  } catch {
    if (timezoneResolver && typeof timezoneResolver.close === 'function') timezoneResolver.close();
    invalid();
  }
}

module.exports = { createDevelopmentPlaceResolver };
