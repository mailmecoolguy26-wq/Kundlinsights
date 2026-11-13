'use strict';

// V2.3 is refinement-only. Its sole eligibility authority is a supplied V2.2
// result; it performs no natal, Dasha, transit, or historical calculation.
const { freeze } = require('../../synthesis/evidence-node');

const CAREER_TIMING_V2_3_RULESET_VERSION = 'career-timing-v2.3-shadow-1';
const ELIGIBILITY_RULESET_VERSION = 'career-timing-v2.2-shadow-1';
const TIERS = Object.freeze(['PEAK', 'STRONG', 'MODERATE', 'BASE']);
const TIER_RANK = Object.freeze({ PEAK: 4, STRONG: 3, MODERATE: 2, BASE: 1 });
const TRANSIT_RANK = Object.freeze({ DUAL_STRONG: 3, JUPITER_ONLY: 2, SATURN_ONLY: 2, UNAVAILABLE: 0 });
const PD_RANK = Object.freeze({ PEAK_SUPPORT: 3, SUPPORT: 2, NEUTRAL: 1, UNAVAILABLE: 0 });
const D10_RANK = Object.freeze({ CONFIRMS: 3, NEUTRAL: 2, MIXED: 1, UNAVAILABLE: 0 });

const validInterval = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Number.isFinite(Date.parse(value.start)) && Number.isFinite(Date.parse(value.end)) && Date.parse(value.start) < Date.parse(value.end);
const safeId = (value) => encodeURIComponent(String(value));

function pdRefinement(phase) {
  const pd = phase && phase.dasha && phase.dasha.pd;
  if (!pd || pd.relationship === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (pd.relationship === 'DIRECTLY_ALIGNED' || pd.refinementState === 'PRIMARY_REFINEMENT') return 'PEAK_SUPPORT';
  if (pd.relationship === 'CONNECTED' || pd.refinementState === 'CONFIRMING_REFINEMENT') return 'SUPPORT';
  return 'NEUTRAL';
}

function transitRefinement(phase) {
  const jupiter = phase && phase.transit && phase.transit.jupiter && phase.transit.jupiter.state;
  const saturn = phase && phase.transit && phase.transit.saturn && phase.transit.saturn.state;
  if (jupiter === 'UNAVAILABLE' && saturn === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (jupiter === 'ALIGNED' && saturn === 'ALIGNED') return 'DUAL_STRONG';
  if (jupiter === 'ALIGNED') return 'JUPITER_ONLY';
  if (saturn === 'ALIGNED') return 'SATURN_ONLY';
  return 'UNAVAILABLE';
}

function d10Refinement(phase) {
  const state = phase && phase.d10 && phase.d10.state;
  return ['CONFIRMS', 'NEUTRAL', 'MIXED', 'UNAVAILABLE'].includes(state) ? state : 'UNAVAILABLE';
}

function refinementTier({ pd, transit, d10 }) {
  if (pd === 'PEAK_SUPPORT' && d10 === 'CONFIRMS' && transit === 'DUAL_STRONG') return 'PEAK';
  if (d10 === 'CONFIRMS' && (pd === 'PEAK_SUPPORT' && ['JUPITER_ONLY', 'SATURN_ONLY'].includes(transit) || pd === 'SUPPORT' && transit === 'DUAL_STRONG')) return 'STRONG';
  if (['DUAL_STRONG', 'JUPITER_ONLY', 'SATURN_ONLY'].includes(transit) && (d10 === 'CONFIRMS' && ['SUPPORT', 'NEUTRAL', 'UNAVAILABLE'].includes(pd) || ['CONFIRMS', 'NEUTRAL'].includes(d10) && ['PEAK_SUPPORT', 'SUPPORT'].includes(pd))) return 'MODERATE';
  return 'BASE';
}

function childFingerprint(child) {
  return JSON.stringify({ tier: child.tier, pd: child.refinement.pd, d10: child.refinement.d10, transit: child.refinement.transit, ashtakavarga: child.refinement.ashtakavarga });
}

function coalesceChildren(children) {
  const output = [];
  for (const child of children) {
    const previous = output.at(-1);
    if (!previous || previous.end !== child.start || childFingerprint(previous) !== childFingerprint(child)) output.push(child);
    else output[output.length - 1] = freeze({ ...previous, childId: `career-v2.3:${safeId(previous.parentCandidateId)}:${safeId(previous.start)}:${safeId(child.end)}`, end: child.end, internalPhases: freeze([...previous.internalPhases, ...child.internalPhases]) });
  }
  return freeze(output);
}

function strongestChild(children) {
  return children.slice().sort((left, right) => TIER_RANK[right.tier] - TIER_RANK[left.tier]
    || TRANSIT_RANK[right.refinement.transit] - TRANSIT_RANK[left.refinement.transit]
    || PD_RANK[right.refinement.pd] - PD_RANK[left.refinement.pd]
    || D10_RANK[right.refinement.d10] - D10_RANK[left.refinement.d10]
    || left.start.localeCompare(right.start)
    || left.childId.localeCompare(right.childId))[0] || null;
}

function buildChild(parent, phase, ashtakavarga) {
  if (!validInterval(phase) || Date.parse(phase.start) < Date.parse(parent.start) || Date.parse(phase.end) > Date.parse(parent.end)) throw new RangeError('V2.3 refinement phase must remain inside its V2.2 parent.');
  const refinement = freeze({ pd: pdRefinement(phase), d10: d10Refinement(phase), transit: transitRefinement(phase), ashtakavarga: ashtakavarga ? 'RAW_CONTEXT' : 'UNAVAILABLE' });
  const tier = refinementTier(refinement);
  return freeze({ childId: `career-v2.3:${safeId(parent.candidateId)}:${safeId(phase.start)}:${safeId(phase.end)}`, parentCandidateId: parent.candidateId, start: phase.start, end: phase.end, tier, eligibility: freeze({ ruleset: ELIGIBILITY_RULESET_VERSION, convergence: parent.dasha.convergence, state: parent.state }), refinement, reasonSummary: freeze({ primaryDashaConvergence: parent.dasha.convergence, pdRefinement: refinement.pd, d10Confirmation: refinement.d10, transitConfirmation: refinement.transit }), internalPhases: freeze([freeze({ start: phase.start, end: phase.end, dasha: phase.dasha, d10: phase.d10, transit: phase.transit })]) });
}

function buildParent(candidate, ashtakavarga) {
  if (!validInterval(candidate) || !Array.isArray(candidate.internalPhases) || !candidate.internalPhases.length) throw new TypeError('V2.3 requires valid V2.2 parent candidates with internal phases.');
  const children = coalesceChildren(candidate.internalPhases.map((phase) => buildChild(candidate, phase, ashtakavarga)));
  const strongest = strongestChild(children);
  return freeze({ parentId: candidate.candidateId, start: candidate.start, end: candidate.end, state: candidate.state, eligibilityRuleset: ELIGIBILITY_RULESET_VERSION, convergence: candidate.dasha.convergence, children, strongestWindowId: strongest && strongest.childId || null, reasonSummary: freeze({ primaryDashaConvergence: candidate.dasha.convergence, strongestTier: strongest && strongest.tier || null }) });
}

function selectCareerTimingV23({ parents, referenceInstant }) {
  const instant = Date.parse(referenceInstant);
  if (!Number.isFinite(instant)) throw new TypeError('V2.3 selection requires a valid reference instant.');
  const activeParent = parents.find((parent) => Date.parse(parent.start) <= instant && instant < Date.parse(parent.end)) || null;
  const activeChild = activeParent && activeParent.children.find((child) => Date.parse(child.start) <= instant && instant < Date.parse(child.end)) || null;
  const nextParent = parents.filter((parent) => Date.parse(parent.start) > instant).sort((left, right) => left.start.localeCompare(right.start) || left.parentId.localeCompare(right.parentId))[0] || null;
  const nextStrongest = nextParent && strongestChild(nextParent.children) || null;
  return freeze({ activeParentId: activeParent && activeParent.parentId || null, activeRefinementId: activeChild && activeChild.childId || null, nextParentId: nextParent && nextParent.parentId || null, nextStrongestWindowId: nextStrongest && nextStrongest.childId || null });
}

function buildCareerTimingV23({ v22Result, referenceInstant, ashtakavargaContext = null } = {}) {
  if (!v22Result || v22Result.rulesetVersion !== ELIGIBILITY_RULESET_VERSION || !Array.isArray(v22Result.candidates)) throw new TypeError('V2.3 requires an authoritative CareerTimingV2.2 shadow result.');
  const parents = freeze(v22Result.candidates.map((candidate) => buildParent(candidate, ashtakavargaContext)));
  const children = freeze(parents.flatMap((parent) => parent.children));
  return freeze({ rulesetVersion: CAREER_TIMING_V2_3_RULESET_VERSION, eligibilityRulesetVersion: ELIGIBILITY_RULESET_VERSION, calculationInstant: v22Result.calculationInstant, forecastStart: v22Result.forecastStart, forecastEnd: v22Result.forecastEnd, parentCount: parents.length, parents, children, selected: selectCareerTimingV23({ parents, referenceInstant: referenceInstant || v22Result.calculationInstant }), tierDistribution: freeze(Object.fromEntries(TIERS.map((tier) => [tier, children.filter((child) => child.tier === tier).length]))), provenance: freeze({ mode: 'SHADOW_ONLY', authoritative: false, eligibilityRecalculated: false, historicalEventsIncluded: false, ashtakavargaRanking: false, productionIntegrated: false }) });
}

module.exports = { CAREER_TIMING_V2_3_RULESET_VERSION, ELIGIBILITY_RULESET_VERSION, TIERS, pdRefinement, transitRefinement, refinementTier, coalesceChildren, selectCareerTimingV23, buildCareerTimingV23 };
