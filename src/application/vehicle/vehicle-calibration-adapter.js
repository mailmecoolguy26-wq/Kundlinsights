'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');
const { reconstructVehicleRetrospectiveEvidence, VEHICLE_RULESET_VERSION } = require('./vehicle-answer-service');

const VEHICLE_CALIBRATION_ADAPTER_VERSION = 'vehicle-calibration-adapter-v1';
const SUPPORTED_EVENT_TYPES = Object.freeze(['VEHICLE_PURCHASE', 'VEHICLE_SALE']);
const CUSTOMER_DISPLAY_SAFETY_POLICY = 'NON_PREDICTIVE_VEHICLE_HISTORY_CONTEXT_ONLY';

function fail(code) { throw repositoryError(code); }
function eventId(event) { return event && (event.lifeEventId || event.id); }
function strength(count) { return count < 1 ? 'NONE' : count === 1 ? 'LIMITED' : count === 2 ? 'WEAK' : count === 3 ? 'MODERATE' : 'STRONG'; }
function familyList(evidence) {
  const out = [];
  if (evidence.foundation) out.push('FOUNDATION');
  if (evidence.d16) out.push('DIVISIONAL_CHART');
  if (Array.isArray(evidence.dasha) && evidence.dasha.length) out.push('DASHA');
  if (Array.isArray(evidence.transit) && evidence.transit.length) out.push('TRANSIT');
  if (evidence.ashtakavarga) out.push('ASHTAKAVARGA');
  return out;
}
function fingerprint(evidence) {
  return {
    foundation: evidence.foundation,
    d16: evidence.d16,
    dasha: (evidence.dasha || []).map((item) => ({ classification: item.classification, eligible: item.eligible, md: item.md, ad: item.ad, pd: item.pd, pdRefinement: item.pdRefinement })),
    transit: (evidence.transit || []).map((item) => ({ majorConfirmation: item.majorConfirmation, hasMajorConfirmation: item.hasMajorConfirmation, majorPlanets: item.majorPlanets, supportPlanets: item.supportPlanets })),
    ashtakavarga: evidence.ashtakavarga,
    intervalSummary: evidence.intervalSummary,
  };
}
function candidateCohort(intent) { return intent === 'VEHICLE_SALE_TIMING' ? 'VEHICLE_SALE' : 'VEHICLE_PURCHASE'; }
function candidateMatch(historical, candidate, primary) {
  if (!historical) return { matches: false, matchedEvidenceFamilies: [], unmatchedEvidenceFamilies: ['FOUNDATION', 'DIVISIONAL_CHART', 'DASHA', 'TRANSIT'] };
  const current = primary || {};
  const sameFoundation = !current.d1 || Boolean(historical.foundation && historical.foundation.classification === current.d1.classification);
  const sameD16 = !current.d16 || Boolean(historical.d16 && historical.d16.confirmation === current.d16.confirmation);
  const pd = candidate && candidate.primaryEvidenceFingerprint && candidate.primaryEvidenceFingerprint.pd;
  const dashaMatch = !pd || (historical.dasha || []).some((item) => item.pd === pd && item.eligible === true);
  const majorConfirmation = candidate && candidate.primaryEvidenceFingerprint && candidate.primaryEvidenceFingerprint.majorConfirmation;
  const transitMatch = !majorConfirmation || (historical.transit || []).some((item) => majorConfirmation === 'MAJOR_CONFIRMATION'
    ? item.majorConfirmation === 'MAJOR_CONFIRMATION'
    : item.hasMajorConfirmation === true);
  const matchedEvidenceFamilies = [];
  if (current.d1 && sameFoundation) matchedEvidenceFamilies.push('FOUNDATION');
  if (current.d16 && sameD16) matchedEvidenceFamilies.push('DIVISIONAL_CHART');
  if (pd && dashaMatch) matchedEvidenceFamilies.push('DASHA');
  if (majorConfirmation && transitMatch) matchedEvidenceFamilies.push('TRANSIT');
  const unmatchedEvidenceFamilies = [];
  if (!current.d1 || !sameFoundation) unmatchedEvidenceFamilies.push('FOUNDATION');
  if (!current.d16 || !sameD16) unmatchedEvidenceFamilies.push('DIVISIONAL_CHART');
  if (!pd || !dashaMatch) unmatchedEvidenceFamilies.push('DASHA');
  if (!majorConfirmation || !transitMatch) unmatchedEvidenceFamilies.push('TRANSIT');
  return { matches: sameFoundation && sameD16 && dashaMatch && transitMatch, matchedEvidenceFamilies, unmatchedEvidenceFamilies };
}
function matchesCandidate(historical, candidate, primary) { return candidateMatch(historical, candidate, primary).matches; }

class VehicleCalibrationAdapter {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, retrospectiveEvidenceExtractor = reconstructVehicleRetrospectiveEvidence } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler || typeof retrospectiveEvidenceExtractor !== 'function') fail('INVALID_VEHICLE_CALIBRATION_ADAPTER');
    this.profiles = birthProfileService;
    this.engine = astronomicalEngine;
    this.sampler = canonicalSiderealSunSampler;
    this.extractor = retrospectiveEvidenceExtractor;
    this.domainCalibrationVersion = VEHICLE_CALIBRATION_ADAPTER_VERSION;
    this.customerDisplaySafetyPolicy = CUSTOMER_DISPLAY_SAFETY_POLICY;
    Object.freeze(this);
  }

  supports(event) { return Boolean(event && event.category === 'VEHICLE' && SUPPORTED_EVENT_TYPES.includes(event.eventType) && event.eventDate && eventId(event)); }
  cohortFor(event) { return this.supports(event) ? event.eventType : null; }
  async resolveTimezone({ principal, birthProfileId }) {
    const profile = await this.profiles.get({ principal, birthProfileId });
    if (!profile || !profile.birthData || typeof profile.birthData.timezone !== 'string') fail('INVALID_VEHICLE_CALIBRATION_TIMEZONE');
    return profile.birthData.timezone;
  }
  async extractRetrospectiveEvidence({ principal, birthProfileId, events }) {
    const fingerprints = [];
    for (const item of events) {
      const evidence = await this.extractor({ principal, birthProfileId, interval: item.interval, datePrecision: item.event.eventDate.precision, birthProfileService: this.profiles, astronomicalEngine: this.engine, canonicalSiderealSunSampler: this.sampler });
      fingerprints.push({ eventId: eventId(item.event), eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: VEHICLE_RULESET_VERSION, evidenceFamilies: familyList(evidence), evidenceFingerprint: fingerprint(evidence), qualityFlags: [item.event.eventDate.precision === 'DAY' ? 'EXACT_DAY_INTERVAL' : item.event.eventDate.precision === 'MONTH' ? 'MONTH_INTERVAL_SUMMARIZED' : 'YEAR_INTERVAL_SUMMARIZED'] });
    }
    return immutableCopy({ fingerprints });
  }
  customerDisplaySafety() { return Object.freeze({ permitted: this.customerDisplaySafetyPolicy === CUSTOMER_DISPLAY_SAFETY_POLICY, policy: this.customerDisplaySafetyPolicy, minimumHighMediumMatches: 2 }); }
  async annotateCandidates({ events, fingerprints, primaryCandidates, adapterContext = {} }) {
    const requiredCohort = candidateCohort(adapterContext.intent);
    const comparable = events.filter((item) => item.calibrationCohort === requiredCohort);
    const byId = new Map(fingerprints.map((item) => [item.eventId, item]));
    const annotations = [];
    for (const candidate of primaryCandidates) {
      const comparisons = comparable.map((item) => {
        const value = byId.get(eventId(item.event));
        return { item, comparison: candidateMatch(value && value.evidenceFingerprint, candidate, adapterContext.primaryVehicleEvidence) };
      });
      const matching = comparisons.filter((item) => item.comparison.matches).map((item) => item.item);
      const mismatch = comparable.length >= 3 && matching.length < 2;
      annotations.push({ candidateId: candidate.candidateId, matchedEventIds: matching.map((item) => eventId(item.event)), matchedEvidenceFamilies: [...new Set(comparisons.filter((item) => item.comparison.matches).flatMap((item) => item.comparison.matchedEvidenceFamilies))].sort(), unmatchedEvidenceFamilies: [...new Set(comparisons.flatMap((item) => item.comparison.unmatchedEvidenceFamilies))].sort(), patternStrength: mismatch ? 'LIMITED' : strength(matching.length), historicalConsistency: mismatch ? 'LIMITED' : matching.length >= 2 ? 'BOUNDED' : 'NONE', tieBreakEligible: matching.length >= 2 && comparable.length >= 3 && !mismatch, qualityFlags: ['PERSONALIZATION_ONLY', 'CUSTOMER_SUMMARY_DISABLED', ...(matching.some((item) => item.event.eventDate.precision !== 'DAY') ? ['BROAD_DATE_PRECISION_PRESENT'] : [])], contradictionFlags: mismatch ? ['MATERIAL_VEHICLE_PATTERN_VARIATION'] : [] });
    }
    return immutableCopy(annotations);
  }
}

module.exports = { VehicleCalibrationAdapter, VEHICLE_CALIBRATION_ADAPTER_VERSION, SUPPORTED_EVENT_TYPES, CUSTOMER_DISPLAY_SAFETY_POLICY, matchesCandidate, candidateMatch };
