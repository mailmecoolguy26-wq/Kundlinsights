'use strict';

const { RASHI_DEFINITIONS } = require('../jyotish/reference-data');

const HOUSE_SYSTEM_ID = 'parashari-rashi-house-v1';

const RASHI_LORDS = Object.freeze({
  1: Object.freeze({ id: 'mars', name: 'Mars' }),
  2: Object.freeze({ id: 'venus', name: 'Venus' }),
  3: Object.freeze({ id: 'mercury', name: 'Mercury' }),
  4: Object.freeze({ id: 'moon', name: 'Moon' }),
  5: Object.freeze({ id: 'sun', name: 'Sun' }),
  6: Object.freeze({ id: 'mercury', name: 'Mercury' }),
  7: Object.freeze({ id: 'venus', name: 'Venus' }),
  8: Object.freeze({ id: 'mars', name: 'Mars' }),
  9: Object.freeze({ id: 'jupiter', name: 'Jupiter' }),
  10: Object.freeze({ id: 'saturn', name: 'Saturn' }),
  11: Object.freeze({ id: 'saturn', name: 'Saturn' }),
  12: Object.freeze({ id: 'jupiter', name: 'Jupiter' })
});

function rashiWithLord(rashiIndex) {
  const rashi = RASHI_DEFINITIONS[rashiIndex - 1];
  if (!rashi) throw new RangeError(`Invalid Rashi index: ${rashiIndex}`);
  return Object.freeze({ ...rashi, rashiLord: RASHI_LORDS[rashiIndex] });
}

module.exports = { HOUSE_SYSTEM_ID, RASHI_LORDS, rashiWithLord };
