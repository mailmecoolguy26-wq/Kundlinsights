'use strict';

const { BAV_RULESET_ID, CONTRIBUTOR_ORDER, PLANETARY_TARGET_ORDER, FIXED_TOTALS, RASHI_DEFINITIONS, RAW_FAVORABLE_REKHA_TABLE } = require('./reference-data');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function targetRashiIndex(contributorRashiIndex, relativePosition) { return ((contributorRashiIndex - 1 + relativePosition - 1) % 12) + 1; }
function rashiName(rashiIndex) { return RASHI_DEFINITIONS[rashiIndex - 1].sanskritName; }
function normalizePlacement(body, input) {
  const placement = typeof input === 'number' ? { rashiIndex: input } : input && input.rashi ? input.rashi : input;
  if (!placement || typeof placement !== 'object' || !Number.isInteger(placement.rashiIndex) || placement.rashiIndex < 1 || placement.rashiIndex > 12) throw new TypeError(`${body} must provide a canonical Rashi index.`);
  const expected = RASHI_DEFINITIONS[placement.rashiIndex - 1];
  for (const key of ['rashiName', 'sanskritName', 'englishName']) if (placement[key] !== undefined && placement[key] !== expected.sanskritName && placement[key] !== expected.englishName) throw new RangeError(`${body} supplies contradictory Rashi metadata.`);
  return placement.rashiIndex;
}
function normalizePlacements(rashiPlacements) {
  if (!rashiPlacements || typeof rashiPlacements !== 'object' || Array.isArray(rashiPlacements)) throw new TypeError('rashiPlacements must be an object.');
  return Object.fromEntries(CONTRIBUTOR_ORDER.map((body) => [body, normalizePlacement(body, rashiPlacements[body]) ]));
}
function calculateBhinnashtakavarga({ rashiPlacements, targetBody } = {}) {
  const placements = normalizePlacements(rashiPlacements);
  if (![...PLANETARY_TARGET_ORDER, 'Ascendant'].includes(targetBody)) throw new RangeError(`Unsupported Bhinnashtakavarga target: ${targetBody}`);
  const rules = RAW_FAVORABLE_REKHA_TABLE[targetBody];
  const rashis = RASHI_DEFINITIONS.map((rashi) => {
    const contributors = Object.fromEntries(CONTRIBUTOR_ORDER.map((contributor) => {
      const relativePosition = ((rashi.rashiIndex - placements[contributor] + 12) % 12) + 1;
      return [contributor, rules[contributor].includes(relativePosition)];
    }));
    return { rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, favorableMarkCount: Object.values(contributors).filter(Boolean).length, contributors };
  });
  const totalFavorableMarks = rashis.reduce((sum, rashi) => sum + rashi.favorableMarkCount, 0);
  if (totalFavorableMarks !== FIXED_TOTALS[targetBody]) throw new Error(`Fixed Ashtakavarga total invariant failed for ${targetBody}.`);
  return freeze({ targetBody, rulesetId: BAV_RULESET_ID, rashis, totalFavorableMarks, provenance: { sourceConvention: 'BPHS-Santhanam-Rekha-positive', classicalPositiveMark: 'Rekha' } });
}
function calculateAllBhinnashtakavargas({ rashiPlacements } = {}) {
  const placements = normalizePlacements(rashiPlacements);
  const planetaryBavs = Object.fromEntries(PLANETARY_TARGET_ORDER.map((targetBody) => [targetBody, calculateBhinnashtakavarga({ rashiPlacements: placements, targetBody })]));
  return freeze({ planetaryBavs, lagnaBav: calculateBhinnashtakavarga({ rashiPlacements: placements, targetBody: 'Ascendant' }) });
}

module.exports = { targetRashiIndex, normalizePlacements, calculateBhinnashtakavarga, calculateAllBhinnashtakavargas, rashiName };
