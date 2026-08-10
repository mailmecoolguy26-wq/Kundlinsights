'use strict';

const { NAKSHATRA_DEFINITIONS } = require('../jyotish/reference-data');

const VIMSHOTTARI_LORDS = Object.freeze([
  Object.freeze({ id: 'ketu', name: 'Ketu', years: 7 }),
  Object.freeze({ id: 'venus', name: 'Venus', years: 20 }),
  Object.freeze({ id: 'sun', name: 'Sun', years: 6 }),
  Object.freeze({ id: 'moon', name: 'Moon', years: 10 }),
  Object.freeze({ id: 'mars', name: 'Mars', years: 7 }),
  Object.freeze({ id: 'rahu', name: 'Rahu', years: 18 }),
  Object.freeze({ id: 'jupiter', name: 'Jupiter', years: 16 }),
  Object.freeze({ id: 'saturn', name: 'Saturn', years: 19 }),
  Object.freeze({ id: 'mercury', name: 'Mercury', years: 17 })
]);

const VIMSHOTTARI_TOTAL_YEARS = 120;
const LORD_BY_ID = Object.freeze(Object.fromEntries(VIMSHOTTARI_LORDS.map((lord) => [lord.id, lord])));

// Layer 2 is the single source of Nakshatra names, ordering, and lord identity.
const VIMSHOTTARI_NAKSHATRA_MAPPING = Object.freeze(NAKSHATRA_DEFINITIONS.map((nakshatra) => Object.freeze({
  nakshatraIndex: nakshatra.nakshatraIndex,
  name: nakshatra.name,
  lord: LORD_BY_ID[nakshatra.lord.id],
  years: LORD_BY_ID[nakshatra.lord.id].years
})));

function cyclicLordsStartingAt(lordId) {
  const index = VIMSHOTTARI_LORDS.findIndex((lord) => lord.id === lordId);
  if (index === -1) throw new RangeError(`Unknown Vimshottari lord: ${lordId}`);
  return Object.freeze(Array.from({ length: VIMSHOTTARI_LORDS.length }, (_, offset) => VIMSHOTTARI_LORDS[(index + offset) % VIMSHOTTARI_LORDS.length]));
}

module.exports = { VIMSHOTTARI_LORDS, VIMSHOTTARI_TOTAL_YEARS, LORD_BY_ID, VIMSHOTTARI_NAKSHATRA_MAPPING, cyclicLordsStartingAt };
