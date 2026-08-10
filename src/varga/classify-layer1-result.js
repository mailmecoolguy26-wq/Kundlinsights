'use strict';

const { deriveVargaFromSiderealLongitude } = require('./derive-varga-from-sidereal-longitude');

const DEFAULT_VARGA_IDS = Object.freeze(['D1', 'D9', 'D10']);

function deriveVargasForLayer1Bodies(layer1Result, vargaIds = DEFAULT_VARGA_IDS) {
  if (!layer1Result || typeof layer1Result !== 'object' || !layer1Result.bodies || typeof layer1Result.bodies !== 'object') throw new TypeError('A Layer 1 result with bodies is required.');
  return Object.freeze(Object.fromEntries(Object.entries(layer1Result.bodies).map(([body, result]) => {
    if (typeof result.siderealLongitudeDegrees !== 'number') throw new TypeError(`Layer 1 body ${body} must contain siderealLongitudeDegrees.`);
    return [body, Object.freeze({ ...result, vargaCoordinates: Object.freeze(Object.fromEntries(vargaIds.map((vargaId) => [vargaId, deriveVargaFromSiderealLongitude(vargaId, result.siderealLongitudeDegrees)]))) })];
  })));
}

module.exports = { DEFAULT_VARGA_IDS, deriveVargasForLayer1Bodies };
