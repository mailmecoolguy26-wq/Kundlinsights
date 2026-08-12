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
const BODY_LONGITUDES = Object.freeze({ Sun: 220.07412509999472, Moon: 319.51986976098, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });
const place = deepFreeze(createResolvedBirthPlace({ provider: 'mapbox-geocoding', providerPlaceId: 'p4-hyderabad', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16' } }));

function request(extra = {}) { return { birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: READING, locale: 'en-IN', ...extra }; }
function canonical(value) { return ((value % 360) + 360) % 360; }
function bodies() {
  return Object.fromEntries(Object.entries(BODY_LONGITUDES).map(([body, longitude]) => [body, deepFreeze({
    body, siderealLongitudeDegrees: longitude, siderealMetadata: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'LICENSE_GATED_VALIDATION' }), tropicalLongitudeDegrees: null,
    longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : 1, motion: body === 'Ascendant' ? null : 'direct', provenance: deepFreeze({ coordinateProvenance: 'provider-native' }),
  })]));
}
function engine() {
  const calls = [];
  return { calls, calculate(input) {
    calls.push(deepFreeze({ ...input }));
    const utc = input.timezone === 'UTC' ? `${input.date}T${input.time}Z` : BIRTH;
    return deepFreeze({ bodies: deepFreeze(bodies()), instant: deepFreeze({ utc, unixMilliseconds: Date.parse(utc) }), sidereal: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: deepFreeze({ providerId: 'synthetic-solar-return', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) });
  } };
}
function sampler(options = {}) {
  const calls = [];
  const provenance = { providerId: options.providerId || 'synthetic-solar-return', swissVersion: options.swissVersion || 'test', calculationStatus: options.calculationStatus || 'LICENSE_GATED_VALIDATION', siderealMode: options.siderealMode || 'SE_SIDM_LAHIRI', coordinateProvenance: options.coordinateProvenance || 'provider-native', productionAuthority: options.productionAuthority ?? false, coordinateFrame: 'geocentric-ecliptic-of-date; native-sidereal-lahiri', localPath: '/private/never-leak' };
  return { calls, sampleCanonicalSiderealSun({ instantUtc }) { calls.push(instantUtc); return deepFreeze({ canonicalSiderealLongitudeDegrees: canonical(BODY_LONGITUDES.Sun + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * DAY_MS)), provenance: deepFreeze(provenance) }); } };
}
function activeLords(dasha, instant) {
  const time = Date.parse(instant); const contains = (period) => Date.parse(period.startInstant.utc) <= time && time < Date.parse(period.endInstant.utc);
  const md = dasha.periods.find(contains); const ad = md.children.find(contains); const pd = ad.children.find(contains);
  return [md.lord.id, ad.lord.id, pd.lord.id];
}

test('keeps legacy and explicit Savana constructor paths identical and preserves the locked Hyderabad Savana active period', () => {
  const legacy = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine() }).generate(deepFreeze(request()));
  const explicit = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), dashaRulesetId: 'vimshottari-longitude-proportional-savana-360-v1' }).generate(deepFreeze(request()));
  assert.deepEqual(explicit, legacy);
  const dasha = calculateVimshottariDasha({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: BODY_LONGITUDES.Moon });
  assert.deepEqual(activeLords(dasha, READING), ['mercury', 'mercury', 'venus']);
  assert.equal(legacy.provenance.dashaRulesetId, 'vimshottari-longitude-proportional-savana-360-v1');
  assert.equal(legacy.provenance.dashaTiming.providerSamplerConsistency, 'NOT_APPLICABLE');
});

test('uses an injected solar sampler with birth-snapshot Moon and Sun, without a second Lahiri conversion', () => {
  const fixture = engine(); const injected = sampler();
  const result = new BirthCareerReadingOrchestrator({ astronomicalEngine: fixture, canonicalSiderealSunSampler: injected, dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' }).generate(deepFreeze(request()));
  assert.ok(injected.calls.includes(BIRTH));
  assert.equal(fixture.calls.length, 2);
  assert.equal(result.provenance.dashaRulesetId, 'vimshottari-longitude-proportional-solar-return-v1');
  assert.deepEqual(result.provenance.dashaTiming, {
    dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1', dashaTimeConventionId: 'solar-return-lahiri-grid-v1', dashaCalculationStatus: 'LICENSE_GATED_VALIDATION', providerSamplerConsistency: 'COMPATIBLE_WHERE_COMPARABLE', solarReturnSolverId: 'solar-return-lahiri-bisection-v1', solarYearInterpolationId: 'solar-return-grid-linear-time-interpolation-v1',
  });
  assert.equal(result.provenance.productionAuthority, false);
  assert.equal(JSON.stringify(result).includes('/private/'), false);
  assert.equal(Object.isFrozen(result), true);
});

test('selects the solar chronology whose active Hyderabad hierarchy is Mercury/Mercury/Mercury', () => {
  const injected = sampler();
  const solar = calculateVimshottariDasha({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: BODY_LONGITUDES.Moon, natalSunCanonicalSiderealLongitude: BODY_LONGITUDES.Sun, canonicalSiderealSunSampler: injected, rulesetId: 'vimshottari-longitude-proportional-solar-return-v1' });
  assert.deepEqual(activeLords(solar, READING), ['mercury', 'mercury', 'mercury']);
  assert.equal(solar.ruleset.id, 'vimshottari-longitude-proportional-solar-return-v1');
});

test('fails closed for missing, unknown, mismatched, or request-injected solar infrastructure', () => {
  assert.throws(() => new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' }), /canonicalSiderealSunSampler/);
  assert.throws(() => new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), dashaRulesetId: 'unknown' }), /Unsupported/);
  assert.throws(() => new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), dashaRulesetId: { id: 'vimshottari-longitude-proportional-savana-360-v1' } }), /string identifier/);
  const mismatched = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler({ siderealMode: 'OTHER' }), dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' });
  assert.throws(() => mismatched.generate(request()), (error) => error.code === 'INCOMPATIBLE_SOLAR_DASHA_PROVIDER_PROVENANCE');
  const legacy = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine() });
  assert.throws(() => legacy.generate(request({ dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' })), /runtime infrastructure/);
  assert.throws(() => legacy.generate(request({ canonicalSiderealSunSampler: sampler() })), /runtime infrastructure/);
});

test('solar chronology is deterministic and preserves the supplied Layer 15A pipeline', () => {
  const first = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' }).generate(deepFreeze(request()));
  const second = new BirthCareerReadingOrchestrator({ astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' }).generate(deepFreeze(request()));
  assert.deepEqual(first, second);
  assert.equal(first.provenance.layer15aRulesetId, 'kundlinsights-career-orchestrator-v1');
});

test('leaves Layer 1-backed natal, Gochar, and transit-event inputs identical between chronology selections', () => {
  const range = { startInstant: READING, endInstant: '2026-08-12T01:00:00.000Z' };
  const savanaEngine = engine(); const solarEngine = engine();
  new BirthCareerReadingOrchestrator({ astronomicalEngine: savanaEngine }).generate(deepFreeze(request({ transitScanRange: range })));
  new BirthCareerReadingOrchestrator({ astronomicalEngine: solarEngine, canonicalSiderealSunSampler: sampler(), dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1' }).generate(deepFreeze(request({ transitScanRange: range })));
  assert.deepEqual(solarEngine.calls, savanaEngine.calls);
});
