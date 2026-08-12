'use strict';

const { resolveEngineProfile } = require('../engine-profiles');
const { createResolvedBirthPlace } = require('../place');
const { freeze } = require('../synthesis/evidence-node');
const { canonicalUtc, digest } = require('./reading-integrity');

const READING_RECORD_SCHEMA_VERSION = 'kundlinsights-reading-record-v1';

function fail(code) { const error = new RangeError(code); error.code = code; throw error; }
function opaqueId(value, name) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value)) fail(`INVALID_${name.toUpperCase()}`); return value; }
function finite(value, name, minimum, maximum) { if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) fail(`INVALID_${name.toUpperCase()}`); return value; }
function optionalRange(range) {
  if (range === undefined || range === null) return null;
  if (!range || typeof range !== 'object') fail('INVALID_TRANSIT_SCAN_RANGE');
  const startInstant = canonicalUtc(range.startInstant); const endInstant = canonicalUtc(range.endInstant);
  if (Date.parse(startInstant) >= Date.parse(endInstant)) fail('INVALID_TRANSIT_SCAN_RANGE');
  return { startInstant, endInstant };
}
function copyPlace(input) {
  const birth = input && input.birth;
  if (!birth || typeof birth !== 'object') fail('INVALID_READING_INPUT');
  const timezone = birth.timezone;
  const resolution = birth.placeResolution;
  if (!resolution || !resolution.timezoneResolver) fail('INCOMPLETE_TIMEZONE_PROVENANCE');
  return {
    localDate: birth.localDate,
    localTime: birth.localTime,
    timezone,
    utc: canonicalUtc(birth.utc),
    latitude: finite(birth.latitude, 'latitude', -90, 90),
    longitude: finite(birth.longitude, 'longitude', -180, 180),
    placeResolution: {
      resolutionVersion: resolution.resolutionVersion,
      timezoneResolver: {
        provider: resolution.timezoneResolver.provider,
        datasetVersion: resolution.timezoneResolver.datasetVersion,
        datasetChecksum: resolution.timezoneResolver.datasetChecksum,
      },
    },
    display: birth.display && typeof birth.display === 'object' ? { label: typeof birth.display.label === 'string' ? birth.display.label : null } : null,
  };
}
function validateBirthForReplay(birth) {
  const place = createResolvedBirthPlace({
    provider: 'persisted-reading-record', providerPlaceId: 'persisted-record', latitude: birth.latitude, longitude: birth.longitude, timezone: birth.timezone,
    resolutionVersion: birth.placeResolution.resolutionVersion, timezoneResolver: birth.placeResolution.timezoneResolver,
  });
  if (typeof birth.localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birth.localDate) || typeof birth.localTime !== 'string' || !/^\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(birth.localTime)) fail('INVALID_PERSISTED_BIRTH_INPUT');
  return place;
}
function safeAstronomy(provenance) {
  const allowed = ['providerId', 'providerVersion', 'calculationStatus', 'productionAuthority', 'siderealMode', 'nodeModel'];
  return Object.fromEntries(allowed.map((key) => [key, provenance[key] === undefined ? null : provenance[key]]));
}
function safeDasha(provenance) {
  const timing = provenance.dashaTiming || {};
  const allowed = ['dashaRulesetId', 'dashaTimeConventionId', 'dashaCalculationStatus', 'providerSamplerConsistency', 'solarReturnSolverId', 'solarYearInterpolationId'];
  return Object.fromEntries(allowed.map((key) => [key, timing[key] === undefined ? provenance[key] === undefined ? null : provenance[key] : timing[key]]));
}
function recordProvenance(result) {
  const provenance = result && result.provenance;
  if (!provenance || typeof provenance !== 'object') fail('INVALID_READING_PROVENANCE');
  return {
    astronomy: safeAstronomy(provenance),
    timezone: { rulesetId: provenance.timezoneRulesetId || null, datasetVersion: provenance.timezoneDatasetVersion || null },
    dasha: safeDasha(provenance),
    houses: { rulesetId: provenance.houseRulesetId || null },
    reading: { rulesetId: result.reading && result.reading.rulesetId || null, interpretationRulesetId: provenance.layer15aRulesetId || null },
    renderer: { rulesetId: result.renderedReading && result.renderedReading.provenance && result.renderedReading.provenance.rendererRulesetId || null },
  };
}
function calculationPayload({ engineProfileId, input, provenance }) {
  return {
    engineProfileId,
    birth: { utc: input.birth.utc, latitude: input.birth.latitude, longitude: input.birth.longitude, timezone: input.birth.timezone, placeResolution: input.birth.placeResolution },
    readingInstant: input.readingInstant,
    transitScanRange: input.transitScanRange,
    calculationProvenance: { astronomy: provenance.astronomy, timezone: provenance.timezone, dasha: provenance.dasha, houses: provenance.houses },
  };
}
function createReadingRecord({ readingId, createdAt, input, result } = {}) {
  const id = opaqueId(readingId, 'reading_id');
  const profileId = result && result.provenance && result.provenance.engineProfileId;
  const profile = resolveEngineProfile(profileId);
  const birth = copyPlace(input);
  validateBirthForReplay(birth);
  const normalizedInput = { birth, readingInstant: canonicalUtc(input.readingInstant), transitScanRange: optionalRange(input.transitScanRange), locale: input.locale };
  if (typeof normalizedInput.locale !== 'string' || !normalizedInput.locale) fail('INVALID_LOCALE');
  const provenance = recordProvenance(result);
  if (provenance.dasha.dashaRulesetId !== profile.calculation.dashaRulesetId || provenance.dasha.dashaTimeConventionId !== profile.calculation.dashaTimeConventionId) fail('PROFILE_DASHA_MISMATCH');
  if (profile.calculation.solarReturnSolverId && (provenance.dasha.solarReturnSolverId !== profile.calculation.solarReturnSolverId || provenance.dasha.solarYearInterpolationId !== profile.calculation.solarYearInterpolationId)) fail('PROFILE_SOLAR_PROVENANCE_MISMATCH');
  const calculationIdentity = digest('sha256', calculationPayload({ engineProfileId: profile.id, input: normalizedInput, provenance }));
  const outputIntegrity = digest('sha256', { reading: result.reading, readingProvenance: provenance.reading });
  const renderedIntegrity = result.renderedReading ? digest('sha256', { renderedReading: result.renderedReading, rendererProvenance: provenance.renderer }) : null;
  return freeze({ schemaVersion: READING_RECORD_SCHEMA_VERSION, readingId: id, domain: result.domain, createdAt: canonicalUtc(createdAt), engineProfileId: profile.id, input: normalizedInput, provenance, reading: result.reading, renderedReading: result.renderedReading || null, integrity: { calculation: calculationIdentity, output: outputIntegrity, rendered: renderedIntegrity } });
}

module.exports = { READING_RECORD_SCHEMA_VERSION, createReadingRecord, calculationPayload, validateBirthForReplay, recordProvenance };
