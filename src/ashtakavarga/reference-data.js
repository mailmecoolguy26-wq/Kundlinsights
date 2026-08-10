'use strict';

const { RASHI_DEFINITIONS } = require('../jyotish/reference-data');

const BAV_RULESET_ID = 'parashari-rekha-bav-santhanam-v1';
const SAV_RULESET_ID = 'parashari-raw-sarvashtakavarga-v1';
const TRIKONA_SHODHANA_RULESET_ID = 'parashari-trikona-shodhana-santhanam-v1';
const EKADHIPATYA_SHODHANA_RULESET_ID = 'parashari-ekadhipatya-shodhana-santhanam-v1';
const SHODHANA_RULESET_ID = 'parashari-ashtakavarga-shodhana-santhanam-v1';
const EKADHIPATYA_OCCUPANCY_POLICY_ID = 'parashari-ekadhipatya-occupancy-seven-graha-v1';
const CONTRIBUTOR_ORDER = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Ascendant']);
const PLANETARY_TARGET_ORDER = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);
const FIXED_TOTALS = Object.freeze({ Sun: 48, Moon: 49, Mars: 39, Mercury: 54, Jupiter: 56, Venus: 52, Saturn: 39, Ascendant: 47 });
const RAW_SAV_TOTAL = 337;
const TRIKONA_GROUPS = Object.freeze([[1, 5, 9], [2, 6, 10], [3, 7, 11], [4, 8, 12]].map(Object.freeze));
const EKADHIPATYA_PAIRS = Object.freeze([
  Object.freeze({ owner: 'Mars', rashiIndices: Object.freeze([1, 8]) }),
  Object.freeze({ owner: 'Mercury', rashiIndices: Object.freeze([3, 6]) }),
  Object.freeze({ owner: 'Jupiter', rashiIndices: Object.freeze([9, 12]) }),
  Object.freeze({ owner: 'Venus', rashiIndices: Object.freeze([2, 7]) }),
  Object.freeze({ owner: 'Saturn', rashiIndices: Object.freeze([10, 11]) }),
]);
const EKADHIPATYA_OCCUPANCY_BODIES = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);

const RAW_FAVORABLE_REKHA_TABLE = {
  Sun: { Sun:[1,2,4,7,8,9,10,11], Moon:[3,6,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[3,5,6,9,10,11,12], Jupiter:[5,6,9,11], Venus:[6,7,12], Saturn:[1,2,4,7,8,9,10,11], Ascendant:[3,4,6,10,11,12] },
  Moon: { Sun:[3,6,7,8,10,11], Moon:[1,3,6,7,9,10,11], Mars:[2,3,5,6,10,11], Mercury:[1,3,4,5,7,8,10,11], Jupiter:[1,2,4,7,8,10,11], Venus:[3,4,5,7,9,10,11], Saturn:[3,5,6,11], Ascendant:[3,6,10,11] },
  Mars: { Sun:[3,5,6,10,11], Moon:[3,6,11], Mars:[1,2,4,7,8,10,11], Mercury:[3,5,6,11], Jupiter:[6,10,11,12], Venus:[6,8,11,12], Saturn:[1,4,7,8,9,10,11], Ascendant:[1,3,6,10,11] },
  Mercury: { Sun:[5,6,9,11,12], Moon:[2,4,6,8,10,11], Mars:[1,2,4,7,8,9,10,11], Mercury:[1,3,5,6,9,10,11,12], Jupiter:[6,8,11,12], Venus:[1,2,3,4,5,8,9,11], Saturn:[1,2,4,7,8,9,10,11], Ascendant:[1,2,4,6,8,10,11] },
  Jupiter: { Sun:[1,2,3,4,7,8,9,10,11], Moon:[2,5,7,9,11], Mars:[1,2,4,7,8,10,11], Mercury:[1,2,4,5,6,9,10,11], Jupiter:[1,2,3,4,7,8,10,11], Venus:[2,5,6,9,10,11], Saturn:[3,5,6,12], Ascendant:[1,2,4,5,6,7,9,10,11] },
  Venus: { Sun:[8,11,12], Moon:[1,2,3,4,5,8,9,11,12], Mars:[3,4,6,9,11,12], Mercury:[3,5,6,9,11], Jupiter:[5,8,9,10,11], Venus:[1,2,3,4,5,8,9,10,11], Saturn:[3,4,5,8,9,10,11], Ascendant:[1,2,3,4,5,8,9,11] },
  Saturn: { Sun:[1,2,4,7,8,10,11], Moon:[3,6,11], Mars:[3,5,6,10,11,12], Mercury:[6,8,9,10,11,12], Jupiter:[5,6,11,12], Venus:[6,11,12], Saturn:[3,5,6,11], Ascendant:[1,3,4,6,10,11] },
  Ascendant: { Sun:[3,4,6,10,11,12], Moon:[3,6,12], Mars:[1,3,6,10,11], Mercury:[1,2,4,6,8,10,11], Jupiter:[1,2,4,5,6,7,9,10,11], Venus:[1,2,3,4,5,8,9], Saturn:[1,3,4,6,10,11], Ascendant:[3,6,10,11] },
};

function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(deepFreeze); return value; }
function validateReferenceData(table = RAW_FAVORABLE_REKHA_TABLE) {
  const targets = [...PLANETARY_TARGET_ORDER, 'Ascendant'];
  for (const target of targets) {
    const rows = table[target];
    if (!rows || typeof rows !== 'object' || Object.keys(rows).length !== CONTRIBUTOR_ORDER.length) throw new TypeError(`Invalid Ashtakavarga table for ${target}.`);
    for (const contributor of CONTRIBUTOR_ORDER) {
      const positions = rows[contributor];
      if (!Array.isArray(positions) || positions.some((position) => !Number.isInteger(position) || position < 1 || position > 12) || new Set(positions).size !== positions.length) throw new TypeError(`Invalid relative positions for ${target}/${contributor}.`);
    }
    const total = CONTRIBUTOR_ORDER.reduce((sum, contributor) => sum + rows[contributor].length, 0);
    if (total !== FIXED_TOTALS[target]) throw new TypeError(`Fixed Ashtakavarga total mismatch for ${target}.`);
  }
  return true;
}

validateReferenceData();
deepFreeze(RAW_FAVORABLE_REKHA_TABLE);

module.exports = { BAV_RULESET_ID, SAV_RULESET_ID, TRIKONA_SHODHANA_RULESET_ID, EKADHIPATYA_SHODHANA_RULESET_ID, SHODHANA_RULESET_ID, EKADHIPATYA_OCCUPANCY_POLICY_ID, CONTRIBUTOR_ORDER, PLANETARY_TARGET_ORDER, FIXED_TOTALS, RAW_SAV_TOTAL, TRIKONA_GROUPS, EKADHIPATYA_PAIRS, EKADHIPATYA_OCCUPANCY_BODIES, RASHI_DEFINITIONS, RAW_FAVORABLE_REKHA_TABLE, validateReferenceData };
