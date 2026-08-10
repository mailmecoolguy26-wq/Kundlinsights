function normalizeSiderealLongitude(longitudeDegrees) {
  if (typeof longitudeDegrees !== 'number' || !Number.isFinite(longitudeDegrees)) {
    throw new TypeError('longitudeDegrees must be a finite number.');
  }
  return ((longitudeDegrees % TOTAL_DEGREES) + TOTAL_DEGREES) % TOTAL_DEGREES;
}
'use strict';

const { TOTAL_DEGREES, RASHI_SPAN_DEGREES, NAKSHATRA_SPAN_DEGREES, PADA_SPAN_DEGREES, RASHI_DEFINITIONS, NAKSHATRA_DEFINITIONS, PADA_DEFINITIONS } = require('./reference-data');

function normalizeSiderealLongitude(longitudeDegrees) {
  if (typeof longitudeDegrees !== 'number' || !Number.isFinite(longitudeDegrees)) throw new TypeError('longitudeDegrees must be a finite number.');
const remainder = longitudeDegrees % TOTAL_DEGREES;
return remainder < 0 ? remainder + TOTAL_DEGREES : remainder;
}

function indexFor(normalizedLongitudeDegrees, spanDegrees, count) {
  return Math.min(count - 1, Math.floor(normalizedLongitudeDegrees / spanDegrees));
}

function classifySiderealLongitude(longitudeDegrees) {
  const normalizedLongitudeDegrees = normalizeSiderealLongitude(longitudeDegrees);
  const rashi = RASHI_DEFINITIONS[indexFor(normalizedLongitudeDegrees, RASHI_SPAN_DEGREES, RASHI_DEFINITIONS.length)];
  const nakshatra = NAKSHATRA_DEFINITIONS[indexFor(normalizedLongitudeDegrees, NAKSHATRA_SPAN_DEGREES, NAKSHATRA_DEFINITIONS.length)];
  const globalPada = PADA_DEFINITIONS[indexFor(normalizedLongitudeDegrees, PADA_SPAN_DEGREES, PADA_DEFINITIONS.length)];
  return Object.freeze({
    normalizedLongitudeDegrees,
    rashi: Object.freeze({ ...rashi, degreesWithinRashi: normalizedLongitudeDegrees - rashi.startDegrees }),
    nakshatra: Object.freeze({ ...nakshatra, degreesWithinNakshatra: normalizedLongitudeDegrees - nakshatra.startDegrees }),
    pada: Object.freeze({ pada: globalPada.pada, padaStartDegrees: globalPada.startDegrees, padaEndDegrees: globalPada.endDegrees, degreesWithinPada: normalizedLongitudeDegrees - globalPada.startDegrees })
  });
}

module.exports = { classifySiderealLongitude, normalizeSiderealLongitude };
