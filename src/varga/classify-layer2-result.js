'use strict';

const { deriveVargaFromSiderealLongitude } = require('./derive-varga-from-sidereal-longitude');
const { DEFAULT_VARGA_IDS } = require('./classify-layer1-result');

function deriveVargasForLayer2Bodies(layer2Bodies, vargaIds = DEFAULT_VARGA_IDS) {
  if (!layer2Bodies || typeof layer2Bodies !== 'object') throw new TypeError('A Layer 2 body map is required.');
  return Object.freeze(Object.fromEntries(Object.entries(layer2Bodies).map(([body, result]) => {
    const longitude = result && result.jyotishCoordinates && result.jyotishCoordinates.normalizedLongitudeDegrees;
    if (typeof longitude !== 'number') throw new TypeError(`Layer 2 body ${body} must contain jyotishCoordinates.normalizedLongitudeDegrees.`);
    return [body, Object.freeze({ ...result, vargaCoordinates: Object.freeze(Object.fromEntries(vargaIds.map((vargaId) => [vargaId, deriveVargaFromSiderealLongitude(vargaId, longitude)]))) })];
  })));
}

module.exports = { deriveVargasForLayer2Bodies };
