'use strict';

// Local-only performance validation for Life Event Calibration V1. It uses a
// safe, synthetic Hyderabad fixture and the development astronomy stack. It
// never opens an HTTP endpoint, reads a database, or prints birth/profile data.
//
// Run: node scripts/benchmark-life-event-calibration-real-path.js
// Optional: CALIBRATION_REAL_BENCHMARK_ITERATIONS=5

const { createDevelopmentAstrology } = require('../src/runtime/create-development-astrology');
const { LifeEventCalibrationCoordinator } = require('../src/application/life-event-calibration');
const { PropertyAnswerService, PropertyIntent, PropertyCalibrationAdapter } = require('../src/application/property');
const { VehicleAnswerService, VehicleIntent, VehicleCalibrationAdapter } = require('../src/application/vehicle');
const { RelationshipAnswerService, RelationshipIntent, RelationshipCalibrationAdapter } = require('../src/application/relationships');
const { FamilyExpansionAnswerService, FamilyExpansionIntent, FamilyExpansionCalibrationAdapter } = require('../src/application/family-expansion');
const { CareerEventAstrologyService, CareerCalibrationAdapter } = require('../src/application/career-events');
const { DivisionalChartService } = require('../src/application/divisional-charts');
const { AshtakavargaService } = require('../src/application/ashtakavarga');
const { BirthCareerReadingOrchestrator } = require('../src/orchestration');
const { createResolvedBirthPlace } = require('../src/place');

const ITERATIONS = Number.parseInt(process.env.CALIBRATION_REAL_BENCHMARK_ITERATIONS || '3', 10);
const WARMUPS = Number.parseInt(process.env.CALIBRATION_REAL_BENCHMARK_WARMUPS || '1', 10);
const DOMAIN_FILTER = new Set((process.env.CALIBRATION_REAL_BENCHMARK_DOMAINS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean));
const COUNT_FILTER = new Set((process.env.CALIBRATION_REAL_BENCHMARK_COUNTS || '').split(',').map((value) => Number.parseInt(value, 10)).filter(Number.isInteger));
const REFERENCE = '2026-10-18T07:08:17.000Z';
const COUNTS = [0, 1, 3, 5];
const PRINCIPAL = Object.freeze({ subject: 'benchmark-subject' });
const PROFILE = Object.freeze({
  id: 'benchmark-profile', status: 'active',
  // Synthetic fixture, deliberately not a customer profile.
  birthData: Object.freeze({ localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: '1990-11-26T08:10:00.000Z', latitude: 17.385, longitude: 78.4867, timezoneProvenance: Object.freeze({ provider: 'timezone-boundary-builder', datasetVersion: 'benchmark-v1', datasetChecksum: 'synthetic' }) }),
});

function percentile(values, point) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * point) - 1)];
}
function measure(values) {
  return Object.freeze({ median: percentile(values, 0.5), p95: percentile(values, 0.95), min: Math.min(...values), max: Math.max(...values), average: values.reduce((sum, value) => sum + value, 0) / values.length });
}
function elapsed(startedAt) { return Number(process.hrtime.bigint() - startedAt) / 1e6; }
function dayEvent(domain, index) {
  const date = { precision: 'DAY', year: 2018 + index, month: 2 + index, day: 10 + index };
  return Object.freeze({ lifeEventId: `${domain.key}-event-${index + 1}`, careerEventId: `${domain.key}-event-${index + 1}`, birthProfileId: PROFILE.id, category: domain.category, eventType: domain.eventType, eventDate: Object.freeze(date), deletedAt: null, observations: Object.freeze([]) });
}
function publicAnswer(value) {
  const copy = { ...value };
  delete copy.internalCalibration;
  return JSON.stringify(copy);
}
function classify({ total, baseline, calibration }) {
  // Comparative only: flag a materially super-linear result, not a fast
  // domain whose tiny baseline makes a small absolute addition look large.
  if (total.p95 > baseline.p95 * 10 && calibration.p95 > baseline.p95 * 2) return 'NEEDS_OPTIMIZATION_BEFORE_UI';
  return 'ACCEPTABLE';
}
function row(domain, count, total, baseline, calibration, stages, correctness) {
  return Object.freeze({ domain: domain.name, events: count, total, baselineDelta: total.median - baseline.median, calibration, stages, classification: classify({ total, baseline, calibration }), correctness });
}

function dependencies(events) {
  const astrology = createDevelopmentAstrology();
  const profiles = Object.freeze({ get: async () => PROFILE });
  const lifeEvents = Object.freeze({ getRelevantLifeEvents: async ({ categories }) => events.filter((event) => categories.includes(event.category)) });
  const coordinatorFor = (adapter, loader) => new LifeEventCalibrationCoordinator({ canonicalEventLoader: loader, clock: () => REFERENCE });
  return Object.freeze({ astrology, profiles, lifeEvents, coordinatorFor });
}

function propertyRunner(events, enabled) {
  const dep = dependencies(events);
  const adapter = new PropertyCalibrationAdapter({ birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler });
  const coordinator = enabled ? dep.coordinatorFor(adapter, async () => events.filter((event) => event.category === 'PROPERTY')) : null;
  const service = new PropertyAnswerService({ birthProfileService: dep.profiles, lifeEventService: dep.lifeEvents, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler, clock: () => REFERENCE, lifeEventCalibrationCoordinator: coordinator, propertyCalibrationAdapter: coordinator ? adapter : null });
  return async () => service.answer({ principal: PRINCIPAL, birthProfileId: PROFILE.id, intent: PropertyIntent.PROPERTY_PURCHASE_TIMING, at: REFERENCE, includeInternalCalibration: enabled });
}
function vehicleRunner(events, enabled) {
  const dep = dependencies(events);
  const adapter = new VehicleCalibrationAdapter({ birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler });
  const coordinator = enabled ? dep.coordinatorFor(adapter, async () => events.filter((event) => event.category === 'VEHICLE')) : null;
  const service = new VehicleAnswerService({ birthProfileService: dep.profiles, lifeEventService: dep.lifeEvents, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler, clock: () => REFERENCE, lifeEventCalibrationCoordinator: coordinator, vehicleCalibrationAdapter: coordinator ? adapter : null });
  return async () => service.answer({ principal: PRINCIPAL, birthProfileId: PROFILE.id, intent: VehicleIntent.VEHICLE_PURCHASE_TIMING, at: REFERENCE, includeInternalCalibration: enabled });
}
function relationshipRunner(events, enabled) {
  const dep = dependencies(events);
  const adapter = new RelationshipCalibrationAdapter({ birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler });
  const coordinator = enabled ? dep.coordinatorFor(adapter, async () => events.filter((event) => event.category === 'RELATIONSHIPS_FAMILY')) : null;
  const service = new RelationshipAnswerService({ birthProfileService: dep.profiles, lifeEventService: dep.lifeEvents, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler, clock: () => REFERENCE, lifeEventCalibrationCoordinator: coordinator, relationshipCalibrationAdapter: coordinator ? adapter : null });
  return async () => service.answer({ principal: PRINCIPAL, birthProfileId: PROFILE.id, intent: RelationshipIntent.RELATIONSHIP_OUTLOOK, includeInternalCalibration: enabled });
}
function familyRunner(events, enabled) {
  const dep = dependencies(events);
  const adapter = new FamilyExpansionCalibrationAdapter({ birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler });
  const coordinator = enabled ? dep.coordinatorFor(adapter, async () => events.filter((event) => event.category === 'RELATIONSHIPS_FAMILY')) : null;
  const service = new FamilyExpansionAnswerService({ birthProfileService: dep.profiles, lifeEventService: dep.lifeEvents, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler, clock: () => REFERENCE, lifeEventCalibrationCoordinator: coordinator, familyExpansionCalibrationAdapter: coordinator ? adapter : null });
  return async () => service.answer({ principal: PRINCIPAL, birthProfileId: PROFILE.id, intent: FamilyExpansionIntent.FAMILY_EXPANSION_OUTLOOK, includeInternalCalibration: enabled });
}

// Career is measured through its deployed calculation seam: base Career
// orchestration plus CareerEventAstrologyService retrospective extraction.
// CareerAnswerService itself reads an already persisted reading, so it is not
// the calibration execution path.
function careerRunner(events, enabled) {
  const dep = dependencies(events);
  const careerEvents = Object.freeze({
    getForCalibration: async ({ eventId }) => events.find((event) => event.careerEventId === eventId),
    listForCalibration: async () => events,
  });
  const divisional = new DivisionalChartService({ birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine });
  const ashtakavarga = new AshtakavargaService({ birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine });
  const snapshots = new CareerEventAstrologyService({ careerEventService: careerEvents, birthProfileService: dep.profiles, astronomicalEngine: dep.astrology.astronomicalEngine, canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler, divisionalChartService: divisional, ashtakavargaService: ashtakavarga });
  const adapter = new CareerCalibrationAdapter({ careerEventAstrologyService: snapshots, birthProfileService: dep.profiles });
  const coordinator = enabled ? dep.coordinatorFor(adapter, careerEvents.listForCalibration) : null;
  const place = createResolvedBirthPlace({ provider: 'benchmark', providerPlaceId: PROFILE.id, latitude: PROFILE.birthData.latitude, longitude: PROFILE.birthData.longitude, timezone: PROFILE.birthData.timezone, timezoneResolver: PROFILE.birthData.timezoneProvenance });
  const base = new BirthCareerReadingOrchestrator({ astronomicalEngine: dep.astrology.astronomicalEngine, dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1', canonicalSiderealSunSampler: dep.astrology.canonicalSiderealSunSampler });
  return async () => {
    const primary = base.generate({ birth: { date: PROFILE.birthData.localDate, time: PROFILE.birthData.localTime, place }, readingInstant: REFERENCE, locale: 'en-IN' });
    if (!coordinator) return Object.freeze({ primary });
    const calibration = await coordinator.calibrate({ principal: PRINCIPAL, birthProfileId: PROFILE.id, adapter, primaryCandidates: [], primaryDomainRulesVersion: primary.result && primary.result.provenance && primary.result.provenance.dashaRulesetId || 'career-reading-v1' });
    return Object.freeze({ primary, internalCalibration: calibration });
  };
}

const DOMAINS = Object.freeze([
  { key: 'career', name: 'Career', category: 'CAREER_BUSINESS', eventType: 'JOB_SWITCH', runner: careerRunner },
  { key: 'property', name: 'Property', category: 'PROPERTY', eventType: 'PROPERTY_PURCHASE', runner: propertyRunner },
  { key: 'vehicle', name: 'Vehicle', category: 'VEHICLE', eventType: 'VEHICLE_PURCHASE', runner: vehicleRunner },
  { key: 'relationship', name: 'Relationship', category: 'RELATIONSHIPS_FAMILY', eventType: 'MARRIAGE', runner: relationshipRunner },
  { key: 'family', name: 'Family Expansion', category: 'RELATIONSHIPS_FAMILY', eventType: 'CHILD_BIRTH', runner: familyRunner },
]);

async function sample(run) {
  const startedAt = process.hrtime.bigint();
  const value = await run();
  return Object.freeze({ milliseconds: elapsed(startedAt), value });
}
async function benchmarkDomain(domain) {
  const baselineRun = domain.runner([], false);
  for (let index = 0; index < WARMUPS; index += 1) await sample(baselineRun);
  const baselineValues = [];
  for (let index = 0; index < ITERATIONS; index += 1) baselineValues.push((await sample(baselineRun)).milliseconds);
  const baseline = measure(baselineValues);
  const rows = [];
  for (const count of COUNTS.filter((value) => COUNT_FILTER.size === 0 || COUNT_FILTER.has(value))) {
    const events = Array.from({ length: count }, (_, index) => dayEvent(domain, index));
    const run = domain.runner(events, true);
    for (let index = 0; index < WARMUPS; index += 1) await sample(run);
    const values = [];
    const calibrationValues = [];
    const loadValues = [], extractionValues = [], annotationValues = [];
    let first = null;
    for (let index = 0; index < ITERATIONS; index += 1) {
      const result = await sample(run);
      values.push(result.milliseconds);
      first ||= result.value;
      const calibration = result.value.internalCalibration;
      const timing = calibration && calibration.audit && calibration.audit.timing;
      calibrationValues.push(timing ? timing.totalMilliseconds : 0);
      loadValues.push(timing ? timing.loadMilliseconds : 0);
      extractionValues.push(timing ? timing.extractionMilliseconds : 0);
      annotationValues.push(timing ? timing.annotationMilliseconds : 0);
    }
    // Calibration is additive only. Perform this expensive parity check once
    // per scenario, outside the timed samples.
    if (domain.name !== 'Career') {
      // Keep the same Life Event input; the only variable is the coordinator.
      const withoutCalibration = await domain.runner(events, false)();
      if (publicAnswer(first) !== publicAnswer({ ...first, internalCalibration: undefined })) throw new Error('BENCHMARK_INTERNAL_CALIBRATION_LEAK');
      if (publicAnswer(withoutCalibration) !== publicAnswer({ ...first, internalCalibration: undefined })) throw new Error('BENCHMARK_PRIMARY_ANSWER_MUTATED');
    }
    const calibration = measure(calibrationValues);
    const correctness = first && first.internalCalibration
      ? Object.freeze({ primaryUnchanged: true, customerDisplayEligible: first.internalCalibration.customerDisplayEligible, exclusions: first.internalCalibration.audit.exclusionCounts })
      : Object.freeze({ primaryUnchanged: true, customerDisplayEligible: false, exclusions: {} });
    rows.push(row(domain, count, measure(values), baseline, calibration, Object.freeze({ load: measure(loadValues), extraction: measure(extractionValues), annotation: measure(annotationValues) }), correctness));
  }
  return rows;
}

function fmt(value) { return value.toFixed(1); }
(async () => {
  console.log(`Real-path local benchmark; synthetic fixture; baseline-warmed process; ${WARMUPS} explicit warm-up + ${ITERATIONS} measured iterations per cell.`);
  console.log('No customer profile, event note, title, or API endpoint is used.');
  const all = [];
  for (const domain of DOMAINS.filter((item) => DOMAIN_FILTER.size === 0 || DOMAIN_FILTER.has(item.key))) all.push(...await benchmarkDomain(domain));
  console.log('| Domain | Events | Median total ms | p95 total ms | Baseline delta ms | Calibration median ms | Classification |');
  console.log('|---|---:|---:|---:|---:|---:|---|');
  for (const result of all) console.log(`| ${result.domain} | ${result.events} | ${fmt(result.total.median)} | ${fmt(result.total.p95)} | ${fmt(result.baselineDelta)} | ${fmt(result.calibration.median)} | ${result.classification} |`);
  console.log('--- calibration stages (median ms) ---');
  for (const result of all) console.log(`${result.domain}/${result.events}: load=${fmt(result.stages.load.median)} extraction=${fmt(result.stages.extraction.median)} annotation=${fmt(result.stages.annotation.median)}`);
  console.log('--- internal readiness ---');
  for (const result of all) console.log(`${result.domain}/${result.events}: eligible=${result.correctness.customerDisplayEligible} exclusions=${JSON.stringify(result.correctness.exclusions)}`);
})().catch((error) => { console.error(error && error.stack || error && error.message || 'REAL_PATH_BENCHMARK_FAILED'); process.exitCode = 1; });
