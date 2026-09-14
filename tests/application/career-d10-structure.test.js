"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCareerD10Structure,
} = require("../../src/application/divisional-charts");

const sign = (index, englishName) => ({
  rashiIndex: index,
  sanskritName: englishName,
  englishName,
});
function fixture() {
  const bodies = {
    Ascendant: { rashi: sign(1, "Mesha"), rashiHouseNumber: 1, degree: 4 },
    Sun: {
      rashi: sign(2, "Vrishabha"),
      rashiHouseNumber: 2,
      degree: 6,
      retrograde: false,
    },
    Moon: {
      rashi: sign(3, "Mithuna"),
      rashiHouseNumber: 3,
      degree: 7,
      retrograde: false,
    },
    Mars: {
      rashi: sign(4, "Karka"),
      rashiHouseNumber: 4,
      degree: 8,
      retrograde: false,
    },
    Mercury: {
      rashi: sign(5, "Simha"),
      rashiHouseNumber: 5,
      degree: 9,
      retrograde: false,
    },
    Jupiter: {
      rashi: sign(6, "Kanya"),
      rashiHouseNumber: 6,
      degree: 10,
      retrograde: false,
    },
    Venus: {
      rashi: sign(7, "Tula"),
      rashiHouseNumber: 7,
      degree: 11,
      retrograde: false,
    },
    Saturn: {
      rashi: sign(8, "Vrishchika"),
      rashiHouseNumber: 8,
      degree: 12,
      retrograde: true,
    },
    Rahu: {
      rashi: sign(9, "Dhanu"),
      rashiHouseNumber: 9,
      degree: 13,
      retrograde: true,
    },
    Ketu: {
      rashi: sign(10, "Makara"),
      rashiHouseNumber: 10,
      degree: 14,
      retrograde: true,
    },
  };
  return {
    chart: "D10",
    bodies,
    houses: Array.from({ length: 12 }, (_, index) => ({
      houseNumber: index + 1,
      rashi: sign(index + 1, `Rashi${index + 1}`),
      rashiHouseLord: index === 0 ? "Mars" : index === 9 ? "Saturn" : "Sun",
    })),
  };
}

test("buildCareerD10Structure delivers factual D10 placements and supported graha aspects only", () => {
  const result = buildCareerD10Structure({ d10: fixture() });
  assert.equal(result.chart, "D10");
  assert.deepEqual(result.lagna.sign, sign(1, "Rashi1"));
  assert.equal(result.lagna.lord, "Mars");
  assert.equal(result.lagna.lordHouse, 4);
  assert.equal(result.tenthHouse.house, 10);
  assert.equal(result.shani.planet, "Saturn");
  assert.equal(result.shani.retrograde, true);
  assert.deepEqual(result.shani.aspectsToHouses, [
    { house: 10, aspectNumber: 3 },
    { house: 2, aspectNumber: 7 },
    { house: 5, aspectNumber: 10 },
  ]);
  assert.deepEqual(result.tenthHouse.aspectsReceived, [
    { planet: "Mars", aspectNumber: 7 },
    { planet: "Jupiter", aspectNumber: 5 },
    { planet: "Saturn", aspectNumber: 3 },
  ]);
  assert.equal(JSON.stringify(result).includes("score"), false);
  assert.equal(JSON.stringify(result).includes("timing"), false);
});

test("buildCareerD10Structure omits malformed D10 input safely", () => {
  assert.equal(buildCareerD10Structure({ d10: null }), null);
  assert.equal(
    buildCareerD10Structure({ d10: { chart: "D10", bodies: {}, houses: [] } }),
    null,
  );
});
