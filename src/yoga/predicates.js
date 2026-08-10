'use strict';

const { KENDRA_HOUSES, DUSTHANA_HOUSES } = require('./reference-data');

function normalizedRashiOffset(fromRashiIndex, toRashiIndex) {
  return (toRashiIndex - fromRashiIndex + 12) % 12;
}

function isKendraFromRashi(offset) {
  return [0, 3, 6, 9].includes(offset);
}

function kendraOrdinal(offset) {
  return isKendraFromRashi(offset) ? offset + 1 : null;
}

function isKendraHouse(houseNumber) {
  return KENDRA_HOUSES.includes(houseNumber);
}

function isDusthanaHouse(houseNumber) {
  return DUSTHANA_HOUSES.includes(houseNumber);
}

module.exports = { normalizedRashiOffset, isKendraFromRashi, kendraOrdinal, isKendraHouse, isDusthanaHouse };
