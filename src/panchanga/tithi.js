'use strict';
const { RULESET_IDS, TITHI_NAMES } = require('./reference-data');
const { classifyEqualInterval } = require('./angular-intervals');
function calculateTithi(elongationDegrees) {
  const interval = classifyEqualInterval(elongationDegrees, 30);
  return { rulesetId: RULESET_IDS.tithi, tithiIndex: interval.index, pakshaIndex: interval.index <= 15 ? 1 : 2, name: TITHI_NAMES[interval.index - 1], elongationDegrees, degreesElapsed: interval.degreesElapsed, degreesRemaining: interval.degreesRemaining, progressRatio: interval.progressRatio, boundaryStatus: interval.boundaryStatus };
}
function calculatePaksha(elongationDegrees) {
  const index = elongationDegrees < 180 ? 1 : 2;
  return { rulesetId: RULESET_IDS.paksha, index, name: index === 1 ? 'Shukla' : 'Krishna', elongationDegrees, boundaryStatus: elongationDegrees === 0 || elongationDegrees === 180 ? 'exactBoundary' : 'withinInterval' };
}
module.exports = { calculateTithi, calculatePaksha };
