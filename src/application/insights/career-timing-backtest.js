'use strict';

// Phase 2H is an internal audit adapter. It consumes already-authoritative D1,
// Dasha, Gochar, and Career-event observations; it neither reads a database nor
// calculates astronomy. Keeping the caller responsible for owned data prevents
// a backtest from bypassing profile ownership or manufacturing a cohort.
const { freeze } = require('../../synthesis/evidence-node');
const { resolveCareerNatalFactors, scanCareerTimingWindows } = require('./career-generalized-timing-engine');

const BACKTEST_RULESET_ID = 'taraverse-career-timing-backtest-v1';
const EVENT_RADIUS_DAYS = 90;
const NEAR_MATCH_DAYS = 30;
const WEAK_NEAR_MATCH_DAYS = 60;
const CONTROL_SEPARATION_DAYS = 120;

const iso = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const dayMs = 24 * 60 * 60 * 1000;
const stable = (values) => [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right)));
const startOf = (date) => `${String(date.year).padStart(4, '0')}-${String(date.month || 1).padStart(2, '0')}-${String(date.day || 1).padStart(2, '0')}T00:00:00.000Z`;
function nextCoverage(date) {
  if (date.precision === 'DAY') return addDays(startOf(date), 1);
  if (date.precision === 'MONTH') return new Date(Date.UTC(date.year, date.month, 1)).toISOString();
  if (date.precision === 'YEAR') return `${date.year + 1}-01-01T00:00:00.000Z`;
  return null;
}
const addDays = (value, days) => new Date(Date.parse(value) + (days * dayMs)).toISOString();
const intersects = (left, right) => Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const clip = (value, boundary) => !intersects(value, boundary) ? null : { ...value, start: Date.parse(value.start) > Date.parse(boundary.start) ? value.start : boundary.start, end: Date.parse(value.end) < Date.parse(boundary.end) ? value.end : boundary.end };

function publicObservations(event = {}) {
  const source = Array.isArray(event.observations) && event.observations.length ? event.observations : [{ type: 'EVENT_DATE', date: event.eventDate, legacy: true }];
  return source.map((item) => {
    const date = item.date || item.eventDate;
    // Private cohort normalisation deliberately uses start/end while API-shaped
    // inputs may use from/to. Both are bounded source coverage, never an
    // inferred event day.
    const from = item.temporalCoverage && (item.temporalCoverage.from || item.temporalCoverage.start) || (date && startOf(date));
    const to = item.temporalCoverage && (item.temporalCoverage.to || item.temporalCoverage.end) || (iso(from) ? nextCoverage(date) : null);
    if (!date || !iso(from) || !iso(to)) return null;
    return freeze({
      birthProfileId: event.birthProfileId,
      careerEventId: event.careerEventId || event.id || null,
      eventType: event.eventType || null,
      observationId: item.observationId || null,
      observationType: item.type || item.observationType || 'EVENT_DATE',
      date: freeze({ precision: date.precision, year: date.year, month: date.month, day: date.day }),
      eventInstant: from,
      temporalCoverage: freeze({ start: from, end: to }),
      legacy: item.legacy === true,
    });
  }).filter(Boolean).sort((left, right) => `${left.eventInstant}|${left.observationType}|${left.careerEventId || ''}`.localeCompare(`${right.eventInstant}|${right.observationType}|${right.careerEventId || ''}`));
}

function normalizeDashaInterval(value) {
  const start = value && (value.start || value.from); const end = value && (value.end || value.to);
  if (!iso(start) || !iso(end) || Date.parse(start) >= Date.parse(end)) return null;
  const activePeriods = Array.isArray(value.activePeriods) ? value.activePeriods : [
    value.mahadasha && { level: 'MD', lord: value.mahadasha.lord },
    value.antardasha && { level: 'AD', lord: value.antardasha.lord },
    value.pratyantardasha && { level: 'PD', lord: value.pratyantardasha.lord },
  ].filter((item) => item && typeof item.lord === 'string');
  return activePeriods.length ? { start, end, activePeriods } : null;
}

function normalizeTransitInterval(value) {
  const start = value && (value.start || value.from); const end = value && (value.end || value.to);
  const sign = value && (value.sign || value.rashiIndex || value.signAtStart && value.signAtStart.rashiIndex);
  return value && typeof value.planet === 'string' && Number.isInteger(sign) && iso(start) && iso(end) && Date.parse(start) < Date.parse(end)
    ? { planet: value.planet, sign, start, end }
    : null;
}

function matchFor(observation, windows) {
  if (['MONTH', 'APPROXIMATE'].includes(observation.date.precision)) {
    const overlaps = windows.some((window) => intersects(window, observation.temporalCoverage));
    const before = windows.filter((window) => Date.parse(window.end) <= Date.parse(observation.temporalCoverage.start)).sort((left, right) => right.end.localeCompare(left.end))[0] || null;
    const after = windows.filter((window) => Date.parse(window.start) >= Date.parse(observation.temporalCoverage.end)).sort((left, right) => left.start.localeCompare(right.start))[0] || null;
    return freeze({
      status: overlaps ? `${observation.date.precision}_OVERLAP` : 'MISS',
      distanceDays: null,
      nearestWindowBefore: before && freeze({ start: before.start, end: before.end }),
      nearestWindowAfter: after && freeze({ start: after.start, end: after.end }),
    });
  }
  const at = Date.parse(observation.eventInstant);
  const exact = windows.some((window) => Date.parse(window.start) <= at && at < Date.parse(window.end));
  const distanceDays = windows.length ? Math.min(...windows.map((window) => Math.max(0, Math.min(Math.abs(at - Date.parse(window.start)), Math.abs(at - Date.parse(window.end))) / dayMs))) : null;
  const status = exact ? 'EXACT_MATCH' : distanceDays !== null && distanceDays <= NEAR_MATCH_DAYS ? 'NEAR_MATCH' : distanceDays !== null && distanceDays <= WEAK_NEAR_MATCH_DAYS ? 'WEAK_NEAR_MATCH' : 'MISS';
  return freeze({ status, distanceDays: distanceDays === null ? null : Number(distanceDays.toFixed(3)) });
}

function deterministicControls(observations) {
  const ordered = observations.slice().sort((left, right) => left.eventInstant.localeCompare(right.eventInstant)); const controls = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const left = Date.parse(ordered[index - 1].eventInstant); const right = Date.parse(ordered[index].eventInstant);
    if (right - left < CONTROL_SEPARATION_DAYS * 2 * dayMs) continue;
    const at = new Date(left + Math.floor((right - left) / 2)).toISOString();
    controls.push(freeze({ controlId: `MIDPOINT:${index}`, eventInstant: at, temporalCoverage: freeze({ start: addDays(at, -EVENT_RADIUS_DAYS), end: addDays(at, EVENT_RADIUS_DAYS) }) }));
  }
  return freeze(controls);
}

function mergeIntervals(intervals) {
  const ordered = intervals.filter((item) => iso(item.start) && iso(item.end)).slice().sort((left, right) => left.start.localeCompare(right.start)); const output = [];
  for (const candidate of ordered) {
    const previous = output[output.length - 1];
    if (!previous || Date.parse(candidate.start) > Date.parse(previous.end)) output.push({ start: candidate.start, end: candidate.end });
    else if (Date.parse(candidate.end) > Date.parse(previous.end)) previous.end = candidate.end;
  }
  return output;
}

function coverageDensity(evaluated, eligible) {
  const evaluatedUnion = mergeIntervals(evaluated); const eligibleUnion = mergeIntervals(eligible);
  const evaluatedMs = evaluatedUnion.reduce((sum, item) => sum + Date.parse(item.end) - Date.parse(item.start), 0);
  const eligibleMs = eligibleUnion.reduce((sum, item) => sum + Date.parse(item.end) - Date.parse(item.start), 0);
  return evaluatedMs ? Number(((eligibleMs / evaluatedMs) * 100).toFixed(3)) : null;
}

function ruleFrequency(results) {
  const rows = new Map();
  const add = (key, bucket) => { if (!rows.has(key)) rows.set(key, { rule: key, windows: 0, eventWindows: 0, controlWindows: 0, durationDays: [] }); const row = rows.get(key); row.windows += 1; row[`${bucket}Windows`] += 1; };
  for (const result of results) for (const window of result.windows) {
    const bucket = result.kind === 'CONTROL' ? 'control' : 'event'; const days = (Date.parse(window.end) - Date.parse(window.start)) / dayMs;
    const keys = stable([
      ...window.gocharActivations.map((item) => item.targetType === 'D1_H10_SIGN' ? 'H10_SIGN_ACTIVATION' : item.targetType === 'D1_H10_LORD' ? 'H10_LORD_ACTIVATION' : null).filter(Boolean),
      ...window.majorPlanetsActive.map((planet) => `${planet.toUpperCase()}_ACTIVATION`),
      window.majorDualActivation ? 'JUPITER_SATURN_DUAL_ACTIVATION' : null,
      window.multiTargetActivation ? 'MULTI_TARGET_ACTIVATION' : null,
    ].filter(Boolean));
    for (const key of keys) { add(key, bucket); rows.get(key).durationDays.push(days); }
  }
  return freeze([...rows.values()].map((row) => freeze({ ...row, averageDurationDays: Number((row.durationDays.reduce((sum, value) => sum + value, 0) / row.durationDays.length).toFixed(3)), durationDays: undefined })).sort((left, right) => left.rule.localeCompare(right.rule)));
}

function summarizeMode(results, selector) {
  const selected = results.map((result) => ({ ...result, windows: result.windows.filter(selector) }));
  const events = selected.filter((item) => item.kind === 'EVENT'); const controls = selected.filter((item) => item.kind === 'CONTROL');
  const matches = events.map((item) => matchFor(item.subject, item.windows));
  const transitionMatches = new Map();
  for (let index = 0; index < events.length; index += 1) {
    const key = events[index].subject.careerEventId || `legacy:${events[index].subject.eventInstant}`;
    if (!transitionMatches.has(key)) transitionMatches.set(key, false);
    if (['EXACT_MATCH', 'NEAR_MATCH', 'MONTH_OVERLAP', 'APPROXIMATE_OVERLAP'].includes(matches[index].status)) transitionMatches.set(key, true);
  }
  return freeze({
    candidateWindows: selected.reduce((sum, item) => sum + item.windows.length, 0),
    exactMatches: matches.filter((item) => item.status === 'EXACT_MATCH').length,
    nearMatches: matches.filter((item) => item.status === 'NEAR_MATCH').length,
    weakNearMatches: matches.filter((item) => item.status === 'WEAK_NEAR_MATCH').length,
    monthOverlaps: matches.filter((item) => item.status === 'MONTH_OVERLAP').length,
    approximateOverlaps: matches.filter((item) => item.status === 'APPROXIMATE_OVERLAP').length,
    misses: matches.filter((item) => item.status === 'MISS').length,
    transitionsMatched: [...transitionMatches.values()].filter(Boolean).length,
    transitionsMissed: [...transitionMatches.values()].filter((item) => !item).length,
    controlMatches: controls.filter((item) => item.windows.length > 0).length,
    controlFalsePositives: controls.filter((item) => item.windows.length > 0).length,
    coverageDensityPercent: coverageDensity(selected.map((item) => item.subject.temporalCoverage), selected.flatMap((item) => item.windows.map((window) => clip(window, item.subject.temporalCoverage)).filter(Boolean))),
  });
}

function granularityAudit(results) {
  const dashaLevels = (window) => Number(window.dashaActivation.mdEvidence.length > 0) + Number(window.dashaActivation.adEvidence.length > 0) + Number(window.dashaActivation.pdEvidence.length > 0);
  const target = (type) => (window) => window.gocharActivations.some((item) => item.targetType === type);
  return freeze({
    dasha: freeze({
      ANY_MD_AD_PD: summarizeMode(results, () => true),
      AD_OR_PD: summarizeMode(results, (window) => window.dashaActivation.adEvidence.length > 0 || window.dashaActivation.pdEvidence.length > 0),
      AT_LEAST_TWO_LEVELS: summarizeMode(results, (window) => dashaLevels(window) >= 2),
      MD_AND_AD: summarizeMode(results, (window) => window.dashaActivation.mdEvidence.length > 0 && window.dashaActivation.adEvidence.length > 0),
      AD_AND_PD: summarizeMode(results, (window) => window.dashaActivation.adEvidence.length > 0 && window.dashaActivation.pdEvidence.length > 0),
    }),
    gochar: freeze({
      H10_SIGN_ONLY: summarizeMode(results, target('D1_H10_SIGN')),
      H10_LORD_ONLY: summarizeMode(results, target('D1_H10_LORD')),
      EITHER_PRIMARY_TARGET: summarizeMode(results, (window) => target('D1_H10_SIGN')(window) || target('D1_H10_LORD')(window)),
      MULTI_TARGET: summarizeMode(results, (window) => window.multiTargetActivation),
      JUPITER_ONLY: summarizeMode(results, (window) => window.majorPlanetsActive.includes('Jupiter')),
      SATURN_ONLY: summarizeMode(results, (window) => window.majorPlanetsActive.includes('Saturn')),
      JUPITER_SATURN_DUAL: summarizeMode(results, (window) => window.majorDualActivation),
    }),
    classification: freeze({
      BASE_TIMING_WINDOW: summarizeMode(results, (window) => window.classification === 'BASE_TIMING_WINDOW'),
      REINFORCED_TIMING_WINDOW: summarizeMode(results, (window) => window.classification === 'REINFORCED_TIMING_WINDOW'),
      STRONG_CONVERGENCE_WINDOW: summarizeMode(results, (window) => window.classification === 'STRONG_CONVERGENCE_WINDOW'),
    }),
  });
}

function runCareerTimingBacktest({ profiles = [] } = {}) {
  const profileReports = [];
  for (const profile of profiles) {
    if (!profile || typeof profile.birthProfileId !== 'string' || !profile.d1Houses) continue;
    const factors = profile.careerNatalFactors || resolveCareerNatalFactors({ d1Houses: profile.d1Houses });
    const observations = freeze((Array.isArray(profile.events) ? profile.events : []).flatMap(publicObservations).filter((item) => item.birthProfileId === profile.birthProfileId));
    const controls = deterministicControls(observations);
    const dashaIntervals = (Array.isArray(profile.dashaIntervals) ? profile.dashaIntervals : []).map(normalizeDashaInterval).filter(Boolean);
    const transitIntervals = (Array.isArray(profile.transitIntervals) ? profile.transitIntervals : []).map(normalizeTransitInterval).filter(Boolean);
    const evaluate = (subject, kind) => {
      // The event remains matched only against its supplied bounded coverage.
      // A small surrounding scan exists solely to report the nearest preceding
      // and following eligible window for non-day observations.
      const horizon = kind === 'EVENT'
        ? freeze({ start: addDays(subject.temporalCoverage.start, -EVENT_RADIUS_DAYS), end: addDays(subject.temporalCoverage.end, EVENT_RADIUS_DAYS) })
        : subject.temporalCoverage;
      const scan = scanCareerTimingWindows({ careerNatalFactors: factors, d1Houses: profile.d1Houses, d1CareerRelevant: profile.d1CareerRelevant === true, dashaIntervals, transitIntervals, horizonStart: horizon.start, horizonEnd: horizon.end, d10Confirmation: profile.d10Confirmation === true, ashtakavargaSupport: profile.ashtakavargaSupport || null, historicalRecurrence: null });
      return freeze({ kind, subject, windows: scan.windows, match: kind === 'EVENT' ? matchFor(subject, scan.windows) : freeze({ status: scan.windows.length ? 'CONTROL_WINDOW_PRESENT' : 'CONTROL_CLEAR', distanceDays: null }) });
    };
    const eventResults = observations.map((item) => evaluate(item, 'EVENT')); const controlResults = controls.map((item) => evaluate(item, 'CONTROL'));
    const transitions = new Map(); for (const item of eventResults) { const key = item.subject.careerEventId || `legacy:${item.subject.eventInstant}`; if (!transitions.has(key)) transitions.set(key, []); transitions.get(key).push(item); }
    const transitionResults = [...transitions.entries()].map(([careerEventId, items]) => freeze({ careerEventId, observationTypes: freeze(items.map((item) => item.subject.observationType)), status: items.some((item) => ['EXACT_MATCH', 'NEAR_MATCH', 'MONTH_OVERLAP', 'APPROXIMATE_OVERLAP'].includes(item.match.status)) ? 'TRANSITION_MATCHED' : 'TRANSITION_UNMATCHED' }));
    const allResults = [...eventResults, ...controlResults]; const eligibleWindows = allResults.flatMap((item) => item.windows.map((window) => clip(window, item.subject.temporalCoverage)).filter(Boolean)); const evaluated = allResults.map((item) => item.subject.temporalCoverage);
    const recurrenceWouldReinforce = profile.historicalRecurrence ? eligibleWindows.length : 0;
    profileReports.push(freeze({ birthProfileId: profile.birthProfileId, natalCareerFactors: factors, observations: freeze(eventResults), controls: freeze(controlResults), transitions: freeze(transitionResults), ruleFrequency: ruleFrequency(allResults), granularityAudit: granularityAudit(allResults), historicalRecurrenceAudit: freeze({ classicalEligibleWindows: eligibleWindows.length, wouldReinforceEligibleWindows: recurrenceWouldReinforce, affectsPrimaryEligibility: false }), coverageDensityPercent: coverageDensity(evaluated, eligibleWindows) }));
  }
  const observations = profileReports.flatMap((profile) => profile.observations); const controls = profileReports.flatMap((profile) => profile.controls); const count = (status) => observations.filter((item) => item.match.status === status).length;
  const aggregate = freeze({
    historicalObservations: observations.length, exactMatches: count('EXACT_MATCH'), nearMatches: count('NEAR_MATCH'), weakNearMatches: count('WEAK_NEAR_MATCH'), monthOverlaps: count('MONTH_OVERLAP'), approximateOverlaps: count('APPROXIMATE_OVERLAP'), misses: count('MISS'),
    transitions: profileReports.flatMap((profile) => profile.transitions), controlPeriods: controls.length, controlFalsePositives: controls.filter((item) => item.match.status === 'CONTROL_WINDOW_PRESENT').length,
    coverageDensityPercent: coverageDensity(profileReports.flatMap((profile) => [...profile.observations, ...profile.controls].map((item) => item.subject.temporalCoverage)), profileReports.flatMap((profile) => [...profile.observations, ...profile.controls].flatMap((item) => item.windows.map((window) => clip(window, item.subject.temporalCoverage)).filter(Boolean)))),
  });
  return freeze({ rulesetId: BACKTEST_RULESET_ID, status: aggregate.historicalObservations ? 'READY_FOR_REVIEW' : 'INSUFFICIENT_HISTORICAL_DATA', configuration: freeze({ eventRadiusDays: EVENT_RADIUS_DAYS, nearMatchDays: NEAR_MATCH_DAYS, weakNearMatchDays: WEAK_NEAR_MATCH_DAYS, controlSeparationDays: CONTROL_SEPARATION_DAYS, recurrenceAffectsEligibility: false, futureProjectionEnabled: false }), profiles: freeze(profileReports), aggregate, limitations: freeze(['SUPPLIED_OWNED_COHORT_REQUIRED', 'PRECOMPUTED_DASHA_AND_TRANSIT_INTERVALS_REQUIRED', 'NO_EVENT_TYPE_PREDICTION', 'FUTURE_PROJECTION_DISABLED']) });
}

module.exports = { BACKTEST_RULESET_ID, EVENT_RADIUS_DAYS, NEAR_MATCH_DAYS, WEAK_NEAR_MATCH_DAYS, CONTROL_SEPARATION_DAYS, publicObservations, deterministicControls, runCareerTimingBacktest };
