#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { CareerV2PrecisionCertificationHarness, validatePrecisionCertificationInput } = require('../src/development/career-v2-precision-certification-harness');
const { createProductionCompatibleLocalCareerV2EvidenceProvider } = require('../src/development/career-v2-local-evidence-provider');

function argument(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; }
const hasFlag = (name) => process.argv.includes(name);

async function main() {
  const inputPath = argument('--input'); const outputDirectory = argument('--output'); const validateOnly = hasFlag('--validate-only');
  if (!inputPath || !validateOnly && !outputDirectory) throw new Error('Usage: node scripts/run-career-v2-precision-certification.js --input <owner-supplied.json> [--validate-only | --output <directory>]');
  const input = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8'));
  const validated = validatePrecisionCertificationInput(input);
  if (validateOnly) { process.stdout.write(`CareerTimingV2 precision cohort valid: ${validated.profiles.length} anonymized profiles, ${validated.profiles.reduce((sum, profile) => sum + profile.events.length, 0)} historical events.\n`); return; }
  const harness = new CareerV2PrecisionCertificationHarness({ evidenceProvider: createProductionCompatibleLocalCareerV2EvidenceProvider() });
  const { result, markdown } = await harness.run(input);
  const output = path.resolve(outputDirectory);
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(output, 'precision-results.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  await fs.writeFile(path.join(output, 'precision-report.md'), markdown, { mode: 0o600 });
  process.stdout.write(`CareerTimingV2 precision certification complete: ${result.aggregate.profileCount} anonymized profiles, ${result.aggregate.knownEvents} known Career events.\n`);
}

main().catch((error) => { process.stderr.write(`CareerTimingV2 precision certification failed: ${error.message}\n`); process.exitCode = 1; });
