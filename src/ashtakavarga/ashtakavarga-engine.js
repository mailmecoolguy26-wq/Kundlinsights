'use strict';

const { BAV_RULESET_ID, SAV_RULESET_ID } = require('./reference-data');
const { calculateAllBhinnashtakavargas } = require('./bhinnashtakavarga');
const { calculateRawSarvashtakavarga } = require('./sarvashtakavarga');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function calculateRawAshtakavarga({ rashiPlacements } = {}) {
  const { planetaryBavs, lagnaBav } = calculateAllBhinnashtakavargas({ rashiPlacements });
  const rawSarvashtakavarga = calculateRawSarvashtakavarga({ planetaryBavs });
  return freeze({ rulesetId: BAV_RULESET_ID, planetaryBavs, lagnaBav, rawSarvashtakavarga, provenance: {
    providerIndependent: true, rulesets: [BAV_RULESET_ID, SAV_RULESET_ID], astronomyCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', longitudeCalculation: 'not-performed', houseCalculation: 'not-performed', vargaCalculation: 'not-performed', dashaCalculation: 'not-performed', transitCalculation: 'not-performed', coordinateClassification: 'consumed-canonical-d1-rashi-facts', sourceConvention: 'BPHS-Santhanam-Rekha-positive', modernPositiveBinduTerminology: 'later-convention-not-used-as-canonical-field', nodePolicy: 'Rahu and Ketu are neither contributors nor BAV targets in this ruleset.'
  } });
}

module.exports = { calculateRawAshtakavarga };
