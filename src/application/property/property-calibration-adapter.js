'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');
const { reconstructPropertyRetrospectiveEvidence, PROPERTY_RULESET_VERSION } = require('./property-answer-service');

const PROPERTY_CALIBRATION_ADAPTER_VERSION = 'property-calibration-adapter-v1';
const SUPPORTED_EVENT_TYPES = Object.freeze(['PROPERTY_PURCHASE', 'PROPERTY_SALE']);
const CUSTOMER_DISPLAY_SAFETY_POLICY = 'NON_PREDICTIVE_PROPERTY_HISTORY_CONTEXT_ONLY';

function fail(code) { throw repositoryError(code); }
function eventId(event) { return event && (event.lifeEventId || event.id); }
function strength(count) { return count < 1 ? 'NONE' : count === 1 ? 'LIMITED' : count === 2 ? 'WEAK' : count === 3 ? 'MODERATE' : 'STRONG'; }
function familyList(evidence) {
  const out = [];
  if (evidence.foundation) out.push('FOUNDATION');
  if (evidence.d4) out.push('DIVISIONAL_CHART');
  if (Array.isArray(evidence.dasha) && evidence.dasha.length) out.push('DASHA');
  if (Array.isArray(evidence.transit) && evidence.transit.length) out.push('TRANSIT');
  if (evidence.ashtakavarga) out.push('ASHTAKAVARGA');
  return out;
}
function fingerprint(evidence) {
  return {
    foundation: evidence.foundation,
    d4: evidence.d4,
    dasha: (evidence.dasha || []).map((item) => ({ classification: item.classification, active: item.active, md: item.md, ad: item.ad, pd: item.pd })),
    transit: (evidence.transit || []).map((item) => ({ active: item.active, majorPlanets: item.majorPlanets, supportPlanets: item.supportPlanets })),
    ashtakavarga: evidence.ashtakavarga,
    intervalSummary: evidence.intervalSummary,
  };
}
function candidateCohort(intent) { return intent === 'PROPERTY_SALE_TIMING' ? 'PROPERTY_SALE' : 'PROPERTY_PURCHASE'; }
function candidateMatch(historical, candidate, primary) {
  const current = primary || {};
  const sameFoundation = !current.natal || historical.foundation && historical.foundation.classification === current.natal.classification;
  const sameD4 = !current.d4 || historical.d4 && historical.d4.confirmation === current.d4.confirmation;
  const pd = candidate && candidate.primaryEvidenceFingerprint && candidate.primaryEvidenceFingerprint.pd;
  const dashaMatch = !pd || (historical.dasha || []).some((item) => item.pd === pd && item.active === true);
  const transitState = candidate && candidate.primaryEvidenceFingerprint && candidate.primaryEvidenceFingerprint.transitConfirmation;
  const transitMatch = !transitState || (transitState === 'MAJOR_CONFIRMATION' ? (historical.transit || []).some((item) => item.majorPlanets.length > 0) : transitState === 'SUPPORTIVE_CONFIRMATION' ? (historical.transit || []).some((item) => item.majorPlanets.length > 0 || item.supportPlanets.length > 0) : true);
  const matchedEvidenceFamilies = [];
  if (current.natal && sameFoundation) matchedEvidenceFamilies.push('FOUNDATION');
  if (current.d4 && sameD4) matchedEvidenceFamilies.push('DIVISIONAL_CHART');
  if (pd && dashaMatch) matchedEvidenceFamilies.push('DASHA');
  if (transitState && transitMatch) matchedEvidenceFamilies.push('TRANSIT');
  const unmatchedEvidenceFamilies = [];
  if (!current.natal || !sameFoundation) unmatchedEvidenceFamilies.push('FOUNDATION');
  if (!current.d4 || !sameD4) unmatchedEvidenceFamilies.push('DIVISIONAL_CHART');
  if (!pd || !dashaMatch) unmatchedEvidenceFamilies.push('DASHA');
  if (!transitState || !transitMatch) unmatchedEvidenceFamilies.push('TRANSIT');
  return { matches: sameFoundation && sameD4 && dashaMatch && transitMatch, matchedEvidenceFamilies, unmatchedEvidenceFamilies };
}
function matchesCandidate(historical, candidate, primary) { return candidateMatch(historical, candidate, primary).matches; }

class PropertyCalibrationAdapter {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, retrospectiveEvidenceExtractor = reconstructPropertyRetrospectiveEvidence } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler || typeof retrospectiveEvidenceExtractor !== 'function') fail('INVALID_PROPERTY_CALIBRATION_ADAPTER');
    this.profiles = birthProfileService;
    this.engine = astronomicalEngine;
    this.sampler = canonicalSiderealSunSampler;
    this.extractor = retrospectiveEvidenceExtractor;
    this.domainCalibrationVersion = PROPERTY_CALIBRATION_ADAPTER_VERSION;
    this.customerDisplaySafetyPolicy = CUSTOMER_DISPLAY_SAFETY_POLICY;
    Object.freeze(this);
  }

  supports(event) { return Boolean(event && event.category === 'PROPERTY' && SUPPORTED_EVENT_TYPES.includes(event.eventType) && event.eventDate && eventId(event)); }
  cohortFor(event) { return this.supports(event) ? event.eventType : null; }
  async resolveTimezone({ principal, birthProfileId }) {
    const profile = await this.profiles.get({ principal, birthProfileId });
    if (!profile || !profile.birthData || typeof profile.birthData.timezone !== 'string') fail('INVALID_PROPERTY_CALIBRATION_TIMEZONE');
    return profile.birthData.timezone;
  }
  async extractRetrospectiveEvidence({ principal, birthProfileId, events }) {
    const fingerprints = [];
    for (const item of events) {
      const evidence = await this.extractor({ principal, birthProfileId, interval: item.interval, datePrecision: item.event.eventDate.precision, birthProfileService: this.profiles, astronomicalEngine: this.engine, canonicalSiderealSunSampler: this.sampler });
      fingerprints.push({ eventId: eventId(item.event), eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: PROPERTY_RULESET_VERSION, evidenceFamilies: familyList(evidence), evidenceFingerprint: fingerprint(evidence), qualityFlags: [item.event.eventDate.precision === 'DAY' ? 'EXACT_DAY_INTERVAL' : item.event.eventDate.precision === 'MONTH' ? 'MONTH_INTERVAL_SUMMARIZED' : 'YEAR_INTERVAL_SUMMARIZED'] });
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
      const comparisons = comparable.map((item) => ({ item, comparison: candidateMatch(byId.get(eventId(item.event)).evidenceFingerprint, candidate, adapterContext.primaryPropertyEvidence) }));
      const matching = comparisons.filter((item) => item.comparison.matches).map((item) => item.item);
      const mismatch = comparable.length >= 3 && matching.length < 2;
      annotations.push({ candidateId: candidate.candidateId, matchedEventIds: matching.map((item) => eventId(item.event)), matchedEvidenceFamilies: [...new Set(comparisons.filter((item) => item.comparison.matches).flatMap((item) => item.comparison.matchedEvidenceFamilies))].sort(), unmatchedEvidenceFamilies: [...new Set(comparisons.flatMap((item) => item.comparison.unmatchedEvidenceFamilies))].sort(), patternStrength: mismatch ? 'LIMITED' : strength(matching.length), historicalConsistency: mismatch ? 'LIMITED' : matching.length >= 2 ? 'BOUNDED' : 'NONE', tieBreakEligible: matching.length >= 2 && comparable.length >= 3 && !mismatch, qualityFlags: ['PERSONALIZATION_ONLY', 'CUSTOMER_SUMMARY_DISABLED', ...(matching.some((item) => item.event.eventDate.precision !== 'DAY') ? ['BROAD_DATE_PRECISION_PRESENT'] : [])], contradictionFlags: mismatch ? ['MATERIAL_PROPERTY_PATTERN_VARIATION'] : [] });
    }
    return immutableCopy(annotations);
  }
}

module.exports = { PropertyCalibrationAdapter, PROPERTY_CALIBRATION_ADAPTER_VERSION, SUPPORTED_EVENT_TYPES, CUSTOMER_DISPLAY_SAFETY_POLICY, matchesCandidate, candidateMatch };
