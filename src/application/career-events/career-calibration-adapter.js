'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');

const CAREER_CALIBRATION_ADAPTER_VERSION = 'career-calibration-adapter-v1';
const SUPPORTED_EVENT_TYPES = Object.freeze(['FIRST_JOB', 'JOB_SWITCH', 'PROMOTION', 'ROLE_CHANGE', 'SALARY_GROWTH', 'JOB_LOSS', 'BUSINESS_STARTED', 'CAREER_BREAKTHROUGH', 'CAREER_SETBACK']);
const CUSTOMER_DISPLAY_SAFETY_POLICY = 'NON_PREDICTIVE_CAREER_HISTORY_CONTEXT_ONLY';
const FAMILY_BY_FACT = Object.freeze({
  DASHA: 'DASHA',
  TRANSIT: 'TRANSIT',
  TRANSIT_EVENT: 'TRANSIT',
  CAREER_HOUSE: 'FOUNDATION',
  ASHTAKAVARGA: 'ASHTAKAVARGA',
});

function fail(code) { throw repositoryError(code); }
function eventId(event) { return event && (event.careerEventId || event.lifeEventId || event.id); }
function familyFor(category) { return FAMILY_BY_FACT[category] || 'DOMAIN_SPECIFIC'; }
function familyForMechanism(value) { return value === 'DASHA_RECURRENCE' ? 'DASHA' : value === 'TRANSIT_RECURRENCE' ? 'TRANSIT' : null; }
function strength(count) { return count < 1 ? 'NONE' : count === 1 ? 'LIMITED' : count === 2 ? 'WEAK' : count === 3 ? 'MODERATE' : 'STRONG'; }
function snapshotFamilies(snapshot) {
  const out = new Set();
  if (snapshot && snapshot.natalCareerContext) out.add('FOUNDATION');
  if (snapshot && snapshot.natalCareerContext && snapshot.natalCareerContext.d10) out.add('DIVISIONAL_CHART');
  if (snapshot && Array.isArray(snapshot.dashaIntervals) && snapshot.dashaIntervals.length) out.add('DASHA');
  if (snapshot && snapshot.transitCoverage) out.add('TRANSIT');
  if (snapshot && snapshot.ashtakavarga) out.add('ASHTAKAVARGA');
  return [...out].sort();
}
function compactSnapshot(snapshot) {
  const dasha = [...new Set((snapshot.dashaIntervals || []).map((item) => `${item.mahadasha && item.mahadasha.lord || ''}/${item.antardasha && item.antardasha.lord || ''}/${item.pratyantardasha && item.pratyantardasha.lord || ''}`))].sort();
  const transit = (snapshot.transitCoverage && snapshot.transitCoverage.bodies || []).map((body) => ({ body: body.body, startHouse: body.intervals && body.intervals[0] && body.intervals[0].natalHouseAtStart || null, endHouse: body.intervals && body.intervals[0] && body.intervals[0].natalHouseAtEnd || null, transitionTypes: [...new Set((body.transitions || []).map((item) => item.eventType))].sort() })).sort((left, right) => left.body.localeCompare(right.body));
  const d10 = snapshot.natalCareerContext && snapshot.natalCareerContext.d10;
  return { dasha, transit, hasD10: Boolean(d10), hasAshtakavarga: Boolean(snapshot.ashtakavarga) };
}
function analysesByEvent(patternComparison) {
  const out = new Map();
  for (const context of patternComparison && patternComparison.comparisonContexts || []) {
    for (const analysis of context.eventAnalyses || []) out.set(analysis.careerEventId, { analysis, context });
  }
  return out;
}

class CareerCalibrationAdapter {
  constructor({ careerEventAstrologyService, birthProfileService } = {}) {
    if (!careerEventAstrologyService || typeof careerEventAstrologyService.get !== 'function' || !birthProfileService || typeof birthProfileService.get !== 'function') fail('INVALID_CAREER_CALIBRATION_ADAPTER');
    this.snapshots = careerEventAstrologyService;
    this.profiles = birthProfileService;
    this.domainCalibrationVersion = CAREER_CALIBRATION_ADAPTER_VERSION;
    this.customerDisplaySafetyPolicy = CUSTOMER_DISPLAY_SAFETY_POLICY;
    Object.freeze(this);
  }

  supports(event) { return Boolean(event && SUPPORTED_EVENT_TYPES.includes(event.eventType) && event.eventDate && eventId(event)); }
  cohortFor(event) { return this.supports(event) ? `CAREER:${event.eventType}` : null; }
  async resolveTimezone({ principal, birthProfileId }) {
    const profile = await this.profiles.get({ principal, birthProfileId });
    if (!profile || !profile.birthData || typeof profile.birthData.timezone !== 'string') fail('INVALID_CAREER_CALIBRATION_TIMEZONE');
    return profile.birthData.timezone;
  }

  async extractRetrospectiveEvidence({ principal, birthProfileId, events, adapterContext = {} }) {
    const known = analysesByEvent(adapterContext.patternComparison);
    const fingerprints = [];
    for (const item of events) {
      const id = eventId(item.event);
      let snapshot = null;
      // The existing P3 comparison has already reconstructed its sampled events.
      // Reuse that result where possible; only request a factual snapshot for an
      // additional event that P3 did not sample.
      const reused = known.get(id);
      if (!reused) snapshot = await this.snapshots.get({ principal, birthProfileId, eventId: id });
      const families = reused
        ? [...new Set([...(reused.analysis.commonFeatures || []), ...(reused.analysis.changedFeatures || [])].map((fact) => familyFor(String(fact.id || '').split('_')[0] === 'TRANSIT' && fact.id === 'TRANSIT_EVENT' ? 'TRANSIT_EVENT' : String(fact.id || '').startsWith('DASHA') ? 'DASHA' : String(fact.id || '').startsWith('ASHTAKAVARGA') ? 'ASHTAKAVARGA' : String(fact.id || '').startsWith('CAREER_HOUSE') ? 'CAREER_HOUSE' : String(fact.id || '').startsWith('TRANSIT') ? 'TRANSIT' : 'DOMAIN_SPECIFIC')))].sort()
        : snapshotFamilies(snapshot);
      const fingerprint = reused
        ? { commonFeatureIds: (reused.analysis.commonFeatures || []).map((fact) => fact.id).sort(), changedFeatureIds: (reused.analysis.changedFeatures || []).map((fact) => fact.id).sort(), comparisonContext: reused.context.contextKey }
        : compactSnapshot(snapshot);
      fingerprints.push({ eventId: id, eventType: item.event.eventType, calibrationCohort: item.calibrationCohort, datePrecision: item.event.eventDate.precision, evaluatedInterval: item.interval, domainRulesVersion: CAREER_CALIBRATION_ADAPTER_VERSION, evidenceFamilies: families, evidenceFingerprint: fingerprint, qualityFlags: reused ? ['REUSED_EXISTING_CAREER_RETROSPECTIVE_EVIDENCE'] : ['RECONSTRUCTED_WITH_CAREER_EVENT_ASTROLOGY_SERVICE'] });
    }
    return immutableCopy({ fingerprints });
  }

  customerDisplaySafety() { return Object.freeze({ permitted: this.customerDisplaySafetyPolicy === CUSTOMER_DISPLAY_SAFETY_POLICY, policy: this.customerDisplaySafetyPolicy, minimumHighMediumMatches: 2 }); }

  async annotateCandidates({ events, fingerprints, primaryCandidates, adapterContext = {} }) {
    const references = new Map(events.map((item) => [eventId(item.event), item]));
    const existing = new Map((adapterContext.historicalEvidence || []).map((item) => [item.patternKey, item]));
    const future = new Map([...(adapterContext.futureOccurrences || []), ...(adapterContext.composites || [])].map((item) => [item.evidenceId, item]));
    const annotations = [];
    for (const candidate of primaryCandidates) {
      const source = future.get(candidate.candidateId);
      if (!source) continue;
      const historical = source.patternKey ? existing.get(source.patternKey) : null;
      const ids = (historical && historical.sourceEventIds || source.sourceEventIds || []).filter((id) => references.has(id));
      const relatedFingerprints = fingerprints.filter((item) => ids.includes(item.eventId));
      const expectedFamilies = [...new Set((source.mechanismFamilies || []).map(familyForMechanism).filter(Boolean))].sort();
      const availableFamilies = new Set(relatedFingerprints.flatMap((item) => item.evidenceFamilies || []));
      const families = expectedFamilies.filter((item) => availableFamilies.has(item));
      const unmatchedEvidenceFamilies = expectedFamilies.filter((item) => !families.includes(item));
      const comparable = Math.max(0, ...[...new Map(events.map((item) => [item.calibrationCohort, 0])).keys()].map((cohort) => events.filter((item) => item.calibrationCohort === cohort).length));
      const contradiction = comparable >= 3 && ids.length < 2;
      annotations.push({ candidateId: candidate.candidateId, matchedEventIds: ids, matchedEvidenceFamilies: families, unmatchedEvidenceFamilies, patternStrength: contradiction ? 'LIMITED' : strength(ids.length), historicalConsistency: contradiction ? 'LIMITED' : ids.length >= 2 ? 'BOUNDED' : 'NONE', tieBreakEligible: ids.length >= 2 && comparable >= 3 && !contradiction, qualityFlags: ['PERSONALIZATION_ONLY', 'CUSTOMER_SUMMARY_DISABLED'], contradictionFlags: contradiction ? ['MATERIAL_PATTERN_VARIATION'] : [] });
    }
    return immutableCopy(annotations);
  }
}

module.exports = { CareerCalibrationAdapter, CAREER_CALIBRATION_ADAPTER_VERSION, SUPPORTED_EVENT_TYPES, CUSTOMER_DISPLAY_SAFETY_POLICY, strength };
