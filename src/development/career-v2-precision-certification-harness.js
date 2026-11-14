'use strict';

// Development-only comparative certification. It consumes the four existing
// Career timing outputs and never changes their methodology.
const { buildCareerTimingPeriods, buildCareerTimingV2, buildCareerTimingV21, buildCareerTimingV22, buildCareerTimingV23 } = require('../application/insights');

const SCHEMA_VERSION = 'career-v2-precision-certification-input-v1';
const RESULT_VERSION = 'career-v2-precision-certification-results-v1';
const EVENT_TYPES = new Set(['JOB_JOINED', 'JOB_CHANGED', 'PROMOTION', 'ROLE_CHANGED', 'SALARY_CHANGED', 'JOB_LOSS', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK', 'OTHER']);
const PRECISIONS = new Set(['DAY', 'MONTH', 'YEAR']);
const DIRECT_REASONS = new Set(['D1_H10_LORD', 'D1_H10_OCCUPANT', 'D1_H10_FULL_ASPECT']);
const STATES = Object.freeze(['SUPPORTIVE', 'SUPPORTIVE_WITH_CONDITIONS', 'MIXED', 'CAUTIOUS']);
const CONTROL_DAYS = Object.freeze([90, 180, 365]);
const BANNED_KEYS = /^(name|phone|email|notes?|userId|subject|productionId)$/i;
const DAY = 86_400_000;
const YEAR = 365.2425 * DAY;

const freeze = (value) => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };
const dateOnly = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const interval = (value) => value && iso(value.start) && iso(value.end) && Date.parse(value.start) < Date.parse(value.end);
const intersects = (left, right) => interval(left) && interval(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const duration = (value) => Date.parse(value.end) - Date.parse(value.start);
const sumDuration = (values) => values.reduce((sum, value) => sum + duration(value), 0);
const round = (value, digits = 4) => Number(value.toFixed(digits));
const percentile = (values, p) => { if (!values.length) return null; const sorted = values.slice().sort((a, b) => a - b); const index = (sorted.length - 1) * p; const low = Math.floor(index); const high = Math.ceil(index); return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (index - low); };

function rejectSensitiveKeys(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (BANNED_KEYS.test(key)) throw new TypeError(`Precision certification input contains prohibited identity/free-text field at ${path}.${key}.`);
    rejectSensitiveKeys(child, `${path}.${key}`);
  }
}

function eventInterval(event) {
  if (event.datePrecision === 'DAY') return { start: new Date(Date.UTC(event.year, event.month - 1, event.day)).toISOString(), end: new Date(Date.UTC(event.year, event.month - 1, event.day + 1)).toISOString() };
  if (event.datePrecision === 'MONTH') return { start: new Date(Date.UTC(event.year, event.month - 1, 1)).toISOString(), end: new Date(Date.UTC(event.year, event.month, 1)).toISOString() };
  return { start: new Date(Date.UTC(event.year, 0, 1)).toISOString(), end: new Date(Date.UTC(event.year + 1, 0, 1)).toISOString() };
}

function mergeIntervals(values = []) {
  const sorted = values.filter(interval).map((value) => ({ start: value.start, end: value.end })).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const output = [];
  for (const value of sorted) {
    const previous = output.at(-1);
    if (!previous || Date.parse(value.start) > Date.parse(previous.end)) output.push({ ...value });
    else if (Date.parse(value.end) > Date.parse(previous.end)) previous.end = value.end;
  }
  return freeze(output.map(freeze));
}

function intersectInterval(left, right) {
  if (!intersects(left, right)) return null;
  return freeze({ start: Date.parse(left.start) > Date.parse(right.start) ? left.start : right.start, end: Date.parse(left.end) < Date.parse(right.end) ? left.end : right.end });
}
function clipIntervals(values, boundary) { return mergeIntervals(values.map((value) => intersectInterval(value, boundary)).filter(Boolean)); }
function subtractIntervals(boundary, excluded = []) {
  let cursor = Date.parse(boundary.start); const end = Date.parse(boundary.end); const output = [];
  for (const value of clipIntervals(excluded, boundary)) {
    const start = Date.parse(value.start); const stop = Date.parse(value.end);
    if (cursor < start) output.push({ start: new Date(cursor).toISOString(), end: new Date(start).toISOString() });
    cursor = Math.max(cursor, stop);
  }
  if (cursor < end) output.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString() });
  return freeze(output.map(freeze));
}

function validateEvent(event, profileId, seen) {
  if (!event || typeof event !== 'object' || !/^EVENT_[A-Z0-9_-]+$/.test(event.eventId || '') || seen.has(event.eventId)) throw new TypeError(`${profileId} has an invalid or duplicate anonymized eventId.`);
  seen.add(event.eventId);
  if (!EVENT_TYPES.has(event.type)) throw new TypeError(`${event.eventId} has an unsupported Career event type.`);
  if (!PRECISIONS.has(event.datePrecision) || !Number.isInteger(event.year) || event.year < 1900 || event.year > 2200) throw new TypeError(`${event.eventId} has an invalid date precision/year.`);
  if (event.datePrecision !== 'YEAR' && (!Number.isInteger(event.month) || event.month < 1 || event.month > 12)) throw new TypeError(`${event.eventId} requires a valid month.`);
  if (event.datePrecision === 'DAY') {
    if (!Number.isInteger(event.day) || event.day < 1 || event.day > 31) throw new TypeError(`${event.eventId} requires a valid day.`);
    const check = new Date(Date.UTC(event.year, event.month - 1, event.day));
    if (check.getUTCFullYear() !== event.year || check.getUTCMonth() !== event.month - 1 || check.getUTCDate() !== event.day) throw new TypeError(`${event.eventId} is not a real calendar date.`);
  }
  if (Object.keys(event).some((key) => !['eventId', 'type', 'datePrecision', 'year', 'month', 'day'].includes(key))) throw new TypeError(`${event.eventId} contains unsupported fields.`);
  return freeze({ eventId: event.eventId, type: event.type, datePrecision: event.datePrecision, year: event.year, ...(event.month ? { month: event.month } : {}), ...(event.day ? { day: event.day } : {}), interval: freeze(eventInterval(event)) });
}

function validatePrecisionCertificationInput(input) {
  rejectSensitiveKeys(input);
  if (!input || input.schemaVersion !== SCHEMA_VERSION || !Array.isArray(input.profiles) || input.profiles.length === 0) throw new TypeError(`Precision certification input must use ${SCHEMA_VERSION} with at least one profile.`);
  if (Object.keys(input).some((key) => !['schemaVersion', 'consent', 'profiles'].includes(key))) throw new TypeError('Precision certification input contains unsupported top-level fields.');
  if (!input.consent || input.consent.ownerSupplied !== true || input.consent.explicitHistoricalValidation !== true) throw new TypeError('Explicit owner-supplied historical-validation consent is required.');
  const profileIds = new Set(); const eventIds = new Set();
  const profiles = input.profiles.map((profile) => {
    if (!profile || !/^PROFILE_[A-Z0-9_-]+$/.test(profile.profileId || '') || profileIds.has(profile.profileId)) throw new TypeError('Every profile requires a unique anonymized PROFILE_* identifier.');
    profileIds.add(profile.profileId);
    if (Object.keys(profile).some((key) => !['profileId', 'birthData', 'observationPeriod', 'events'].includes(key))) throw new TypeError(`${profile.profileId} contains unsupported fields.`);
    const birth = profile.birthData;
    if (!birth || Object.keys(birth).some((key) => !['date', 'time', 'timezone', 'latitude', 'longitude'].includes(key)) || !dateOnly(birth.date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(birth.time || '') || typeof birth.timezone !== 'string' || !birth.timezone || !Number.isFinite(birth.latitude) || birth.latitude < -90 || birth.latitude > 90 || !Number.isFinite(birth.longitude) || birth.longitude < -180 || birth.longitude > 180) throw new TypeError(`${profile.profileId} has invalid birthData.`);
    const observed = profile.observationPeriod;
    if (!observed || Object.keys(observed).some((key) => !['start', 'end'].includes(key)) || !dateOnly(observed.start) || !dateOnly(observed.end)) throw new TypeError(`${profile.profileId} requires explicit owner-supplied observationPeriod.start/end dates.`);
    const observationPeriod = freeze({ start: `${observed.start}T00:00:00.000Z`, end: `${observed.end}T00:00:00.000Z` });
    if (!interval(observationPeriod)) throw new RangeError(`${profile.profileId} observationPeriod must have start before end.`);
    if (!Array.isArray(profile.events)) throw new TypeError(`${profile.profileId} requires an events array.`);
    const events = profile.events.map((event) => validateEvent(event, profile.profileId, eventIds));
    if (events.some((event) => !intersects(event.interval, observationPeriod))) throw new RangeError(`${profile.profileId} has an event outside its observationPeriod.`);
    return freeze({ profileId: profile.profileId, birthData: freeze({ ...birth }), observationPeriod, events: freeze(events) });
  });
  return freeze({ schemaVersion: SCHEMA_VERSION, consent: freeze({ ownerSupplied: true, explicitHistoricalValidation: true }), profiles: freeze(profiles) });
}

function deterministicControlSamples(background, observation) {
  const total = duration(observation); const result = [];
  for (const days of CONTROL_DAYS) for (const [stratum, low, high] of [['EARLY', 0, 1 / 3], ['MIDDLE', 1 / 3, 2 / 3], ['RECENT', 2 / 3, 1]]) {
    const span = days * DAY;
    const candidates = background.filter((value) => duration(value) >= span && ((Date.parse(value.start) + Date.parse(value.end)) / 2 - Date.parse(observation.start)) / total >= low && ((Date.parse(value.start) + Date.parse(value.end)) / 2 - Date.parse(observation.start)) / total < high);
    if (!candidates.length) continue;
    const source = stratum === 'RECENT' ? candidates.at(-1) : candidates[0];
    const start = stratum === 'RECENT' ? Date.parse(source.end) - span : stratum === 'MIDDLE' ? Math.floor((Date.parse(source.start) + Date.parse(source.end) - span) / 2) : Date.parse(source.start);
    result.push(freeze({ sampleId: `${days}D_${stratum}`, days, stratum, start: new Date(start).toISOString(), end: new Date(start + span).toISOString() }));
  }
  return freeze(result);
}

function relationship(lord, promise) {
  const factor = promise.factors.relevantPlanets.find((value) => value.planet === lord);
  if (!factor) return 'UNRELATED';
  return factor.relevanceReasons.some((reason) => DIRECT_REASONS.has(reason)) ? 'DIRECT' : 'CONNECTED';
}
function dashaPattern(candidate, promise) { return candidate.dasha && candidate.dasha.md && candidate.dasha.ad ? `${relationship(candidate.dasha.md.lord, promise)} + ${relationship(candidate.dasha.ad.lord, promise)}` : 'OTHER'; }

function candidateMetrics({ candidates, atomicCount, observation, eventIntervals, events, promise, statesAvailable = true }) {
  const clipped = candidates.map((candidate) => { const clippedInterval = intersectInterval(candidate, observation); return clippedInterval ? { ...candidate, ...clippedInterval } : null; }).filter(Boolean);
  const union = mergeIntervals(clipped); const eventUnion = clipIntervals(eventIntervals, observation);
  const candidateMs = sumDuration(union);
  const eventMs = sumDuration(mergeIntervals(union.flatMap((candidate) => eventUnion.map((event) => intersectInterval(candidate, event)).filter(Boolean))));
  const associated = clipped.filter((candidate) => eventUnion.some((event) => intersects(candidate, event)));
  const background = clipped.filter((candidate) => !eventUnion.some((event) => intersects(candidate, event)));
  const stateDistribution = (list) => Object.fromEntries(STATES.map((state) => [state, statesAvailable ? list.filter((candidate) => candidate.state === state).length : null]));
  const patterns = (list) => Object.fromEntries(['DIRECT + DIRECT', 'DIRECT + CONNECTED', 'CONNECTED + DIRECT', 'DIRECT + UNRELATED', 'UNRELATED + DIRECT', 'CONNECTED + CONNECTED', 'CONNECTED + UNRELATED', 'UNRELATED + CONNECTED', 'OTHER'].map((pattern) => [pattern, promise ? list.filter((candidate) => dashaPattern(candidate, promise) === pattern).length : null]));
  const durations = clipped.map(duration); const statistic = (p) => percentile(durations, p) === null ? null : round(percentile(durations, p) / DAY);
  const coveredEventIds = events.filter((event) => clipped.some((candidate) => intersects(event.interval, candidate))).map((event) => event.eventId);
  return freeze({ atomicWindows: atomicCount, coalescedWindows: clipped.length, windowsPerYear: round(clipped.length / (duration(observation) / YEAR)), durationDays: freeze({ mean: durations.length ? round(durations.reduce((a, b) => a + b, 0) / durations.length / DAY) : null, median: statistic(0.5), p25: statistic(0.25), p75: statistic(0.75), longest: durations.length ? round(Math.max(...durations) / DAY) : null }), durationSamplesDays: freeze(durations.map((value) => value / DAY)), candidateDays: round(candidateMs / DAY), observationDays: round(duration(observation) / DAY), timeInWindowPercent: round(candidateMs / duration(observation) * 100), eventAssociatedCandidateDays: round(eventMs / DAY), backgroundCandidateDays: round((candidateMs - eventMs) / DAY), eventConcentrationPercent: candidateMs ? round(eventMs / candidateMs * 100) : 0, backgroundCandidates: background.length, eventAssociatedCandidates: associated.length, stateDistribution: freeze({ eventAssociated: freeze(stateDistribution(associated)), background: freeze(stateDistribution(background)) }), dashaPatternDistribution: freeze({ eventAssociated: freeze(patterns(associated)), background: freeze(patterns(background)) }), eventsCovered: coveredEventIds.length, coveredEventIds: freeze(coveredEventIds) });
}

function singlePrimaryAnalysis(candidates, promise, observation, events) {
  return freeze(Object.fromEntries(['DIRECT + UNRELATED', 'UNRELATED + DIRECT', 'CONNECTED + UNRELATED', 'UNRELATED + CONNECTED'].map((pattern) => {
    const selected = candidates.filter((candidate) => dashaPattern(candidate, promise) === pattern).map((candidate) => { const clipped = intersectInterval(candidate, observation); return clipped ? { ...candidate, ...clipped } : null; }).filter(Boolean);
    const durations = selected.map(duration);
    return [pattern, freeze({ windows: selected.length, candidateDays: round(sumDuration(mergeIntervals(selected)) / DAY), eventAssociatedWindows: selected.filter((candidate) => events.some((event) => intersects(candidate, event.interval))).length, backgroundWindows: selected.filter((candidate) => !events.some((event) => intersects(candidate, event.interval))).length, medianDurationDays: durations.length ? round(percentile(durations, 0.5) / DAY) : null, jupiterOnly: selected.filter((candidate) => candidate.transit.jupiter.state === 'ALIGNED' && candidate.transit.saturn.state !== 'ALIGNED').length, saturnOnly: selected.filter((candidate) => candidate.transit.saturn.state === 'ALIGNED' && candidate.transit.jupiter.state !== 'ALIGNED').length, dualTransit: selected.filter((candidate) => candidate.transit.jupiter.state === 'ALIGNED' && candidate.transit.saturn.state === 'ALIGNED').length, d10: freeze(Object.fromEntries(['CONFIRMS', 'NEUTRAL', 'MIXED', 'UNAVAILABLE'].map((state) => [state, selected.filter((candidate) => candidate.d10.state === state).length]))), pdRefinement: freeze(Object.fromEntries(['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT', 'CONTEXT_ONLY', 'NOT_RELEVANT'].map((state) => [state, selected.filter((candidate) => candidate.dasha.pd.refinementState === state).length]))) })];
  })));
}

const V23_TIERS = Object.freeze(['PEAK', 'STRONG', 'MODERATE', 'BASE']);
const V23_TIER_RANK = Object.freeze({ PEAK: 4, STRONG: 3, MODERATE: 2, BASE: 1 });

function v23TierMetrics({ v23, v22, observation, events, eventIntervals }) {
  const parentIdentity = (value) => `${value.candidateId || value.parentId}|${value.start}|${value.end}`;
  const eligibilityMatchesV22 = v23.parentCount === v22.candidates.length && v23.parents.every((parent, index) => parentIdentity(parent) === parentIdentity(v22.candidates[index]));
  const backgroundObservationMs = sumDuration(subtractIntervals(observation, eventIntervals));
  const tiers = Object.fromEntries(V23_TIERS.map((tier) => {
    const candidates = v23.children.filter((child) => child.tier === tier);
    const metrics = candidateMetrics({ candidates, atomicCount: candidates.length, observation, eventIntervals, events, promise: null, statesAvailable: false });
    return [tier, freeze({ ...metrics, backgroundObservationPercent: backgroundObservationMs ? round(metrics.backgroundCandidateDays * DAY / backgroundObservationMs * 100) : 0 })];
  }));
  const eventDistribution = { PEAK: 0, STRONG: 0, MODERATE: 0, BASE: 0, NO_V22_ELIGIBILITY: 0 };
  for (const event of events) {
    const overlaps = v23.children.filter((child) => intersects(child, event.interval));
    if (!overlaps.length) eventDistribution.NO_V22_ELIGIBILITY += 1;
    else eventDistribution[overlaps.slice().sort((left, right) => V23_TIER_RANK[right.tier] - V23_TIER_RANK[left.tier])[0].tier] += 1;
  }
  return freeze({ eligibilityMatchesV22, parentCount: v23.parentCount, childWindowCount: v23.children.length, fragmentedParentCount: v23.parents.filter((parent) => parent.children.length > 1).length, tiers: freeze(tiers), eventDistribution: freeze(eventDistribution) });
}

function qualityFlags(profile, eventUnion) {
  const flags = []; const observation = profile.observationPeriod;
  if (duration(observation) < YEAR) flags.push('SHORT_OBSERVATION_PERIOD');
  const sorted = eventUnion.slice().sort((a, b) => a.start.localeCompare(b.start));
  if (sorted.some((event, index) => index > 0 && Date.parse(event.start) - Date.parse(sorted[index - 1].end) < 30 * DAY)) flags.push('CLUSTERED_EVENTS');
  if (subtractIntervals(observation, eventUnion).some((gap) => duration(gap) > 2 * YEAR)) flags.push('LONG_GAP_WITH_UNCERTAIN_EVENT_HISTORY');
  if (profile.events.some((event) => Date.parse(event.interval.start) - Date.parse(observation.start) < 30 * DAY || Date.parse(observation.end) - Date.parse(event.interval.end) < 30 * DAY)) flags.push('EVENT_CLOSE_TO_OBSERVATION_BOUNDARY');
  const identities = new Set(); if (profile.events.some((event) => { const key = `${event.interval.start}|${event.interval.end}`; if (identities.has(key)) return true; identities.add(key); return false; })) flags.push('DUPLICATE_OR_SAME_INTERVAL_EVENTS');
  return freeze(flags);
}

function legacyWindows(result) { return result.periods.map((value) => freeze({ start: value.startDate, end: value.endDate })); }
const atomicCount = (result) => Number.isInteger(result.atomicCandidateCount) ? result.atomicCandidateCount : result.candidates.reduce((sum, candidate) => sum + (candidate.internalPhases || [candidate]).length, 0);

function profileReport(profile, evidence) {
  const observation = profile.observationPeriod; const eventUnion = mergeIntervals(profile.events.map((event) => event.interval)); const backgroundIntervals = subtractIntervals(observation, eventUnion);
  const input = { ...evidence, forecastStart: observation.start, forecastEnd: observation.end, calculationInstant: observation.start, referenceInstant: observation.start };
  const legacyRaw = buildCareerTimingPeriods({ d1Houses: evidence.d1Houses, dashaIntervals: evidence.dashaIntervals, transitIntervals: evidence.transitIntervals, horizonStart: observation.start, horizonEnd: observation.end, d10Confirmation: Boolean(evidence.d10Corroboration), recurrence: null });
  const legacy = legacyWindows(legacyRaw); const v2 = buildCareerTimingV2(input); const v21 = buildCareerTimingV21(input); const v22 = buildCareerTimingV22(input); const v23 = buildCareerTimingV23({ v22Result: v22, referenceInstant: observation.start });
  const rulesets = freeze({ legacy: candidateMetrics({ candidates: legacy, atomicCount: legacy.length, observation, eventIntervals: eventUnion, events: profile.events, promise: null, statesAvailable: false }), v2: candidateMetrics({ candidates: v2.candidates, atomicCount: atomicCount(v2), observation, eventIntervals: eventUnion, events: profile.events, promise: v22.promise }), v21: candidateMetrics({ candidates: v21.candidates, atomicCount: atomicCount(v21), observation, eventIntervals: eventUnion, events: profile.events, promise: v21.promise }), v22: candidateMetrics({ candidates: v22.candidates, atomicCount: atomicCount(v22), observation, eventIntervals: eventUnion, events: profile.events, promise: v22.promise }) });
  const controls = deterministicControlSamples(backgroundIntervals, observation).map((sample) => freeze({ ...sample, rulesets: freeze(Object.fromEntries([['legacy', legacy], ['v2', v2.candidates], ['v21', v21.candidates], ['v22', v22.candidates]].map(([name, candidates]) => [name, freeze({ hasCandidate: candidates.some((candidate) => intersects(sample, candidate)), overlappingCandidateCount: candidates.filter((candidate) => intersects(sample, candidate)).length })]))) }));
  return freeze({ profileId: profile.profileId, observationPeriod: observation, observationYears: round(duration(observation) / YEAR), knownEvents: profile.events.length, eventAssociatedIntervals: eventUnion, backgroundIntervals, dataQualityFlags: qualityFlags(profile, eventUnion), rulesets, v23: v23TierMetrics({ v23, v22, observation, events: profile.events, eventIntervals: eventUnion }), singlePrimary: singlePrimaryAnalysis(v2.candidates, v22.promise, observation, profile.events), controls: freeze(controls) });
}

function aggregate(profiles) {
  const rulesets = {};
  const legacyCovered = new Set(profiles.flatMap((profile) => profile.rulesets.legacy.coveredEventIds.map((eventId) => `${profile.profileId}/${eventId}`)));
  for (const name of ['legacy', 'v2', 'v21', 'v22']) {
    const rows = profiles.map((profile) => profile.rulesets[name]); const observationDays = rows.reduce((sum, row) => sum + row.observationDays, 0); const candidateDays = rows.reduce((sum, row) => sum + row.candidateDays, 0);
    const samples = rows.flatMap((row) => row.durationSamplesDays); const covered = new Set(profiles.flatMap((profile) => profile.rulesets[name].coveredEventIds.map((eventId) => `${profile.profileId}/${eventId}`)));
    const sumDistribution = (field, scope) => Object.fromEntries(Object.keys(rows[0][field][scope]).map((key) => [key, rows[0][field][scope][key] === null ? null : rows.reduce((sum, row) => sum + row[field][scope][key], 0)]));
    rulesets[name] = freeze({ eventsCovered: covered.size, retainedFromLegacy: [...covered].filter((eventId) => legacyCovered.has(eventId)).length, lostFromLegacy: [...legacyCovered].filter((eventId) => !covered.has(eventId)).length, gainedVsLegacy: [...covered].filter((eventId) => !legacyCovered.has(eventId)).length, atomicWindows: rows.reduce((sum, row) => sum + row.atomicWindows, 0), coalescedWindows: rows.reduce((sum, row) => sum + row.coalescedWindows, 0), windowsPerYear: round(rows.reduce((sum, row) => sum + row.coalescedWindows, 0) / profiles.reduce((sum, profile) => sum + profile.observationYears, 0)), durationDays: freeze({ mean: samples.length ? round(samples.reduce((a, b) => a + b, 0) / samples.length) : null, median: samples.length ? round(percentile(samples, 0.5)) : null, p25: samples.length ? round(percentile(samples, 0.25)) : null, p75: samples.length ? round(percentile(samples, 0.75)) : null, longest: samples.length ? round(Math.max(...samples)) : null }), candidateDays: round(candidateDays), timeInWindowPercent: round(candidateDays / observationDays * 100), eventAssociatedCandidateDays: round(rows.reduce((sum, row) => sum + row.eventAssociatedCandidateDays, 0)), backgroundCandidateDays: round(rows.reduce((sum, row) => sum + row.backgroundCandidateDays, 0)), backgroundCandidates: rows.reduce((sum, row) => sum + row.backgroundCandidates, 0), fragmentedProfiles: profiles.filter((profile) => profile.rulesets[name].atomicWindows > profile.rulesets[name].coalescedWindows).length, stateDistribution: freeze({ eventAssociated: freeze(sumDistribution('stateDistribution', 'eventAssociated')), background: freeze(sumDistribution('stateDistribution', 'background')) }), dashaPatternDistribution: freeze({ eventAssociated: freeze(sumDistribution('dashaPatternDistribution', 'eventAssociated')), background: freeze(sumDistribution('dashaPatternDistribution', 'background')) }) });
  }
  const patterns = ['DIRECT + UNRELATED', 'UNRELATED + DIRECT', 'CONNECTED + UNRELATED', 'UNRELATED + CONNECTED'];
  const sumSingle = (pattern, key) => profiles.reduce((sum, profile) => sum + profile.singlePrimary[pattern][key], 0);
  const v23Tiers = Object.fromEntries(V23_TIERS.map((tier) => {
    const rows = profiles.map((profile) => profile.v23.tiers[tier]); const observationDays = rows.reduce((sum, row) => sum + row.observationDays, 0); const samples = rows.flatMap((row) => row.durationSamplesDays); const candidateDays = rows.reduce((sum, row) => sum + row.candidateDays, 0);
    const backgroundObservationDays = profiles.reduce((sum, profile) => sum + sumDuration(profile.backgroundIntervals) / DAY, 0); const backgroundCandidateDays = rows.reduce((sum, row) => sum + row.backgroundCandidateDays, 0);
    return [tier, freeze({ windows: rows.reduce((sum, row) => sum + row.coalescedWindows, 0), windowsPerYear: round(rows.reduce((sum, row) => sum + row.coalescedWindows, 0) / profiles.reduce((sum, profile) => sum + profile.observationYears, 0)), medianDurationDays: samples.length ? round(percentile(samples, 0.5)) : null, candidateDays: round(candidateDays), observationPercent: round(candidateDays / observationDays * 100), eventAssociatedCandidateDays: round(rows.reduce((sum, row) => sum + row.eventAssociatedCandidateDays, 0)), backgroundCandidateDays: round(backgroundCandidateDays), backgroundObservationPercent: backgroundObservationDays ? round(backgroundCandidateDays / backgroundObservationDays * 100) : 0, eventAssociatedWindows: rows.reduce((sum, row) => sum + row.eventAssociatedCandidates, 0), backgroundWindows: rows.reduce((sum, row) => sum + row.backgroundCandidates, 0), eventsCovered: new Set(profiles.flatMap((profile) => profile.v23.tiers[tier].coveredEventIds.map((eventId) => `${profile.profileId}/${eventId}`))).size })];
  }));
  const v23 = freeze({ eligibilityMatchesV22: profiles.every((profile) => profile.v23.eligibilityMatchesV22), parentWindows: profiles.reduce((sum, profile) => sum + profile.v23.parentCount, 0), childWindows: profiles.reduce((sum, profile) => sum + profile.v23.childWindowCount, 0), fragmentedParents: profiles.reduce((sum, profile) => sum + profile.v23.fragmentedParentCount, 0), tiers: freeze(v23Tiers), eventDistribution: freeze(Object.fromEntries([...V23_TIERS, 'NO_V22_ELIGIBILITY'].map((tier) => [tier, profiles.reduce((sum, profile) => sum + profile.v23.eventDistribution[tier], 0)]))) });
  return freeze({ profileCount: profiles.length, knownEvents: profiles.reduce((sum, profile) => sum + profile.knownEvents, 0), rulesets: freeze(rulesets), v23, singlePrimary: freeze(Object.fromEntries(patterns.map((pattern) => [pattern, freeze({ windows: sumSingle(pattern, 'windows'), candidateDays: round(sumSingle(pattern, 'candidateDays')), eventAssociatedWindows: sumSingle(pattern, 'eventAssociatedWindows'), backgroundWindows: sumSingle(pattern, 'backgroundWindows'), profilesAffected: profiles.filter((profile) => profile.singlePrimary[pattern].windows > 0).length, jupiterOnly: sumSingle(pattern, 'jupiterOnly'), saturnOnly: sumSingle(pattern, 'saturnOnly'), dualTransit: sumSingle(pattern, 'dualTransit'), d10: freeze(Object.fromEntries(['CONFIRMS', 'NEUTRAL', 'MIXED', 'UNAVAILABLE'].map((state) => [state, profiles.reduce((sum, profile) => sum + profile.singlePrimary[pattern].d10[state], 0)]))), pdRefinement: freeze(Object.fromEntries(['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT', 'CONTEXT_ONLY', 'NOT_RELEVANT'].map((state) => [state, profiles.reduce((sum, profile) => sum + profile.singlePrimary[pattern].pdRefinement[state], 0)]))) })]))), dataQualityFlags: freeze(profiles.flatMap((profile) => profile.dataQualityFlags.map((flag) => freeze({ profileId: profile.profileId, flag })))) });
}

function markdownReport(result) {
  const lines = ['# CareerTimingV2 Precision Certification', '', `- Profiles: ${result.aggregate.profileCount}`, `- Known Career events: ${result.aggregate.knownEvents}`, '- Background means no recorded Career event in supplied history; it is not a definitive negative.', '', '| Metric | Legacy | V2 | V2.1 | V2.2 |', '|---|---:|---:|---:|---:|'];
  const row = (label, key) => lines.push(`| ${label} | ${['legacy', 'v2', 'v21', 'v22'].map((name) => result.aggregate.rulesets[name][key]).join(' | ')} |`);
  row('Events covered', 'eventsCovered'); row('Coalesced windows', 'coalescedWindows'); row('Windows/year', 'windowsPerYear'); lines.push(`| Median duration days | ${['legacy', 'v2', 'v21', 'v22'].map((name) => result.aggregate.rulesets[name].durationDays.median).join(' | ')} |`); row('Candidate days', 'candidateDays'); row('% observation time', 'timeInWindowPercent'); row('Event-associated candidate days', 'eventAssociatedCandidateDays'); row('Background candidate days', 'backgroundCandidateDays'); row('Background candidates', 'backgroundCandidates'); row('Fragmented profiles', 'fragmentedProfiles');
  lines.push('', '## V2.3 shadow refinements', '', `- V2.2 eligibility invariant preserved: ${result.aggregate.v23.eligibilityMatchesV22}`, `- Parent windows: ${result.aggregate.v23.parentWindows}`, `- Child windows: ${result.aggregate.v23.childWindows}`, `- Fragmented parents: ${result.aggregate.v23.fragmentedParents}`, '', '| Tier | Windows | Events covered | Event-associated days | Background days | % observation | % background observation | Median days |', '|---|---:|---:|---:|---:|---:|---:|---:|', ...V23_TIERS.map((tier) => { const value = result.aggregate.v23.tiers[tier]; return `| ${tier} | ${value.windows} | ${value.eventsCovered} | ${value.eventAssociatedCandidateDays} | ${value.backgroundCandidateDays} | ${value.observationPercent} | ${value.backgroundObservationPercent} | ${value.medianDurationDays} |`; }), '', `Event distribution: ${V23_TIERS.map((tier) => `${tier}=${result.aggregate.v23.eventDistribution[tier]}`).join(', ')}, NO_V22_ELIGIBILITY=${result.aggregate.v23.eventDistribution.NO_V22_ELIGIBILITY}`);
  lines.push('', 'This comparative report does not measure predictive accuracy.', ''); return lines.join('\n');
}

class CareerV2PrecisionCertificationHarness {
  constructor({ evidenceProvider } = {}) { if (typeof evidenceProvider !== 'function') throw new TypeError('CareerV2PrecisionCertificationHarness requires an explicit local evidenceProvider.'); this.evidenceProvider = evidenceProvider; Object.freeze(this); }
  async run(input) {
    const validated = validatePrecisionCertificationInput(input); const profiles = [];
    for (const profile of validated.profiles) profiles.push(profileReport(profile, await this.evidenceProvider({ profileId: profile.profileId, birthData: profile.birthData, evaluationInstant: profile.observationPeriod.start, rangeStart: profile.observationPeriod.start, rangeEnd: profile.observationPeriod.end })));
    const result = freeze({ resultVersion: RESULT_VERSION, inputSchemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), mode: 'LOCAL_PRECISION_CERTIFICATION_ONLY', profiles: freeze(profiles), aggregate: aggregate(profiles), safeguards: freeze({ productionDatabaseAccess: false, birthDataInOutput: false, backgroundIsDefinitiveNegative: false, methodologyMutation: false }) });
    return freeze({ result, markdown: markdownReport(result) });
  }
}

module.exports = { SCHEMA_VERSION, RESULT_VERSION, validatePrecisionCertificationInput, eventInterval, mergeIntervals, subtractIntervals, deterministicControlSamples, CareerV2PrecisionCertificationHarness, markdownReport };
