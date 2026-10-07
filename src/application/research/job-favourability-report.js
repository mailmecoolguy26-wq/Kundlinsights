'use strict';

// Private reporting only. Generated artifacts contain aggregate research
// metrics and pseudonymous identifiers; callers must retain raw cohort inputs
// outside source control.
const fs = require('node:fs');
const path = require('node:path');

const PRIVATE_ARTIFACT_ROOT = path.resolve(process.cwd(), 'tmp/private-backtest');

function privateDirectory(value = PRIVATE_ARTIFACT_ROOT) {
  const resolved = path.resolve(value);
  if (resolved !== PRIVATE_ARTIFACT_ROOT && !resolved.startsWith(`${PRIVATE_ARTIFACT_ROOT}${path.sep}`)) throw new TypeError('Research artifacts must remain under tmp/private-backtest.');
  return resolved;
}
function renderMetric(value) { return value === null || value === undefined ? 'NOT AVAILABLE' : String(value); }
function calculationCoverageLines(entries = []) {
  const byFamily = new Map();
  for (const entry of entries) for (const value of Object.values(entry.coverage || {})) {
    if (!value || typeof value.family !== 'string') continue;
    if (!byFamily.has(value.family)) byFamily.set(value.family, { CALCULATED: 0, UNAVAILABLE: 0, NOT_APPLICABLE: 0, reasons: {} });
    const total = byFamily.get(value.family);
    if (total[value.status] !== undefined) total[value.status] += 1;
    if (value.failureReason) total.reasons[value.failureReason] = (total.reasons[value.failureReason] || 0) + 1;
  }
  return [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([family, total]) => `- ${family}: calculated=${total.CALCULATED}; unavailable=${total.UNAVAILABLE}; not applicable=${total.NOT_APPLICABLE}; failure reasons=${Object.keys(total.reasons).length ? JSON.stringify(total.reasons) : 'NONE'}`);
}
function renderJobFavourabilityResearchReport(report = {}) {
  const lines = [
    '# TaraVerse Job Favourability Research Report',
    '',
    'Status: offline research only. This report does not create a production rule, future projection, customer period, probability, or forecast.',
    '',
    ...(report.pipelineLabel ? [`Run label: ${report.pipelineLabel}`, ''] : []),
    ...(report.dataClassification ? [`Data classification: ${report.dataClassification}`, ''] : []),
    `Ruleset: ${report.rulesetId || 'NOT AVAILABLE'}`,
    `Conclusion: ${report.conclusion || 'NO_DISCRIMINATIVE_PATTERN'}`,
    '',
    '## Pre-registered candidate analyses',
  ];
  for (const item of report.candidateAnalyses || []) {
    const metrics = item.metrics || {}; const raw = metrics.raw || {};
    lines.push('', `### ${item.candidateId}`, `Interaction order: ${item.interactionOrder}`, `Fields: ${(item.fields || []).join(' + ') || 'NOT AVAILABLE'}`, `Employment-transition prevalence: ${renderMetric(metrics.featurePrevalence && metrics.featurePrevalence.employmentTransition)}`, `Temporal-control false-positive rate: ${renderMetric(metrics.temporalControlFalsePositiveRate)}`, `Non-employment Career-event false-positive rate: ${renderMetric(metrics.nonEmploymentCareerEventFalsePositiveRate)}`, `Precision: ${renderMetric(metrics.precision)}`, `Employment-transition recall: ${renderMetric(metrics.employmentTransitionRecall)}`, `Risk difference: ${renderMetric(metrics.riskDifference)}`, `Odds ratio: ${renderMetric(metrics.oddsRatio)}`, `Employment-transition raw: ${renderMetric(raw.positive && raw.positive.numerator)}/${renderMetric(raw.positive && raw.positive.denominator)}`, `Temporal-control raw: ${renderMetric(raw.temporalControl && raw.temporalControl.numerator)}/${renderMetric(raw.temporalControl && raw.temporalControl.denominator)}`);
  }
  lines.push(
    '',
    '## H6 research-only factual/context dimensions',
    '- `h6LordActiveAtMd`, `h6LordActiveAtAd`, and `h6LordActiveAtPd` preserve level-specific factual Dasha identity; PD is `NOT_APPLICABLE` outside DAY precision.',
    '- `h6LordStrengthContext` preserves supplied planetary-state facts without a strength score or outcome label.',
    '- `h2H6H10AxisContext` preserves natal lords, placements, occupants, and shared-lord facts without evaluating an axis outcome.',
    '- `h6BeneficOccupancyContext` is emitted only when a supplied classification ruleset and occupant-body list are available; it has no interpretive result.',
    '',
    `H6 factual/context aggregates: ${renderMetric(report.h6FactualContext && JSON.stringify(report.h6FactualContext))}`,
    '',
    '## Missingness',
    `Feature-state counts: ${renderMetric(report.missingness && JSON.stringify(report.missingness))}`,
    '',
    '## Calculation coverage',
    ...(calculationCoverageLines(report.calculationCoverage || []).length ? calculationCoverageLines(report.calculationCoverage || []) : ['- NOT AVAILABLE']),
    '',
    '## Guardrails',
    '- Candidate interactions are pre-registered and limited to order two.',
    '- H6, D10, Moon, Ashtakavarga, recurrence, and node facts are research dimensions only.',
    '- No feature is an employment-acquisition rule solely because it appears in this report.',
    '- Profile-disjoint selection and evaluation remain required before any replication conclusion.',
  );
  return `${lines.join('\n')}\n`;
}
function writePrivateJobFavourabilityArtifacts({ report, directory = PRIVATE_ARTIFACT_ROOT, artifactName = 'JOB-FAVOURABILITY-RESEARCH' } = {}) {
  if (!report || typeof report !== 'object') throw new TypeError('Research report is required.');
  if (!/^[A-Z0-9-]+$/.test(artifactName)) throw new TypeError('Research artifact name is invalid.');
  const target = privateDirectory(directory); fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(target, `${artifactName}.json`); const markdownPath = path.join(target, `${artifactName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(markdownPath, renderJobFavourabilityResearchReport(report), { encoding: 'utf8', mode: 0o600 });
  return Object.freeze({ jsonPath, markdownPath });
}

module.exports = { PRIVATE_ARTIFACT_ROOT, privateDirectory, calculationCoverageLines, renderJobFavourabilityResearchReport, writePrivateJobFavourabilityArtifacts };
