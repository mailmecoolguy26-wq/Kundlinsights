'use strict';
const { RULESET_IDS, NITYA_YOGA_NAMES } = require('./reference-data');
const { classifyEqualInterval } = require('./angular-intervals');
function calculateNityaYoga(normalizedLongitudeSumDegrees) {
  const interval = classifyEqualInterval(normalizedLongitudeSumDegrees, 27);
  return { rulesetId: RULESET_IDS.nityaYoga, yogaIndex: interval.index, name: NITYA_YOGA_NAMES[interval.index - 1], normalizedLongitudeSumDegrees, degreesElapsed: interval.degreesElapsed, degreesRemaining: interval.degreesRemaining, progressRatio: interval.progressRatio, boundaryStatus: interval.boundaryStatus };
}
module.exports = { calculateNityaYoga };
