'use strict';

const GRAHAS = Object.freeze([
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function sign(rashi) {
  return freeze({
    rashiIndex: rashi.rashiIndex,
    sanskritName: rashi.sanskritName,
    englishName: rashi.englishName,
  });
}

function nakshatra(value) {
  return freeze({
    nakshatraIndex: value.nakshatraIndex,
    name: value.name,
  });
}

function placement({ body, coordinates, house }) {
  return freeze({
    body: body.body,
    longitude: body.siderealLongitudeDegrees,
    sign: sign(coordinates.rashi),
    degreeWithinSign: coordinates.rashi.degreesWithinRashi,
    house,
    nakshatra: nakshatra(coordinates.nakshatra),
    pada: coordinates.pada.pada,
    speed: body.longitudeSpeedDegreesPerDay,
    motion: body.motion,
    retrograde: body.motion === 'retrograde',
  });
}

function safeCalculationMetadata(layer1Result) {
  const provider = layer1Result.provider || {};
  const sidereal = layer1Result.sidereal || {};
  return freeze({
    zodiac: 'sidereal',
    ayanamsha: sidereal.ayanamshaSystem || null,
    siderealMode: sidereal.siderealMode || provider.siderealMode || null,
    nodeModel: provider.nodeModel || null,
    calculationStatus: layer1Result.calculationStatus || provider.calculationStatus || null,
  });
}

function houseSignAssignments(houses) {
  return freeze(houses.houses.map((house) => freeze({
    house: house.houseNumber,
    sign: sign(house.rashi),
  })));
}

function toNatalSummaryDto({ birthProfileId, layer1Result, layer2Bodies, houses }) {
  if (!birthProfileId || !layer1Result || !layer2Bodies || !houses) {
    throw new TypeError('Natal summary DTO requires an owned birth profile and completed Layer 1/2/house results.');
  }
  const ascendantBody = layer1Result.bodies.Ascendant;
  const ascendantCoordinates = layer2Bodies.Ascendant.jyotishCoordinates;
  const ascendant = placement({
    body: ascendantBody,
    coordinates: ascendantCoordinates,
    house: houses.ascendant.rashiHouseNumber,
  });
  const houseByBody = new Map(houses.planetaryAssignments.map((item) => [item.body, item.rashiHouseNumber]));
  const planets = GRAHAS.map((bodyName) => placement({
    body: layer1Result.bodies[bodyName],
    coordinates: layer2Bodies[bodyName].jyotishCoordinates,
    house: houseByBody.get(bodyName),
  }));
  const moon = planets.find((item) => item.body === 'Moon');
  const sun = planets.find((item) => item.body === 'Sun');
  return freeze({
    birthProfileId,
    summary: freeze({
      ascendant,
      moon: freeze({ sign: moon.sign, nakshatra: moon.nakshatra, pada: moon.pada }),
      sun: freeze({ sign: sun.sign }),
    }),
    houses: houseSignAssignments(houses),
    planets,
    calculation: safeCalculationMetadata(layer1Result),
  });
}

module.exports = { GRAHAS, toNatalSummaryDto };
