'use strict';

const { SAV_RULESET_ID, PLANETARY_TARGET_ORDER, RAW_SAV_TOTAL, RASHI_DEFINITIONS } = require('./reference-data');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function calculateRawSarvashtakavarga({ planetaryBavs } = {}) {
  if (!planetaryBavs || typeof planetaryBavs !== 'object') throw new TypeError('planetaryBavs are required.');
  const rashis = RASHI_DEFINITIONS.map((rashi, index) => {
    const byTargetBav = Object.fromEntries(PLANETARY_TARGET_ORDER.map((target) => {
      const value = planetaryBavs[target] && planetaryBavs[target].rashis && planetaryBavs[target].rashis[index] && planetaryBavs[target].rashis[index].favorableMarkCount;
      if (!Number.isInteger(value) || value < 0 || value > 8) throw new TypeError(`Invalid BAV evidence for ${target}.`);
      return [target, value];
    }));
    return { rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, favorableMarkCount: Object.values(byTargetBav).reduce((sum, value) => sum + value, 0), byTargetBav };
  });
  const totalFavorableMarks = rashis.reduce((sum, rashi) => sum + rashi.favorableMarkCount, 0);
  if (totalFavorableMarks !== RAW_SAV_TOTAL) throw new Error('Raw Sarvashtakavarga total invariant failed.');
  return freeze({ rulesetId: SAV_RULESET_ID, rashis, totalFavorableMarks, provenance: { includedTargets: PLANETARY_TARGET_ORDER, excludesLagnaBav: true } });
}

module.exports = { calculateRawSarvashtakavarga };
