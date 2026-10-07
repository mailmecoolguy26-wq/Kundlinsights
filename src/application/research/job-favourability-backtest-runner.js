'use strict';

// Offline observational analysis only. Candidate definitions are a small,
// pre-registered registry, never a search across arbitrary planet/house pairs.
const { HORIZON_IDS } = require('./job-favourability-cohort-builder');

const RUNNER_RULESET_ID = 'taraverse-job-favourability-backtest-v1';
const MAX_INTERACTION_ORDER = 2;
const POSITIVE = 'EMPLOYMENT_TRANSITION';
const TEMPORAL = 'TEMPORAL_CONTROL';
const CONTROL = 'CAREER_CONTROL';

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function bool(value) { return value === true; }
function available(value) { return value && value.state === 'AVAILABLE'; }
function anyActiveTransit(value) { return available(value) && Array.isArray(value.values) && value.values.length > 0; }
function activeDasha(row) { return available(row.dasha && row.dasha.h10Lord) && bool(row.dasha.h10Lord.values && row.dasha.h10Lord.values.active); }
function activeH6Dasha(row) { return available(row.dasha && row.dasha.h6Lord) && bool(row.dasha.h6Lord.values && row.dasha.h6Lord.values.active); }
function genericCareerActive(row) { return available(row.genericCareerSignal) && bool(row.genericCareerSignal.values && row.genericCareerSignal.values.active); }
function majorWorkHouseContext(row) {
  const houses = [2, 6, 10, 11];
  return ['jupiter', 'saturn'].some((planet) => available(row.transits && row.transits[planet]) && row.transits[planet].values.some((item) => houses.includes(item.natalHouse)));
}
function jupiterSaturnContext(row) { return anyActiveTransit(row.transits && row.transits.jupiter) || anyActiveTransit(row.transits && row.transits.saturn); }

const CANDIDATE_INTERACTIONS = Object.freeze([
  Object.freeze({ id: 'CAREER_DASHA_X_H6_LORD_DASHA_CONTEXT', order: 2, fields: Object.freeze(['CAREER_LINKED_DASHA', 'H6_LORD_DASHA_CONTEXT']), matches: (row) => activeDasha(row) && activeH6Dasha(row) }),
  Object.freeze({ id: 'CAREER_DASHA_X_JUPITER_SATURN_HOUSE_CONTEXT', order: 2, fields: Object.freeze(['CAREER_LINKED_DASHA', 'JUPITER_SATURN_HOUSE_CONTEXT']), matches: (row) => activeDasha(row) && jupiterSaturnContext(row) }),
  Object.freeze({ id: 'GENERIC_CAREER_SIGNAL_X_H6_CONTEXT', order: 2, fields: Object.freeze(['GENERIC_CAREER_SIGNAL', 'H6_LORD_DASHA_CONTEXT']), matches: (row) => genericCareerActive(row) && activeH6Dasha(row) }),
  Object.freeze({ id: 'CAREER_DASHA_X_WORK_RELATED_TRANSIT_HOUSE_CONTEXT', order: 2, fields: Object.freeze(['CAREER_LINKED_DASHA', 'WORK_RELATED_TRANSIT_HOUSE_CONTEXT']), matches: (row) => activeDasha(row) && majorWorkHouseContext(row) }),
]);
const BASELINE = Object.freeze({ id: 'GENERIC_CAREER_SIGNAL_BASELINE', order: 1, fields: Object.freeze(['GENERIC_CAREER_SIGNAL']), matches: genericCareerActive });

function unitKey(row) { return `${row.pseudonymousProfileId}|${row.unitId}|${row.horizon.horizonId}`; }
function foldRows(rows, predicate) {
  const result = new Map();
  for (const row of rows) {
    const key = unitKey(row); if (!result.has(key)) result.set(key, { key, pseudonymousProfileId: row.pseudonymousProfileId, unitId: row.unitId, unitKind: row.unitKind, eventFamily: row.eventFamily, horizonId: row.horizon.horizonId, partition: row.partition, rows: [] });
    result.get(key).rows.push(row);
  }
  return [...result.values()].map((unit) => freeze({
    ...unit,
    active: unit.rows.some(predicate),
    // A transition can retain both OFFER and JOINING anchors.  Metrics are
    // unit-level, so use its largest registered horizon rather than summing
    // anchor windows and inflating density above one.
    activeDurationMs: Math.max(0, ...unit.rows.map((row) => (
      available(row.genericCareerSignal) && Number.isFinite(row.genericCareerSignal.values.activeDurationMs)
        ? row.genericCareerSignal.values.activeDurationMs
        : 0
    ))),
    horizonDurationMs: Math.max(0, ...unit.rows.map((row) => (
      Date.parse(row.horizon.end) - Date.parse(row.horizon.start)
    ))),
  })).sort((left, right) => left.key.localeCompare(right.key));
}
function rate(numerator, denominator) { return denominator ? Number((numerator / denominator).toFixed(6)) : null; }
function oddsRatio({ positivesActive, positivesInactive, controlsActive, controlsInactive }) {
  if (![positivesActive, positivesInactive, controlsActive, controlsInactive].every(Number.isFinite) || positivesInactive === 0 || controlsActive === 0) return null;
  return Number(((positivesActive * controlsInactive) / (positivesInactive * controlsActive)).toFixed(6));
}
function familyCount(units, kinds) { return units.filter((unit) => kinds.includes(unit.unitKind)); }
function metricFor(units) {
  const positives = familyCount(units, [POSITIVE]); const temporal = familyCount(units, [TEMPORAL]); const nonEmployment = familyCount(units, [CONTROL]); const allControls = [...temporal, ...nonEmployment];
  const count = (set, active) => set.filter((unit) => unit.active === active).length;
  const positiveActive = count(positives, true); const temporalActive = count(temporal, true); const nonEmploymentActive = count(nonEmployment, true); const controlsActive = count(allControls, true);
  const precision = rate(positiveActive, positiveActive + controlsActive);
  const recall = rate(positiveActive, positives.length);
  const densityValues = units.filter((unit) => unit.horizonDurationMs > 0).map((unit) => unit.activeDurationMs / unit.horizonDurationMs);
  return freeze({
    raw: freeze({ positive: freeze({ numerator: positiveActive, denominator: positives.length }), temporalControl: freeze({ numerator: temporalActive, denominator: temporal.length }), nonEmploymentCareerControl: freeze({ numerator: nonEmploymentActive, denominator: nonEmployment.length }) }),
    featurePrevalence: freeze({ employmentTransition: recall, temporalControl: rate(temporalActive, temporal.length), nonEmploymentCareerControl: rate(nonEmploymentActive, nonEmployment.length) }),
    riskDifference: rate(positiveActive, positives.length) === null || rate(controlsActive, allControls.length) === null ? null : Number((rate(positiveActive, positives.length) - rate(controlsActive, allControls.length)).toFixed(6)),
    oddsRatio: oddsRatio({ positivesActive: positiveActive, positivesInactive: positives.length - positiveActive, controlsActive, controlsInactive: allControls.length - controlsActive }),
    employmentTransitionRecall: recall,
    temporalControlFalsePositiveRate: rate(temporalActive, temporal.length),
    nonEmploymentCareerEventFalsePositiveRate: rate(nonEmploymentActive, nonEmployment.length),
    precision,
    precisionRecall: freeze({ precision, recall }),
    activeWindow: freeze({ averageDensity: densityValues.length ? Number((densityValues.reduce((sum, value) => sum + value, 0) / densityValues.length).toFixed(6)) : null, totalDurationMs: units.reduce((sum, unit) => sum + unit.activeDurationMs, 0) }),
  });
}
function missingness(rows) {
  const fields = ['dasha', 'transits', 'refinedTransitFacts', 'd10', 'moon', 'ashtakavarga', 'genericCareerSignal', 'historicalRecurrence']; const output = {};
  for (const field of fields) {
    const states = { AVAILABLE: 0, UNAVAILABLE: 0, NOT_APPLICABLE: 0 };
    for (const row of rows) {
      const value = row[field];
      if (field === 'dasha') [value && value.identities, value && value.h10Lord, value && value.h6Lord].filter(Boolean).forEach((item) => { states[item.state] += 1; });
      else if (field === 'transits') Object.values(value || {}).forEach((item) => { if (item && states[item.state] !== undefined) states[item.state] += 1; });
      else if (value && states[value.state] !== undefined) states[value.state] += 1;
    }
    output[field] = freeze(states);
  }
  return freeze(output);
}
function provenance(rows) {
  const ids = new Map();
  for (const row of rows) { const value = row.astronomyProvenance || {}; const key = JSON.stringify(value); ids.set(key, (ids.get(key) || 0) + 1); }
  return freeze([...ids.entries()].map(([key, rowCount]) => freeze({ provenance: JSON.parse(key), rowCount })).sort((left, right) => JSON.stringify(left.provenance).localeCompare(JSON.stringify(right.provenance))));
}
function prePost(rows, definition) {
  const selected = rows.filter((row) => ['PRE', 'POST'].includes(row.horizon.direction));
  const out = {};
  for (const direction of ['PRE', 'POST']) { const entries = selected.filter((row) => row.horizon.direction === direction); out[direction] = freeze({ numerator: entries.filter(definition.matches).length, denominator: entries.length, prevalence: rate(entries.filter(definition.matches).length, entries.length) }); }
  return freeze(out);
}
function perProfile(rows, definition) {
  const byProfile = new Map(); for (const row of rows) { if (!byProfile.has(row.pseudonymousProfileId)) byProfile.set(row.pseudonymousProfileId, []); byProfile.get(row.pseudonymousProfileId).push(row); }
  return freeze([...byProfile.entries()].map(([pseudonymousProfileId, values]) => freeze({ pseudonymousProfileId, metrics: metricFor(foldRows(values, definition.matches)) })).sort((left, right) => left.pseudonymousProfileId.localeCompare(right.pseudonymousProfileId)));
}
function incremental(candidate, baseline) {
  const fields = ['precision', 'employmentTransitionRecall', 'temporalControlFalsePositiveRate', 'nonEmploymentCareerEventFalsePositiveRate', 'riskDifference']; const output = {};
  for (const field of fields) output[field] = candidate[field] === null || baseline[field] === null ? null : Number((candidate[field] - baseline[field]).toFixed(6));
  return freeze(output);
}
function conclusion(rows, analyses, replicationCandidateConfirmed) {
  const positives = rows.filter((row) => row.unitKind === POSITIVE).map((row) => `${row.pseudonymousProfileId}|${row.unitId}`);
  if (!new Set(positives).size) return 'NO_DISCRIMINATIVE_PATTERN';
  if (replicationCandidateConfirmed === true && analyses.some((analysis) => analysis.metrics.riskDifference !== null && analysis.metrics.riskDifference > 0)) return 'CANDIDATE_FOR_SOURCE_AUDIT_AND_REPLICATION';
  return 'RESEARCH_SIGNAL_ONLY';
}

function runJobFavourabilityBacktest({ featureRows = [], replicationCandidateConfirmed = false } = {}) {
  if (!Array.isArray(featureRows)) throw new TypeError('Job favourability backtest requires feature rows.');
  if (featureRows.some((row) => !row || !HORIZON_IDS.includes(row.horizon && row.horizon.horizonId))) throw new TypeError('Job favourability feature rows must use pre-registered horizons.');
  const analyses = [BASELINE, ...CANDIDATE_INTERACTIONS].map((definition) => {
    if (definition.order > MAX_INTERACTION_ORDER) throw new TypeError('Research interaction exceeds the registered maximum order.');
    const units = foldRows(featureRows, definition.matches); const metrics = metricFor(units); const baselineUnits = foldRows(featureRows, BASELINE.matches); const baselineMetrics = metricFor(baselineUnits);
    return freeze({ candidateId: definition.id, interactionOrder: definition.order, fields: definition.fields, metrics, incrementalDiscriminationVsGenericCareerBaseline: definition.id === BASELINE.id ? null : incremental(metrics, baselineMetrics), preVsPostPrevalence: prePost(featureRows, definition), perProfile: perProfile(featureRows, definition) });
  });
  const output = freeze({
    rulesetId: RUNNER_RULESET_ID,
    researchOnly: true,
    futureProjectionEnabled: false,
    candidateInteractionOrderMaximum: MAX_INTERACTION_ORDER,
    preRegisteredHorizons: freeze([...HORIZON_IDS]),
    candidateAnalyses: freeze(analyses),
    missingness: missingness(featureRows),
    provenance: provenance(featureRows),
    conclusion: conclusion(featureRows, analyses, replicationCandidateConfirmed),
    limitations: freeze(['OFFLINE_RESEARCH_ONLY', 'NO_COMPOSITE_ASTROLOGY_SCORE', 'NO_CUSTOMER_FAVOURABILITY_PERIOD', 'NO_JOB_PROBABILITY', 'NO_EXACT_JOB_DATE', 'NO_OFFER_OR_JOINING_FORECAST', 'PROFILE_DISJOINT_SELECTION_AND_EVALUATION_REQUIRED']),
  });
  return output;
}

module.exports = { RUNNER_RULESET_ID, MAX_INTERACTION_ORDER, CANDIDATE_INTERACTIONS, runJobFavourabilityBacktest };
