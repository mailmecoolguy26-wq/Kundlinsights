'use strict';

function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); return value; }

function buildSolarReturnVimshottariProvenance({ ruleset, natalSunCanonicalSiderealLongitude, grid, samplerProvenance }) {
  const allowed = ['provider', 'providerId', 'swissVersion', 'binding', 'calculationStatus', 'ephemerisMode', 'siderealMode', 'coordinateFrame', 'coordinateProvenance', 'body', 'requestedFlags', 'returnedFlags', 'productionAuthority'];
  const sampler = Object.fromEntries(allowed.filter((key) => Object.hasOwn(samplerProvenance, key)).map((key) => [key, samplerProvenance[key]]));
  return deepFreeze({
    rulesetId: ruleset.id,
    timeConventionId: ruleset.timeConventionId,
    solarReturnSolverId: 'solar-return-lahiri-bisection-v1',
    solarYearInterpolationId: 'solar-return-grid-linear-time-interpolation-v1',
    balanceMethodId: ruleset.balanceMethodId,
    nakshatraClassification: 'Layer 2 canonical sidereal longitude classification',
    natalSunCanonicalSiderealLongitude,
    grid: { backwardIntervals: grid.backwardIntervals, forwardIntervals: grid.forwardIntervals, maxBackwardIntervals: grid.maxBackwardIntervals, maxForwardIntervals: grid.maxForwardIntervals, targetPolicy: grid.provenance.targetPolicy },
    timestampRoundingPolicy: 'integer UTC milliseconds; MD coordinates interpolate with Math.round; AD/PD use cumulative BigInt partition boundaries.',
    partitionPolicy: 'actual parent interval × cumulative nominal Vimshottari weights / 120; final child ends exactly at parent end.',
    sampler: deepFreeze(sampler)
  });
}

module.exports = { buildSolarReturnVimshottariProvenance };
