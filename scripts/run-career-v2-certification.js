#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CareerV2CertificationHarness, validateCertificationInput } = require('../src/development/career-v2-certification-harness');
const { createProductionCompatibleLocalCareerV2EvidenceProvider } = require('../src/development/career-v2-local-evidence-provider');

function argument(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }
const hasFlag = (name) => process.argv.includes(name);

async function main() {
  const inputPath = argument('--input');
  const providerPath = argument('--evidence-provider');
  const providerName = argument('--provider');
  const validateOnly = hasFlag('--validate-only');
  const outputDirectory = argument('--output') || path.resolve('tmp/career-v2-certification');
  if (!inputPath || !validateOnly && Boolean(providerPath) === Boolean(providerName)) throw new Error('Usage: node scripts/run-career-v2-certification.js --input <consented.json> [--validate-only | (--provider production-compatible-local | --evidence-provider <local-module.js>)] [--output <directory>]');
  const input = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8'));
  const validated = validateCertificationInput(input);
  const eventCount = validated.profiles.reduce((sum, profile) => sum + profile.events.length, 0);
  if (validateOnly) {
    process.stdout.write(`CareerTimingV2 cohort valid: ${validated.profiles.length} anonymized profiles, ${eventCount} historical events.\n`);
    return;
  }
  let evidenceProvider;
  if (providerName) {
    if (providerName !== 'production-compatible-local') throw new Error('Unsupported built-in evidence provider.');
    evidenceProvider = createProductionCompatibleLocalCareerV2EvidenceProvider();
  } else {
    const loaded = require(path.resolve(providerPath));
    evidenceProvider = typeof loaded === 'function' ? loaded : loaded.evidenceProvider;
  }
  const harness = new CareerV2CertificationHarness({ evidenceProvider });
  // The harness owns canonical raw-input validation. `validated` contains
  // derived internal fields (for example event coverage) and must not be fed
  // back through the strict external cohort schema.
  const { result, markdown } = await harness.run(input);
  await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(outputDirectory, 'certification-results.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  await fs.writeFile(path.join(outputDirectory, 'certification-report.md'), markdown, { mode: 0o600 });
  process.stdout.write(`CareerTimingV2 certification complete: ${result.aggregate.profileCount} anonymized profiles, ${result.aggregate.eventCoverage.total} historical events, ${result.aggregate.eventCoverage.retained} retained, ${result.aggregate.eventCoverage.lost} lost, ${result.aggregate.eventCoverage.gained} gained.\n`);
}

main().catch((error) => { process.stderr.write(`CareerTimingV2 certification failed: ${error.message}\n`); process.exitCode = 1; });
