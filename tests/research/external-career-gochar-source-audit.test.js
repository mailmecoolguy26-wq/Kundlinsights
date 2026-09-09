'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  REQUIRED_CANDIDATE_FIELDS,
  artifact,
  run,
  validateArtifact,
} = require('../../scripts/research/external-career-gochar-source-audit');

test('external Career Gochar audit is deterministic, source-linked, and research-only', () => {
  const first = artifact();
  const second = artifact();
  assert.deepEqual(first, second);
  assert.equal(first.researchOnly, true);
  assert.equal(first.productionChanges, false);
  assert.equal(first.decision, 'MORE_RESEARCH_REQUIRED');
  assert.deepEqual(first.classifications.readyForReview, []);
  assert.equal(validateArtifact(first), true);
  assert.equal(first.candidateRules.every((candidate) => REQUIRED_CANDIDATE_FIELDS.every((field) => candidate[field] !== undefined && candidate[field] !== null)), true);
});

test('external Career Gochar audit rejects duplicate bibliography IDs and unknown candidate sources', () => {
  const duplicate = artifact();
  duplicate.bibliography = [...duplicate.bibliography, { ...duplicate.bibliography[0] }];
  assert.throws(() => validateArtifact(duplicate), /duplicate source IDs/);

  const unknown = artifact();
  unknown.candidateRules = [{ ...unknown.candidateRules[0], sourceId: 'not-in-bibliography' }];
  assert.throws(() => validateArtifact(unknown), /unknown source/);
});

test('external audit writes a stable untracked research artifact', () => {
  const outputPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'external-career-gochar-')), 'audit.json');
  const first = run({ outputPath });
  const second = run({ outputPath });
  assert.equal(first.outputPath, outputPath);
  assert.deepEqual(first.result, second.result);
  assert.deepEqual(JSON.parse(fs.readFileSync(outputPath, 'utf8')), first.result);
});

test('production source does not import external Career Gochar research tooling', () => {
  const sourceRoot = path.join(__dirname, '../../src');
  const files = (directory) => fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const source = files(sourceRoot)
    .filter((file) => file.endsWith('.js'))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.equal(source.includes('scripts/research/external-career-gochar-source-audit'), false);
});
