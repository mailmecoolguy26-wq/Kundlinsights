'use strict';

class EphemerisProvider {
  /**
   * Calculates provider coordinates for a UTC instant.
   *
   * Request: { instant: Date, observer: { latitude, longitude, coordinateReference }, bodies? }.
   * `bodies`, when supplied, is a canonical caller-selected calculation set.
   * Result: { bodies, provider }. Every body must provide canonical
   * siderealLongitudeDegrees either natively with siderealMetadata or indirectly
   * through tropicalLongitudeDegrees. Tropical longitude is optional when a future
   * provider supplies a native canonical sidereal coordinate only. Ascendant is a
   * first-class body and is observer-aware; it does not imply house calculations.
   */
  calculate(_request) { throw new Error('EphemerisProvider.calculate must be implemented.'); }
}

module.exports = { EphemerisProvider };
