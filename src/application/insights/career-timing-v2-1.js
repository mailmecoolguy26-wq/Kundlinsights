'use strict';

// Career Timing V2.1 is a shadow-only methodology refinement. It reuses
// already-calculated V2 evidence, performs no astronomy or historical-event
// calibration, and is intentionally not connected to production consumers.
const { freeze } = require('../../synthesis/evidence-node');
const { canonicalPlanetId } = require('../../jyotish');
const { evaluateCareerGocharActivations } = require('./career-generalized-timing-engine');
const { careerPromise, d10Confirmation } = require('./career-timing-v2');

const CAREER_TIMING_V2_1_RULESET_VERSION = 'career-timing-v2.1-shadow-1';
const CAREER_TIMING_V2_1_AGREEMENT_CONTRACT_VERSION = 'career-timing-v2.1-agreement-1';
const AGREEMENT_UNITS = Object.freeze(['D1_CAREER_PROMISE', 'MAHADASHA_ACTIVATION', 'ANTARDASHA_ACTIVATION', 'PRATYANTAR_REFINEMENT', 'D10_CONFIRMATION', 'JUPITER_TRANSIT_CONFIRMATION', 'SATURN_TRANSIT_CONFIRMATION']);
const DIRECT_REASONS = new Set(['D1_H10_LORD', 'D1_H10_OCCUPANT']);
const SUPPORTED_STATES = new Set(['SUPPORTIVE', 'SUPPORTIVE_WITH_CONDITIONS', 'MIXED', 'CAUTIOUS']);
const STATE_RANK = Object.freeze({ SUPPORTIVE: 4, SUPPORTIVE_WITH_CONDITIONS: 3, MIXED: 2, CAUTIOUS: 1, INSUFFICIENT_EVIDENCE: 0 });
const CONVERGENCE_RANK = Object.freeze({ STRONG_CONVERGENCE: 3, PARTIAL_CONVERGENCE: 2, WEAK_CONVERGENCE: 1, NO_CONVERGENCE: 0 });
const TRANSIT_RANK = Object.freeze({ DUAL_CONFIRMATION: 2, SINGLE_CONFIRMATION: 1, NO_CONFIRMATION: 0 });

const validInterval = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Number.isFinite(Date.parse(value.start)) && Number.isFinite(Date.parse(value.end)) && Date.parse(value.start) < Date.parse(value.end);
const intersects = (left, right) => validInterval(left) && validInterval(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const activeAt = (value, start, end) => validInterval(value) && Date.parse(value.start) <= Date.parse(start) && Date.parse(value.end) >= Date.parse(end);
const unique = (values) => [...new Set(values)].sort();
const safeId = (value) => encodeURIComponent(String(value));
const clipped = (value, horizon) => intersects(value, horizon) ? {
  start: Date.parse(value.start) > Date.parse(horizon.start) ? value.start : horizon.start,
  end: Date.parse(value.end) < Date.parse(horizon.end) ? value.end : horizon.end,
} : null;

function classifyLevel(periods, name, relevant) {
  const item = (periods || []).find((value) => value && value.level === name);
  const planet = item && canonicalPlanetId(item.lord);
  if (!planet) return freeze({ level: name, lord: null, relationship: 'UNAVAILABLE', state: 'UNAVAILABLE', evidence: freeze([]) });
  const factor = relevant.get(planet);
  if (!factor) return freeze({ level: name, lord: item.lord, relationship: 'UNRELATED', state: 'NOT_RELEVANT', evidence: freeze([]) });
  const relationship = factor.relevanceReasons.some((reason) => DIRECT_REASONS.has(reason)) ? 'DIRECTLY_ALIGNED' : 'CONNECTED';
  return freeze({ level: name, lord: item.lord, relationship, state: relationship === 'DIRECTLY_ALIGNED' ? 'ALIGNED' : 'CONNECTED', evidence: freeze(factor.relevanceReasons) });
}

function convergenceFor(md, ad) {
  const values = [md.relationship, ad.relationship];
  if (values.every((value) => value === 'DIRECTLY_ALIGNED')) return 'STRONG_CONVERGENCE';
  if (values.includes('DIRECTLY_ALIGNED') && values.includes('CONNECTED')) return 'PARTIAL_CONVERGENCE';
  if (values.some((value) => ['DIRECTLY_ALIGNED', 'CONNECTED'].includes(value))) return 'WEAK_CONVERGENCE';
  return 'NO_CONVERGENCE';
}

function dashaConvergence({ promise, activePeriods = [] } = {}) {
  const relevant = new Map((promise && promise.factors && promise.factors.relevantPlanets || []).map((item) => [canonicalPlanetId(item.planet), item]));
  const md = classifyLevel(activePeriods, 'MD', relevant);
  const ad = classifyLevel(activePeriods, 'AD', relevant);
  const rawPd = classifyLevel(activePeriods, 'PD', relevant);
  const convergence = convergenceFor(md, ad);
  const primaryEligible = Boolean(promise && promise.eligible && ['STRONG_CONVERGENCE', 'PARTIAL_CONVERGENCE'].includes(convergence));
  const pdRefinement = !primaryEligible ? rawPd.relationship === 'UNAVAILABLE' ? 'NOT_RELEVANT' : 'CONTEXT_ONLY'
    : rawPd.relationship === 'DIRECTLY_ALIGNED' ? 'PRIMARY_REFINEMENT'
      : rawPd.relationship === 'CONNECTED' ? 'CONFIRMING_REFINEMENT'
        : rawPd.relationship === 'UNAVAILABLE' ? 'NOT_RELEVANT' : 'NOT_RELEVANT';
  return freeze({
    md, ad, pd: freeze({ ...rawPd, refinementState: pdRefinement }), convergence, primaryEligible,
    support: convergence === 'STRONG_CONVERGENCE' ? 'STRONG_MD_AD_SUPPORT' : convergence === 'PARTIAL_CONVERGENCE' ? 'MODERATE_MD_AD_SUPPORT' : 'INSUFFICIENT_MD_AD_SUPPORT',
  });
}

function transitFor({ planet, activeIntervals, promise, d1Houses, dasha }) {
  const supplied = activeIntervals.filter((item) => item.planet === planet);
  if (!supplied.length) return freeze({ planet, state: 'UNAVAILABLE', activations: freeze([]), sourceIntervals: freeze([]) });
  const activations = evaluateCareerGocharActivations({
    careerNatalFactors: promise.factors,
    d1Houses,
    careerDashaActivation: { active: dasha.primaryEligible },
    d1CareerRelevant: promise.eligible,
    transitIntervals: supplied,
  }).filter((item) => item.transitPlanet === planet);
  return freeze({
    planet,
    state: activations.length ? 'ALIGNED' : 'NEUTRAL',
    activations,
    sourceIntervals: freeze(supplied.map((item) => freeze({ start: item.start, end: item.end, sign: item.sign, ...(typeof item.boundaryMethod === 'string' ? { boundaryMethod: item.boundaryMethod } : {}) }))),
  });
}

function transitConfirmation(transit) {
  const count = [transit.jupiter, transit.saturn].filter((item) => item.state === 'ALIGNED').length;
  return count === 2 ? 'DUAL_CONFIRMATION' : count === 1 ? 'SINGLE_CONFIRMATION' : 'NO_CONFIRMATION';
}

function agreementLevel(level) {
  if (!level || level.relationship === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (level.relationship === 'DIRECTLY_ALIGNED') return 'ALIGNED';
  if (level.relationship === 'CONNECTED') return 'CONDITIONAL';
  return 'CONTRADICTED';
}

function buildCareerTimingV21Agreement({ promiseState, dasha, d10, transit } = {}) {
  const units = [
    { unit: AGREEMENT_UNITS[0], state: ['STRONG', 'MODERATE'].includes(promiseState) ? 'ALIGNED' : promiseState === 'LIMITED' ? 'CONDITIONAL' : 'UNAVAILABLE' },
    { unit: AGREEMENT_UNITS[1], state: agreementLevel(dasha && dasha.md) },
    { unit: AGREEMENT_UNITS[2], state: agreementLevel(dasha && dasha.ad) },
    { unit: AGREEMENT_UNITS[3], state: dasha && dasha.pd.refinementState === 'PRIMARY_REFINEMENT' ? 'ALIGNED' : dasha && dasha.pd.refinementState === 'CONFIRMING_REFINEMENT' ? 'CONDITIONAL' : dasha && dasha.pd.relationship === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[4], state: d10 && d10.state === 'CONFIRMS' ? 'ALIGNED' : d10 && d10.state === 'MIXED' ? 'CONTRADICTED' : d10 && d10.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[5], state: transit && transit.jupiter.state === 'ALIGNED' ? 'ALIGNED' : transit && transit.jupiter.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[6], state: transit && transit.saturn.state === 'ALIGNED' ? 'ALIGNED' : transit && transit.saturn.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
  ].map((item) => freeze(item));
  const count = (state) => units.filter((item) => item.state === state).length;
  return freeze({ contractVersion: CAREER_TIMING_V2_1_AGREEMENT_CONTRACT_VERSION, units: freeze(units), evaluatedCount: units.length - count('UNAVAILABLE'), alignedCount: count('ALIGNED'), conditionalCount: count('CONDITIONAL'), contradictedCount: count('CONTRADICTED'), unavailableCount: count('UNAVAILABLE') });
}

function candidateState({ promise, dasha, d10, confirmation }) {
  if (!promise.eligible || !dasha.primaryEligible || confirmation === 'NO_CONFIRMATION') return 'INSUFFICIENT_EVIDENCE';
  if (d10.state === 'MIXED') return 'MIXED';
  if (dasha.convergence === 'STRONG_CONVERGENCE' && confirmation === 'DUAL_CONFIRMATION') return 'SUPPORTIVE';
  return 'SUPPORTIVE_WITH_CONDITIONS';
}

function cautionsFor({ dasha, d10, transit }) {
  return freeze([
    dasha.convergence === 'PARTIAL_CONVERGENCE' ? 'PARTIAL_MD_AD_CONVERGENCE' : null,
    !['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT'].includes(dasha.pd.refinementState) ? 'PD_NOT_CAREER_REFINING' : null,
    d10.state !== 'CONFIRMS' ? 'D10_NOT_CONFIRMING' : null,
    transit.jupiter.state !== 'ALIGNED' ? 'JUPITER_NOT_CONFIRMING' : null,
    transit.saturn.state !== 'ALIGNED' ? 'SATURN_NOT_CONFIRMING' : null,
  ].filter(Boolean));
}

function customerFingerprint(candidate) {
  return JSON.stringify({ state: candidate.state, promise: candidate.promiseState, md: [candidate.dasha.md.lord, candidate.dasha.md.relationship], ad: [candidate.dasha.ad.lord, candidate.dasha.ad.relationship], convergence: candidate.dasha.convergence, d10: candidate.d10.state, transitConfirmation: candidate.transitConfirmation, cautions: candidate.cautions.filter((item) => item !== 'PD_NOT_CAREER_REFINING') });
}

function internalPhase(candidate) {
  return freeze({ start: candidate.start, end: candidate.end, state: candidate.state, dasha: candidate.dasha, d10: candidate.d10, transit: candidate.transit, transitConfirmation: candidate.transitConfirmation, agreement: candidate.agreement, cautions: candidate.cautions });
}

function mergePlanet(left, right) {
  const activations = new Map();
  for (const item of [...left.activations, ...right.activations]) activations.set(`${item.transitPlanet}|${item.targetType}|${item.targetPlanet || ''}|${item.targetSign}|${item.activationType}|${item.start}|${item.end}`, item);
  return freeze({ ...left, activations: freeze([...activations.values()]), sourceIntervals: freeze([...(left.sourceIntervals || []), ...(right.sourceIntervals || [])]) });
}

function coalesceCareerTimingV21Candidates(candidates = []) {
  const output = [];
  for (const candidate of candidates) {
    const previous = output.at(-1);
    if (!previous || previous.end !== candidate.start || customerFingerprint(previous) !== customerFingerprint(candidate)) {
      output.push(freeze({ ...candidate, internalPhases: freeze(candidate.internalPhases || [internalPhase(candidate)]) }));
      continue;
    }
    output[output.length - 1] = freeze({ ...previous, candidateId: `career-v2.1:${safeId(previous.start)}:${safeId(candidate.end)}:coalesced`, end: candidate.end, transit: freeze({ jupiter: mergePlanet(previous.transit.jupiter, candidate.transit.jupiter), saturn: mergePlanet(previous.transit.saturn, candidate.transit.saturn) }), internalPhases: freeze([...previous.internalPhases, internalPhase(candidate)]) });
  }
  return freeze(output);
}

function selectCareerTimingV21Candidates({ candidates = [], referenceInstant } = {}) {
  const instant = Date.parse(referenceInstant);
  if (!Number.isFinite(instant)) throw new TypeError('Career Timing V2.1 selector requires a valid reference instant.');
  const supported = candidates.filter((candidate) => SUPPORTED_STATES.has(candidate.state));
  const rank = (left, right) => (STATE_RANK[right.state] - STATE_RANK[left.state]) || (CONVERGENCE_RANK[right.dasha.convergence] - CONVERGENCE_RANK[left.dasha.convergence]) || (TRANSIT_RANK[right.transitConfirmation] - TRANSIT_RANK[left.transitConfirmation]) || left.start.localeCompare(right.start) || left.candidateId.localeCompare(right.candidateId);
  const active = supported.filter((candidate) => Date.parse(candidate.start) <= instant && instant < Date.parse(candidate.end)).sort(rank)[0] || null;
  const next = supported.filter((candidate) => Date.parse(candidate.start) > instant).sort((left, right) => left.start.localeCompare(right.start) || rank(left, right))[0] || null;
  return freeze({ activeCandidateId: active && active.candidateId || null, nextCandidateId: next && next.candidateId || null });
}

function buildCareerTimingV21({ d1Houses, dashaIntervals = [], transitIntervals = [], d10Structure = null, d10Corroboration = null, forecastStart, forecastEnd, calculationInstant = forecastStart, referenceInstant = calculationInstant } = {}) {
  const horizon = { start: forecastStart, end: forecastEnd };
  if (!validInterval(horizon) || !Number.isFinite(Date.parse(calculationInstant))) throw new TypeError('Career Timing V2.1 requires valid calculation and forecast instants.');
  const promise = careerPromise({ d1Houses });
  const d10 = d10Confirmation({ d10Structure, d10Corroboration });
  const dashas = dashaIntervals.map((item) => ({ ...item, bounds: clipped(item, horizon) })).filter((item) => item.bounds && Array.isArray(item.activePeriods));
  const transits = transitIntervals.map((item) => ({ ...item, bounds: clipped(item, horizon) })).filter((item) => item.bounds && ['Jupiter', 'Saturn'].includes(item.planet));
  const boundaries = unique([horizon.start, horizon.end, ...dashas.flatMap((item) => [item.bounds.start, item.bounds.end]), ...transits.flatMap((item) => [item.bounds.start, item.bounds.end])]);
  const atomic = []; const backgroundActivations = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]; const end = boundaries[index + 1];
    if (Date.parse(start) >= Date.parse(end)) continue;
    for (const row of dashas.filter((item) => activeAt(item.bounds, start, end))) {
      const dasha = dashaConvergence({ promise, activePeriods: row.activePeriods });
      if (!dasha.primaryEligible) {
        if (['DIRECTLY_ALIGNED', 'CONNECTED'].includes(dasha.md.relationship) || ['DIRECTLY_ALIGNED', 'CONNECTED'].includes(dasha.ad.relationship)) backgroundActivations.push(freeze({ start, end, dasha, classification: 'BACKGROUND_CAREER_ACTIVATION', customerFacing: false }));
        continue;
      }
      const activeIntervals = transits.filter((item) => activeAt(item.bounds, start, end)).map((item) => ({ ...item, start, end }));
      const transit = freeze({ jupiter: transitFor({ planet: 'Jupiter', activeIntervals, promise, d1Houses, dasha }), saturn: transitFor({ planet: 'Saturn', activeIntervals, promise, d1Houses, dasha }) });
      const confirmation = transitConfirmation(transit);
      const state = candidateState({ promise, dasha, d10, confirmation });
      if (state === 'INSUFFICIENT_EVIDENCE') continue;
      const agreement = buildCareerTimingV21Agreement({ promiseState: promise.state, dasha, d10, transit });
      const candidate = freeze({ candidateId: `career-v2.1:${safeId(start)}:${safeId(end)}:${safeId(dasha.md.lord)}:${safeId(dasha.ad.lord)}:${safeId(dasha.pd.lord)}`, start, end, promiseState: promise.state, dasha, d10, transit, transitConfirmation: confirmation, state, cautions: cautionsFor({ dasha, d10, transit }), agreement, internalEvidence: freeze({ promiseReasons: promise.reasons, historicalCalibrationIncluded: false, ashtakavargaIncluded: false }), provenance: freeze({ rulesetVersion: CAREER_TIMING_V2_1_RULESET_VERSION, intervalSemantics: 'HALF_OPEN', sourceDashaInterval: freeze({ start: row.start, end: row.end }), transitEvidenceAuthority: 'SUPPLIED_REFINED_INTERVALS' }) });
      atomic.push(freeze({ ...candidate, internalPhases: freeze([internalPhase(candidate)]) }));
    }
  }
  atomic.sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end) || left.candidateId.localeCompare(right.candidateId));
  const candidates = coalesceCareerTimingV21Candidates(atomic);
  return freeze({ rulesetVersion: CAREER_TIMING_V2_1_RULESET_VERSION, calculationInstant, forecastStart, forecastEnd, promise, atomicCandidateCount: atomic.length, candidates, backgroundActivations: freeze(backgroundActivations), selected: selectCareerTimingV21Candidates({ candidates, referenceInstant }), evidenceAgreementContractVersion: CAREER_TIMING_V2_1_AGREEMENT_CONTRACT_VERSION, provenance: freeze({ mode: 'SHADOW_ONLY', authoritative: false, historicalCalibrationIncluded: false, astronomyCalculatedHere: false, productionIntegrated: false }) });
}

module.exports = { CAREER_TIMING_V2_1_RULESET_VERSION, CAREER_TIMING_V2_1_AGREEMENT_CONTRACT_VERSION, dashaConvergence, transitConfirmation, buildCareerTimingV21Agreement, coalesceCareerTimingV21Candidates, selectCareerTimingV21Candidates, buildCareerTimingV21 };
