'use strict';

const Astronomy = require('astronomy-engine');
const { AstronomicalEngine, AstronomyEngineProvider, CanonicalSiderealSunSampler, deepFreeze } = require('../astronomy');
const { interimLahiriAyanamsha, normalizeLongitude } = require('../astronomy/sidereal-calculator');

function createDevelopmentAstrology() {
  const provider = new AstronomyEngineProvider();
  const astronomicalEngine = new AstronomicalEngine(provider);
  const canonicalSiderealSunSampler = new CanonicalSiderealSunSampler({
    sample: ({ instantUtc }) => {
      const sourceInstant = new Date(instantUtc);

      // Preserve the existing sampler's second-level timestamp behavior.
      const instant = new Date(
        `${sourceInstant.toISOString().slice(0, 10)}T${sourceInstant.toISOString().slice(11, 19)}.000Z`,
      );

      const vector = Astronomy.GeoVector(
        Astronomy.Body.Sun,
        instant,
        true,
      );

      const ecliptic = Astronomy.Ecliptic(vector);
      const tropicalLongitudeDegrees = normalizeLongitude(ecliptic.elon);
      const canonicalSiderealLongitudeDegrees = normalizeLongitude(
        tropicalLongitudeDegrees - interimLahiriAyanamsha(instant),
      );

      return deepFreeze({
        canonicalSiderealLongitudeDegrees,
        provenance: deepFreeze({
          provider: 'Astronomy Engine',
          providerId: 'astronomy-engine',
          providerVersion: '2.1.17',
          calculationStatus: 'PROVISIONAL',
          calculationMode: 'interim-development-reference',
          siderealMode: 'Lahiri / Chitrapaksha',
          coordinateProvenance: 'derived-from-tropical',
          productionAuthority: false,
        }),
      });
    }
  });
  return Object.freeze({ astronomicalEngine, canonicalSiderealSunSampler, productionAuthority: false });
}

module.exports = { createDevelopmentAstrology };
