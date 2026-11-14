'use strict';

const { buildCareerTimingPeriods, buildCareerTimingV2, buildCareerTimingV21, buildCareerTimingV22, dashaHierarchy } = require('../application/insights');

const SCHEMA_VERSION = 'career-v2-certification-input-v1';
const RESULT_VERSION = 'career-v2-certification-results-v3-four-way';
const EVENT_TYPES = Object.freeze(['JOB_JOINED', 'JOB_CHANGED', 'PROMOTION', 'ROLE_CHANGED', 'SALARY_CHANGED', 'JOB_LOSS', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK', 'OTHER']);
const PRECISIONS = new Set(['DAY', 'MONTH', 'YEAR']);
const REJECTION_REASONS = Object.freeze(['LIMITED_D1', 'INSUFFICIENT_D1', 'MD_AD_NOT_ELIGIBLE', 'PD_ONLY_LEGACY', 'NO_MAJOR_TRANSIT', 'OUTSIDE_FORECAST_HORIZON', 'EVIDENCE_UNAVAILABLE', 'OTHER_DETERMINISTIC_REASON']);
const DAY = 86_400_000;
const BANNED_KEYS = /^(name|phone|email|notes?|userId|subject|productionId)$/i;

const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const interval = (value) => value && iso(value.start) && iso(value.end) && Date.parse(value.start) < Date.parse(value.end);
const intersects = (left, right) => interval(left) && interval(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const duration = (value) => Date.parse(value.end) - Date.parse(value.start);
const median = (values) => { if (!values.length) return null; const sorted = values.slice().sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const freeze = (value) => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

function rejectSensitiveKeys(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (BANNED_KEYS.test(key)) throw new TypeError(`Certification input contains prohibited identity/free-text field at ${path}.${key}.`);
    rejectSensitiveKeys(child, `${path}.${key}`);
  }
}

function eventCoverage(event) {
  const { year, month, day, datePrecision: precision } = event;
  if (precision === 'DAY') return { start: new Date(Date.UTC(year, month - 1, day)).toISOString(), end: new Date(Date.UTC(year, month - 1, day + 1)).toISOString() };
  if (precision === 'MONTH') return { start: new Date(Date.UTC(year, month - 1, 1)).toISOString(), end: new Date(Date.UTC(year, month, 1)).toISOString() };
  return { start: new Date(Date.UTC(year, 0, 1)).toISOString(), end: new Date(Date.UTC(year + 1, 0, 1)).toISOString() };
}

function validateEvent(event, profileId, seen) {
  if (!event || typeof event !== 'object' || !/^EVENT_[A-Z0-9_-]+$/.test(event.eventId || '') || seen.has(event.eventId)) throw new TypeError(`${profileId} has an invalid or duplicate anonymized eventId.`);
  seen.add(event.eventId);
  if (!EVENT_TYPES.includes(event.type)) throw new TypeError(`${event.eventId} has an unsupported Career event type.`);
  if (!PRECISIONS.has(event.datePrecision) || !Number.isInteger(event.year) || event.year < 1900 || event.year > 2200) throw new TypeError(`${event.eventId} has an invalid date precision/year.`);
  if (event.datePrecision !== 'YEAR' && (!Number.isInteger(event.month) || event.month < 1 || event.month > 12)) throw new TypeError(`${event.eventId} requires a valid month.`);
  if (event.datePrecision === 'DAY') {
    if (!Number.isInteger(event.day) || event.day < 1 || event.day > 31) throw new TypeError(`${event.eventId} requires a valid day.`);
    const date = new Date(Date.UTC(event.year, event.month - 1, event.day));
    if (date.getUTCFullYear() !== event.year || date.getUTCMonth() !== event.month - 1 || date.getUTCDate() !== event.day) throw new TypeError(`${event.eventId} is not a real calendar date.`);
  }
  const allowed = new Set(['eventId', 'type', 'datePrecision', 'year', 'month', 'day']);
  if (Object.keys(event).some((key) => !allowed.has(key))) throw new TypeError(`${event.eventId} contains unsupported fields.`);
  return freeze({ eventId: event.eventId, type: event.type, datePrecision: event.datePrecision, year: event.year, ...(event.month ? { month: event.month } : {}), ...(event.day ? { day: event.day } : {}), coverage: freeze(eventCoverage(event)) });
}

function validateCertificationInput(input) {
  rejectSensitiveKeys(input);
  if (!input || input.schemaVersion !== SCHEMA_VERSION || !Array.isArray(input.profiles) || input.profiles.length === 0) throw new TypeError(`Certification input must use ${SCHEMA_VERSION} with at least one profile.`);
  if (Object.keys(input).some((key) => !['schemaVersion', 'consent', 'profiles'].includes(key))) throw new TypeError('Certification input contains unsupported top-level fields.');
  if (!input.consent || input.consent.ownerSupplied !== true || input.consent.explicitHistoricalValidation !== true) throw new TypeError('Explicit owner-supplied historical-validation consent is required.');
  const profileIds = new Set(); const eventIds = new Set();
  const profiles = input.profiles.map((profile) => {
    if (!profile || !/^PROFILE_[A-Z0-9_-]+$/.test(profile.profileId || '') || profileIds.has(profile.profileId)) throw new TypeError('Every profile requires a unique anonymized PROFILE_* identifier.');
    profileIds.add(profile.profileId);
    const birth = profile.birthData;
    if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth.date || '') || !/^\d{2}:\d{2}(:\d{2})?$/.test(birth.time || '') || typeof birth.timezone !== 'string' || !birth.timezone || !Number.isFinite(birth.latitude) || birth.latitude < -90 || birth.latitude > 90 || !Number.isFinite(birth.longitude) || birth.longitude < -180 || birth.longitude > 180) throw new TypeError(`${profile.profileId} has invalid birthData.`);
    if (Object.keys(birth).some((key) => !['date', 'time', 'timezone', 'latitude', 'longitude'].includes(key))) throw new TypeError(`${profile.profileId} birthData contains unsupported fields.`);
    if (!Array.isArray(profile.events) || !Array.isArray(profile.evaluationInstants) || !profile.evaluationInstants.length || profile.evaluationInstants.some((value) => !iso(value))) throw new TypeError(`${profile.profileId} requires events and valid evaluationInstants.`);
    if (Object.keys(profile).some((key) => !['profileId', 'birthData', 'events', 'evaluationInstants'].includes(key))) throw new TypeError(`${profile.profileId} contains unsupported fields.`);
    return freeze({ profileId: profile.profileId, birthData: freeze({ ...birth }), events: freeze(profile.events.map((event) => validateEvent(event, profile.profileId, eventIds))), evaluationInstants: freeze([...new Set(profile.evaluationInstants)].sort()) });
  });
  return freeze({ schemaVersion: SCHEMA_VERSION, consent: freeze({ ownerSupplied: true, explicitHistoricalValidation: true }), profiles: freeze(profiles) });
}

function legacyWindows(result) { return result.periods.map((value) => freeze({ start: value.startDate, end: value.endDate, dashaPeriods: value.technicalDetails.dasha.periods })); }
function atomicCount(v2) { return v2.candidates.reduce((sum, candidate) => sum + candidate.internalPhases.length, 0); }
function covered(event, windows) { return windows.some((window) => intersects(event.coverage, window)); }
function overlappingCandidate(event, candidates) { return candidates.filter((candidate) => intersects(event.coverage, candidate)).sort((a, b) => b.agreement.alignedCount - a.agreement.alignedCount || a.start.localeCompare(b.start))[0] || null; }
function overlapKind(left, right) {
  if (!intersects(left, right)) return 'NO_OVERLAP';
  const overlap = Math.min(Date.parse(left.end), Date.parse(right.end)) - Math.max(Date.parse(left.start), Date.parse(right.start));
  return overlap / duration(left) >= 0.8 ? 'HIGH_OVERLAP' : 'PARTIAL_OVERLAP';
}
function pdOnly(period) { const values = new Set(period.dashaPeriods); return [...values].some((value) => value.startsWith('PD:')) && ![...values].some((value) => value.startsWith('MD:') || value.startsWith('AD:')); }

function rejectionReason({ event, legacy, v2, evidence }) {
  if (Date.parse(event.coverage.end) <= Date.parse(evidence.forecastStart) || Date.parse(event.coverage.start) >= Date.parse(evidence.forecastEnd)) return 'OUTSIDE_FORECAST_HORIZON';
  if (v2.promise.state === 'LIMITED') return 'LIMITED_D1';
  if (v2.promise.state === 'INSUFFICIENT') return 'INSUFFICIENT_D1';
  const rows = evidence.dashaIntervals.filter((row) => intersects(event.coverage, row));
  if (!rows.length) return 'EVIDENCE_UNAVAILABLE';
  const hierarchies = rows.map((row) => dashaHierarchy({ promise: v2.promise, activePeriods: row.activePeriods }));
  if (hierarchies.every((item) => !item.primaryEligible)) return legacy.filter((window) => intersects(event.coverage, window)).some(pdOnly) ? 'PD_ONLY_LEGACY' : 'MD_AD_NOT_ELIGIBLE';
  const transitPresent = evidence.transitIntervals.some((row) => ['Jupiter', 'Saturn'].includes(row.planet) && intersects(event.coverage, row));
  if (!transitPresent) return 'NO_MAJOR_TRANSIT';
  if (hierarchies.some((item) => ['UNAVAILABLE'].includes(item.md.state) || ['UNAVAILABLE'].includes(item.ad.state))) return 'EVIDENCE_UNAVAILABLE';
  return 'OTHER_DETERMINISTIC_REASON';
}

function profileReport(profile, evidence) {
  if (!evidence || !interval({ start: evidence.forecastStart, end: evidence.forecastEnd }) || !evidence.d1Houses || !Array.isArray(evidence.dashaIntervals) || !Array.isArray(evidence.transitIntervals)) throw new TypeError(`${profile.profileId} evidence provider returned an invalid deterministic evidence packet.`);
  const legacyResult = buildCareerTimingPeriods({ d1Houses: evidence.d1Houses, dashaIntervals: evidence.dashaIntervals, transitIntervals: evidence.transitIntervals, horizonStart: evidence.forecastStart, horizonEnd: evidence.forecastEnd, d10Confirmation: Boolean(evidence.d10Corroboration), recurrence: null });
  const legacy = legacyWindows(legacyResult);
  const evaluations = profile.evaluationInstants.map((at) => {
    const v2 = buildCareerTimingV2({ ...evidence, calculationInstant: evidence.calculationInstant || evidence.forecastStart, referenceInstant: at });
    const byId = new Map(v2.candidates.map((candidate) => [candidate.candidateId, candidate]));
    return freeze({ instant: at, activeCandidateId: v2.selected.activeCandidateId, nextCandidateId: v2.selected.nextCandidateId, active: byId.get(v2.selected.activeCandidateId) || null, next: byId.get(v2.selected.nextCandidateId) || null });
  });
  const v2 = buildCareerTimingV2({ ...evidence, calculationInstant: evidence.calculationInstant || evidence.forecastStart, referenceInstant: profile.evaluationInstants[0] });
  const v21 = buildCareerTimingV21({ ...evidence, calculationInstant: evidence.calculationInstant || evidence.forecastStart, referenceInstant: profile.evaluationInstants[0] });
  const v22 = buildCareerTimingV22({ ...evidence, calculationInstant: evidence.calculationInstant || evidence.forecastStart, referenceInstant: profile.evaluationInstants[0] });
  const eventResults = profile.events.map((event) => {
    const legacyCovered = covered(event, legacy); const candidate = overlappingCandidate(event, v2.candidates); const v21Candidate = overlappingCandidate(event, v21.candidates); const v22Candidate = overlappingCandidate(event, v22.candidates); const v2Covered = Boolean(candidate); const v21Covered = Boolean(v21Candidate); const v22Covered = Boolean(v22Candidate);
    const coverageClass = legacyCovered && v2Covered && v21Covered ? 'ALL_THREE' : legacyCovered && v2Covered ? 'LEGACY_V2_ONLY' : legacyCovered && v21Covered ? 'LEGACY_V21_ONLY' : v2Covered && v21Covered ? 'V2_V21_ONLY' : legacyCovered ? 'LEGACY_ONLY' : v2Covered ? 'V2_ONLY' : v21Covered ? 'V21_ONLY' : 'NONE';
    return freeze({ eventId: event.eventId, eventType: event.type, datePrecision: event.datePrecision, coverage: event.coverage, legacyCovered, v2Covered, v21Covered, v22Covered, coverageClass, comparison: legacyCovered && v2Covered ? 'BOTH' : legacyCovered ? 'LEGACY_ONLY' : v2Covered ? 'V2_ONLY' : 'NEITHER', rejectionReason: v2Covered ? null : rejectionReason({ event, legacy, v2, evidence }), v2State: candidate && candidate.state || null, v21State: v21Candidate && v21Candidate.state || null, v22State: v22Candidate && v22Candidate.state || null, agreement: candidate && candidate.agreement || null, v21Agreement: v21Candidate && v21Candidate.agreement || null, v22Agreement: v22Candidate && v22Candidate.agreement || null });
  });
  const overlaps = legacy.map((window) => { const matches = v2.candidates.filter((candidate) => intersects(window, candidate)); return freeze({ legacyWindow: freeze({ start: window.start, end: window.end }), classification: matches.length ? matches.some((candidate) => overlapKind(window, candidate) === 'HIGH_OVERLAP') || matches.reduce((sum, candidate) => sum + Math.max(0, Math.min(Date.parse(window.end), Date.parse(candidate.end)) - Math.max(Date.parse(window.start), Date.parse(candidate.start))), 0) / duration(window) >= 0.8 ? 'HIGH_OVERLAP' : 'PARTIAL_OVERLAP' : 'NO_OVERLAP', matchingV2CandidateIds: freeze(matches.map((item) => item.candidateId)) }); });
  return freeze({ profileId: profile.profileId, legacy: freeze({ candidateCount: legacy.length, windows: freeze(legacy), evaluations: freeze(profile.evaluationInstants.map((at) => freeze({ instant: at, active: legacy.find((window) => Date.parse(window.start) <= Date.parse(at) && Date.parse(at) < Date.parse(window.end)) || null, next: legacy.find((window) => Date.parse(window.start) > Date.parse(at)) || null }))) }), v2: freeze({ promise: v2.promise, atomicCandidateCount: atomicCount(v2), coalescedCandidateCount: v2.candidates.length, candidates: v2.candidates, evaluations: freeze(evaluations) }), v21: freeze({ promise: v21.promise, atomicCandidateCount: v21.atomicCandidateCount, coalescedCandidateCount: v21.candidates.length, candidates: v21.candidates, backgroundActivationCount: v21.backgroundActivations.length, selected: v21.selected }), v22: freeze({ promise: v22.promise, atomicCandidateCount: v22.atomicCandidateCount, coalescedCandidateCount: v22.candidates.length, candidates: v22.candidates, backgroundActivationCount: v22.backgroundActivations.length, selected: v22.selected }), events: freeze(eventResults), overlap: freeze(overlaps) });
}

function aggregate(profiles) {
  const candidates = profiles.flatMap((profile) => profile.v2.candidates); const events = profiles.flatMap((profile) => profile.events);
  const v21Candidates = profiles.flatMap((profile) => profile.v21.candidates);
  const v22Candidates = profiles.flatMap((profile) => profile.v22.candidates);
  const legacyWindowsAll = profiles.flatMap((profile) => profile.legacy.windows.map((window) => ({ profile, window })));
  const pdOnlyWindows = legacyWindowsAll.filter(({ window }) => pdOnly(window));
  const limitedProfiles = profiles.filter((profile) => profile.v2.promise.state === 'LIMITED');
  const single = (planet) => candidates.filter((candidate) => candidate.transit[planet].state === 'ALIGNED' && candidate.transit[planet === 'jupiter' ? 'saturn' : 'jupiter'].state !== 'ALIGNED');
  const stateDistribution = Object.fromEntries(['SUPPORTIVE', 'SUPPORTIVE_WITH_CONDITIONS', 'MIXED', 'CAUTIOUS', 'INSUFFICIENT_EVIDENCE'].map((state) => [state, candidates.filter((candidate) => candidate.state === state).length]));
  const flags = [];
  const lostFor = (reason) => events.filter((event) => event.comparison === 'LEGACY_ONLY' && event.rejectionReason === reason).length;
  if (lostFor('PD_ONLY_LEGACY') >= 2) flags.push('REVIEW_PD_ONLY_REMOVAL_WITH_MULTIPLE_OBSERVED_EVENTS');
  if (lostFor('LIMITED_D1') >= 2) flags.push('REVIEW_LIMITED_D1_REPEATED_OBSERVED_EVENT_REMOVAL');
  const onePrimary = candidates.filter((candidate) => [candidate.dasha.md.state, candidate.dasha.ad.state].filter((state) => state === 'ALIGNED').length === 1).length;
  if (onePrimary >= 3 && onePrimary / Math.max(candidates.length, 1) >= 0.5) flags.push('REVIEW_ONE_PRIMARY_DASHA_BREADTH');
  if ((single('jupiter').length + single('saturn').length) >= 3 && (single('jupiter').length + single('saturn').length) / Math.max(candidates.length, 1) >= 0.75) flags.push('REVIEW_SINGLE_MAJOR_TRANSIT_BREADTH');
  const legacyCount = legacyWindowsAll.length;
  if (candidates.length >= legacyCount + 3 && candidates.length > legacyCount * 2) flags.push('REVIEW_V2_CANDIDATE_COUNT_INCREASE');
  const short = candidates.filter((candidate) => duration(candidate) < 7 * DAY).length;
  if (short >= 3 && short / Math.max(candidates.length, 1) > 0.5) flags.push('REVIEW_SHORT_INTERVAL_FRAGMENTATION');
  const conditional = candidates.filter((candidate) => candidate.state === 'SUPPORTIVE_WITH_CONDITIONS');
  if (conditional.length >= 3 && conditional.length / Math.max(candidates.length, 1) >= 0.75 && conditional.filter((candidate) => candidate.agreement.unavailableCount > 0).length / conditional.length >= 0.75) flags.push('REVIEW_SYSTEMATIC_UNAVAILABLE_CONDITIONS');
  const durations = candidates.map(duration); const legacyDurations = legacyWindowsAll.map(({ window }) => duration(window));
  const coverageClasses = ['ALL_THREE', 'LEGACY_V2_ONLY', 'LEGACY_V21_ONLY', 'V2_V21_ONLY', 'LEGACY_ONLY', 'V2_ONLY', 'V21_ONLY', 'NONE'];
  const v21Single = (planet) => v21Candidates.filter((candidate) => candidate.transit[planet].state === 'ALIGNED' && candidate.transit[planet === 'jupiter' ? 'saturn' : 'jupiter'].state !== 'ALIGNED');
  const v21Durations = v21Candidates.map(duration);
  const v21LegacyCovered = events.filter((event) => event.legacyCovered && event.v21Covered).length;
  const v22Single = (planet) => v22Candidates.filter((candidate) => candidate.transit[planet].state === 'ALIGNED' && candidate.transit[planet === 'jupiter' ? 'saturn' : 'jupiter'].state !== 'ALIGNED');
  const v22Durations = v22Candidates.map(duration);
  const v22LegacyCovered = events.filter((event) => event.legacyCovered && event.v22Covered).length;
  return freeze({
    profileCount: profiles.length, eventCoverage: freeze({ total: events.length, legacyCovered: events.filter((event) => event.legacyCovered).length, v2Covered: events.filter((event) => event.v2Covered).length, retained: events.filter((event) => event.comparison === 'BOTH').length, lost: events.filter((event) => event.comparison === 'LEGACY_ONLY').length, gained: events.filter((event) => event.comparison === 'V2_ONLY').length }),
    windows: freeze({ legacyCount, v2AtomicCount: profiles.reduce((sum, profile) => sum + profile.v2.atomicCandidateCount, 0), v2CoalescedCount: candidates.length, legacyAverageDurationMs: legacyDurations.length ? legacyDurations.reduce((a, b) => a + b, 0) / legacyDurations.length : null, legacyMedianDurationMs: median(legacyDurations), v2AverageDurationMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null, v2MedianDurationMs: median(durations), highOverlap: profiles.flatMap((profile) => profile.overlap).filter((item) => item.classification === 'HIGH_OVERLAP').length, partialOverlap: profiles.flatMap((profile) => profile.overlap).filter((item) => item.classification === 'PARTIAL_OVERLAP').length, noOverlap: profiles.flatMap((profile) => profile.overlap).filter((item) => item.classification === 'NO_OVERLAP').length, fragmentedProfiles: profiles.filter((profile) => profile.v2.atomicCandidateCount > profile.v2.coalescedCandidateCount || profile.v2.coalescedCandidateCount > profile.legacy.candidateCount).length }),
    specialCohorts: freeze({ pdOnlyLegacy: freeze({ total: pdOnlyWindows.length, withHistoricalEvents: pdOnlyWindows.filter(({ profile, window }) => profile.events.some((event) => event.legacyCovered && intersects(event.coverage, window))).length, removedByV2: pdOnlyWindows.filter(({ profile, window }) => !profile.v2.candidates.some((candidate) => intersects(window, candidate))).length }), limitedD1: freeze({ profiles: limitedProfiles.length, historicalEventOverlap: limitedProfiles.reduce((sum, profile) => sum + profile.events.filter((event) => event.legacyCovered).length, 0) }), mdOnlyEligible: candidates.filter((candidate) => candidate.dasha.md.state === 'ALIGNED' && candidate.dasha.ad.state !== 'ALIGNED').length, adOnlyEligible: candidates.filter((candidate) => candidate.dasha.ad.state === 'ALIGNED' && candidate.dasha.md.state !== 'ALIGNED').length, jupiterOnly: single('jupiter').length, saturnOnly: single('saturn').length, bothTransits: candidates.filter((candidate) => candidate.transit.jupiter.state === 'ALIGNED' && candidate.transit.saturn.state === 'ALIGNED').length, d10: freeze(Object.fromEntries(['CONFIRMS', 'NEUTRAL', 'MIXED', 'UNAVAILABLE'].map((state) => [state, candidates.filter((candidate) => candidate.d10.state === state).length]))) }),
    stateDistribution: freeze(stateDistribution), rejectionReasons: freeze(Object.fromEntries(REJECTION_REASONS.map((reason) => [reason, events.filter((event) => event.rejectionReason === reason).length]))), methodologyReviewFlags: freeze(flags),
    threeWayCoverage: freeze(Object.fromEntries(coverageClasses.map((value) => [value, events.filter((event) => event.coverageClass === value).length]))),
    v21: freeze({
      eventCoverage: freeze({ total: events.length, covered: events.filter((event) => event.v21Covered).length, retainedFromLegacy: v21LegacyCovered, lostFromLegacy: events.filter((event) => event.legacyCovered && !event.v21Covered).length, gainedVsLegacy: events.filter((event) => !event.legacyCovered && event.v21Covered).length, retainedFromV2: events.filter((event) => event.v2Covered && event.v21Covered).length, lostFromV2: events.filter((event) => event.v2Covered && !event.v21Covered).length, gainedVsV2: events.filter((event) => !event.v2Covered && event.v21Covered).length }),
      windows: freeze({ atomicCount: profiles.reduce((sum, profile) => sum + profile.v21.atomicCandidateCount, 0), coalescedCount: v21Candidates.length, averageDurationMs: v21Durations.length ? v21Durations.reduce((a, b) => a + b, 0) / v21Durations.length : null, medianDurationMs: median(v21Durations), fragmentedProfiles: profiles.filter((profile) => profile.v21.atomicCandidateCount > profile.v21.coalescedCandidateCount || profile.v21.coalescedCandidateCount > profile.legacy.candidateCount).length, profilesReducedVsV2: profiles.filter((profile) => profile.v21.coalescedCandidateCount < profile.v2.coalescedCandidateCount).length }),
      specialCohorts: freeze({ mdOnlyDirect: v21Candidates.filter((candidate) => candidate.dasha.md.relationship === 'DIRECTLY_ALIGNED' && candidate.dasha.ad.relationship !== 'DIRECTLY_ALIGNED').length, adOnlyDirect: v21Candidates.filter((candidate) => candidate.dasha.ad.relationship === 'DIRECTLY_ALIGNED' && candidate.dasha.md.relationship !== 'DIRECTLY_ALIGNED').length, jupiterOnly: v21Single('jupiter').length, saturnOnly: v21Single('saturn').length, bothTransits: v21Candidates.filter((candidate) => candidate.transitConfirmation === 'DUAL_CONFIRMATION').length, backgroundActivations: profiles.reduce((sum, profile) => sum + profile.v21.backgroundActivationCount, 0) }),
      stateDistribution: freeze(Object.fromEntries(['SUPPORTIVE', 'SUPPORTIVE_WITH_CONDITIONS', 'MIXED', 'CAUTIOUS', 'INSUFFICIENT_EVIDENCE'].map((state) => [state, v21Candidates.filter((candidate) => candidate.state === state).length]))),
    }),
    v22: freeze({
      eventCoverage: freeze({ total: events.length, covered: events.filter((event) => event.v22Covered).length, retainedFromLegacy: v22LegacyCovered, lostFromLegacy: events.filter((event) => event.legacyCovered && !event.v22Covered).length, gainedVsLegacy: events.filter((event) => !event.legacyCovered && event.v22Covered).length, retainedFromV2: events.filter((event) => event.v2Covered && event.v22Covered).length, lostFromV2: events.filter((event) => event.v2Covered && !event.v22Covered).length, gainedVsV2: events.filter((event) => !event.v2Covered && event.v22Covered).length, retainedFromV21: events.filter((event) => event.v21Covered && event.v22Covered).length, recoveredFromV21: events.filter((event) => !event.v21Covered && event.v22Covered).length }),
      windows: freeze({ atomicCount: profiles.reduce((sum, profile) => sum + profile.v22.atomicCandidateCount, 0), coalescedCount: v22Candidates.length, averageDurationMs: v22Durations.length ? v22Durations.reduce((a, b) => a + b, 0) / v22Durations.length : null, medianDurationMs: median(v22Durations), fragmentedProfiles: profiles.filter((profile) => profile.v22.atomicCandidateCount > profile.v22.coalescedCandidateCount || profile.v22.coalescedCandidateCount > profile.legacy.candidateCount).length, profilesReducedVsV2: profiles.filter((profile) => profile.v22.coalescedCandidateCount < profile.v2.coalescedCandidateCount).length }),
      specialCohorts: freeze({ mdOnlyDirect: v22Candidates.filter((candidate) => candidate.dasha.md.relationship === 'DIRECTLY_ALIGNED' && candidate.dasha.ad.relationship !== 'DIRECTLY_ALIGNED').length, adOnlyDirect: v22Candidates.filter((candidate) => candidate.dasha.ad.relationship === 'DIRECTLY_ALIGNED' && candidate.dasha.md.relationship !== 'DIRECTLY_ALIGNED').length, jupiterOnly: v22Single('jupiter').length, saturnOnly: v22Single('saturn').length, bothTransits: v22Candidates.filter((candidate) => candidate.transitConfirmation === 'DUAL_CONFIRMATION').length, backgroundActivations: profiles.reduce((sum, profile) => sum + profile.v22.backgroundActivationCount, 0) }),
      stateDistribution: freeze(Object.fromEntries(['SUPPORTIVE', 'SUPPORTIVE_WITH_CONDITIONS', 'MIXED', 'CAUTIOUS', 'INSUFFICIENT_EVIDENCE'].map((state) => [state, v22Candidates.filter((candidate) => candidate.state === state).length]))),
    }),
  });
}

function markdownReport(result) {
  const lines = [`# CareerTimingV2 Certification Report`, '', `- Result version: ${result.resultVersion}`, `- Profiles: ${result.aggregate.profileCount}`, `- Historical events: ${result.aggregate.eventCoverage.total}`, `- Birth data and coordinates: intentionally omitted`, '', '## Event Coverage', '', `- Legacy covered: ${result.aggregate.eventCoverage.legacyCovered}`, `- V2 covered: ${result.aggregate.eventCoverage.v2Covered}`, `- Retained: ${result.aggregate.eventCoverage.retained}`, `- Lost: ${result.aggregate.eventCoverage.lost}`, `- Gained: ${result.aggregate.eventCoverage.gained}`, '', '## Profile Summary', '', '| Profile | Legacy | V2 atomic | V2 coalesced | Promise |', '|---|---:|---:|---:|---|'];
  for (const profile of result.profiles) lines.push(`| ${profile.profileId} | ${profile.legacy.candidateCount} | ${profile.v2.atomicCandidateCount} | ${profile.v2.coalescedCandidateCount} | ${profile.v2.promise.state} |`);
  lines.push('', '## V2.1 Shadow Summary', '', `- V2.1 covered events: ${result.aggregate.v21.eventCoverage.covered}`, `- V2.1 atomic candidates: ${result.aggregate.v21.windows.atomicCount}`, `- V2.1 coalesced candidates: ${result.aggregate.v21.windows.coalescedCount}`, `- V2.1 fragmented profiles: ${result.aggregate.v21.windows.fragmentedProfiles}`, `- V2.1 retained from V2: ${result.aggregate.v21.eventCoverage.retainedFromV2}`, `- V2.1 lost from V2: ${result.aggregate.v21.eventCoverage.lostFromV2}`, `- V2.1 gained vs V2: ${result.aggregate.v21.eventCoverage.gainedVsV2}`);
  lines.push('', '## V2.2 Shadow Summary', '', `- V2.2 covered events: ${result.aggregate.v22.eventCoverage.covered}`, `- V2.2 atomic candidates: ${result.aggregate.v22.windows.atomicCount}`, `- V2.2 coalesced candidates: ${result.aggregate.v22.windows.coalescedCount}`, `- V2.2 fragmented profiles: ${result.aggregate.v22.windows.fragmentedProfiles}`, `- V2.2 retained from V2: ${result.aggregate.v22.eventCoverage.retainedFromV2}`, `- V2.2 lost from V2: ${result.aggregate.v22.eventCoverage.lostFromV2}`, `- V2.2 recovered from V2.1: ${result.aggregate.v22.eventCoverage.recoveredFromV21}`);
  lines.push('', '## Window Quality', '', `- High overlap: ${result.aggregate.windows.highOverlap}`, `- Partial overlap: ${result.aggregate.windows.partialOverlap}`, `- No overlap: ${result.aggregate.windows.noOverlap}`, `- Fragmented profiles: ${result.aggregate.windows.fragmentedProfiles}`, '', '## Event Comparison', '', '| Profile | Event | Type | Precision | Result | Rejection reason |', '|---|---|---|---|---|---|');
  for (const profile of result.profiles) for (const event of profile.events) lines.push(`| ${profile.profileId} | ${event.eventId} | ${event.eventType} | ${event.datePrecision} | ${event.comparison} | ${event.rejectionReason || '—'} |`);
  lines.push('', '## Special Cohorts', '', `- PD-only legacy windows: ${result.aggregate.specialCohorts.pdOnlyLegacy.total}`, `- LIMITED D1 profiles: ${result.aggregate.specialCohorts.limitedD1.profiles}`, `- MD-only eligible candidates: ${result.aggregate.specialCohorts.mdOnlyEligible}`, `- AD-only eligible candidates: ${result.aggregate.specialCohorts.adOnlyEligible}`, `- Jupiter-only candidates: ${result.aggregate.specialCohorts.jupiterOnly}`, `- Saturn-only candidates: ${result.aggregate.specialCohorts.saturnOnly}`, `- Dual-transit candidates: ${result.aggregate.specialCohorts.bothTransits}`, '', '## Methodology Review Flags', '', ...(result.aggregate.methodologyReviewFlags.length ? result.aggregate.methodologyReviewFlags.map((flag) => `- ${flag}`) : ['- None']), '', 'This report measures historical event/window coverage only. It is not a probabilistic evaluation.', '');
  return lines.join('\n');
}

class CareerV2CertificationHarness {
  constructor({ evidenceProvider } = {}) { if (typeof evidenceProvider !== 'function') throw new TypeError('CareerV2CertificationHarness requires an explicit local evidenceProvider.'); this.evidenceProvider = evidenceProvider; Object.freeze(this); }
  async run(input) {
    const validated = validateCertificationInput(input); const reports = [];
    for (const profile of validated.profiles) {
      const points = [...profile.events.flatMap((event) => [Date.parse(event.coverage.start), Date.parse(event.coverage.end)]), ...profile.evaluationInstants.map(Date.parse)];
      const margin = 90 * DAY;
      const rangeStart = new Date(Math.min(...points) - margin).toISOString();
      const rangeEnd = new Date(Math.max(...points) + margin).toISOString();
      reports.push(profileReport(profile, await this.evidenceProvider({ profileId: profile.profileId, birthData: profile.birthData, evaluationInstant: profile.evaluationInstants[0], rangeStart, rangeEnd })));
    }
    const result = freeze({ resultVersion: RESULT_VERSION, inputSchemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), mode: 'LOCAL_CERTIFICATION_ONLY', profiles: freeze(reports), aggregate: aggregate(reports), safeguards: freeze({ productionDatabaseAccess: false, birthDataInMarkdown: false, historicalEventsAffectWindows: false }) });
    return freeze({ result, markdown: markdownReport(result) });
  }
}

module.exports = { SCHEMA_VERSION, RESULT_VERSION, EVENT_TYPES, REJECTION_REASONS, validateCertificationInput, CareerV2CertificationHarness, markdownReport };
