'use strict';

// Internal-only synthetic calibration benchmark. It intentionally measures the
// coordinator/adapter contract without a database, private profile data, or a
// production endpoint. Run: node scripts/benchmark-life-event-calibration.js
const { LifeEventCalibrationCoordinator } = require('../src/application/life-event-calibration');

const ITERATIONS = Number.parseInt(process.env.CALIBRATION_BENCHMARK_ITERATIONS || '40', 10);
const COUNTS = [0, 1, 3, 5];
const DOMAINS = [
  { name: 'Career', category: 'CAREER_BUSINESS', type: 'JOB_SWITCH', family: false },
  { name: 'Property', category: 'PROPERTY', type: 'PROPERTY_PURCHASE', family: false },
  { name: 'Vehicle', category: 'VEHICLE', type: 'VEHICLE_PURCHASE', family: false },
  { name: 'Relationship', category: 'RELATIONSHIPS_FAMILY', type: 'MARRIAGE', family: false },
  { name: 'Family Expansion', category: 'RELATIONSHIPS_FAMILY', type: 'CHILD_BIRTH', family: true },
];

function event(domain, index) {
  return { lifeEventId: `${domain.name.toLowerCase().replaceAll(' ', '-')}-${index}`, category: domain.category, eventType: domain.type, eventDate: { precision: 'DAY', year: 2020 + index, month: 1, day: 1 } };
}
function percentile(values, point) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * point) - 1)];
}
function adapter(domain) {
  return {
    domainCalibrationVersion: `benchmark-${domain.name.toLowerCase().replaceAll(' ', '-')}-v1`,
    supports: (item) => item.category === domain.category && item.eventType === domain.type,
    cohortFor: (item) => item.eventType,
    resolveTimezone: async () => 'UTC',
    customerDisplaySafety: () => ({ permitted: true, policy: 'BENCHMARK_NON_PREDICTIVE', minimumHighMediumMatches: domain.family ? 3 : 2 }),
    extractRetrospectiveEvidence: async ({ events }) => ({ fingerprints: events.map((item) => ({ eventId: item.event.lifeEventId, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: 'benchmark-v1', evidenceFamilies: ['FOUNDATION', 'DASHA'], evidenceFingerprint: { benchmark: true }, qualityFlags: [] })) }),
    annotateCandidates: async ({ events, primaryCandidates }) => primaryCandidates.map((candidate) => ({ candidateId: candidate.candidateId, matchedEventIds: events.map((item) => item.event.lifeEventId), matchedEvidenceFamilies: ['FOUNDATION', 'DASHA'], unmatchedEvidenceFamilies: ['TRANSIT'], patternStrength: 'MODERATE', historicalConsistency: 'BOUNDED', tieBreakEligible: events.length >= 3, qualityFlags: [], contradictionFlags: [] })),
  };
}
async function measure(domain, count) {
  const events = Array.from({ length: count }, (_, index) => event(domain, index));
  const coordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: async () => events, clock: () => '2026-01-01T00:00:00.000Z' });
  const input = { principal: { subject: 'benchmark-user' }, birthProfileId: 'benchmark-profile', adapter: adapter(domain), primaryCandidates: [{ candidateId: 'candidate', primaryRank: 0, primaryState: 'INTERNAL', primaryStrength: 'INTERNAL', start: '2026-02-01T00:00:00.000Z', end: '2026-03-01T00:00:00.000Z', primaryEvidenceFingerprint: {} }] };
  const samples = [];
  for (let index = 0; index < ITERATIONS; index += 1) {
    const startedAt = process.hrtime.bigint();
    await coordinator.calibrate(input);
    samples.push(Number(process.hrtime.bigint() - startedAt) / 1e6);
  }
  return { median: percentile(samples, 0.5), p95: percentile(samples, 0.95), min: Math.min(...samples), max: Math.max(...samples) };
}

(async () => {
  console.log(`Synthetic calibration-only benchmark; ${ITERATIONS} iterations per cell.`);
  console.log('| Domain | 0 events median/p95 ms | 1 event median/p95 ms | 3 events median/p95 ms | 5 events median/p95 ms |');
  console.log('|---|---:|---:|---:|---:|');
  for (const domain of DOMAINS) {
    const results = [];
    for (const count of COUNTS) results.push(await measure(domain, count));
    const cell = (value) => `${value.median.toFixed(3)} / ${value.p95.toFixed(3)}`;
    console.log(`| ${domain.name} | ${results.map(cell).join(' | ')} |`);
  }
})().catch((error) => { console.error(error && error.code || error && error.message || 'BENCHMARK_FAILED'); process.exitCode = 1; });
