'use strict';

const { assertCanonicalUtcInstant, deepFreeze } = require('../../astronomy/canonical-sidereal-sun-sampler');
const { MAX_SOLAR_RETURN_INTERVALS } = require('./reference-data');
const { normalizeSolarReturnTarget, solveSolarReturn } = require('./solar-return-solver');
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

module.exports = { buildSolarReturnGrid };
