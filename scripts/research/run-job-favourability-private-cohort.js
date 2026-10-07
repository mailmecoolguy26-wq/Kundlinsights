'use strict';

// Private/offline cohort runner. It has no API, database, or mobile imports.
const fs = require('node:fs');
const path = require('node:path');
const { AstronomicalEngine, AstronomyEngineProvider } = require('../../src/astronomy');
const { calculateRashiHouses } = require('../../src/bhava');
const { normalizeJobFavourabilityPrivateCohort } = require('../../src/application/research/job-favourability-private-cohort-intake');
const { buildJobFavourabilityCohort } = require('../../src/application/research/job-favourability-cohort-builder');
const { extractJobFavourabilityFeatureRows } = require('../../src/application/research/job-favourability-feature-extractor');
const { runJobFavourabilityBacktest } = require('../../src/application/research/job-favourability-backtest-runner');
const { PRIVATE_ARTIFACT_ROOT, privateDirectory, writePrivateJobFavourabilityArtifacts } = require('../../src/application/research/job-favourability-report');

const DEFAULT_INPUT = path.join(PRIVATE_ARTIFACT_ROOT, 'JOB-FAVOURABILITY-CURATED-COHORT.json');
const FACTUAL_INPUT_KEYS = Object.freeze(['dashaIntervals', 'transitIntervals', 'transitEvents', 'planetaryStateFacts', 'h6BeneficOccupancyFacts', 'd10Facts', 'moonSupportFacts', 'ashtakavargaFacts', 'genericCareerSignals', 'recurrenceEvidence', 'astronomyProvenance']);

function privatePath(value) { return privateDirectory(path.resolve(value)); }
function inputProfileToResearchProfile(profile, astronomicalEngine) {
  const natal = astronomicalEngine.calculate({
    date: profile.birth.localDate,
    time: profile.birth.localTime,
    timezone: profile.birth.timezone,
    latitude: profile.birth.latitude,
    longitude: profile.birth.longitude,
  });
  const d1Houses = calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees,
    bodies: natal.bodies,
  });
  const factual = Object.fromEntries(FACTUAL_INPUT_KEYS.filter((key) => Object.hasOwn(profile.factualInputs, key)).map((key) => [key, profile.factualInputs[key]]));
  return Object.freeze({
    birthProfileId: profile.pseudonymousProfileId,
    events: profile.canonicalEvents,
    d1Houses,
    ...factual,
    astronomyProvenance: {
      engineProfileId: natal.provider && natal.provider.providerId || 'private-research-engine',
      ayanamshaSystem: natal.sidereal && natal.sidereal.ayanamshaSystem || null,
      nodePolicy: natal.provider && natal.provider.nodePolicy || null,
      calculationStatus: natal.calculationStatus || null,
      ...(factual.astronomyProvenance || {}),
    },
  });
}
function cohortSummary(cohort) {
  return {
    schemaId: cohort.schemaId,
    profiles: cohort.profiles.map(({ pseudonymousProfileId, partition, unitCount }) => ({ pseudonymousProfileId, partition, unitCount })),
    units: cohort.units.map(({ unitId, unitKind, eventFamily, anchors }) => ({ unitId, unitKind, eventFamily, anchors: anchors.map(({ observationType, precision, coverage }) => ({ observationType, precision, coverage })) })),
  };
}
function runPrivateCuratedCohort({ inputPath = DEFAULT_INPUT, astronomicalEngine = new AstronomicalEngine(new AstronomyEngineProvider()), artifactName = 'JOB-FAVOURABILITY-CURATED-COHORT-REPORT' } = {}) {
  const resolvedInput = privatePath(inputPath);
  const input = JSON.parse(fs.readFileSync(resolvedInput, 'utf8'));
  const curated = normalizeJobFavourabilityPrivateCohort(input);
  const profiles = curated.profiles.map((profile) => inputProfileToResearchProfile(profile, astronomicalEngine));
  const cohort = buildJobFavourabilityCohort({ profiles, cohortSalt: curated.cohortSalt });
  const featureRows = profiles.flatMap((profile) => extractJobFavourabilityFeatureRows({ profile, cohort }));
  const report = {
    ...runJobFavourabilityBacktest({ featureRows }),
    pipelineLabel: 'CURATED_COHORT_RESEARCH_ONLY',
    dataClassification: 'PRIVATE_CURATED_HISTORICAL_INPUT',
  };
  const reportPaths = writePrivateJobFavourabilityArtifacts({ report, artifactName });
  const outputDirectory = privateDirectory();
  const featureRowsPath = path.join(outputDirectory, `${artifactName}-FEATURE-ROWS.json`);
  const cohortSummaryPath = path.join(outputDirectory, `${artifactName}-COHORT-SUMMARY.json`);
  fs.writeFileSync(featureRowsPath, `${JSON.stringify(featureRows, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(cohortSummaryPath, `${JSON.stringify(cohortSummary(cohort), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return Object.freeze({ report, featureRowCount: featureRows.length, cohortSummary: cohortSummary(cohort), paths: Object.freeze({ ...reportPaths, featureRowsPath, cohortSummaryPath }) });
}

if (require.main === module) {
  const inputPath = process.argv[2] || DEFAULT_INPUT;
  try {
    const result = runPrivateCuratedCohort({ inputPath });
    console.log(JSON.stringify({ pipelineLabel: result.report.pipelineLabel, conclusion: result.report.conclusion, featureRowCount: result.featureRowCount, profileCount: result.cohortSummary.profiles.length, paths: result.paths }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: 'PRIVATE_JOB_FAVOURABILITY_COHORT_FAILED', safeErrorClass: error && error.constructor && error.constructor.name || 'Error' }));
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_INPUT, inputProfileToResearchProfile, runPrivateCuratedCohort };
