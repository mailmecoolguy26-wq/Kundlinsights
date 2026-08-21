'use strict';

const { AstronomicalEngine, AstronomyEngineProvider, CanonicalSiderealSunSampler, deepFreeze } = require('../astronomy');

function createDevelopmentAstrology() {
  const provider = new AstronomyEngineProvider();
  const astronomicalEngine = new AstronomicalEngine(provider);
  const canonicalSiderealSunSampler = new CanonicalSiderealSunSampler({
    sample: ({ instantUtc }) => {
      const instant = new Date(instantUtc);
      const result = astronomicalEngine.calculate({ date: instant.toISOString().slice(0, 10), time: instant.toISOString().slice(11, 19), timezone: 'UTC', latitude: 0, longitude: 0 });
      return deepFreeze({ canonicalSiderealLongitudeDegrees: result.bodies.Sun.siderealLongitudeDegrees, provenance: deepFreeze({ provider: 'Astronomy Engine', providerId: 'astronomy-engine', providerVersion: '2.1.17', calculationStatus: 'PROVISIONAL', calculationMode: 'interim-development-reference', siderealMode: 'Lahiri / Chitrapaksha', coordinateProvenance: 'derived-from-tropical', productionAuthority: false }) });
    }
  });
  return Object.freeze({ astronomicalEngine, canonicalSiderealSunSampler, productionAuthority: false });
}

module.exports = { createDevelopmentAstrology };
