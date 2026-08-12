'use strict';

const { validateCanonicalSiderealSunSample, deepFreeze } = require('../astronomy/canonical-sidereal-sun-sampler');
const { cyclicLordsStartingAt, VIMSHOTTARI_TOTAL_YEARS } = require('./reference-data');
const { instantFromEpochMilliseconds } = require('./time-conventions');
const { buildAntardashas, findActiveAtBirth } = require('./timeline-builder');
const { buildBidirectionalSolarReturnGrid } = require('./solar-return/solar-return-grid');
const { normalizeSolarReturnTarget } = require('./solar-return/solar-return-solver');
const { instantAtSolarYearCoordinate } = require('./solar-return/solar-year-coordinate');
const { buildSolarReturnVimshottariProvenance } = require('./solar-return-vimshottari-provenance');

function durationExact(numerator, denominator = 1) { return Object.freeze({ numerator: String(numerator), denominator: String(denominator), unit: 'vimshottari-year' }); }
function materializedDuration(milliseconds) { return Object.freeze({ milliseconds: milliseconds.toString() }); }
function freezePeriod(period) { return Object.freeze({ ...period, children: Object.freeze(period.children) }); }
function sampleBirthSun(sampler, birthInstantUtc) {
  if (!sampler || typeof sampler.sampleCanonicalSiderealSun !== 'function') throw new TypeError('Solar-return Vimshottari requires canonicalSiderealSunSampler.');
  try { return validateCanonicalSiderealSunSample(sampler.sampleCanonicalSiderealSun(Object.freeze({ instantUtc: birthInstantUtc }))); }
  catch (error) { if (error && error.code === 'INVALID_SUN_SAMPLE') throw error; const wrapped = new TypeError(`Solar-return Vimshottari Sun sampler failed: ${error && error.message ? error.message : 'unknown error'}`); wrapped.code = 'INVALID_SUN_SAMPLE'; throw wrapped; }
}
function coordinateEpoch(grid, coordinate) {
  const instant = instantAtSolarYearCoordinate({ grid, coordinate }).instantUtc;
  return BigInt(new Date(instant).getTime());
}

function buildSolarReturnVimshottariTimeline({ birthEpochMilliseconds, birthInstantUtc, birthBalance, ruleset, canonicalSiderealSunSampler, natalSunCanonicalSiderealLongitude }) {
  if (!canonicalSiderealSunSampler || typeof canonicalSiderealSunSampler.sampleCanonicalSiderealSun !== 'function') throw new TypeError('Solar-return Vimshottari requires canonicalSiderealSunSampler.');
  if (!Number.isFinite(natalSunCanonicalSiderealLongitude)) throw new TypeError('Solar-return Vimshottari requires natalSunCanonicalSiderealLongitude.');
  const target = normalizeSolarReturnTarget(natalSunCanonicalSiderealLongitude);
  const samplerSample = sampleBirthSun(canonicalSiderealSunSampler, birthInstantUtc);
  const lords = cyclicLordsStartingAt(birthBalance.nakshatra.lord.id);
  const birthStartCoordinate = -birthBalance.elapsedMahadashaYears;
  const finalCoordinate = birthStartCoordinate + VIMSHOTTARI_TOTAL_YEARS;
  const backwardIntervals = Math.ceil(Math.max(0, -birthStartCoordinate));
  const forwardIntervals = Math.ceil(Math.max(0, finalCoordinate));
  const grid = buildBidirectionalSolarReturnGrid({ sampler: canonicalSiderealSunSampler, referenceInstantUtc: birthInstantUtc, targetLongitude: target, backwardIntervals, forwardIntervals });
  let cumulativeYears = 0;
  const periods = Object.freeze(lords.map((lord) => {
    const startCoordinate = birthStartCoordinate + cumulativeYears;
    const endCoordinate = startCoordinate + lord.years;
    const start = coordinateEpoch(grid, startCoordinate);
    const end = coordinateEpoch(grid, endCoordinate);
    const duration = end - start;
    if (duration <= 0n) throw new RangeError('Solar-return Vimshottari produced a nonpositive Mahadasha interval.');
    const id = `MD:${lord.id}`;
    const shell = { id, lord };
    const children = buildAntardashas({ mahadasha: shell, startEpochMilliseconds: start, durationMilliseconds: duration, ruleset });
    cumulativeYears += lord.years;
    return freezePeriod({ id, level: 'mahadasha', lord, parentId: null, startInstant: instantFromEpochMilliseconds(start), endInstant: instantFromEpochMilliseconds(end), durationExact: durationExact(lord.years), materializedDuration: materializedDuration(duration), rulesetId: ruleset.id, solarYearCoordinates: deepFreeze({ start: startCoordinate, end: endCoordinate }), children });
  }));
  return deepFreeze({ periods, activeAtBirth: findActiveAtBirth(periods, birthEpochMilliseconds), grid, provenance: buildSolarReturnVimshottariProvenance({ ruleset, natalSunCanonicalSiderealLongitude: target, grid, samplerProvenance: samplerSample.provenance }) });
}

module.exports = { buildSolarReturnVimshottariTimeline };
