'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepFreeze } = require('../../src/astronomy');
const { SwissNativeAdapter, SwissCanonicalSiderealSunSampler } = require('../../src/astronomy');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../src/dasha');
const { SWISS_GOLDEN_PROVENANCE } = require('../astronomy/fixtures/swiss-golden-fixtures');

const BIRTH = '2000-01-01T00:00:00.000Z';
const BIRTH_EPOCH = new Date(BIRTH).getTime();
const DAY_MS = 86_400_000;
const YEAR_MS = 365 * DAY_MS;
const MOON = 319.5198697609602;
const SUN = 220.07412509999472;
const ephemerisPath = process.env.KUNDLINSIGHTS_SWISS_REFERENCE_EPHEMERIS_PATH;
function canonical(value) { return ((value % 360) + 360) % 360; }
function sampler() { return Object.freeze({ sampleCanonicalSiderealSun: ({ instantUtc }) => deepFreeze({ canonicalSiderealLongitudeDegrees: canonical(SUN + (new Date(instantUtc).getTime() - BIRTH_EPOCH) * 360 / YEAR_MS), provenance: deepFreeze({ provider: 'Synthetic native Lahiri', providerId: 'synthetic-solar-return', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-ecliptic-of-date; native-sidereal-lahiri', requestedFlags: 65794, returnedFlags: 65794, productionAuthority: false }) }) }); }
function solar(input = {}) { return calculateVimshottariDasha({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: MOON, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, canonicalSiderealSunSampler: sampler(), natalSunCanonicalSiderealLongitude: SUN, ...input }); }
function assertTessellates(children, parent) { assert.equal(children[0].startInstant.utc, parent.startInstant.utc); assert.equal(children.at(-1).endInstant.utc, parent.endInstant.utc); for (let index = 1; index < children.length; index += 1) assert.equal(children[index - 1].endInstant.utc, children[index].startInstant.utc); }
function contains(period, epoch) { return BigInt(period.startInstant.epochMilliseconds) <= epoch && epoch < BigInt(period.endInstant.epochMilliseconds); }

test('keeps no-ruleset and explicit Savana calls exactly unchanged without invoking solar infrastructure', () => {
  const input = { birthInstant: '1990-11-26T08:10:00.000Z', moonCanonicalSiderealLongitude: 319.51986976098 };
  const implicit = calculateVimshottariDasha(input);
  const explicit = calculateVimshottariDasha({ ...input, rulesetId: 'vimshottari-longitude-proportional-savana-360-v1' });
  assert.deepEqual(explicit, implicit);
  const mercury = implicit.periods.find((period) => period.lord.id === 'mercury');
  assert.equal(mercury.startInstant.utc, '2026-01-14T16:24:20.789Z');
  assert.equal(mercury.endInstant.utc, '2042-10-17T16:24:20.789Z');
});

test('requires an injected canonical Sun sampler and natal canonical Sun target only for the explicit solar ruleset', () => {
  const base = { birthInstant: BIRTH, moonCanonicalSiderealLongitude: MOON, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id };
  assert.throws(() => calculateVimshottariDasha(base), /canonicalSiderealSunSampler/);
  assert.throws(() => calculateVimshottariDasha({ ...base, canonicalSiderealSunSampler: sampler() }), /natalSunCanonicalSiderealLongitude/);
  assert.throws(() => calculateVimshottariDasha({ ...base, canonicalSiderealSunSampler: sampler(), natalSunCanonicalSiderealLongitude: NaN }), /natalSunCanonicalSiderealLongitude/);
  assert.throws(() => calculateVimshottariDasha({ ...base, canonicalSiderealSunSampler: sampler(), natalSunCanonicalSiderealLongitude: SUN, ruleset: 'vimshottari-longitude-proportional-savana-360-v1' }), /Conflicting/);
  assert.throws(() => calculateVimshottariDasha({ ...base, rulesetId: 'unknown' }), /Unsupported/);
});

test('builds an explicit solar-return Rahu chronology from actual signed return-grid coordinates', () => {
  const result = solar();
  assert.equal(result.ruleset.id, SOLAR_RETURN_VIMSHOTTARI_RULESET.id);
  assert.equal(result.birthContext.nakshatra, 'Shatabhisha');
  assert.equal(result.birthContext.lord.id, 'rahu');
  assert.equal(result.birthContext.remainingRatio, 0.03600976792798605);
  assert.equal(result.birthContext.remainingMahadashaYears, 0.6481758227037488);
  assert.deepEqual(result.periods.map((period) => period.lord.id), ['rahu', 'jupiter', 'saturn', 'mercury', 'ketu', 'venus', 'sun', 'moon', 'mars']);
  assert.ok(Math.abs(result.periods[0].solarYearCoordinates.start + 17.35182417729625) < 1e-12);
  assert.ok(new Date(result.periods[0].startInstant.utc).getTime() < BIRTH_EPOCH);
  assert.ok(new Date(result.periods[0].endInstant.utc).getTime() > BIRTH_EPOCH);
  assert.equal(result.provenance.solarReturn.grid.backwardIntervals, 18);
  assert.equal(result.provenance.solarReturn.grid.forwardIntervals, 103);
});

test('uses actual MD parents for exact MD, AD, and PD tessellation with half-open active selection', () => {
  const result = solar();
  for (const md of result.periods) {
    assertTessellates(md.children, md);
    assert.equal(md.children[0].lord.id, md.lord.id);
    for (const ad of md.children) { assertTessellates(ad.children, ad); assert.equal(ad.children[0].lord.id, ad.lord.id); }
  }
  const rahu = result.periods[0];
  assert.equal(result.activeAtBirth.mahadasha.id, rahu.id);
  const atEnd = BigInt(rahu.endInstant.epochMilliseconds);
  const next = result.periods[1];
  assert.equal(BigInt(next.startInstant.epochMilliseconds), atEnd);
  assert.equal(result.periods.reduce((sum, period) => sum + Number(period.durationExact.numerator), 0), 120);
});

test('is deterministic, deeply immutable, safe-provenance-only, and preserves supplied provider status', () => {
  const input = Object.freeze({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: MOON, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, canonicalSiderealSunSampler: sampler(), natalSunCanonicalSiderealLongitude: SUN });
  const first = calculateVimshottariDasha(input); const second = calculateVimshottariDasha(input);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.periods[0].children[0].children[0]), true);
  assert.equal(first.provenance.solarReturn.sampler.calculationStatus, 'LICENSE_GATED_VALIDATION');
  assert.equal(first.provenance.solarReturn.sampler.productionAuthority, false);
  assert.equal(JSON.stringify(first.provenance).includes('/private/'), false);
});

test('Hyderabad solar chronology remains external-data-gated PROTOTYPE_PARITY rather than independent authority', { skip: !ephemerisPath }, () => {
  const nativeAdapter = new SwissNativeAdapter({ ephemerisPath, manifest: SWISS_GOLDEN_PROVENANCE.manifest });
  const result = calculateVimshottariDasha({ birthInstant: '1990-11-26T08:10:00.000Z', moonCanonicalSiderealLongitude: MOON, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, canonicalSiderealSunSampler: new SwissCanonicalSiderealSunSampler({ nativeAdapter }), natalSunCanonicalSiderealLongitude: SUN });
  const mercury = result.periods.find((period) => period.lord.id === 'mercury');
  assert.equal(mercury.startInstant.utc, '2026-07-21T01:33:54.601Z');
  assert.equal(mercury.endInstant.utc, '2043-07-21T10:16:28.360Z');
  assert.equal(mercury.children[0].endInstant.utc, '2028-12-16T17:23:56.383Z');
  assert.equal(mercury.children[0].children[0].endInstant.utc, '2026-11-22T16:24:29.853Z');
  const atReading = BigInt(new Date('2026-08-12T00:00:00.000Z').getTime());
  const md = result.periods.find((period) => contains(period, atReading));
  const ad = md.children.find((period) => contains(period, atReading));
  const pd = ad.children.find((period) => contains(period, atReading));
  assert.deepEqual([md.lord.id, ad.lord.id, pd.lord.id], ['mercury', 'mercury', 'mercury']);
  assert.equal(result.provenance.solarReturn.sampler.calculationStatus, 'LICENSE_GATED_VALIDATION');
  assert.equal(result.provenance.solarReturn.sampler.productionAuthority, false);
});
