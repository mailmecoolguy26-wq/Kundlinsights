'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { buildRuntimeArtifact } = require('../../scripts/build-timezone-runtime-artifact');

const APPROVED_SOURCE_BYTES = 149581087;
const APPROVED_SOURCE_SHA256 = '3ccc7784a2ec07b132db7e27e837a156bc7e100ab93d9fa062bd74f79f9a40bb';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function minimalApprovedSourceFixture() {
  const features = Array.from({ length: 301 }, (_, index) => ({
    type: 'Feature',
    properties: { tzid: `Test/Zone-${String(index).padStart(3, '0')}` },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [index, 0], [index + 0.5, 0], [index + 0.5, 0.5], [index, 0.5], [index, 0],
      ]],
    },
  }));
  const text = JSON.stringify({ type: 'FeatureCollection', features });
  return Object.freeze({
    length: APPROVED_SOURCE_BYTES,
    toString: () => text,
  });
}

test('builds a manifest whose binary byte length and checksum match the generated artifact', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kundlinsights-timezone-builder-'));
  const sourcePath = path.join(directory, 'minimal-approved-source.json');
  const outputDirectory = path.join(directory, 'runtime');
  const existingOutputDirectory = path.join(directory, 'existing-runtime');
  const source = minimalApprovedSourceFixture();
  const nativeReadFileSync = fs.readFileSync;
  const nativeCreateHash = crypto.createHash;
  fs.mkdirSync(existingOutputDirectory);
  fs.readFileSync = function readMinimalApprovedSource(candidate, ...arguments_) {
    return candidate === sourcePath ? source : nativeReadFileSync.call(this, candidate, ...arguments_);
  };
  crypto.createHash = function createApprovedSourceHash(algorithm, options) {
    const hash = nativeCreateHash.call(this, algorithm, options);
    let approvedSource = false;
    return {
      update(value, ...arguments_) {
        if (value === source) {
          approvedSource = true;
          return this;
        }
        hash.update(value, ...arguments_);
        return this;
      },
      digest(...arguments_) {
        return approvedSource ? APPROVED_SOURCE_SHA256 : hash.digest(...arguments_);
      },
    };
  };
  try {
    const result = buildRuntimeArtifact({ sourcePath, outputDirectory });
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
    const binary = fs.readFileSync(result.binaryPath);
    assert.equal(manifest.binary.fileName, 'tbb-2026c-1970.bin');
    assert.equal(path.basename(result.manifestPath), 'tbb-2026c-1970.manifest.json');
    assert.equal(typeof manifest.binary.byteLength, 'number');
    assert.equal(manifest.binary.byteLength, binary.length);
    assert.equal(manifest.binary.sha256, sha256(binary));
    assert.throws(
      () => buildRuntimeArtifact({ sourcePath, outputDirectory: existingOutputDirectory }),
      /Output directory already exists/,
    );
  } finally {
    fs.readFileSync = nativeReadFileSync;
    crypto.createHash = nativeCreateHash;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
