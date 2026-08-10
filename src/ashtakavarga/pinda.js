'use strict';

const { PLANETARY_TARGET_ORDER, RASHI_DEFINITIONS, SHODHANA_RULESET_ID } = require('./reference-data');
const { DEFAULT_PINDA_RULESET_ID, getPindaRuleset } = require('./pinda-reference-data');
const { normalizePlacement } = require('./ekadhipatya-shodhana');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function validateShodhitaBav(shodhitaBav) {
  if (!shodhitaBav || typeof shodhitaBav !== 'object' || Array.isArray(shodhitaBav)) throw new TypeError('shodhitaBav must be an object.');
  if (!PLANETARY_TARGET_ORDER.includes(shodhitaBav.targetBody)) throw new RangeError(`Unsupported Pinda target: ${shodhitaBav.targetBody}`);
  if (shodhitaBav.shodhanaRulesetId !== SHODHANA_RULESET_ID) throw new RangeError('shodhitaBav must be a Layer 11B Shodhita BAV result.');
  if (!Array.isArray(shodhitaBav.rashis) || shodhitaBav.rashis.length !== 12) throw new RangeError('shodhitaBav must contain exactly 12 canonical Rashis.');
  shodhitaBav.rashis.forEach((rashi, index) => {
    const expected = RASHI_DEFINITIONS[index];
    if (!rashi || rashi.rashiIndex !== expected.rashiIndex || rashi.rashiName !== expected.sanskritName) throw new RangeError('shodhitaBav Rashis must be in canonical order.');
    if (!Number.isInteger(rashi.rawFavorableMarkCount) || rashi.rawFavorableMarkCount < 0 || !Number.isInteger(rashi.afterTrikonaFavorableMarkCount) || rashi.afterTrikonaFavorableMarkCount < 0 || !Number.isInteger(rashi.afterEkapadhipatyaFavorableMarkCount) || rashi.afterEkapadhipatyaFavorableMarkCount < 0 || rashi.favorableMarkCount !== rashi.afterEkapadhipatyaFavorableMarkCount) throw new RangeError('shodhitaBav must retain non-negative integer post-Ekapadhipatya evidence.');
  });
  return shodhitaBav;
}
function normalizeNatalPlacements(natalPlacements) {
  if (!natalPlacements || typeof natalPlacements !== 'object' || Array.isArray(natalPlacements)) throw new TypeError('natalPlacements must be an object.');
  return Object.fromEntries(PLANETARY_TARGET_ORDER.map((body) => [body, normalizePlacement(body, natalPlacements[body])]));
}
function calculateAshtakavargaPinda({ shodhitaBav, natalPlacements, rulesetId = DEFAULT_PINDA_RULESET_ID } = {}) {
  validateShodhitaBav(shodhitaBav);
  const placements = normalizeNatalPlacements(natalPlacements);
  const ruleset = getPindaRuleset(rulesetId);
  const rashiContributions = RASHI_DEFINITIONS.map((rashi, index) => {
    const shodhitaValue = shodhitaBav.rashis[index].favorableMarkCount;
    const multiplier = ruleset.rashiMultipliers[index];
    return { rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, shodhitaValue, multiplier, contribution: shodhitaValue * multiplier };
  });
  const grahaContributions = PLANETARY_TARGET_ORDER.map((graha) => {
    const natalRashiIndex = placements[graha];
    const rashi = RASHI_DEFINITIONS[natalRashiIndex - 1];
    const shodhitaValue = shodhitaBav.rashis[natalRashiIndex - 1].favorableMarkCount;
    const multiplier = ruleset.grahaMultipliers[graha];
    return { graha, natalRashiIndex, natalRashiName: rashi.sanskritName, shodhitaValue, multiplier, contribution: shodhitaValue * multiplier };
  });
  const rashiPinda = rashiContributions.reduce((sum, entry) => sum + entry.contribution, 0);
  const grahaPinda = grahaContributions.reduce((sum, entry) => sum + entry.contribution, 0);
  return freeze({ targetBody: shodhitaBav.targetBody, rulesetId: ruleset.id, rashiPinda, grahaPinda, totalPinda: rashiPinda + grahaPinda, evidence: { rashiContributions, grahaContributions }, provenance: { layer: '11C', operation: 'ashtakavarga-pinda', rulesetId: ruleset.id, sourceRulesets: ruleset.source, terminology: { classicalPrimaryName: 'Yoga Pinda', laterAliases: ['Shodhya Pinda', 'Shuddha Pinda'] }, shodhitaInput: 'Layer-11B-post-Trikona-and-Ekapadhipatya-only', excludedTargets: ['Ascendant', 'Rahu', 'Ketu'], excludedGrahaParticipants: ['Ascendant', 'Rahu', 'Ketu'], astronomyCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', longitudeCalculation: 'not-performed', houseCalculation: 'not-performed', vargaCalculation: 'not-performed', dashaCalculation: 'not-performed', transitCalculation: 'not-performed', panchangaCalculation: 'not-performed', interpretation: 'not-performed', prediction: 'not-performed' } });
}

module.exports = { validateShodhitaBav, normalizeNatalPlacements, calculateAshtakavargaPinda };
