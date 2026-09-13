'use strict';

// A narrow, factual D1 projection over existing house and raw SAV results.
// It intentionally contains no threshold, ranking, timing, or interpretation.
function houseByNumber(houses, number) {
  return houses && Array.isArray(houses.houses)
    ? houses.houses.find((house) => house && house.houseNumber === number) || null
    : null;
}

function savForHouse(rawAshtakavarga, house) {
  if (!house || !house.rashi || !Number.isInteger(house.rashi.rashiIndex)) return null;
  const rashis = rawAshtakavarga && rawAshtakavarga.rawSarvashtakavarga && rawAshtakavarga.rawSarvashtakavarga.rashis;
  const row = Array.isArray(rashis)
    ? rashis.find((item) => item && item.rashiIndex === house.rashi.rashiIndex)
    : null;
  return row && Number.isInteger(row.favorableMarkCount) && row.favorableMarkCount >= 0
    ? row.favorableMarkCount
    : null;
}

function placementByPlanet(houses, planet) {
  const assignments = houses && Array.isArray(houses.planetaryAssignments)
    ? houses.planetaryAssignments
    : [];
  return assignments.find((assignment) => assignment && assignment.body === planet) || null;
}

// There is no existing generic bhava-counting helper. This local, inclusive
// offset is deliberately limited to this factual projection.
function inclusiveHouseOffset(fromHouse, ordinal) {
  if (!Number.isInteger(fromHouse) || fromHouse < 1 || fromHouse > 12 ||
      !Number.isInteger(ordinal) || ordinal < 1) return null;
  return ((fromHouse + ordinal - 2) % 12) + 1;
}

function lordStructure({ houses, rawAshtakavarga, sourceHouse }) {
  const rawLord = sourceHouse && sourceHouse.rashiHouseLord;
  // Production snapshots may carry the canonical planet string. The current
  // house calculator also retains the legacy canonical `{ id, name }` value;
  // this is extraction only, never a second lordship mapping.
  const lord = typeof rawLord === 'string'
    ? rawLord
    : rawLord && typeof rawLord.name === 'string'
    ? rawLord.name
    : null;
  if (typeof lord !== 'string') return null;
  const placement = placementByPlanet(houses, lord);
  if (!placement || !Number.isInteger(placement.rashiHouseNumber)) return { planet: lord };
  const house = houseByNumber(houses, placement.rashiHouseNumber);
  const houseSav = savForHouse(rawAshtakavarga, house);
  return {
    planet: lord,
    house: placement.rashiHouseNumber,
    ...(houseSav === null ? {} : { houseSav }),
  };
}

function buildCareerAshtakavargaStructure({ houses, rawAshtakavarga } = {}) {
  const h10House = houseByNumber(houses, 10);
  const h7House = houseByNumber(houses, 7);
  const h10Sav = savForHouse(rawAshtakavarga, h10House);
  const h7Sav = savForHouse(rawAshtakavarga, h7House);
  const h10Lord = lordStructure({ houses, rawAshtakavarga, sourceHouse: h10House });
  const h7Lord = lordStructure({ houses, rawAshtakavarga, sourceHouse: h7House });
  const tenthHouseNumber = h10Lord && Number.isInteger(h10Lord.house)
    ? inclusiveHouseOffset(h10Lord.house, 10)
    : null;
  const tenthHouse = tenthHouseNumber === null ? null : houseByNumber(houses, tenthHouseNumber);
  const tenthSav = savForHouse(rawAshtakavarga, tenthHouse);
  const value = {
    ...(h10House ? { h10: { house: 10, ...(h10Sav === null ? {} : { sav: h10Sav }) } } : {}),
    ...(h10Lord ? { h10Lord } : {}),
    ...(h7House ? { h7: { house: 7, ...(h7Sav === null ? {} : { sav: h7Sav }) } } : {}),
    ...(h7Lord ? { h7Lord } : {}),
    ...(tenthHouseNumber === null ? {} : {
      tenthFromH10Lord: {
        house: tenthHouseNumber,
        ...(tenthSav === null ? {} : { sav: tenthSav }),
      },
    }),
  };
  return Object.keys(value).length ? Object.freeze(value) : null;
}

module.exports = { buildCareerAshtakavargaStructure, inclusiveHouseOffset };
