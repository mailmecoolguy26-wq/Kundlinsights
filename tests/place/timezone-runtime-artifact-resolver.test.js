'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TimezoneRuntimeArtifactResolver, BirthPlaceResolutionError, BirthPlaceResolver, decodeGeometry } = require('../../src/place');
const { encodeGeometry } = require('../../scripts/build-timezone-runtime-artifact');

const source = Object.freeze({
  provider: 'timezone-boundary-builder', family: '1970', version: '2026c',
  sourceZipSha256: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16',
});
const square = (minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude) => [
  [minimumLongitude, minimumLatitude], [maximumLongitude, minimumLatitude],
  [maximumLongitude, maximumLatitude], [minimumLongitude, maximumLatitude], [minimumLongitude, minimumLatitude],
];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

test('encodes and decodes source coordinates as lossless Float64 values', () => {
  const polygons = [[[
    [78.48670000000001, 17.385000000000002], [78.48670000000001, 17.485000000000003],
    [78.58670000000002, 17.485000000000003], [78.48670000000001, 17.385000000000002],
  ]]];
  const binary = encodeGeometry(polygons);
  assert.deepEqual(decodeGeometry(binary), polygons);
  assert.equal(binary.length, 4 + 4 + 4 + polygons[0][0].length * 16);
});

function artifact(entries, mutateManifest = manifest => manifest) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kundlinsights-a2p2-'));
  const binaryPath = path.join(directory, 'test.bin');
  const chunks = entries.map(entry => encodeGeometry(entry.polygons));
  let offset = 0;
  const features = entries.map((entry, index) => {
    const feature = { tzid: entry.tzid, bbox: entry.bbox, byteOffset: offset, byteLength: chunks[index].length };
    offset += chunks[index].length;
    return feature;
  });
  const binary = Buffer.concat(chunks);
  fs.writeFileSync(binaryPath, binary);
  const manifest = mutateManifest({
    formatId: 'kundlinsights-tbb-binary-v1', buildRuleset: 'timezone-runtime-artifact-build-v1', source,
    binary: { fileName: 'test.bin', byteLength: binary.length, sha256: sha256(binary) }, features,
  });
  const manifestPath = path.join(directory, 'test.manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  return { directory, binaryPath, manifestPath };
}

async function withArtifact(entries, body, mutateManifest) {
  const fixture = artifact(entries, mutateManifest);
  try { return await body(fixture); } finally { fs.rmSync(fixture.directory, { recursive: true, force: true }); }
}

const fixtures = Object.freeze([
  { tzid: 'Asia/Kolkata', bbox: [70, 10, 80, 20], polygons: [[square(70, 10, 80, 20), square(73, 13, 74, 14)]] },
  { tzid: 'Europe/London', bbox: [-5, 50, 5, 60], polygons: [[square(-5, 50, 0, 55)], [square(1, 56, 5, 60)]] },
]);

test('resolves Polygon and MultiPolygon, rejects holes and preserves immutable public provenance', () => withArtifact(fixtures, ({ manifestPath, binaryPath, directory }) => {
  const resolver = new TimezoneRuntimeArtifactResolver({ manifestPath, binaryPath });
  const input = Object.freeze({ latitude: 17.385, longitude: 78.4867 });
  const result = resolver.resolve(input);
  assert.equal(result.timezone, 'Asia/Kolkata');
  assert.equal(resolver.resolve({ latitude: 57, longitude: 2 }).timezone, 'Europe/London');
  assert.throws(() => resolver.resolve({ latitude: 13.5, longitude: 73.5 }), error => error.code === 'UNRESOLVED_TIMEZONE');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.provenance), true);
  assert.equal(JSON.stringify(result).includes(directory), false);
  assert.deepEqual(result, resolver.resolve(input));
  resolver.close();
}));

test('preserves exact-boundary, overlapping-candidate, uncovered, and coordinate validation semantics', () => withArtifact(fixtures, async ({ manifestPath, binaryPath }) => {
  const resolver = new TimezoneRuntimeArtifactResolver({ manifestPath, binaryPath });
  assert.throws(() => resolver.resolve({ latitude: 10, longitude: 75 }), error => error.code === 'AMBIGUOUS_TIMEZONE_BOUNDARY');
  assert.throws(() => resolver.resolve({ latitude: 0, longitude: 0 }), error => error.code === 'UNRESOLVED_TIMEZONE');
  assert.throws(() => resolver.resolve({ latitude: NaN, longitude: 0 }), error => error.code === 'INVALID_COORDINATES');
  assert.throws(() => resolver.resolve({ latitude: 0, longitude: 181 }), error => error.code === 'INVALID_COORDINATES');
  resolver.close();
  await withArtifact([
    { tzid: 'Asia/Kolkata', bbox: [0, 0, 10, 10], polygons: [[square(0, 0, 10, 10)]] },
    { tzid: 'Asia/Dubai', bbox: [0, 0, 10, 10], polygons: [[square(0, 0, 10, 10)]] },
  ], ({ manifestPath: overlapManifest, binaryPath: overlapBinary }) => {
    const overlap = new TimezoneRuntimeArtifactResolver({ manifestPath: overlapManifest, binaryPath: overlapBinary });
    assert.throws(() => overlap.resolve({ latitude: 5, longitude: 5 }), error => error.code === 'AMBIGUOUS_TIMEZONE');
    overlap.close();
  });
}));

test('fails closed for malformed, incompatible, invalid-IANA, wrong-checksum, and wrong-length manifests', async () => {
  const cases = [
    manifest => ({ ...manifest, formatId: 'unsupported-runtime-v99' }),
    manifest => ({ ...manifest, features: [{ ...manifest.features[0], tzid: 'IST' }] }),
    manifest => ({ ...manifest, binary: { ...manifest.binary, sha256: '0'.repeat(64) } }),
    manifest => ({ ...manifest, binary: { ...manifest.binary, byteLength: manifest.binary.byteLength + 1 } }),
    () => ({}),
  ];
  for (const mutateManifest of cases) await withArtifact([fixtures[0]], ({ manifestPath, binaryPath }) => {
    assert.throws(() => new TimezoneRuntimeArtifactResolver({ manifestPath, binaryPath }), BirthPlaceResolutionError);
  }, mutateManifest);
});

test('lookup range-reads only bbox candidates rather than loading the full geometry artifact', () => withArtifact([
  { tzid: 'Asia/Kolkata', bbox: [70, 10, 80, 20], polygons: [[square(70, 10, 80, 20)]] },
  { tzid: 'Europe/London', bbox: [-5, 50, 5, 60], polygons: [[square(-5, 50, 5, 60)]] },
], ({ manifestPath, binaryPath }) => {
  const resolver = new TimezoneRuntimeArtifactResolver({ manifestPath, binaryPath });
  const fullLength = fs.statSync(binaryPath).size;
  const nativeReadSync = fs.readSync;
  const reads = [];
  fs.readSync = function instrumentedReadSync(descriptor, buffer, offset, length, position) {
    if (position !== null) reads.push({ length, position });
    return nativeReadSync.apply(this, arguments);
  };
  try { assert.equal(resolver.resolve({ latitude: 17, longitude: 78 }).timezone, 'Asia/Kolkata'); } finally { fs.readSync = nativeReadSync; resolver.close(); }
  assert.equal(reads.length, 1);
  assert.ok(reads[0].length < fullLength);
  assert.equal(reads[0].position, 0);
}));

test('integrates the optimized resolver through the A1 birth-place contract', async () => withArtifact(fixtures, async ({ manifestPath, binaryPath }) => {
  const timezoneResolver = new TimezoneRuntimeArtifactResolver({ manifestPath, binaryPath });
  const resolver = new BirthPlaceResolver({
    placeProvider: {
      suggest: async () => [],
      resolve: async () => ({ provider: 'mapbox-geocoding', providerPlaceId: 'mock-hyderabad', latitude: 17.385, longitude: 78.4867 }),
    },
    timezoneResolver,
  });
  const place = await resolver.resolveSelection({ providerPlaceId: 'mock-hyderabad' });
  assert.equal(place.timezone, 'Asia/Kolkata');
  assert.deepEqual(place.timezoneResolver, {
    provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: source.sourceZipSha256,
  });
  assert.equal(Object.isFrozen(place), true);
  timezoneResolver.close();
}));
