'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const cli = path.join(root, 'scripts/run-career-v2-certification.js');

function writeCohortFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'career-v2-certification-input-'));
  const fixture = path.join(directory, 'cohort.json');
  fs.writeFileSync(fixture, `${JSON.stringify({
    schemaVersion: 'career-v2-certification-input-v1',
    consent: { ownerSupplied: true, explicitHistoricalValidation: true },
    profiles: [{
      profileId: 'PROFILE_CLI_TEST',
      birthData: {
        date: '2000-01-01',
        time: '12:00:00',
        timezone: 'Asia/Kolkata',
        latitude: 17.385,
        longitude: 78.4867,
      },
      events: [
        { eventId: 'EVENT_DAY', type: 'JOB_JOINED', datePrecision: 'DAY', year: 2025, month: 12, day: 2 },
        { eventId: 'EVENT_MONTH', type: 'PROMOTION', datePrecision: 'MONTH', year: 2025, month: 11 },
        { eventId: 'EVENT_YEAR', type: 'JOB_CHANGED', datePrecision: 'YEAR', year: 2025 },
      ],
      evaluationInstants: ['2026-01-01T00:00:00.000Z'],
    }],
  }, null, 2)}\n`, { mode: 0o600 });
  return fixture;
}

test('validate-only checks the anonymized cohort before astronomy/provider initialization', () => {
  const fixture = writeCohortFixture();
  const result = spawnSync(process.execPath, [cli, '--input', fixture, '--validate-only'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'CareerTimingV2 cohort valid: 1 anonymized profiles, 3 historical events.\n');
  assert.equal(result.stderr, '');
});

test('built-in production-compatible-local workflow writes JSON and Markdown with aggregate-only stdout', () => {
  const fixture = writeCohortFixture();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'career-v2-certification-'));
  const result = spawnSync(process.execPath, [cli, '--input', fixture, '--provider', 'production-compatible-local', '--output', directory], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^CareerTimingV2 certification complete: 1 anonymized profiles, 3 historical events, \d+ retained, \d+ lost, \d+ gained\.\n$/);
  assert.equal(result.stderr, '');
  const json = JSON.parse(fs.readFileSync(path.join(directory, 'certification-results.json'), 'utf8'));
  const markdown = fs.readFileSync(path.join(directory, 'certification-report.md'), 'utf8');
  assert.equal(json.aggregate.profileCount, 1);
  assert.equal(json.aggregate.eventCoverage.total, 3);
  assert.equal(json.profiles[0].profileId, 'PROFILE_CLI_TEST');
  assert.equal(JSON.stringify(json).includes('"birthData":'), false);
  assert.match(markdown, /PROFILE_CLI_TEST/);
  assert.doesNotMatch(markdown, /2000-01-01|Asia\/Kolkata/);
});
