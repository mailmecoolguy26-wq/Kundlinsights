'use strict';

const { assertCanonicalUtcInstant, validateCanonicalSiderealSunSample, deepFreeze } = require('../../astronomy/canonical-sidereal-sun-sampler');
const { SOLAR_RETURN_LAHIRI_BISECTION_V1 } = require('./reference-data');
const { SolarReturnError, fail } = require('./solar-return-errors');

const DAY_MS = 86_400_000;
const PREFLIGHT_DAYS = 30;
const MAX_ITERATIONS = 32;

function normalizeLongitude(value) { return ((value % 360) + 360) % 360; }
function normalizeSolarReturnTarget(value) {
  if (!Number.isFinite(value)) fail('INVALID_SOLAR_RETURN_TARGET', 'Solar-return target longitude must be finite.');
  return normalizeLongitude(value);
}
function signedSolarResidual(sample, target) { return normalizeLongitude(sample - target + 180) - 180; }
function epochFromUtc(value, code = 'SOLAR_RETURN_SOLVER_FAILED') {
  try { return assertCanonicalUtcInstant(value).getTime(); } catch (_) { fail(code, 'Solar-return instant must be a canonical UTC ISO instant.'); }
}
function utcFromEpoch(epoch) {
  if (!Number.isSafeInteger(epoch)) fail('SOLAR_RETURN_SOLVER_FAILED', 'Solar-return timestamp is outside the supported Date range.');
  return new Date(epoch).toISOString();
}
function safeSamplerProvenance(provenance) {
  const allowed = ['provider', 'providerId', 'swissVersion', 'binding', 'calculationStatus', 'ephemerisMode', 'siderealMode', 'coordinateFrame', 'coordinateProvenance', 'body', 'requestedFlags', 'returnedFlags', 'productionAuthority'];
  return deepFreeze(Object.fromEntries(allowed.filter((key) => Object.hasOwn(provenance, key)).map((key) => [key, provenance[key]])));
}
function sampleAt(sampler, epoch) {
  if (!sampler || typeof sampler.sampleCanonicalSiderealSun !== 'function') fail('INVALID_SUN_SAMPLE', 'A canonical sidereal Sun sampler is required.');
  let sample;
  try { sample = sampler.sampleCanonicalSiderealSun(Object.freeze({ instantUtc: utcFromEpoch(epoch) })); }
  catch (error) { if (error && error.code === 'INVALID_SUN_SAMPLE') throw error; fail('INVALID_SUN_SAMPLE', `Sun sampler failed: ${error && error.message ? error.message : 'unknown error'}`); }
  try { return validateCanonicalSiderealSunSample(sample); }
  catch (error) { if (error && error.code === 'INVALID_SUN_SAMPLE') throw error; fail('INVALID_SUN_SAMPLE', 'Sun sampler returned an invalid sample.'); }
}
function preflight(sampler, priorEpoch, target) {
  const samples = [];
  for (let day = 350; day <= 350 + PREFLIGHT_DAYS; day += 1) {
    const epoch = priorEpoch + day * DAY_MS;
    const sample = sampleAt(sampler, epoch);
    samples.push({ epoch, residual: signedSolarResidual(sample.canonicalSiderealLongitudeDegrees, target), sample });
  }
  const candidates = [];
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1]; const after = samples[index];
    if (after.residual < before.residual) fail('SOLAR_RETURN_SOLVER_FAILED', 'Solar-return daily preflight observed non-monotonic Sun residuals.');
    if (before.residual < 0 && after.residual >= 0) candidates.push({ low: before, high: after });
  }
  if (candidates.length !== 1) fail('SOLAR_RETURN_BRACKET_NOT_FOUND', candidates.length > 1 ? 'Solar-return daily preflight observed multiple crossings.' : 'Solar-return daily preflight found no target crossing.');
  return candidates[0];
}
function solveSolarReturn({ sampler, priorInstantUtc, targetLongitude, rulesetId = SOLAR_RETURN_LAHIRI_BISECTION_V1.id } = {}) {
  if (rulesetId !== SOLAR_RETURN_LAHIRI_BISECTION_V1.id) fail('UNSUPPORTED_SOLAR_RETURN_RULESET', `Unsupported solar-return ruleset: ${rulesetId}`);
  const priorEpoch = epochFromUtc(priorInstantUtc);
  const target = normalizeSolarReturnTarget(targetLongitude);
  let { low, high } = preflight(sampler, priorEpoch, target);
  let iterations = 0;
  while (high.epoch - low.epoch > 1) {
    if (iterations >= MAX_ITERATIONS) fail('SOLAR_RETURN_ITERATION_LIMIT', 'Solar-return bisection exceeded its fixed iteration cap.');
    const epoch = low.epoch + Math.floor((high.epoch - low.epoch) / 2);
    const sample = sampleAt(sampler, epoch);
    const residual = signedSolarResidual(sample.canonicalSiderealLongitudeDegrees, target);
    if (residual >= 0) high = { epoch, residual, sample }; else low = { epoch, residual, sample };
    iterations += 1;
  }
  if (!(low.residual < 0 && high.residual >= 0)) fail('SOLAR_RETURN_SOLVER_FAILED', 'Solar-return bisection lost its signed crossing bracket.');
  return deepFreeze({ instantUtc: utcFromEpoch(high.epoch), targetLongitude: target, bracketLowUtc: utcFromEpoch(low.epoch), bracketHighUtc: utcFromEpoch(high.epoch), iterations, rulesetId, provenance: deepFreeze({ solver: 'integer-millisecond-bisection', dailyPreflight: '350-to-380-civil-days; one observed negative-to-nonnegative crossing', primaryAcceptance: 'bracket-width-at-most-one-millisecond', sampler: safeSamplerProvenance(high.sample.provenance) }) });
}

module.exports = { DAY_MS, PREFLIGHT_DAYS, MAX_ITERATIONS, normalizeSolarReturnTarget, signedSolarResidual, solveSolarReturn, SolarReturnError };
