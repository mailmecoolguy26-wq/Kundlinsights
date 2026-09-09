'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { artifact, run } = require('../../scripts/research/career-gochar-rule-audit');

test('Career Gochar source audit is deterministic and marks only source-backed rule dependencies as ready', () => {
  const first = artifact(); const second = artifact();
  assert.deepEqual(first, second);
  assert.equal(first.repositoryOnly, true);
  assert.deepEqual(first.readyForRulebook, []);
  assert.equal(first.decision, 'NOT_READY');
  assert.equal(first.candidates.every((candidate) => candidate.transitPlanets.scope && candidate.natalTargets.scope && candidate.temporalSemantics), true);
  assert.deepEqual(first.needsMoreSourceResearch, ['career-layer10-event-timing-context-existing-v1']);
});

test('Career Gochar audit writes a stable research-only artifact', () => {
  const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'career-gochar-audit-')), 'audit.json');
  const first = run({ outputPath }); const second = run({ outputPath });
  assert.equal(first.outputPath, outputPath);
  assert.deepEqual(first.result, second.result);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), first.result);
});

test('production source does not import Career Gochar research tooling', () => {
  const sourceRoot = path.join(__dirname, '../../src');
  const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const source = files(sourceRoot).filter((file) => file.endsWith('.js')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.equal(source.includes('scripts/research/career-gochar-rule-audit'), false);
});
