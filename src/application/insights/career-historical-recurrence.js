'use strict';

// Phase 2P: private-history comparator. It is intentionally not wired to
// eligibility or future projection. Callers must supply only already-eligible
// structural snapshots and bounded observation intervals.
const { freeze } = require('../../synthesis/evidence-node');
const time = (value) => Date.parse(value);
const valid = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Number.isFinite(time(value.start)) && Number.isFinite(time(value.end)) && time(value.start) < time(value.end);
const stable = (values) => [...new Set(values.filter((v) => typeof v === 'string' && v))].sort();
function structuralFeatures(snapshot = {}) { return stable(snapshot.structuralFeatures); }
function planetFeatures(snapshot = {}) { return stable(snapshot.planetSpecificFeatures); }
function completedBefore(transition, current) {
  const items = Array.isArray(transition && transition.observations) ? transition.observations : [];
  return items.length > 0 && items.every((item) => valid(item.interval) && time(item.interval.end) < time(current.interval.start));
}
function compareCareerHistoricalRecurrence({ profileId, current, transitions = [] } = {}) {
  if (!profileId || !current || !valid(current.interval) || !Array.isArray(transitions)) return freeze({ available: false, reason: 'INVALID_OR_AMBIGUOUS_INPUT' });
  const prior = transitions.filter((transition) => transition && transition.profileId === profileId && transition.id !== current.transitionId && completedBefore(transition, current));
  if (!prior.length) return freeze({ available: false, reason: 'RECURRENCE_NOT_AVAILABLE_NO_PRIOR_TRANSITION', priorTransitionsConsidered: freeze([]), structurallyMatchedTransitions: freeze([]), planetSpecificMatchedTransitions: freeze([]), matchedStructuralFeatures: freeze([]), matchedPlanetSpecificFeatures: freeze([]), changedFeatures: freeze([]), evidenceRefs: freeze([]) });
  const currentStructural = structuralFeatures(current); const currentPlanet = planetFeatures(current);
  const structural = []; const planet = []; const matchedStructural = new Set(); const matchedPlanet = new Set(); const changed = new Set();
  for (const transition of prior) {
    const snapshots = transition.observations.flatMap((item) => Array.isArray(item.snapshots) ? item.snapshots : []);
    const pastStructural = stable(snapshots.flatMap(structuralFeatures)); const pastPlanet = stable(snapshots.flatMap(planetFeatures));
    const commonStructural = currentStructural.filter((token) => pastStructural.includes(token)); const commonPlanet = currentPlanet.filter((token) => pastPlanet.includes(token));
    commonStructural.forEach((token) => matchedStructural.add(token)); commonPlanet.forEach((token) => matchedPlanet.add(token));
    [...currentStructural, ...pastStructural].filter((token) => !commonStructural.includes(token)).forEach((token) => changed.add(token));
    if (commonStructural.length) structural.push(transition.id); if (commonPlanet.length) planet.push(transition.id);
  }
  return freeze({ available: true, recurrencePresent: structural.length > 0, priorTransitionsConsidered: freeze(prior.map((item) => item.id).sort()), structurallyMatchedTransitions: freeze(stable(structural)), planetSpecificMatchedTransitions: freeze(stable(planet)), matchedStructuralFeatures: freeze(stable([...matchedStructural])), matchedPlanetSpecificFeatures: freeze(stable([...matchedPlanet])), changedFeatures: freeze(stable([...changed])), evidenceRefs: freeze(['CAREER_HISTORICAL_TRANSITION_FACTS_ONLY']), matchedTransitionCount: structural.length, matchedFeatureCount: matchedStructural.size });
}
module.exports = { compareCareerHistoricalRecurrence, structuralFeatures, planetFeatures };
