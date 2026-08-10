'use strict';

const { PLANETARY_TARGET_ORDER, SHODHANA_RULESET_ID } = require('./reference-data');
const { validateRawBav, calculateTrikonaShodhana } = require('./trikona-shodhana');
const { calculateEkapadhipatyaShodhana } = require('./ekadhipatya-shodhana');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function calculateShodhitaBhinnashtakavarga({ rawBav, rashiPlacements } = {}) {
  validateRawBav(rawBav);
  const trikonaShodhana = calculateTrikonaShodhana({ rawBav });
  const ekadhipatyaShodhana = calculateEkapadhipatyaShodhana({ trikonaShodhana, rashiPlacements });
  return freeze({ targetBody: rawBav.targetBody, rawBavRulesetId: rawBav.rulesetId, shodhanaRulesetId: SHODHANA_RULESET_ID, occupancyPolicyId: ekadhipatyaShodhana.occupancyPolicyId, trikonaShodhana, ekadhipatyaShodhana, rashis: ekadhipatyaShodhana.rashis, totalFavorableMarks: ekadhipatyaShodhana.totalFavorableMarks, provenance: { arithmetic: 'CLASSICAL_TRANSLATION', operationOrdering: 'CLASSICAL_TRANSLATION', noPindaCalculation: 'not-performed', noInterpretation: 'not-performed', noPrediction: 'not-performed' } });
}
function calculateShodhitaAshtakavarga({ rawAshtakavarga, rashiPlacements } = {}) {
  if (!rawAshtakavarga || typeof rawAshtakavarga !== 'object' || !rawAshtakavarga.planetaryBavs || !rawAshtakavarga.lagnaBav || !rawAshtakavarga.rawSarvashtakavarga) throw new TypeError('rawAshtakavarga must contain Layer 11A BAV and raw SAV results.');
  const planetaryBavs = Object.fromEntries(PLANETARY_TARGET_ORDER.map((body) => [body, calculateShodhitaBhinnashtakavarga({ rawBav: rawAshtakavarga.planetaryBavs[body], rashiPlacements })]));
  const lagnaBav = calculateShodhitaBhinnashtakavarga({ rawBav: rawAshtakavarga.lagnaBav, rashiPlacements });
  return freeze({ rulesetId: SHODHANA_RULESET_ID, planetaryBavs, lagnaBav, rawSarvashtakavarga: rawAshtakavarga.rawSarvashtakavarga, provenance: { providerIndependent: true, sourceLayer: 'Layer-11A-raw-BAV', rawSavTreatment: 'untouched-not-recomputed-not-corrected', astronomyCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', longitudeCalculation: 'not-performed', houseCalculation: 'not-performed', vargaCalculation: 'not-performed', dashaCalculation: 'not-performed', transitCalculation: 'not-performed', pindaCalculation: 'not-performed', interpretation: 'not-performed', prediction: 'not-performed' } });
}

module.exports = { calculateShodhitaBhinnashtakavarga, calculateShodhitaAshtakavarga };
