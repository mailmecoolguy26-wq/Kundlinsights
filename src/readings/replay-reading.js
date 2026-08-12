'use strict';

const { BirthCareerReadingOrchestrator } = require('../orchestration');
const { localDateTimeToUtc } = require('../astronomy/time');
const { resolveEngineProfile } = require('../engine-profiles');
const { freeze } = require('../synthesis/evidence-node');
const { canonicalUtc, digest } = require('./reading-integrity');
const { READING_RECORD_SCHEMA_VERSION, calculationPayload, validateBirthForReplay, recordProvenance } = require('./reading-record');

function replayError(code) { const error = new RangeError(code); error.code = code; return error; }
function comparable(actual, persisted, fields) { return fields.every((key) => persisted[key] === null || persisted[key] === undefined || actual[key] === persisted[key]); }
function validateRecord(record) {
  if (!record || typeof record !== 'object' || record.schemaVersion !== READING_RECORD_SCHEMA_VERSION) throw replayError('UNSUPPORTED_READING_RECORD_SCHEMA');
  if (typeof record.engineProfileId !== 'string' || !record.engineProfileId) throw replayError('MISSING_REPLAY_ENGINE_PROFILE');
  if (!record.integrity || !record.integrity.calculation || !record.integrity.output) throw replayError('INVALID_READING_INTEGRITY');
  return record;
}
function replayPersistedReading({ record, astronomicalRuntime, engineProfileRegistry = { resolveEngineProfile } } = {}) {
  validateRecord(record);
  if (!engineProfileRegistry || typeof engineProfileRegistry.resolveEngineProfile !== 'function') throw replayError('INVALID_ENGINE_PROFILE_REGISTRY');
  let profile;
  try { profile = engineProfileRegistry.resolveEngineProfile(record.engineProfileId); } catch (_) { throw replayError('UNKNOWN_REPLAY_ENGINE_PROFILE'); }
  if (!profile || profile.id !== record.engineProfileId) throw replayError('UNKNOWN_REPLAY_ENGINE_PROFILE');
  const persistedDasha = record.provenance && record.provenance.dasha;
  if (!persistedDasha || persistedDasha.dashaRulesetId !== profile.calculation.dashaRulesetId || persistedDasha.dashaTimeConventionId !== profile.calculation.dashaTimeConventionId) throw replayError('REPLAY_PROFILE_DASHA_MISMATCH');
  if (!astronomicalRuntime || !astronomicalRuntime.astronomicalEngine || typeof astronomicalRuntime.astronomicalEngine.calculate !== 'function') throw replayError('MISSING_REPLAY_ASTRONOMICAL_RUNTIME');
  const birth = record.input && record.input.birth;
  const place = validateBirthForReplay(birth);
  const converter = astronomicalRuntime.timezoneConverter || localDateTimeToUtc;
  let resolvedUtc;
  try { const value = converter({ date: birth.localDate, time: birth.localTime, timezone: birth.timezone }); resolvedUtc = canonicalUtc(value instanceof Date ? value.toISOString() : value); } catch (_) { throw replayError('TIMEZONE_REPLAY_DRIFT'); }
  if (resolvedUtc !== canonicalUtc(birth.utc)) throw replayError('TIMEZONE_REPLAY_DRIFT');
  const solar = profile.calculation.solarReturnSolverId !== undefined;
  const sampler = astronomicalRuntime.canonicalSiderealSunSampler;
  if (solar && (!sampler || typeof sampler.sampleCanonicalSiderealSun !== 'function')) throw replayError('MISSING_REPLAY_SOLAR_DASHA_SAMPLER');
  const orchestrator = new BirthCareerReadingOrchestrator({
    astronomicalEngine: astronomicalRuntime.astronomicalEngine,
    dashaRulesetId: profile.calculation.dashaRulesetId,
    ...(solar ? { canonicalSiderealSunSampler: sampler } : {}),
  });
  let result;
  try {
    result = orchestrator.generate({
      birth: { date: birth.localDate, time: birth.localTime, place },
      readingInstant: record.input.readingInstant,
      ...(record.input.transitScanRange ? { transitScanRange: record.input.transitScanRange } : {}),
      locale: record.input.locale,
    });
  } catch (error) {
    if (error && error.code === 'INCOMPATIBLE_SOLAR_DASHA_PROVIDER_PROVENANCE') throw replayError('REPLAY_PROVIDER_INCOMPATIBLE');
    throw error;
  }
  const actualProvenance = recordProvenance(result);
  if (!comparable(actualProvenance.astronomy, record.provenance.astronomy, ['providerId', 'providerVersion', 'siderealMode', 'nodeModel', 'calculationStatus', 'productionAuthority'])) throw replayError('REPLAY_PROVIDER_INCOMPATIBLE');
  const calculation = digest('sha256', calculationPayload({ engineProfileId: profile.id, input: record.input, provenance: actualProvenance }));
  if (calculation.digest !== record.integrity.calculation.digest) throw replayError('REPLAY_CALCULATION_DIGEST_MISMATCH');
  const output = digest('sha256', { reading: result.reading, readingProvenance: actualProvenance.reading });
  if (output.digest !== record.integrity.output.digest) throw replayError('REPLAY_OUTPUT_DIGEST_MISMATCH');
  return freeze({ result, verification: { engineProfileId: profile.id, calculationDigest: calculation.digest, outputDigest: output.digest, timezone: 'MATCHED', provider: 'COMPATIBLE_WHERE_COMPARABLE', networkAccess: 'not-performed', geocoding: 'not-performed' } });
}

module.exports = { replayPersistedReading };
