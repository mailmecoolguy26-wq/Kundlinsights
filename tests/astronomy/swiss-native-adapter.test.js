'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SwissNativeAdapter, validateManifest, STATIONARY_SPEED_THRESHOLD_DEGREES_PER_DAY } = require('../../src/astronomy');

const FLAGS = { OK: 0, ERR: -1, SEFLG_JPLEPH: 1, SEFLG_SWIEPH: 2, SEFLG_MOSEPH: 4, SEFLG_SPEED: 256, SEFLG_SIDEREAL: 65536, SE_SIDM_LAHIRI: 1, SE_GREG_CAL: 1, SE_SUN: 0, SE_MOON: 1, SE_MARS: 4, SE_MERCURY: 2, SE_JUPITER: 5, SE_VENUS: 3, SE_SATURN: 6, SE_MEAN_NODE: 10, SE_TRUE_NODE: 11 };
const REQUESTED = FLAGS.SEFLG_SWIEPH | FLAGS.SEFLG_SPEED | FLAGS.SEFLG_SIDEREAL;
const manifest = Object.freeze({ manifestId: 'TEST_ONLY_SYNTHETIC_MANIFEST', releaseId: 'test', files: [{ fileName: 'sepl_18.se1', byteLength: 1, sha256: 'a'.repeat(64) }, { fileName: 'semo_18.se1', byteLength: 1, sha256: 'b'.repeat(64) }] });

function mockBinding({ resultFlag = REQUESTED, resultError = '', speed = 1.25, ascendant = 331.2 } = {}) {
  const calls = [];
  return { calls, constants: FLAGS, version: () => '2.10.03', set_ephe_path: (value) => calls.push(['path', value]), set_sid_mode: (...values) => calls.push(['sid', ...values]), utc_to_jd: (...values) => { calls.push(['utc', ...values]); return { flag: 0, data: [2450000.6, 2450000.5] }; }, calc_ut: (...values) => { calls.push(['calc', ...values]); return { flag: resultFlag, error: resultError, data: [values[1] * 10 + 0.25, 0, 1, speed, 0, 0] }; }, houses_ex2: (...values) => { calls.push(['houses', ...values]); return { flag: 0, error: '', data: { points: [ascendant], houses: Array(12).fill(1) } }; } };
}
function adapter(options = {}) { const binding = mockBinding(options); return { binding, adapter: new SwissNativeAdapter({ binding, ephemerisPath: '/test/ephemeris', manifest, manifestVerifier: () => true }) }; }

test('validates the synthetic manifest shape and rejects bad SHA-256 input', () => {
  assert.deepEqual(validateManifest(manifest).files.map(({ fileName }) => fileName), ['sepl_18.se1', 'semo_18.se1']);
  assert.throws(() => validateManifest({ ...manifest, files: [{ ...manifest.files[0], sha256: 'not-a-hash' }, manifest.files[1]] }));
});

test('initializes Lahiri/path once and rejects policy reconfiguration', () => {
  const binding = mockBinding();
  new SwissNativeAdapter({ binding, ephemerisPath: '/test/ephemeris', manifest, manifestVerifier: () => true });
  assert.deepEqual(binding.calls.slice(0, 2), [['path', '/test/ephemeris'], ['sid', FLAGS.SE_SIDM_LAHIRI, 0, 0]]);
  new SwissNativeAdapter({ binding, ephemerisPath: '/test/ephemeris', manifest, manifestVerifier: () => true });
  assert.equal(binding.calls.filter(([name]) => name === 'path').length, 1);
  assert.throws(() => new SwissNativeAdapter({ binding, ephemerisPath: '/other/ephemeris', manifest, manifestVerifier: () => true }), /cannot be reconfigured/);
});

test('uses exact native flags, all approved planet mappings, Mean Node, speed units, and sidereal Ascendant only', () => {
  const { adapter: native, binding } = adapter();
  const jd = native.julianDayUt(new Date('1990-11-26T08:10:00.000Z'));
  assert.equal(jd, 2450000.5);
  for (const [body, constant] of Object.entries({ Sun: FLAGS.SE_SUN, Moon: FLAGS.SE_MOON, Mars: FLAGS.SE_MARS, Mercury: FLAGS.SE_MERCURY, Jupiter: FLAGS.SE_JUPITER, Venus: FLAGS.SE_VENUS, Saturn: FLAGS.SE_SATURN, Rahu: FLAGS.SE_MEAN_NODE })) {
    const result = native.calculateBody(jd, body);
    assert.equal(result.speed, 1.25);
    assert.equal(result.returnedFlags, REQUESTED);
    assert.equal(binding.calls.find(([name, , id]) => name === 'calc' && id === constant)[3], REQUESTED);
  }
  assert.equal(binding.calls.some(([name, , id]) => name === 'calc' && id === FLAGS.SE_TRUE_NODE), false);
  const ascendant = native.calculateAscendant(jd, { latitude: 17.385, longitude: 78.4867, coordinateReference: 'WGS84' });
  assert.ok(Math.abs(ascendant.longitude - 331.2) < 1e-12);
  assert.deepEqual(binding.calls.at(-1), ['houses', jd, FLAGS.SEFLG_SIDEREAL, 17.385, 78.4867, 'W']);
});

test('fails closed for native errors, invalid results, Moshier, JPL, or missing required returned flags', () => {
  for (const options of [{ resultFlag: FLAGS.ERR, resultError: 'failed' }, { resultFlag: FLAGS.SEFLG_MOSEPH | FLAGS.SEFLG_SPEED | FLAGS.SEFLG_SIDEREAL }, { resultFlag: FLAGS.SEFLG_JPLEPH | FLAGS.SEFLG_SPEED | FLAGS.SEFLG_SIDEREAL }, { resultFlag: FLAGS.SEFLG_SWIEPH | FLAGS.SEFLG_SPEED }, { resultFlag: REQUESTED, resultError: 'warning' }]) {
    const { adapter: native } = adapter(options);
    assert.throws(() => native.calculateBody(2450000.5, 'Sun'));
  }
  const { adapter: native } = adapter();
  assert.throws(() => native.julianDayUt(new Date('invalid')));
  assert.throws(() => native.calculateAscendant(2450000.5, { latitude: NaN, longitude: 1, coordinateReference: 'WGS84' }));
});

test('documents the unchanged KundlInsights stationary threshold boundary', () => {
  assert.equal(STATIONARY_SPEED_THRESHOLD_DEGREES_PER_DAY, 1e-7);
  const { motionFromSpeed } = require('../../src/astronomy/swiss-native-adapter');
  assert.equal(motionFromSpeed(1e-8), 'stationary');
  assert.equal(motionFromSpeed(1e-7), 'direct');
  assert.equal(motionFromSpeed(-1e-7), 'retrograde');
  assert.equal(motionFromSpeed(-1e-8), 'stationary');
});
