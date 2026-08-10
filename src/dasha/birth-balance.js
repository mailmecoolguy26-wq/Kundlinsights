'use strict';

const { classifySiderealLongitude } = require('../jyotish/classify-sidereal-longitude');
const { NAKSHATRA_SPAN_DEGREES } = require('../jyotish/reference-data');
const { LORD_BY_ID } = require('./reference-data');

function calculateLongitudeProportionalBirthBalance(moonCanonicalSiderealLongitude) {
  const classification = classifySiderealLongitude(moonCanonicalSiderealLongitude);
  const lord = LORD_BY_ID[classification.nakshatra.lord.id];
  const elapsedRatio = classification.nakshatra.degreesWithinNakshatra / NAKSHATRA_SPAN_DEGREES;
  const remainingRatio = 1 - elapsedRatio;
  return Object.freeze({
    moonCanonicalSiderealLongitude: classification.normalizedLongitudeDegrees,
    nakshatra: Object.freeze({ index: classification.nakshatra.nakshatraIndex, name: classification.nakshatra.name, lord }),
    degreesWithinNakshatra: classification.nakshatra.degreesWithinNakshatra,
    elapsedRatio,
    remainingRatio,
    elapsedMahadashaYears: lord.years * elapsedRatio,
    remainingMahadashaYears: lord.years * remainingRatio
  });
}

module.exports = { calculateLongitudeProportionalBirthBalance };
