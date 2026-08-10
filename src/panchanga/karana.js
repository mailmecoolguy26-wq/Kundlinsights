'use strict';
const { RULESET_IDS, MOVABLE_KARANAS, KARANA_ALIASES } = require('./reference-data');
const { classifyEqualInterval } = require('./angular-intervals');
function karanaName(positionIndex) {
  if (positionIndex === 1) return 'Kimstughna';
  if (positionIndex >= 58) return ['Shakuni', 'Chatushpada', 'Naga'][positionIndex - 58];
  return MOVABLE_KARANAS[(positionIndex - 2) % MOVABLE_KARANAS.length];
}
function calculateKarana(elongationDegrees) {
  const interval = classifyEqualInterval(elongationDegrees, 60);
  const name = karanaName(interval.index);
  return { rulesetId: RULESET_IDS.karana, positionIndex: interval.index, name, aliases: KARANA_ALIASES[name] || [], elongationDegrees, degreesElapsed: interval.degreesElapsed, degreesRemaining: interval.degreesRemaining, progressRatio: interval.progressRatio, boundaryStatus: interval.boundaryStatus };
}
module.exports = { calculateKarana, karanaName };
