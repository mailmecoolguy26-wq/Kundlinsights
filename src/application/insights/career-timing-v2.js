'use strict';

// Career Timing V2 Phase 1 is an internal, deterministic shadow contract. It
// consumes already-calculated D1, Dasha, D10 and transit facts and performs no
// astronomy, persistence, historical calibration, routing or customer output.
const { freeze } = require('../../synthesis/evidence-node');
const { canonicalPlanetId } = require('../../jyotish');
const {
  resolveCareerNatalFactors,
  evaluateCareerGocharActivations,
} = require('./career-generalized-timing-engine');

const CAREER_TIMING_V2_RULESET_VERSION = 'career-timing-v2-shadow-1';
const CAREER_TIMING_V2_AGREEMENT_CONTRACT_VERSION = 'career-timing-v2-agreement-1';
const SUPPORTED_STATES = new Set(['SUPPORTIVE', 'SUPPORTIVE_WITH_CONDITIONS', 'MIXED', 'CAUTIOUS']);
const STATE_RANK = Object.freeze({ SUPPORTIVE: 4, SUPPORTIVE_WITH_CONDITIONS: 3, MIXED: 2, CAUTIOUS: 1, INSUFFICIENT_EVIDENCE: 0 });
const AGREEMENT_STATES = new Set(['ALIGNED', 'CONDITIONAL', 'CONTRADICTED', 'UNAVAILABLE']);
const AGREEMENT_UNITS = Object.freeze(['D1_CAREER_PROMISE', 'MAHADASHA_ACTIVATION', 'ANTARDASHA_ACTIVATION', 'PRATYANTAR_REFINEMENT', 'D10_CONFIRMATION', 'JUPITER_TRANSIT_CONFIRMATION', 'SATURN_TRANSIT_CONFIRMATION']);

const validInterval = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Number.isFinite(Date.parse(value.start)) && Number.isFinite(Date.parse(value.end)) && Date.parse(value.start) < Date.parse(value.end);
const intersects = (left, right) => validInterval(left) && validInterval(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const unique = (values) => [...new Set(values)].sort();
const clipped = (value, horizon) => intersects(value, horizon) ? {
  start: Date.parse(value.start) > Date.parse(horizon.start) ? value.start : horizon.start,
  end: Date.parse(value.end) < Date.parse(horizon.end) ? value.end : horizon.end,
} : null;
const activeAt = (value, start, end) => validInterval(value) && Date.parse(value.start) <= Date.parse(start) && Date.parse(value.end) >= Date.parse(end);
const safeId = (value) => encodeURIComponent(String(value));

function careerPromise({ d1Houses } = {}) {
  let factors;
  try { factors = resolveCareerNatalFactors({ d1Houses }); }
  catch (_) {
    return freeze({ state: 'INSUFFICIENT', eligible: false, reasons: freeze([{ code: 'D1_H10_EVIDENCE_UNAVAILABLE' }]), factors: null });
  }
  const reasons = [{ code: 'H10_LORD_AVAILABLE', planet: factors.tenthLord, natalHouse: factors.tenthLordNatalHouse }];
  if (factors.tenthHouseOccupants.length) reasons.push({ code: 'H10_OCCUPANT_CONNECTION', planets: factors.tenthHouseOccupants });
  if (factors.tenthHouseAspectors.length) reasons.push({ code: 'H10_APPROVED_ASPECT_CONNECTION', planets: unique(factors.tenthHouseAspectors.map((item) => item.planet)) });
  if (factors.tenthLordConjunctions.length) reasons.push({ code: 'H10_LORD_CONJUNCTION_CONNECTION', planets: factors.tenthLordConjunctions });
  if (factors.tenthLordAspectors.length) reasons.push({ code: 'H10_LORD_APPROVED_ASPECT_CONNECTION', planets: unique(factors.tenthLordAspectors.map((item) => item.planet)) });
  // The approved repository rules establish an H10-lord seed and factual
  // additional connections, but do not define a defensible STRONG threshold.
  const state = reasons.length > 1 ? 'MODERATE' : 'LIMITED';
  return freeze({ state, eligible: state === 'MODERATE', reasons: freeze(reasons.map(freeze)), factors });
}

function level(periods, name, relevant) {
  const item = (periods || []).find((value) => value && value.level === name);
  if (!item || !canonicalPlanetId(item.lord)) return freeze({ level: name, lord: null, state: 'UNAVAILABLE', evidence: freeze([]) });
  const planet = canonicalPlanetId(item.lord);
  const factor = relevant.get(planet);
  return freeze({ level: name, lord: item.lord, state: factor ? 'ALIGNED' : 'NOT_RELEVANT', evidence: freeze(factor ? factor.relevanceReasons : []) });
}

function dashaHierarchy({ promise, activePeriods = [] } = {}) {
  const relevant = new Map((promise && promise.factors && promise.factors.relevantPlanets || []).map((item) => [canonicalPlanetId(item.planet), item]));
  const md = level(activePeriods, 'MD', relevant);
  const ad = level(activePeriods, 'AD', relevant);
  const rawPd = level(activePeriods, 'PD', relevant);
  const aligned = [md, ad].filter((item) => item.state === 'ALIGNED').length;
  // Phase 1's narrow rule allows one aligned primary period and one evaluated
  // neutral period. Two unrelated primary periods are never eligible.
  const primaryEligible = Boolean(promise && promise.eligible && aligned >= 1 && md.state !== 'UNAVAILABLE' && ad.state !== 'UNAVAILABLE');
  const support = !primaryEligible ? 'INSUFFICIENT_MD_AD_SUPPORT' : aligned === 2 ? 'STRONG_MD_AD_SUPPORT' : 'MODERATE_MD_AD_SUPPORT';
  const pdState = rawPd.state === 'ALIGNED'
    ? primaryEligible ? aligned === 2 ? 'PRIMARY_REFINEMENT' : 'CONFIRMING_REFINEMENT' : 'CONTEXT_ONLY'
    : rawPd.state === 'UNAVAILABLE' ? 'NOT_RELEVANT' : 'NOT_RELEVANT';
  const pd = freeze({ ...rawPd, refinementState: pdState });
  return freeze({ md, ad, pd, primaryEligible, support });
}

function d10Confirmation({ d10Structure = null, d10Corroboration = null } = {}) {
  if (d10Corroboration && d10Corroboration.chart === 'D10' && Array.isArray(d10Corroboration.themes) && d10Corroboration.themes.length) {
    return freeze({ state: 'CONFIRMS', reasons: freeze([{ code: 'D10_EXISTING_CORROBORATION', themeCount: d10Corroboration.themes.length }]) });
  }
  if (d10Structure && d10Structure.chart === 'D10' && d10Structure.lagna && d10Structure.tenthHouse && d10Structure.shani) {
    return freeze({ state: 'NEUTRAL', reasons: freeze([{ code: 'D10_FACTS_AVAILABLE_WITHOUT_APPROVED_CONFIRMATION' }]) });
  }
  return freeze({ state: 'UNAVAILABLE', reasons: freeze([{ code: 'D10_EVIDENCE_UNAVAILABLE' }]) });
}

function transitFor({ planet, activeIntervals, promise, d1Houses, dasha }) {
  const supplied = activeIntervals.filter((item) => item.planet === planet);
  if (!supplied.length) return freeze({ planet, state: 'UNAVAILABLE', activations: freeze([]) });
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
    sourceIntervals: freeze(supplied.map((item) => freeze({
      start: item.start,
      end: item.end,
      sign: item.sign,
      ...(typeof item.boundaryMethod === 'string' ? { boundaryMethod: item.boundaryMethod } : {}),
    }))),
  });
}

function agreementState(value) {
  if (!AGREEMENT_STATES.has(value)) throw new TypeError('Invalid Career Timing V2 agreement state.');
  return value;
}
function buildCareerTimingV2Agreement({ promiseState, dasha, d10, transit } = {}) {
  const units = [
    { unit: AGREEMENT_UNITS[0], state: promiseState === 'STRONG' || promiseState === 'MODERATE' ? 'ALIGNED' : promiseState === 'LIMITED' ? 'CONDITIONAL' : 'UNAVAILABLE' },
    { unit: AGREEMENT_UNITS[1], state: dasha && dasha.md.state === 'ALIGNED' ? 'ALIGNED' : dasha && dasha.md.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[2], state: dasha && dasha.ad.state === 'ALIGNED' ? 'ALIGNED' : dasha && dasha.ad.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[3], state: dasha && ['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT'].includes(dasha.pd.refinementState) ? 'ALIGNED' : dasha && dasha.pd.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[4], state: d10 && d10.state === 'CONFIRMS' ? 'ALIGNED' : d10 && d10.state === 'MIXED' ? 'CONTRADICTED' : d10 && d10.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[5], state: transit && transit.jupiter.state === 'ALIGNED' ? 'ALIGNED' : transit && transit.jupiter.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
    { unit: AGREEMENT_UNITS[6], state: transit && transit.saturn.state === 'ALIGNED' ? 'ALIGNED' : transit && transit.saturn.state === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'CONDITIONAL' },
  ].map((item) => freeze({ unit: item.unit, state: agreementState(item.state) }));
  const count = (state) => units.filter((item) => item.state === state).length;
  return freeze({
    contractVersion: CAREER_TIMING_V2_AGREEMENT_CONTRACT_VERSION,
    units: freeze(units),
    evaluatedCount: units.length - count('UNAVAILABLE'),
    alignedCount: count('ALIGNED'),
    conditionalCount: count('CONDITIONAL'),
    contradictedCount: count('CONTRADICTED'),
    unavailableCount: count('UNAVAILABLE'),
  });
}

function candidateState({ promise, dasha, d10, transit }) {
  if (!promise.eligible || !dasha.primaryEligible || !['ALIGNED'].includes(transit.jupiter.state) && !['ALIGNED'].includes(transit.saturn.state)) return 'INSUFFICIENT_EVIDENCE';
  if (d10.state === 'MIXED') return 'MIXED';
  const bothPrimary = dasha.md.state === 'ALIGNED' && dasha.ad.state === 'ALIGNED';
  const pdPrimary = dasha.pd.refinementState === 'PRIMARY_REFINEMENT';
  const dualTransit = transit.jupiter.state === 'ALIGNED' && transit.saturn.state === 'ALIGNED';
  if (bothPrimary && pdPrimary && dualTransit && d10.state === 'CONFIRMS') return 'SUPPORTIVE';
  return 'SUPPORTIVE_WITH_CONDITIONS';
}

function cautionsFor({ dasha, d10, transit }) {
  return freeze([
    dasha.md.state !== 'ALIGNED' ? 'MAHADASHA_NOT_CAREER_ALIGNED' : null,
    dasha.ad.state !== 'ALIGNED' ? 'ANTARDASHA_NOT_CAREER_ALIGNED' : null,
    !['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT'].includes(dasha.pd.refinementState) ? 'PD_NOT_CAREER_REFINING' : null,
    d10.state !== 'CONFIRMS' ? 'D10_NOT_CONFIRMING' : null,
    transit.jupiter.state !== 'ALIGNED' ? 'JUPITER_NOT_CONFIRMING' : null,
    transit.saturn.state !== 'ALIGNED' ? 'SATURN_NOT_CONFIRMING' : null,
  ].filter(Boolean));
}

function materialFingerprint(candidate) {
  const activation = (value) => value.activations.map((item) => `${item.targetType}|${item.targetPlanet || ''}|${item.activationType}`).sort();
  return JSON.stringify({
    state: candidate.state,
    promise: candidate.promiseState,
    md: [candidate.dasha.md.lord, candidate.dasha.md.state],
    ad: [candidate.dasha.ad.lord, candidate.dasha.ad.state],
    pd: [candidate.dasha.pd.lord, candidate.dasha.pd.refinementState],
    d10: candidate.d10.state,
    jupiter: [candidate.transit.jupiter.state, activation(candidate.transit.jupiter)],
    saturn: [candidate.transit.saturn.state, activation(candidate.transit.saturn)],
    cautions: candidate.cautions,
  });
}

function internalPhase(candidate) {
  return freeze({
    start: candidate.start,
    end: candidate.end,
    state: candidate.state,
    dasha: candidate.dasha,
    d10: candidate.d10,
    transit: candidate.transit,
    agreement: candidate.agreement,
    cautions: candidate.cautions,
    evidenceFingerprint: materialFingerprint(candidate),
  });
}

function mergePlanetTransit(left, right) {
  const activations = new Map();
  for (const item of [...left.activations, ...right.activations]) {
    const key = `${item.transitPlanet}|${item.targetType}|${item.targetPlanet || ''}|${item.targetSign}|${item.activationType}`;
    const prior = activations.get(key);
    activations.set(key, prior ? freeze({
      ...prior,
      start: prior.start < item.start ? prior.start : item.start,
      end: prior.end > item.end ? prior.end : item.end,
    }) : item);
  }
  return freeze({
    ...left,
    activations: freeze([...activations.values()].sort((a, b) => `${a.start}|${a.targetType}|${a.activationType}`.localeCompare(`${b.start}|${b.targetType}|${b.activationType}`))),
    sourceIntervals: freeze([...(left.sourceIntervals || []), ...(right.sourceIntervals || [])]),
  });
}

function coalesceCareerTimingV2Candidates(candidates = []) {
  const output = [];
  for (const candidate of candidates) {
    const previous = output.at(-1);
    if (!previous || previous.end !== candidate.start || materialFingerprint(previous) !== materialFingerprint(candidate)) {
      output.push(freeze({ ...candidate, internalPhases: freeze(candidate.internalPhases || [internalPhase(candidate)]) }));
      continue;
    }
    output[output.length - 1] = freeze({
      ...previous,
      candidateId: `career-v2:${safeId(previous.start)}:${safeId(candidate.end)}:coalesced`,
      end: candidate.end,
      transit: freeze({
        jupiter: mergePlanetTransit(previous.transit.jupiter, candidate.transit.jupiter),
        saturn: mergePlanetTransit(previous.transit.saturn, candidate.transit.saturn),
      }),
      internalPhases: freeze([...previous.internalPhases, internalPhase(candidate)]),
    });
  }
  return freeze(output);
}

function selectCareerTimingV2Candidates({ candidates = [], referenceInstant } = {}) {
  const instant = Date.parse(referenceInstant);
  if (!Number.isFinite(instant)) throw new TypeError('Career Timing V2 selector requires a valid reference instant.');
  const supported = candidates.filter((candidate) => SUPPORTED_STATES.has(candidate.state));
  const pdRank = (candidate) => candidate.dasha.pd.refinementState === 'PRIMARY_REFINEMENT' ? 2 : candidate.dasha.pd.refinementState === 'CONFIRMING_REFINEMENT' ? 1 : 0;
  const rank = (left, right) => (STATE_RANK[right.state] - STATE_RANK[left.state]) || (pdRank(right) - pdRank(left)) || left.start.localeCompare(right.start) || left.candidateId.localeCompare(right.candidateId);
  const active = supported.filter((candidate) => Date.parse(candidate.start) <= instant && instant < Date.parse(candidate.end)).sort(rank)[0] || null;
  const next = supported.filter((candidate) => Date.parse(candidate.start) > instant).sort((left, right) => left.start.localeCompare(right.start) || rank(left, right))[0] || null;
  return freeze({ activeCandidateId: active && active.candidateId || null, nextCandidateId: next && next.candidateId || null });
}

function buildCareerTimingV2({ d1Houses, dashaIntervals = [], transitIntervals = [], d10Structure = null, d10Corroboration = null, forecastStart, forecastEnd, calculationInstant = forecastStart, referenceInstant = calculationInstant } = {}) {
  const horizon = { start: forecastStart, end: forecastEnd };
  if (!validInterval(horizon) || !Number.isFinite(Date.parse(calculationInstant))) throw new TypeError('Career Timing V2 requires valid calculation and forecast instants.');
  const promise = careerPromise({ d1Houses });
  const d10 = d10Confirmation({ d10Structure, d10Corroboration });
  const dashas = dashaIntervals.map((item) => ({ ...item, bounds: clipped(item, horizon) })).filter((item) => item.bounds && Array.isArray(item.activePeriods));
  const transits = transitIntervals.map((item) => ({ ...item, bounds: clipped(item, horizon) })).filter((item) => item.bounds && ['Jupiter', 'Saturn'].includes(item.planet));
  const boundaries = unique([horizon.start, horizon.end, ...dashas.flatMap((item) => [item.bounds.start, item.bounds.end]), ...transits.flatMap((item) => [item.bounds.start, item.bounds.end])]);
  const atomic = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index]; const end = boundaries[index + 1];
    if (Date.parse(start) >= Date.parse(end)) continue;
    const dashaRows = dashas.filter((item) => activeAt(item.bounds, start, end));
    if (!dashaRows.length) continue;
    for (const row of dashaRows) {
      const dasha = dashaHierarchy({ promise, activePeriods: row.activePeriods });
      if (!dasha.primaryEligible) continue;
      const activeIntervals = transits.filter((item) => activeAt(item.bounds, start, end)).map((item) => ({ ...item, start, end }));
      const transit = freeze({
        jupiter: transitFor({ planet: 'Jupiter', activeIntervals, promise, d1Houses, dasha }),
        saturn: transitFor({ planet: 'Saturn', activeIntervals, promise, d1Houses, dasha }),
      });
      const state = candidateState({ promise, dasha, d10, transit });
      if (state === 'INSUFFICIENT_EVIDENCE') continue;
      const agreement = buildCareerTimingV2Agreement({ promiseState: promise.state, dasha, d10, transit });
      const candidateId = `career-v2:${safeId(start)}:${safeId(end)}:${safeId(dasha.md.lord)}:${safeId(dasha.ad.lord)}:${safeId(dasha.pd.lord)}`;
      const candidate = {
        candidateId, start, end, promiseState: promise.state, dasha, d10, transit, state,
        cautions: cautionsFor({ dasha, d10, transit }), agreement,
        internalEvidence: freeze({ promiseReasons: promise.reasons, historicalCalibrationIncluded: false, ashtakavargaIncluded: false }),
        provenance: freeze({ rulesetVersion: CAREER_TIMING_V2_RULESET_VERSION, intervalSemantics: 'HALF_OPEN', sourceDashaInterval: freeze({ start: row.start, end: row.end }), transitEvidenceAuthority: 'SUPPLIED_REFINED_INTERVALS' }),
      };
      atomic.push(freeze({ ...candidate, internalPhases: freeze([internalPhase(candidate)]) }));
    }
  }
  atomic.sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end) || left.candidateId.localeCompare(right.candidateId));
  const candidates = coalesceCareerTimingV2Candidates(atomic);
  const selected = selectCareerTimingV2Candidates({ candidates, referenceInstant });
  return freeze({
    rulesetVersion: CAREER_TIMING_V2_RULESET_VERSION,
    calculationInstant,
    forecastStart,
    forecastEnd,
    promise,
    candidates,
    selected,
    evidenceAgreementContractVersion: CAREER_TIMING_V2_AGREEMENT_CONTRACT_VERSION,
    provenance: freeze({ mode: 'SHADOW_ONLY', authoritative: false, historicalCalibrationIncluded: false, astronomyCalculatedHere: false }),
  });
}

function legacyWindow(value) {
  if (!value || typeof value.startDate !== 'string' || typeof value.endDate !== 'string' || Date.parse(value.startDate) >= Date.parse(value.endDate)) return null;
  return { id: value.candidateId || null, start: value.startDate, end: value.endDate, state: value.evidenceState || null };
}
function selectLegacy(periods, referenceInstant) {
  const instant = Date.parse(referenceInstant); const valid = periods.map(legacyWindow).filter(Boolean).sort((a, b) => a.start.localeCompare(b.start));
  return { first: valid[0] || null, active: valid.find((item) => Date.parse(item.start) <= instant && instant < Date.parse(item.end)) || null, next: valid.find((item) => Date.parse(item.start) > instant) || null, count: valid.length };
}
function overlapSummary(left, right) {
  if (!left || !right) return freeze({ overlaps: false, overlapMilliseconds: 0 });
  const start = Math.max(Date.parse(left.start), Date.parse(right.start)); const end = Math.min(Date.parse(left.end), Date.parse(right.end));
  return freeze({ overlaps: start < end, overlapMilliseconds: Math.max(0, end - start) });
}
function compareLegacyCareerTimingWithV2({ legacyPeriods = [], v2Result, referenceInstant } = {}) {
  if (!v2Result || v2Result.rulesetVersion !== CAREER_TIMING_V2_RULESET_VERSION) throw new TypeError('Career Timing V2 shadow comparison requires a V2 result.');
  const legacy = selectLegacy(legacyPeriods, referenceInstant);
  const byId = new Map(v2Result.candidates.map((item) => [item.candidateId, item]));
  const active = byId.get(v2Result.selected.activeCandidateId) || null; const next = byId.get(v2Result.selected.nextCandidateId) || null;
  return freeze({
    mode: 'SHADOW_ONLY',
    legacy: freeze(legacy),
    v2: freeze({ active, next, count: v2Result.candidates.length }),
    activeOverlap: overlapSummary(legacy.active, active),
    nextOverlap: overlapSummary(legacy.next, next),
    stateDifferences: freeze({ active: legacy.active && active ? `${legacy.active.state || 'UNKNOWN'}->${active.state}` : null, next: legacy.next && next ? `${legacy.next.state || 'UNKNOWN'}->${next.state}` : null }),
    eligibilityDifferences: freeze({ legacyHasCandidate: legacy.count > 0, v2HasCandidate: v2Result.candidates.length > 0 }),
  });
}

module.exports = {
  CAREER_TIMING_V2_RULESET_VERSION,
  CAREER_TIMING_V2_AGREEMENT_CONTRACT_VERSION,
  AGREEMENT_UNITS,
  careerPromise,
  dashaHierarchy,
  d10Confirmation,
  buildCareerTimingV2Agreement,
  coalesceCareerTimingV2Candidates,
  selectCareerTimingV2Candidates,
  buildCareerTimingV2,
  compareLegacyCareerTimingWithV2,
};
