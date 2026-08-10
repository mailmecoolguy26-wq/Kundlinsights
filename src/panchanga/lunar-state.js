'use strict';
const { RULESET_IDS } = require('./reference-data');
function calculateLunarPhaseState(elongationDegrees) {
  const state = elongationDegrees === 0 ? 'newMoon' : elongationDegrees === 180 ? 'fullMoon' : elongationDegrees < 180 ? 'waxing' : 'waning';
  return { rulesetId: RULESET_IDS.lunarPhaseState, state, elongationDegrees, boundaryStatus: state === 'newMoon' || state === 'fullMoon' ? 'exactSyzygy' : 'withinPhase' };
}
module.exports = { calculateLunarPhaseState };
