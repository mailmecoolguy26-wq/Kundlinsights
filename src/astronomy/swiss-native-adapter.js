'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const swephDefault = require('sweph');
const { normalizeLongitude } = require('./sidereal-calculator');
const { SWISS_BINDING, SWISS_VERSION, BODY_CONSTANT_NAMES, REQUIRED_MANIFEST_FILES } = require('./swiss-reference-data');

const initializedPolicies = new WeakMap();

function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); return value; }
function assert(condition, message) { if (!condition) throw new TypeError(message); }
function isSha256(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value); }

function validateManifest(manifest) {
  assert(manifest && typeof manifest === 'object', 'Swiss ephemeris manifest is required.');
  assert(typeof manifest.manifestId === 'string' && manifest.manifestId.length > 0, 'Swiss ephemeris manifestId is required.');
  assert(typeof manifest.releaseId === 'string' && manifest.releaseId.length > 0, 'Swiss ephemeris manifest releaseId is required.');
  assert(Array.isArray(manifest.files), 'Swiss ephemeris manifest files must be an array.');
  const files = manifest.files.map((entry) => {
    assert(entry && typeof entry === 'object', 'Swiss ephemeris manifest file entry must be an object.');
    assert(typeof entry.fileName === 'string' && /^[A-Za-z0-9_.-]+$/.test(entry.fileName), 'Swiss ephemeris manifest fileName is invalid.');
    assert(Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0, 'Swiss ephemeris manifest byteLength is invalid.');
    assert(isSha256(entry.sha256), 'Swiss ephemeris manifest sha256 must be a SHA-256 hex digest.');
    return { fileName: entry.fileName, byteLength: entry.byteLength, sha256: entry.sha256.toLowerCase() };
  });
  for (const fileName of REQUIRED_MANIFEST_FILES) assert(files.some((entry) => entry.fileName === fileName), `Swiss ephemeris manifest must include ${fileName}.`);
  return deepFreeze({ manifestId: manifest.manifestId, releaseId: manifest.releaseId, files });
}

function verifyManifestAtPath(ephemerisPath, manifest) {
  for (const entry of manifest.files) {
    const candidate = path.join(ephemerisPath, entry.fileName);
    const stat = fs.statSync(candidate);
    assert(stat.isFile() && stat.size === entry.byteLength, `Swiss ephemeris manifest byte length mismatch for ${entry.fileName}.`);
    const digest = crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex');
    assert(digest === entry.sha256, `Swiss ephemeris manifest SHA-256 mismatch for ${entry.fileName}.`);
  }
  return true;
}

function motionFromSpeed(speed) { return Math.abs(speed) < 1e-7 ? 'stationary' : speed < 0 ? 'retrograde' : 'direct'; }

class SwissNativeAdapter {
  constructor({ ephemerisPath, manifest, binding = swephDefault, manifestVerifier = verifyManifestAtPath } = {}) {
    assert(binding && typeof binding === 'object', 'Swiss binding is required.');
    assert(typeof ephemerisPath === 'string' && path.isAbsolute(ephemerisPath), 'Swiss ephemerisPath must be absolute.');
    ['version', 'set_ephe_path', 'set_sid_mode', 'calc_ut', 'houses_ex2', 'utc_to_jd'].forEach((name) => assert(typeof binding[name] === 'function', `Swiss binding must expose ${name}().`));
    assert(binding.constants && typeof binding.constants === 'object', 'Swiss binding constants are required.');
    const validatedManifest = validateManifest(manifest);
    const policy = deepFreeze({ ephemerisPath, manifest: validatedManifest });
    const prior = initializedPolicies.get(binding);
    if (prior && JSON.stringify(prior) !== JSON.stringify(policy)) throw new Error('Swiss Ephemeris process-global policy is already initialized and cannot be reconfigured.');
    if (!prior) {
      assert(manifestVerifier(ephemerisPath, validatedManifest) === true, 'Swiss ephemeris manifest verification failed.');
      binding.set_ephe_path(ephemerisPath);
      binding.set_sid_mode(binding.constants.SE_SIDM_LAHIRI, 0, 0);
      const swissVersion = binding.version();
      assert(swissVersion === SWISS_VERSION, `Swiss Ephemeris version must be ${SWISS_VERSION}; received ${swissVersion}.`);
      initializedPolicies.set(binding, policy);
    }
    this.binding = binding;
    this.policy = initializedPolicies.get(binding);
    this.swissVersion = binding.version();
    Object.freeze(this);
  }

  get requestedFlags() { const c = this.binding.constants; return c.SEFLG_SWIEPH | c.SEFLG_SPEED | c.SEFLG_SIDEREAL; }

  julianDayUt(instant) {
    assert(instant instanceof Date && Number.isFinite(instant.getTime()), 'Swiss provider requires a valid UTC Date instant.');
    const converted = this.binding.utc_to_jd(instant.getUTCFullYear(), instant.getUTCMonth() + 1, instant.getUTCDate(), instant.getUTCHours(), instant.getUTCMinutes(), instant.getUTCSeconds() + instant.getUTCMilliseconds() / 1000, this.binding.constants.SE_GREG_CAL);
    assert(converted && converted.flag === this.binding.constants.OK && Array.isArray(converted.data) && Number.isFinite(converted.data[1]), converted && converted.error ? converted.error : 'Swiss UTC/JD conversion failed.');
    return converted.data[1];
  }

  calculateBody(jdUt, body) {
    const constantName = BODY_CONSTANT_NAMES[body];
    assert(constantName, `Unsupported Swiss body ${body}.`);
    const result = this.binding.calc_ut(jdUt, this.binding.constants[constantName], this.requestedFlags);
    this.assertCalcResult(result, body);
    return deepFreeze({ longitude: normalizeLongitude(result.data[0]), speed: result.data[3], returnedFlags: result.flag });
  }

  assertCalcResult(result, body) {
    const c = this.binding.constants;
    assert(result && Number.isInteger(result.flag) && result.flag >= 0, `Swiss calculation failed for ${body}: ${result && result.error ? result.error : 'invalid return status'}`);
    assert(!result.error, `Swiss calculation returned an error for ${body}: ${result.error}`);
    assert(Array.isArray(result.data) && Number.isFinite(result.data[0]) && Number.isFinite(result.data[3]), `Swiss calculation returned invalid coordinate data for ${body}.`);
    for (const flag of [c.SEFLG_SWIEPH, c.SEFLG_SPEED, c.SEFLG_SIDEREAL]) assert((result.flag & flag) === flag, `Swiss calculation for ${body} did not return required flag ${flag}.`);
    assert((result.flag & c.SEFLG_MOSEPH) === 0, `Swiss calculation for ${body} fell back to Moshier.`);
    assert((result.flag & c.SEFLG_JPLEPH) === 0, `Swiss calculation for ${body} switched to JPL.`);
  }

  calculateAscendant(jdUt, observer) {
    assert(observer && Number.isFinite(observer.latitude) && Number.isFinite(observer.longitude) && observer.coordinateReference === 'WGS84', 'Swiss provider requires a WGS84 observer.');
    const result = this.binding.houses_ex2(jdUt, this.binding.constants.SEFLG_SIDEREAL, observer.latitude, observer.longitude, 'W');
    assert(result && result.flag === this.binding.constants.OK && !result.error && result.data && Array.isArray(result.data.points) && Number.isFinite(result.data.points[0]), result && result.error ? result.error : 'Swiss sidereal Ascendant calculation failed.');
    return deepFreeze({ longitude: normalizeLongitude(result.data.points[0]), api: 'houses_ex2', houseSystemCarrier: 'W' });
  }
}

module.exports = { SwissNativeAdapter, validateManifest, verifyManifestAtPath, motionFromSpeed };
