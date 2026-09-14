"use strict";

// A deliberately factual D10 snapshot for Career Reading delivery.  It uses
// the existing production D10 projection and the already-supported classical
// seven-graha aspect table; it does not evaluate, rank, or predict from them.
const {
  CASTING_GRAHAS,
  FULL_ASPECTS_BY_GRAHA,
} = require("../../drishti/reference-data");
const { freeze } = require("../../synthesis/evidence-node");

const PLANETS = new Set([
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
]);
const LORDS = new Set([
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
]);

function houseNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}
function sign(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !Number.isInteger(value.rashiIndex) ||
    value.rashiIndex < 1 ||
    value.rashiIndex > 12 ||
    typeof value.englishName !== "string"
  )
    return null;
  return freeze({
    rashiIndex: value.rashiIndex,
    ...(typeof value.sanskritName === "string"
      ? { sanskritName: value.sanskritName }
      : {}),
    englishName: value.englishName,
  });
}
function lord(value) {
  const candidate = typeof value === "string" ? value : value && value.name;
  return LORDS.has(candidate) ? candidate : null;
}
function bodyFact(name, value) {
  if (!PLANETS.has(name) || !value || typeof value !== "object") return null;
  const rashi = sign(value.rashi);
  const house = houseNumber(value.rashiHouseNumber);
  if (!rashi || !house) return null;
  const output = { planet: name, sign: rashi, house };
  if (Number.isFinite(value.degree) && value.degree >= 0 && value.degree < 30)
    output.degree = value.degree;
  if (typeof value.retrograde === "boolean")
    output.retrograde = value.retrograde;
  return freeze(output);
}
function houseFact(d10, number, received) {
  const source = Array.isArray(d10.houses)
    ? d10.houses.find((item) => item && item.houseNumber === number)
    : null;
  const rashi = source && sign(source.rashi);
  if (!rashi) return null;
  const value = { house: number, sign: rashi };
  const houseLord = lord(source.rashiHouseLord);
  if (houseLord) value.lord = houseLord;
  const lordPlacement =
    houseLord && bodyFact(houseLord, d10.bodies && d10.bodies[houseLord]);
  if (lordPlacement) value.lordHouse = lordPlacement.house;
  const occupants = Object.entries(d10.bodies || {})
    .map(([name, item]) => bodyFact(name, item))
    .filter((item) => item && item.house === number);
  if (occupants.length) value.occupants = occupants;
  value.aspectsReceived = received;
  return freeze(value);
}
function targetHouse(source, aspectNumber) {
  return ((source + aspectNumber - 2) % 12) + 1;
}
function aspects(d10) {
  const all = [];
  for (const planet of CASTING_GRAHAS) {
    const source = houseNumber(
      d10.bodies && d10.bodies[planet] && d10.bodies[planet].rashiHouseNumber,
    );
    if (!source) continue;
    for (const definition of FULL_ASPECTS_BY_GRAHA[planet])
      all.push(
        freeze({
          planet,
          sourceHouse: source,
          house: targetHouse(source, definition.aspectNumber),
          aspectNumber: definition.aspectNumber,
        }),
      );
  }
  return all;
}

function buildCareerD10Structure({ d10 } = {}) {
  if (!d10 || d10.chart !== "D10" || !d10.bodies || !Array.isArray(d10.houses))
    return null;
  const allAspects = aspects(d10);
  const received = (house) =>
    allAspects
      .filter((item) => item.house === house)
      .map((item) =>
        freeze({ planet: item.planet, aspectNumber: item.aspectNumber }),
      );
  const lagna = houseFact(d10, 1, received(1));
  const tenthHouse = houseFact(d10, 10, received(10));
  const shani = bodyFact("Saturn", d10.bodies.Saturn);
  if (!lagna || !tenthHouse || !shani) return null;
  const conjunctions = Object.entries(d10.bodies)
    .map(([name, item]) => bodyFact(name, item))
    .filter(
      (item) => item && item.planet !== "Saturn" && item.house === shani.house,
    );
  const shaniAspects = allAspects.filter((item) => item.planet === "Saturn");
  return freeze({
    chart: "D10",
    lagna,
    tenthHouse,
    shani: freeze({
      ...shani,
      conjunctions,
      aspectsToHouses: shaniAspects.map((item) =>
        freeze({ house: item.house, aspectNumber: item.aspectNumber }),
      ),
      aspectsToPlanets: shaniAspects.flatMap((aspect) =>
        Object.entries(d10.bodies)
          .map(([name, item]) => bodyFact(name, item))
          .filter((item) => item && item.house === aspect.house)
          .map((item) =>
            freeze({
              planet: item.planet,
              house: item.house,
              aspectNumber: aspect.aspectNumber,
            }),
          ),
      ),
    }),
  });
}

module.exports = { buildCareerD10Structure };
