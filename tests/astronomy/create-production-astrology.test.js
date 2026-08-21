'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProductionAstrology, ProductionLicenseGateError } = require('../../src/astronomy');

const FLAGS = 2 | 256 | 65536;
const manifest = Object.freeze({ manifestId: 'swiss-test-manifest', releaseId: '2.10.03', files: Object.freeze([{ fileName: 'sepl_18.se1', byteLength: 1, sha256: 'a'.repeat(64) }, { fileName: 'semo_18.se1', byteLength: 1, sha256: 'b'.repeat(64) }]) });

class NativeAdapter {
  constructor({ ephemerisPath, manifest: suppliedManifest }) { if (ephemerisPath !== '/approved/swiss' || suppliedManifest !== manifest) throw new Error('invalid Swiss input'); this.swissVersion = '2.10.03'; this.requestedFlags = FLAGS; }
  julianDayUt() { return 2451545; }
  calculateBody(_jd, body) { const values = { Sun: [256.5157004, 1.0193939], Moon: [199.4705784, 12.0212633], Mars: [304.1100832, 0.7756338], Mercury: [248.036061, 1.5562179], Jupiter: [1.3998649, 0.0407211], Venus: [217.7125709, 1.2090029], Saturn: [16.5424409, -0.0199852], Rahu: [101.1874234, -0.052992] }; const [longitude, speed] = values[body]; return Object.freeze({ longitude, speed, returnedFlags: FLAGS }); }
  calculateAscendant() { return Object.freeze({ longitude: 347.5222842, api: 'houses_ex2', houseSystemCarrier: 'W' }); }
}

test('fails closed until an explicit commercial license confirmation is supplied', () => {
  assert.throws(() => createProductionAstrology({ swissEphemeris: { ephemerisPath: '/approved/swiss', manifest, licenseConfirmed: false } }), ProductionLicenseGateError);
});

test('builds one verified production Swiss authority shared by the engine and canonical Sun sampler', () => {
  const result = createProductionAstrology({ swissEphemeris: { ephemerisPath: '/approved/swiss', manifest, licenseConfirmed: true }, dependencies: { SwissNativeAdapter: NativeAdapter } });
  assert.equal(result.productionAuthority, true);
  assert.equal(result.astronomicalEngine.provider.nativeAdapter, result.nativeAdapter);
  assert.equal(result.canonicalSiderealSunSampler.nativeAdapter, result.nativeAdapter);
  const calculation = result.astronomicalEngine.calculate({ date: '2000-01-01', time: '12:00:00', timezone: 'UTC', latitude: 0, longitude: 0 });
  assert.equal(calculation.provider.productionAuthority, true);
  assert.equal(calculation.provider.calculationStatus, 'PRODUCTION');
  assert.equal(calculation.bodies.Rahu.provenance.nodeModel, 'MEAN_NODE');
  assert.ok(Math.abs(calculation.bodies.Ketu.siderealLongitudeDegrees - ((calculation.bodies.Rahu.siderealLongitudeDegrees + 180) % 360)) < 1e-12);
  assert.equal(calculation.bodies.Ascendant.provenance.api, 'houses_ex2');
  assert.equal(calculation.bodies.Saturn.motion, 'retrograde');
  assert.equal(result.canonicalSiderealSunSampler.sampleCanonicalSiderealSun({ instantUtc: '2000-01-01T12:00:00.000Z' }).provenance.productionAuthority, true);
});
