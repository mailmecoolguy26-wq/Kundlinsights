'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BirthCareerReadingOrchestrator } = require('../../src/orchestration');
const { createResolvedBirthPlace } = require('../../src/place');
const { deepFreeze } = require('../../src/astronomy');
const { calculateVimshottariDasha } = require('../../src/dasha');

const BIRTH = '1990-11-26T08:10:00.000Z';
const READING = '2026-08-12T00:00:00.000Z';
const DAY_MS = 86_400_000;
const RULESETS = Object.freeze({ savana: 'vimshottari-longitude-proportional-savana-360-v1', solar: 'vimshottari-longitude-proportional-solar-return-v1' });
const LONGITUDES = Object.freeze({ Sun: 220.07412509999472, Moon: 319.51986976098, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });
const place = deepFreeze(createResolvedBirthPlace({ provider: 'mapbox-geocoding', providerPlaceId: 'p5-hyderabad', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16' } }));

function request(extra = {}) { return deepFreeze({ birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: READING, locale: 'en-IN', ...extra }); }
function canonical(value) { return ((value % 360) + 360) % 360; }
function engine() {
  const calls = [];
  const bodies = deepFreeze(Object.fromEntries(Object.entries(LONGITUDES).map(([body, siderealLongitudeDegrees]) => [body, deepFreeze({ body, siderealLongitudeDegrees, tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : 1, motion: body === 'Ascendant' ? null : 'direct', siderealMetadata: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'LICENSE_GATED_VALIDATION' }), provenance: deepFreeze({ coordinateProvenance: 'provider-native' }) })])));
  return { calls, calculate(input) { calls.push(deepFreeze({ ...input })); const utc = input.timezone === 'UTC' ? `${input.date}T${input.time}Z` : BIRTH; return deepFreeze({ bodies, instant: deepFreeze({ utc, unixMilliseconds: Date.parse(utc) }), sidereal: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: deepFreeze({ providerId: 'synthetic-p5', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) }); } };
}
function sampler() { return Object.freeze({ sampleCanonicalSiderealSun({ instantUtc }) { return deepFreeze({ canonicalSiderealLongitudeDegrees: canonical(LONGITUDES.Sun + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * DAY_MS)), provenance: deepFreeze({ providerId: 'synthetic-p5', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', coordinateProvenance: 'provider-native', productionAuthority: false, privatePath: '/private/never-leak' }) }); } }); }
function activeLords(dasha) { const epoch = Date.parse(READING); const contains = (period) => Date.parse(period.startInstant.utc) <= epoch && epoch < Date.parse(period.endInstant.utc); const md = dasha.periods.find(contains); const ad = md.children.find(contains); const pd = ad.children.find(contains); return [md.lord.id, ad.lord.id, pd.lord.id]; }

test('uses solar-return chronology and v2 engine provenance by default for new readings', () => {
  const result = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler() }).generate(request());
  const explicitSolar = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), dashaRulesetId: RULESETS.solar }).generate(request());
  assert.deepEqual(result, explicitSolar);
  assert.equal(result.provenance.engineProfileId, 'kundlinsights-vedic-engine-profile-v2');
  assert.equal(result.provenance.dashaRulesetId, RULESETS.solar);
  assert.equal(result.provenance.dashaTimeConventionId, 'solar-return-lahiri-grid-v1');
  assert.equal(result.provenance.dashaTiming.solarReturnSolverId, 'solar-return-lahiri-bisection-v1');
  assert.equal(result.provenance.dashaTiming.solarYearInterpolationId, 'solar-return-grid-linear-time-interpolation-v1');
  assert.equal(result.provenance.productionAuthority, false);
  assert.equal(JSON.stringify(result).includes('/private/'), false);
  assert.equal(Object.isFrozen(result), true);
  const dasha = calculateVimshottariDasha({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: LONGITUDES.Moon, natalSunCanonicalSiderealLongitude: LONGITUDES.Sun, canonicalSiderealSunSampler: sampler(), rulesetId: RULESETS.solar });
  assert.deepEqual(activeLords(dasha), ['mercury', 'mercury', 'mercury']);
});

test('fails closed for omitted-rule default Solar infrastructure and never falls back to Savana', () => {
  assert.throws(() => new BirthCareerReadingOrchestrator({ astronomicalEngine: engine() }), (error) => error.code === 'MISSING_DEFAULT_SOLAR_DASHA_SAMPLER');
});

test('keeps explicit Savana available without a sampler for legacy reading replay', () => {
  const result = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), dashaRulesetId: RULESETS.savana }).generate(request());
  assert.equal(result.provenance.engineProfileId, 'kundlinsights-vedic-engine-profile-v1');
  assert.equal(result.provenance.dashaRulesetId, RULESETS.savana);
  assert.equal(result.provenance.dashaTiming.providerSamplerConsistency, 'NOT_APPLICABLE');
  const dasha = calculateVimshottariDasha({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: LONGITUDES.Moon, rulesetId: RULESETS.savana });
  assert.deepEqual(activeLords(dasha), ['mercury', 'mercury', 'venus']);
});

test('keeps explicit Solar on the same v2 policy path and rejects caller-selected rulesets', () => {
  const explicit = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), dashaRulesetId: RULESETS.solar }).generate(request());
  assert.equal(explicit.provenance.engineProfileId, 'kundlinsights-vedic-engine-profile-v2');
  assert.throws(() => new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), dashaRulesetId: 'unknown' }), /Unsupported/);
  assert.throws(() => new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler() }).generate(request({ dashaRulesetId: RULESETS.savana })), /runtime infrastructure/);
});
