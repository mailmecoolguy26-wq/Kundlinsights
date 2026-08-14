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

function coordinatePlacement({ body, coordinate, house }) {
  const rashi = coordinate.varga.derivedVargaRashi;
  return freeze({
    body,
    sign: sign(rashi),
    degreeWithinSign: rashi.degreesWithinResultingRashi,
    house,
  });
}

function houseSignAssignments(houses) {
  return freeze(
    houses.houses.map((house) =>
      freeze({ house: house.houseNumber, sign: sign(house.rashi) }),
    ),
  );
}

function toDivisionalChartDto({ birthProfileId, chartType, coordinates, houses }) {
  if (!birthProfileId || !['D9', 'D10'].includes(chartType) || !coordinates || !houses) {
    throw new TypeError('Divisional chart DTO requires an approved chart and completed projection.');
  }
  const houseByBody = new Map(
    houses.planetaryAssignments.map((item) => [item.body, item.rashiHouseNumber]),
  );
  const ascendant = coordinatePlacement({
    body: 'Ascendant',
    coordinate: coordinates.Ascendant,
    house: houses.ascendant.rashiHouseNumber,
  });
  const planets = GRAHAS.map((body) =>
    coordinatePlacement({
      body,
      coordinate: coordinates[body],
      house: houseByBody.get(body),
    }),
  );
  return freeze({
    birthProfileId,
    chart: chartType,
    ascendant,
    houses: houseSignAssignments(houses),
    planets,
    calculation: freeze({
      zodiac: 'sidereal',
      degreeWithinSign:
        'KundlInsights Varga engine coordinate within the derived resulting Rashi.',
      houseSystemId: houses.houseSystemId,
    }),
  });
}

module.exports = { GRAHAS, toDivisionalChartDto };
