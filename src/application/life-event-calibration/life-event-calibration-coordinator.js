'use strict';

const { localDateTimeToUtc } = require('../../astronomy/time');
const { immutableCopy, repositoryError } = require('../../persistence/contracts');

const CALIBRATION_CONTRACT_VERSION = 'life-event-calibration-v1';
const DATE_PRECISIONS = Object.freeze(['DAY', 'MONTH', 'YEAR']);
const EVIDENCE_FAMILIES = Object.freeze(['FOUNDATION', 'DASHA', 'DIVISIONAL_CHART', 'TRANSIT', 'ASHTAKAVARGA', 'DOMAIN_SPECIFIC']);
const THRESHOLD_LEVELS = Object.freeze(['NONE', 'CONTEXT_ONLY', 'WEAK_PATTERN', 'PATTERN_ELIGIBLE']);
const DISPLAY_REASON_CODES = Object.freeze(['INSUFFICIENT_COMPARABLE_EVENTS', 'INSUFFICIENT_MATCHING_EVENTS', 'INSUFFICIENT_PRECISE_MATCHES', 'INSUFFICIENT_MATCHED_EVIDENCE_FAMILIES', 'MATERIAL_CONTRADICTION', 'DOMAIN_SAFETY_RESTRICTION', 'ELIGIBLE']);

function fail(code) { throw repositoryError(code); }
function safeCode(error) { return error && typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN_ERROR'; }
function dateParts(date) {
  if (!date || typeof date !== 'object' || !DATE_PRECISIONS.includes(date.precision) || !Number.isInteger(date.year)) fail('INVALID_CALIBRATION_EVENT_DATE');
  if (date.precision === 'DAY' && (!Number.isInteger(date.month) || !Number.isInteger(date.day))) fail('INVALID_CALIBRATION_EVENT_DATE');
  if (date.precision === 'MONTH' && (!Number.isInteger(date.month) || date.day != null)) fail('INVALID_CALIBRATION_EVENT_DATE');
  if (date.precision === 'YEAR' && (date.month != null || date.day != null)) fail('INVALID_CALIBRATION_EVENT_DATE');
  return date;
}
function localUtc(date, timezone) {
  return localDateTimeToUtc({ date, time: '00:00:00.000', timezone, latitude: 0, longitude: 0 }).toISOString();
}
function yyyy(value) { return String(value).padStart(4, '0'); }
function mm(value) { return String(value).padStart(2, '0'); }
function dayAfter(year, month, day) { return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10); }
function monthAfter(year, month) { return month === 12 ? `${yyyy(year + 1)}-01-01` : `${yyyy(year)}-${mm(month + 1)}-01`; }

// This represents an uncertainty interval, not an invented precise event date.
function eventInterval(eventDate, timezone) {
  const date = dateParts(eventDate);
  const startDate = date.precision === 'DAY' ? `${yyyy(date.year)}-${mm(date.month)}-${mm(date.day)}` : date.precision === 'MONTH' ? `${yyyy(date.year)}-${mm(date.month)}-01` : `${yyyy(date.year)}-01-01`;
  const endDate = date.precision === 'DAY' ? dayAfter(date.year, date.month, date.day) : date.precision === 'MONTH' ? monthAfter(date.year, date.month) : `${yyyy(date.year + 1)}-01-01`;
  return Object.freeze({ from: localUtc(startDate, timezone), to: localUtc(endDate, timezone), timezone });
}
function precisionCategory(precision) { return precision === 'DAY' ? 'HIGH' : precision === 'MONTH' ? 'MEDIUM' : 'LOW'; }
function threshold(count) { return count === 0 ? 'NONE' : count === 1 ? 'CONTEXT_ONLY' : count === 2 ? 'WEAK_PATTERN' : 'PATTERN_ELIGIBLE'; }
function primaryCandidate(value, index) {
  if (!value || typeof value !== 'object' || typeof value.candidateId !== 'string' || !value.candidateId) fail('INVALID_PRIMARY_CALIBRATION_CANDIDATE');
  const allowed = ['candidateId', 'primaryRank', 'primaryState', 'primaryStrength', 'start', 'end', 'primaryEvidenceFingerprint'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('INVALID_PRIMARY_CALIBRATION_CANDIDATE');
  return Object.freeze({ candidateId: value.candidateId, primaryRank: Number.isSafeInteger(value.primaryRank) ? value.primaryRank : index, primaryState: value.primaryState == null ? null : value.primaryState, primaryStrength: value.primaryStrength == null ? null : value.primaryStrength, start: value.start == null ? null : value.start, end: value.end == null ? null : value.end, primaryEvidenceFingerprint: value.primaryEvidenceFingerprint == null ? null : value.primaryEvidenceFingerprint });
}
function annotation(value, knownIds) {
  if (!value || typeof value !== 'object' || typeof value.candidateId !== 'string' || !knownIds.has(value.candidateId)) fail('INVALID_CALIBRATION_ANNOTATION');
  // Deliberately whitelist annotation fields: an adapter cannot replace primary data.
  const allowed = ['candidateId', 'matchedEventIds', 'matchedEvidenceFamilies', 'unmatchedEvidenceFamilies', 'patternStrength', 'historicalConsistency', 'tieBreakEligible', 'qualityFlags', 'contradictionFlags'];
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('INVALID_CALIBRATION_ANNOTATION');
  return Object.freeze({ candidateId: value.candidateId, matchedEventIds: [...new Set(value.matchedEventIds || [])].sort(), matchedEvidenceFamilies: [...new Set(value.matchedEvidenceFamilies || [])].filter((item) => EVIDENCE_FAMILIES.includes(item)).sort(), unmatchedEvidenceFamilies: [...new Set(value.unmatchedEvidenceFamilies || [])].filter((item) => EVIDENCE_FAMILIES.includes(item)).sort(), patternStrength: value.patternStrength || 'NONE', historicalConsistency: value.historicalConsistency || 'NONE', tieBreakEligible: value.tieBreakEligible === true, qualityFlags: [...new Set(value.qualityFlags || [])].sort(), contradictionFlags: [...new Set(value.contradictionFlags || [])].sort() });
}
function elapsedMilliseconds(start) { return Number(process.hrtime.bigint() - start) / 1e6; }
function increment(map, key) { map[key] = (map[key] || 0) + 1; }
function displaySafety(adapter, context) {
  if (typeof adapter.customerDisplaySafety !== 'function') return Object.freeze({ permitted: false, policy: null, minimumHighMediumMatches: 2 });
  const value = adapter.customerDisplaySafety(context);
  return Object.freeze({ permitted: Boolean(value && value.permitted === true && typeof value.policy === 'string' && value.policy), policy: value && typeof value.policy === 'string' ? value.policy : null, minimumHighMediumMatches: value && Number.isInteger(value.minimumHighMediumMatches) && value.minimumHighMediumMatches >= 2 ? value.minimumHighMediumMatches : 2 });
}
function readiness(annotationValue, fingerprintsById, comparableEventCount, safety) {
  const matched = annotationValue ? annotationValue.matchedEventIds : [];
  const precise = matched.filter((id) => {
    const fingerprint = fingerprintsById.get(id);
    return fingerprint && ['DAY', 'MONTH'].includes(fingerprint.datePrecision);
  });
  const families = annotationValue ? annotationValue.matchedEvidenceFamilies : [];
  const contradictions = annotationValue ? annotationValue.contradictionFlags : [];
  const reasons = [];
  if (comparableEventCount < 3) reasons.push('INSUFFICIENT_COMPARABLE_EVENTS');
  if (matched.length < 2) reasons.push('INSUFFICIENT_MATCHING_EVENTS');
  if (precise.length < safety.minimumHighMediumMatches) reasons.push('INSUFFICIENT_PRECISE_MATCHES');
  if (families.length < 2) reasons.push('INSUFFICIENT_MATCHED_EVIDENCE_FAMILIES');
  if (contradictions.length) reasons.push('MATERIAL_CONTRADICTION');
  if (!safety.permitted) reasons.push('DOMAIN_SAFETY_RESTRICTION');
  if (reasons.length === 0) reasons.push('ELIGIBLE');
  return Object.freeze({ candidateId: annotationValue ? annotationValue.candidateId : null, customerDisplayEligible: reasons[0] === 'ELIGIBLE', reasonCodes: reasons, comparableEventCount, matchedEventCount: matched.length, highMediumMatchedEventCount: precise.length, matchedEvidenceFamilies: families, unmatchedEvidenceFamilies: annotationValue ? annotationValue.unmatchedEvidenceFamilies : [], safetyPolicy: safety.policy });
}

class LifeEventCalibrationCoordinator {
  constructor({ canonicalEventLoader, clock } = {}) {
    if (typeof canonicalEventLoader !== 'function' || typeof clock !== 'function') fail('INVALID_LIFE_EVENT_CALIBRATION_COORDINATOR');
    this.loadEvents = canonicalEventLoader;
    this.clock = clock;
    Object.freeze(this);
  }

  async calibrate({ principal, birthProfileId, adapter, primaryCandidates = [], primaryDomainRulesVersion = null, adapterContext = {} } = {}) {
    if (!adapter || typeof adapter.supports !== 'function' || typeof adapter.cohortFor !== 'function' || typeof adapter.resolveTimezone !== 'function' || typeof adapter.extractRetrospectiveEvidence !== 'function' || typeof adapter.annotateCandidates !== 'function' || typeof adapter.domainCalibrationVersion !== 'string') fail('INVALID_LIFE_EVENT_CALIBRATION_ADAPTER');
    const candidates = primaryCandidates.map(primaryCandidate);
    const referenceInstant = new Date(this.clock()).toISOString();
    const startedAt = process.hrtime.bigint();
    const base = { calibrationContractVersion: CALIBRATION_CONTRACT_VERSION, domainCalibrationVersion: adapter.domainCalibrationVersion, primaryDomainRulesVersion, status: 'NO_EVENTS', comparableEventCount: 0, matchedEventCount: 0, thresholdLevel: 'NONE', patternStrength: 'NONE', historicalConsistency: 'NONE', customerDisplayEligible: false, customerDisplayReadiness: [], customerSummary: null, annotations: [], fingerprints: [], audit: { referenceInstant, relevantEventIds: [], eventTypes: [], cohorts: [], precisionCategories: [], matchedEvidenceFamilies: [], unmatchedEvidenceFamilies: [], qualityFlags: [], contradictionFlags: [], exclusionCounts: {}, timing: { totalMilliseconds: 0, loadMilliseconds: 0, extractionMilliseconds: 0, annotationMilliseconds: 0 }, candidateIds: candidates.map((item) => item.candidateId), customerSummaryEnabled: false } };
    try {
      const loadStartedAt = process.hrtime.bigint();
      const [events, timezone] = await Promise.all([this.loadEvents({ principal, birthProfileId, adapter }), adapter.resolveTimezone({ principal, birthProfileId })]);
      const loadMilliseconds = elapsedMilliseconds(loadStartedAt);
      if (!Array.isArray(events) || typeof timezone !== 'string' || !timezone) fail('INVALID_CANONICAL_LIFE_EVENT_SOURCE');
      const exclusionCounts = {};
      const eligible = [];
      for (const event of events) {
        if (!event) { increment(exclusionCounts, 'MALFORMED_EVENT'); continue; }
        if (event.deletedAt != null) { increment(exclusionCounts, 'DELETED'); continue; }
        if (!adapter.supports(event)) { increment(exclusionCounts, 'UNSUPPORTED_TYPE_OR_CATEGORY'); continue; }
        let interval;
        try { interval = eventInterval(event.eventDate, timezone); } catch (_) { increment(exclusionCounts, 'MALFORMED_DATE'); continue; }
        if (interval.to > referenceInstant) {
          increment(exclusionCounts, interval.from >= referenceInstant ? 'FUTURE_EVENT' : `CURRENT_OVERLAPPING_${event.eventDate.precision}`);
          continue;
        }
        const cohort = adapter.cohortFor(event);
        if (typeof cohort !== 'string' || !cohort) { increment(exclusionCounts, 'WRONG_COHORT'); continue; }
        eligible.push({ event, interval, cohort });
      }
      eligible.sort((left, right) => left.interval.from.localeCompare(right.interval.from) || String(left.event.careerEventId || left.event.lifeEventId || left.event.id).localeCompare(String(right.event.careerEventId || right.event.lifeEventId || right.event.id)));
      const cohorts = new Map();
      for (const item of eligible) { if (!cohorts.has(item.cohort)) cohorts.set(item.cohort, []); cohorts.get(item.cohort).push(item); }
      const comparableEventCount = Math.max(0, ...[...cohorts.values()].map((items) => items.length));
      const thresholdLevel = threshold(comparableEventCount);
      const prepared = eligible.map(({ event, interval, cohort }) => ({ event, interval, calibrationCohort: cohort, precisionCategory: precisionCategory(event.eventDate.precision) }));
      const extractionStartedAt = process.hrtime.bigint();
      const extraction = prepared.length >= 2 ? await adapter.extractRetrospectiveEvidence({ principal, birthProfileId, events: prepared, referenceInstant, adapterContext }) : { fingerprints: prepared.map((item) => ({ eventId: item.event.careerEventId || item.event.lifeEventId || item.event.id, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: adapter.domainCalibrationVersion, evidenceFamilies: [], evidenceFingerprint: {}, qualityFlags: ['INSUFFICIENT_COMPARABLE_EVENTS'] })) };
      const extractionMilliseconds = elapsedMilliseconds(extractionStartedAt);
      const fingerprints = Array.isArray(extraction && extraction.fingerprints) ? extraction.fingerprints : fail('INVALID_RETROSPECTIVE_CALIBRATION_EVIDENCE');
      const annotationStartedAt = process.hrtime.bigint();
      const rawAnnotations = thresholdLevel === 'PATTERN_ELIGIBLE' && candidates.length ? await adapter.annotateCandidates({ principal, birthProfileId, events: prepared, fingerprints, primaryCandidates: candidates, referenceInstant, adapterContext }) : [];
      const annotationMilliseconds = elapsedMilliseconds(annotationStartedAt);
      const knownIds = new Set(candidates.map((item) => item.candidateId));
      const annotations = (rawAnnotations || []).map((item) => annotation(item, knownIds));
      const matchedEventIds = [...new Set(annotations.flatMap((item) => item.matchedEventIds))];
      const matchedEventCount = matchedEventIds.length;
      const patternStrength = annotations.reduce((best, item) => ({ NONE: 0, LIMITED: 1, WEAK: 2, MODERATE: 3, STRONG: 4 }[item.patternStrength] > ({ NONE: 0, LIMITED: 1, WEAK: 2, MODERATE: 3, STRONG: 4 }[best] || 0) ? item.patternStrength : best), 'NONE');
      const contradictions = [...new Set(annotations.flatMap((item) => item.contradictionFlags))].sort();
      const safety = displaySafety(adapter, { principal, birthProfileId, adapterContext, primaryCandidates: candidates });
      const fingerprintsById = new Map(fingerprints.map((item) => [item.eventId, item]));
      const customerDisplayReadiness = annotations.length ? annotations.map((item) => readiness(item, fingerprintsById, comparableEventCount, safety)) : [readiness(null, fingerprintsById, comparableEventCount, safety)];
      const customerDisplayEligible = customerDisplayReadiness.some((item) => item.customerDisplayEligible);
      const audit = { ...base.audit, relevantEventIds: prepared.map((item) => item.event.careerEventId || item.event.lifeEventId || item.event.id), eventTypes: [...new Set(prepared.map((item) => item.event.eventType))].sort(), cohorts: [...cohorts.entries()].map(([cohort, items]) => ({ cohort, eventCount: items.length })).sort((left, right) => left.cohort.localeCompare(right.cohort)), precisionCategories: [...new Set(prepared.map((item) => item.precisionCategory))].sort(), matchedEvidenceFamilies: [...new Set(annotations.flatMap((item) => item.matchedEvidenceFamilies))].sort(), unmatchedEvidenceFamilies: [...new Set(annotations.flatMap((item) => item.unmatchedEvidenceFamilies))].sort(), qualityFlags: [...new Set([...fingerprints.flatMap((item) => item.qualityFlags || []), ...annotations.flatMap((item) => item.qualityFlags)])].sort(), contradictionFlags: contradictions, exclusionCounts, timing: { totalMilliseconds: elapsedMilliseconds(startedAt), loadMilliseconds, extractionMilliseconds, annotationMilliseconds } };
      return immutableCopy({ ...base, status: prepared.length === 0 ? 'NO_EVENTS' : thresholdLevel === 'CONTEXT_ONLY' ? 'CONTEXT_ONLY' : 'PATTERN_EVALUATED', comparableEventCount, matchedEventCount, thresholdLevel, patternStrength: contradictions.length ? (patternStrength === 'NONE' ? 'NONE' : 'LIMITED') : patternStrength, historicalConsistency: contradictions.length ? 'LIMITED' : matchedEventCount >= 2 ? 'BOUNDED' : 'NONE', customerDisplayEligible, customerDisplayReadiness, annotations, fingerprints, audit });
    } catch (error) {
      return immutableCopy({ ...base, status: 'CALIBRATION_UNAVAILABLE', audit: { ...base.audit, qualityFlags: ['CALIBRATION_UNAVAILABLE'], safeFailureCode: safeCode(error), timing: { ...base.audit.timing, totalMilliseconds: elapsedMilliseconds(startedAt) } } });
    }
  }
}

module.exports = { LifeEventCalibrationCoordinator, CALIBRATION_CONTRACT_VERSION, DATE_PRECISIONS, EVIDENCE_FAMILIES, THRESHOLD_LEVELS, DISPLAY_REASON_CODES, eventInterval, precisionCategory, threshold };
