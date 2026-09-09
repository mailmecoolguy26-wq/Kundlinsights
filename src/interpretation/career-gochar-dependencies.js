'use strict';

const { BODIES } = require('../gochar/reference-data');
const { EVENT_ORDER } = require('../transit-events/reference-data');

const DEPENDENCY_STATUS = Object.freeze({
  EXPLICIT: 'EXPLICIT',
  DERIVED_FROM_EXISTING_RULE: 'DERIVED_FROM_EXISTING_RULE',
  UNSPECIFIED: 'DEPENDENCY_UNSPECIFIED',
});

const TRANSIT_EVENT_TYPES_EXCLUDING_SADE_SATI = Object.freeze(
  EVENT_ORDER.filter((eventType) => eventType !== 'sadeSatiPhaseChange'),
);

// These are admissibility contracts, not new interpretations.  The first
// rule's Layer-9 source intentionally supplies structural context without a
// documented Career-specific planet/target boundary, so it must not be used to
// plan future scans.  The second is an existing engine convention whose
// concrete event allowlist is encoded in career-gochar-engine.js.
const CAREER_GOCHAR_RULE_DEPENDENCIES = Object.freeze([
  Object.freeze({
    ruleId: 'career-gochar-structural-connection-v1',
    dependencyStatus: DEPENDENCY_STATUS.UNSPECIFIED,
    transitPlanets: null,
    natalTargetKinds: null,
    natalTargets: null,
    relationTypes: ['TEMPORALLY_ACTIVATES'],
    eventTypes: null,
    provenance: {
      sourceStatus: 'SOURCE_INTERPRETATION',
      sourceRefs: ['Layer9-Layer12C-supplied-structural-gochar'],
      reason: 'The supplied structural Gochar source contains no Career-specific transit-planet, target, or relation restriction.',
    },
  }),
  Object.freeze({
    ruleId: 'career-transit-event-timing-context-v1',
    dependencyStatus: DEPENDENCY_STATUS.DERIVED_FROM_EXISTING_RULE,
    transitPlanets: BODIES,
    natalTargetKinds: ['CAREER_DERIVED_RELATION'],
    natalTargets: 'ALL_EXISTING_CAREER_RELATIONS',
    relationTypes: ['TEMPORALLY_ACTIVATES'],
    eventTypes: TRANSIT_EVENT_TYPES_EXCLUDING_SADE_SATI,
    provenance: {
      sourceStatus: 'ENGINE_CONVENTION',
      sourceRefs: ['Layer10-refined-event-Layer12C-structural-link'],
      reason: 'Existing evaluation accepts every Layer-10 activation except sadeSatiPhaseChange; no narrower planet or Career-relation dependency is encoded.',
    },
  }),
]);

function careerGocharDependency(ruleId) {
  return CAREER_GOCHAR_RULE_DEPENDENCIES.find((dependency) => dependency.ruleId === ruleId) || null;
}

function isProjectionSafeCareerGocharRule(dependency) {
  return dependency !== null && dependency.dependencyStatus !== DEPENDENCY_STATUS.UNSPECIFIED;
}

// Dependency-aware current-time evaluation is intentionally permissive for
// unspecified rules.  They are still production-current rules; only future
// planning excludes them until source restrictions are audited.
function permitsCurrentCareerGocharActivation({ ruleId, node } = {}) {
  const dependency = careerGocharDependency(ruleId);
  if (!dependency || dependency.dependencyStatus === DEPENDENCY_STATUS.UNSPECIFIED) return true;
  if (!node || node.sourceLayer !== '10') return false;
  const eventType = node.fact && node.fact.eventType;
  const transitPlanet = node.fact && node.fact.body;
  // Existing current-time callers may carry partial safe facts.  Metadata
  // must not turn that established behavior into an absence; future planning
  // always has the complete scanner contract and can prefilter strictly.
  if (typeof eventType !== 'string' || typeof transitPlanet !== 'string') return true;
  return dependency.eventTypes.includes(eventType) && dependency.transitPlanets.includes(transitPlanet);
}

module.exports = {
  DEPENDENCY_STATUS,
  TRANSIT_EVENT_TYPES_EXCLUDING_SADE_SATI,
  CAREER_GOCHAR_RULE_DEPENDENCIES,
  careerGocharDependency,
  isProjectionSafeCareerGocharRule,
  permitsCurrentCareerGocharActivation,
};
