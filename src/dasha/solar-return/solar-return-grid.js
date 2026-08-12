'use strict';

const { assertCanonicalUtcInstant, deepFreeze } = require('../../astronomy/canonical-sidereal-sun-sampler');
const { MAX_SOLAR_RETURN_INTERVALS, MAX_BACKWARD_SOLAR_RETURN_INTERVALS } = require('./reference-data');
const { normalizeSolarReturnTarget, solveSolarReturn, solvePreviousSolarReturn } = require('./solar-return-solver');
const { fail } = require('./solar-return-errors');

function buildSolarReturnGrid({ sampler, referenceInstantUtc, targetLongitude, intervals = MAX_SOLAR_RETURN_INTERVALS, rulesetId } = {}) {
  if (!Number.isSafeInteger(intervals) || intervals < 0 || intervals > MAX_SOLAR_RETURN_INTERVALS) fail('SOLAR_RETURN_SOLVER_FAILED', `Solar-return intervals must be an integer from 0 to ${MAX_SOLAR_RETURN_INTERVALS}.`);
  let prior;
  try { prior = assertCanonicalUtcInstant(referenceInstantUtc).toISOString(); } catch (_) { fail('SOLAR_RETURN_SOLVER_FAILED', 'referenceInstantUtc must be a canonical UTC ISO instant.'); }
  const target = normalizeSolarReturnTarget(targetLongitude);
  const entries = [deepFreeze({ index: 0, instantUtc: prior })];
  for (let index = 1; index <= intervals; index += 1) {
    const result = solveSolarReturn({ sampler, priorInstantUtc: prior, targetLongitude: target, rulesetId });
    entries.push(deepFreeze({ index, instantUtc: result.instantUtc, returnResult: result }));
    prior = result.instantUtc;
  }
  return deepFreeze({ referenceInstantUtc: entries[0].instantUtc, targetLongitude: target, maxIntervals: MAX_SOLAR_RETURN_INTERVALS, intervals, entries, provenance: deepFreeze({ targetPolicy: 'constant-original-natal-target', cachePolicy: 'no-global-mutable-cache' }) });
}

function buildBidirectionalSolarReturnGrid({ sampler, referenceInstantUtc, targetLongitude, backwardIntervals = MAX_BACKWARD_SOLAR_RETURN_INTERVALS, forwardIntervals = MAX_SOLAR_RETURN_INTERVALS, rulesetId } = {}) {
  if (!Number.isSafeInteger(backwardIntervals) || backwardIntervals < 0 || backwardIntervals > MAX_BACKWARD_SOLAR_RETURN_INTERVALS) fail('SOLAR_RETURN_SOLVER_FAILED', `Backward solar-return intervals must be an integer from 0 to ${MAX_BACKWARD_SOLAR_RETURN_INTERVALS}.`);
  if (!Number.isSafeInteger(forwardIntervals) || forwardIntervals < 0 || forwardIntervals > MAX_SOLAR_RETURN_INTERVALS) fail('SOLAR_RETURN_SOLVER_FAILED', `Forward solar-return intervals must be an integer from 0 to ${MAX_SOLAR_RETURN_INTERVALS}.`);
  let reference;
  try { reference = assertCanonicalUtcInstant(referenceInstantUtc).toISOString(); } catch (_) { fail('SOLAR_RETURN_SOLVER_FAILED', 'referenceInstantUtc must be a canonical UTC ISO instant.'); }
  const target = normalizeSolarReturnTarget(targetLongitude);
  const negativeEntries = [];
  let next = reference;
  for (let index = -1; index >= -backwardIntervals; index -= 1) {
    const result = solvePreviousSolarReturn({ sampler, nextInstantUtc: next, targetLongitude: target, rulesetId });
    negativeEntries.unshift(deepFreeze({ index, instantUtc: result.instantUtc, returnResult: result }));
    next = result.instantUtc;
  }
  const positiveEntries = [];
  let prior = reference;
  for (let index = 1; index <= forwardIntervals; index += 1) {
    const result = solveSolarReturn({ sampler, priorInstantUtc: prior, targetLongitude: target, rulesetId });
    positiveEntries.push(deepFreeze({ index, instantUtc: result.instantUtc, returnResult: result }));
    prior = result.instantUtc;
  }
  return deepFreeze({ referenceInstantUtc: reference, targetLongitude: target, backwardIntervals, forwardIntervals, maxBackwardIntervals: MAX_BACKWARD_SOLAR_RETURN_INTERVALS, maxForwardIntervals: MAX_SOLAR_RETURN_INTERVALS, entries: Object.freeze([...negativeEntries, deepFreeze({ index: 0, instantUtc: reference }), ...positiveEntries]), provenance: deepFreeze({ targetPolicy: 'constant-original-natal-target', cachePolicy: 'no-global-mutable-cache', directionPolicy: 'actual-independent-previous-and-next-solar-returns' }) });
}

module.exports = { buildSolarReturnGrid, buildBidirectionalSolarReturnGrid };
