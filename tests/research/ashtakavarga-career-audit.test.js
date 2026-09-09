'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collect, audit, sampleProfiles } = require('../../scripts/research/ashtakavarga-career-audit');

test('analysis-only Ashtakavarga audit is deterministic and uses a broad non-PII sample', async () => {
  const samples = sampleProfiles(100);
  assert.equal(samples.length, 100);
  assert.ok(new Set(samples.map((item) => item.birthData.localDate)).size > 80);
  assert.ok(new Set(samples.map((item) => `${item.birthData.latitude}|${item.birthData.longitude}`)).size >= 6);
  const first = audit(await collect({ count: 24 }));
  const second = audit(await collect({ count: 24 }));
  assert.deepEqual(first, second);
  assert.equal(first.distributions.h10Sav.count, 24);
  assert.equal(first.recommendation.option, 'A');
});

test('production source does not import research tooling', () => {
  const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const source = files(path.join(__dirname, '../../src')).filter((file) => file.endsWith('.js')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.equal(source.includes('scripts/research'), false);
});
