'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');
const { reconstructRelationshipRetrospectiveEvidence, RELATIONSHIP_RULESET_VERSION } = require('./relationship-answer-service');

const RELATIONSHIP_CALIBRATION_ADAPTER_VERSION = 'relationship-calibration-adapter-v1';
const SUPPORTED_EVENT_TYPES = Object.freeze(['ENGAGEMENT', 'MARRIAGE']);
const CUSTOMER_DISPLAY_SAFETY_POLICY = 'NON_PREDICTIVE_RELATIONSHIP_HISTORY_CONTEXT_ONLY';

function fail(code) { throw repositoryError(code); }
function eventId(event) { return event && (event.lifeEventId || event.id); }
function strength(count) { return count < 1 ? 'NONE' : count === 1 ? 'LIMITED' : count === 2 ? 'WEAK' : count === 3 ? 'MODERATE' : 'STRONG'; }
function familyList(evidence) {
  const out = [];
  if (evidence.foundation) out.push('FOUNDATION');
  if (evidence.d9) out.push('DIVISIONAL_CHART');
  if (Array.isArray(evidence.dasha) && evidence.dasha.length) out.push('DASHA');
  if (Array.isArray(evidence.transit) && evidence.transit.length) out.push('TRANSIT');
  if (evidence.ashtakavarga) out.push('ASHTAKAVARGA');
  return out;
}
function fingerprint(evidence) {
  return {
    foundation: evidence.foundation,
    d9: evidence.d9,
    dasha: (evidence.dasha || []).map((item) => ({ state: item.state, eligible: item.eligible, md: item.md, ad: item.ad, pd: item.pd, pdRefinement: item.pdRefinement })),
    transit: (evidence.transit || []).map((item) => ({ jupiter: item.jupiter, saturn: item.saturn, venus: item.venus, caution: item.caution, major: item.major })),
    ashtakavarga: evidence.ashtakavarga,
    intervalSummary: evidence.intervalSummary,
  };
}
function candidateCohort(intent) { return intent === 'MARRIAGE_OUTLOOK' ? 'MARRIAGE' : 'ENGAGEMENT'; }
function candidateMatch(historical, candidate, primary) {
  if (!historical) return { matches: false, matchedEvidenceFamilies: [], unmatchedEvidenceFamilies: ['FOUNDATION', 'DIVISIONAL_CHART', 'DASHA', 'TRANSIT'] };
  const current = primary || {};
  const sameFoundation = !current.d1 || Boolean(historical.foundation && historical.foundation.state === current.d1.state);
  const sameD9 = !current.d9 || Boolean(historical.d9 && historical.d9.confirmation === current.d9.confirmation);
  const pd = candidate && candidate.primaryEvidenceFingerprint && candidate.primaryEvidenceFingerprint.pd;
  const dashaMatch = !pd || (historical.dasha || []).some((item) => item.pd === pd && item.eligible === true);
  const majorRegime = candidate && candidate.primaryEvidenceFingerprint && candidate.primaryEvidenceFingerprint.majorRegime;
  const transitMatch = !majorRegime || (historical.transit || []).some((item) => majorRegime === 'NONE' ? item.major !== true : item.major === true);
  const matchedEvidenceFamilies = [];
  if (current.d1 && sameFoundation) matchedEvidenceFamilies.push('FOUNDATION');
  if (current.d9 && sameD9) matchedEvidenceFamilies.push('DIVISIONAL_CHART');
  if (pd && dashaMatch) matchedEvidenceFamilies.push('DASHA');
  if (majorRegime && transitMatch) matchedEvidenceFamilies.push('TRANSIT');
  const unmatchedEvidenceFamilies = [];
  if (!current.d1 || !sameFoundation) unmatchedEvidenceFamilies.push('FOUNDATION');
  if (!current.d9 || !sameD9) unmatchedEvidenceFamilies.push('DIVISIONAL_CHART');
  if (!pd || !dashaMatch) unmatchedEvidenceFamilies.push('DASHA');
  if (!majorRegime || !transitMatch) unmatchedEvidenceFamilies.push('TRANSIT');
  return { matches: sameFoundation && sameD9 && dashaMatch && transitMatch, matchedEvidenceFamilies, unmatchedEvidenceFamilies };
}
function matchesCandidate(historical, candidate, primary) { return candidateMatch(historical, candidate, primary).matches; }

class RelationshipCalibrationAdapter {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, retrospectiveEvidenceExtractor = reconstructRelationshipRetrospectiveEvidence } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler || typeof retrospectiveEvidenceExtractor !== 'function') fail('INVALID_RELATIONSHIP_CALIBRATION_ADAPTER');
    this.profiles = birthProfileService;
    this.engine = astronomicalEngine;
    this.sampler = canonicalSiderealSunSampler;
    this.extractor = retrospectiveEvidenceExtractor;
    this.domainCalibrationVersion = RELATIONSHIP_CALIBRATION_ADAPTER_VERSION;
    this.customerDisplaySafetyPolicy = CUSTOMER_DISPLAY_SAFETY_POLICY;
    Object.freeze(this);
  }
  supports(event) { return Boolean(event && event.category === 'RELATIONSHIPS_FAMILY' && SUPPORTED_EVENT_TYPES.includes(event.eventType) && event.eventDate && eventId(event)); }
  cohortFor(event) { return this.supports(event) ? event.eventType : null; }
  async resolveTimezone({ principal, birthProfileId }) {
    const profile = await this.profiles.get({ principal, birthProfileId });
    if (!profile || !profile.birthData || typeof profile.birthData.timezone !== 'string') fail('INVALID_RELATIONSHIP_CALIBRATION_TIMEZONE');
    return profile.birthData.timezone;
  }
  async extractRetrospectiveEvidence({ principal, birthProfileId, events }) {
    const fingerprints = [];
    for (const item of events) {
      const evidence = await this.extractor({ principal, birthProfileId, interval: item.interval, datePrecision: item.event.eventDate.precision, birthProfileService: this.profiles, astronomicalEngine: this.engine, canonicalSiderealSunSampler: this.sampler });
      fingerprints.push({ eventId: eventId(item.event), eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: RELATIONSHIP_RULESET_VERSION, evidenceFamilies: familyList(evidence), evidenceFingerprint: fingerprint(evidence), qualityFlags: [item.event.eventDate.precision === 'DAY' ? 'EXACT_DAY_INTERVAL' : item.event.eventDate.precision === 'MONTH' ? 'MONTH_INTERVAL_SUMMARIZED' : 'YEAR_INTERVAL_SUMMARIZED'] });
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
        return { item, comparison: candidateMatch(value && value.evidenceFingerprint, candidate, adapterContext.primaryRelationshipEvidence) };
      });
      const matching = comparisons.filter((item) => item.comparison.matches).map((item) => item.item);
      const mismatch = comparable.length >= 3 && matching.length < 2;
      annotations.push({ candidateId: candidate.candidateId, matchedEventIds: matching.map((item) => eventId(item.event)), matchedEvidenceFamilies: [...new Set(comparisons.filter((item) => item.comparison.matches).flatMap((item) => item.comparison.matchedEvidenceFamilies))].sort(), unmatchedEvidenceFamilies: [...new Set(comparisons.flatMap((item) => item.comparison.unmatchedEvidenceFamilies))].sort(), patternStrength: mismatch ? 'LIMITED' : strength(matching.length), historicalConsistency: mismatch ? 'LIMITED' : matching.length >= 2 ? 'BOUNDED' : 'NONE', tieBreakEligible: matching.length >= 2 && comparable.length >= 3 && !mismatch, qualityFlags: ['PERSONALIZATION_ONLY', 'CUSTOMER_SUMMARY_DISABLED', ...(matching.some((item) => item.event.eventDate.precision !== 'DAY') ? ['BROAD_DATE_PRECISION_PRESENT'] : [])], contradictionFlags: mismatch ? ['MATERIAL_RELATIONSHIP_PATTERN_VARIATION'] : [] });
    }
    return immutableCopy(annotations);
  }
}

module.exports = { RelationshipCalibrationAdapter, RELATIONSHIP_CALIBRATION_ADAPTER_VERSION, SUPPORTED_EVENT_TYPES, CUSTOMER_DISPLAY_SAFETY_POLICY, matchesCandidate, candidateMatch };
