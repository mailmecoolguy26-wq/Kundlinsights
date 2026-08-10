'use strict';

const { classifySiderealLongitude } = require('../jyotish/classify-sidereal-longitude');
const { HOUSE_SYSTEM_ID, rashiWithLord } = require('./reference-data');

function resolveHouseSystemId(houseSystemId = HOUSE_SYSTEM_ID) {
  if (houseSystemId !== HOUSE_SYSTEM_ID) throw new RangeError(`Unsupported house system: ${houseSystemId}`);
  return HOUSE_SYSTEM_ID;
}

function rashiHouseNumber(rashiIndex, ascendantRashiIndex) {
  return ((rashiIndex - ascendantRashiIndex + 12) % 12) + 1;
}

function normalizeBodyLongitude(body, value) {
  const longitude = typeof value === 'number' ? value : value && value.siderealLongitudeDegrees;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new TypeError(`Body ${body} must provide a finite canonical sidereal longitude.`);
  return longitude;
}

function calculateRashiHouses({ ascendantCanonicalSiderealLongitude, bodies = {}, houseSystemId } = {}) {
  const resolvedHouseSystemId = resolveHouseSystemId(houseSystemId);
  if (typeof ascendantCanonicalSiderealLongitude !== 'number' || !Number.isFinite(ascendantCanonicalSiderealLongitude)) throw new TypeError('ascendantCanonicalSiderealLongitude must be a finite number.');
  if (!bodies || typeof bodies !== 'object' || Array.isArray(bodies)) throw new TypeError('bodies must be an object keyed by body name.');

  const ascendantCoordinates = classifySiderealLongitude(ascendantCanonicalSiderealLongitude);
  const ascendantRashiIndex = ascendantCoordinates.rashi.rashiIndex;
  const ascendantRashi = rashiWithLord(ascendantRashiIndex);
  const houses = Object.freeze(Array.from({ length: 12 }, (_, offset) => {
    const houseNumber = offset + 1;
    const rashiIndex = ((ascendantRashiIndex - 1 + offset) % 12) + 1;
    const rashi = rashiWithLord(rashiIndex);
    return Object.freeze({
      houseNumber,
      rashi,
      startLongitude: rashi.startDegrees,
      endLongitude: rashi.endDegrees,
      rashiHouseLord: rashi.rashiLord,
      bhavaMadhyaLongitude: null
    });
  }));

  const planetaryAssignments = Object.freeze(Object.entries(bodies)
    .filter(([body]) => body !== 'Ascendant')
    .map(([body, value]) => {
      const inputLongitude = normalizeBodyLongitude(body, value);
      const coordinates = classifySiderealLongitude(inputLongitude);
      const rashi = rashiWithLord(coordinates.rashi.rashiIndex);
      const houseNumber = rashiHouseNumber(rashi.rashiIndex, ascendantRashiIndex);
      return Object.freeze({
        body,
        canonicalSiderealLongitude: inputLongitude,
        normalizedCanonicalSiderealLongitude: coordinates.normalizedLongitudeDegrees,
        rashi,
        rashiHouseNumber: houseNumber,
        bhavaNumber: houseNumber
      });
    }));

  return Object.freeze({
    rulesetId: resolvedHouseSystemId,
    houseSystemId: resolvedHouseSystemId,
    ascendant: Object.freeze({
      body: 'Ascendant',
      role: 'ascendant-angle',
      canonicalSiderealLongitude: ascendantCanonicalSiderealLongitude,
      normalizedCanonicalSiderealLongitude: ascendantCoordinates.normalizedLongitudeDegrees,
      rashi: ascendantRashi,
      rashiHouseNumber: 1,
      bhavaNumber: 1,
      definesBhava: 1
    }),
    houses,
    planetaryAssignments,
    provenance: Object.freeze({
      providerIndependent: true,
      coordinateFrame: 'canonical-sidereal',
      boundaryPolicy: '[start, end)',
      calculation: 'Rashi containing the canonical sidereal Ascendant is House 1; subsequent Rashis are Houses 2–12 in zodiacal order.',
      bhavaMadhya: 'Not defined for parashari-rashi-house-v1; no Bhava Madhya is fabricated.'
    })
  });
}

module.exports = { calculateRashiHouses, resolveHouseSystemId, rashiHouseNumber };
