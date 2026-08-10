'use strict';

const { classifySiderealLongitude } = require('./classify-sidereal-longitude');

function classifyLayer1Bodies(layer1Result) {
  if (!layer1Result || typeof layer1Result !== 'object' || !layer1Result.bodies || typeof layer1Result.bodies !== 'object') throw new TypeError('A Layer 1 result with bodies is required.');
  return Object.freeze(Object.fromEntries(Object.entries(layer1Result.bodies).map(([body, result]) => {
    if (typeof result.siderealLongitudeDegrees !== 'number') throw new TypeError(`Layer 1 body ${body} must contain siderealLongitudeDegrees.`);
    return [body, Object.freeze({ ...result, jyotishCoordinates: classifySiderealLongitude(result.siderealLongitudeDegrees) })];
  })));
}

module.exports = { classifyLayer1Bodies };
