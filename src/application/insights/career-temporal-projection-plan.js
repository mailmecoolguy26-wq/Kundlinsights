'use strict';

// This module is deliberately a plan over already-derived Career evidence.  It
// does not calculate astronomy, scan transits, or introduce interpretation.
// Keeping this dependency boundary explicit prevents a future scanner from
// manufacturing unrelated Layer 12C nodes before Layer 12D's pairwise gate.
const { BODIES } = require('../../gochar/reference-data');
const { EVENT_ORDER } = require('../../transit-events/reference-data');
const { CAREER_GOCHAR_RULE_DEPENDENCIES, isProjectionSafeCareerGocharRule } = require('../../interpretation/career-gochar-dependencies');

const RULESET_ID = 'career-temporal-projection-plan-v1';
const EXCLUDED_EVENT_TYPES = Object.freeze(new Set(['sadeSatiPhaseChange']));
const CAREER_RELATION_TYPES = Object.freeze(new Set([
  'CAREER_PRIMARY_HOUSE',
  'CAREER_HOUSE_LORD',
  'CAREER_HOUSE_OCCUPANT',
  'CAREER_HOUSE_ASPECT',
  'CAREER_HOUSE_LORD_ASPECT',
  'CAREER_HOUSE_LORD_STATE',
  'CAREER_OCCUPANT_STATE',
]));

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function bodyOf(endpoint) {
  return endpoint && endpoint.entityType === 'GRAHA' && typeof endpoint.entityId === 'string'
    ? endpoint.entityId
    : null;
}

function houseOf(endpoint) {
  return endpoint && endpoint.entityType === 'HOUSE' && Number.isInteger(Number(endpoint.entityId))
    ? Number(endpoint.entityId)
    : null;
}

function assertInstant(value, name) {
  if (typeof value !== 'string' || !value.endsWith('Z') || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${name} must be a UTC ISO instant.`);
  }
  return value;
}

function stable(values) { return [...new Set(values)].sort((left, right) => left.localeCompare(right)); }

function buildCareerTemporalProjectionPlan({ domainGraph, horizonStart, horizonEnd } = {}) {
  if (!domainGraph || domainGraph.domain !== 'CAREER' || !Array.isArray(domainGraph.derivedRelations)) {
    throw new TypeError('Career temporal projection requires an existing Career domain graph.');
  }
  assertInstant(horizonStart, 'horizonStart');
  assertInstant(horizonEnd, 'horizonEnd');
  if (Date.parse(horizonStart) >= Date.parse(horizonEnd)) throw new RangeError('horizonStart must precede horizonEnd.');

  const relations = domainGraph.derivedRelations
    .filter((relation) => CAREER_RELATION_TYPES.has(relation.relationType))
    .slice()
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const natalPlanets = stable(relations.flatMap((relation) => [bodyOf(relation.subject), bodyOf(relation.target)].filter(Boolean)));
  const natalHouses = stable(relations.flatMap((relation) => [houseOf(relation.subject), houseOf(relation.target)].filter((value) => value !== null).map(String))).map(Number);

  const projectionSafeGocharRules = CAREER_GOCHAR_RULE_DEPENDENCIES
    .filter(isProjectionSafeCareerGocharRule)
    .map((dependency) => ({
      ruleId: dependency.ruleId,
      dependencyStatus: dependency.dependencyStatus,
      transitPlanets: [...dependency.transitPlanets],
      natalTargetKinds: [...dependency.natalTargetKinds],
      natalTargets: dependency.natalTargets,
      relationTypes: [...dependency.relationTypes],
      eventTypes: [...dependency.eventTypes],
      provenance: { ...dependency.provenance },
    }));
  const projectedPlanets = new Set(projectionSafeGocharRules.flatMap((rule) => rule.transitPlanets));
  const projectedEventTypes = new Set(projectionSafeGocharRules.flatMap((rule) => rule.eventTypes));
  const eligibleTransitPlanets = BODIES.filter((planet) => projectedPlanets.has(planet));
  const eligibleEventTypes = EVENT_ORDER.filter((eventType) => projectedEventTypes.has(eventType));
  const dashaLords = natalPlanets;

  return freeze({
    rulesetId: RULESET_ID,
    horizon: { start: horizonStart, end: horizonEnd },
    careerRelationIds: relations.map((relation) => relation.id),
    careerSubjects: { natalHouses, natalPlanets },
    dasha: { eligibleLords: dashaLords, relationTypes: ['CAREER_HOUSE_LORD', 'CAREER_HOUSE_OCCUPANT'] },
    transit: {
      eligiblePlanets: eligibleTransitPlanets,
      eligibleEventTypes,
      excludedEventTypes: [...EXCLUDED_EVENT_TYPES],
      natalTargets: { houses: natalHouses, planets: natalPlanets },
      projectionSafeGocharRules,
      dependencyPolicy: 'only-rules-with-audited-dependencies-are-eligible-for-future-projection',
    },
    integrationGate: {
      enabled: false,
      reason: 'One Layer-10 convention is mechanically projectable but remains universal; the Layer-9 structural Gochar rule is dependency-unspecified. Production future projection remains disabled.',
    },
    provenance: {
      planningOnly: true,
      astrologyCalculation: 'not-performed',
      transitScanning: 'not-performed',
      interpretation: 'not-performed',
      arbitraryTopNPruning: 'not-performed',
    },
  });
}

module.exports = { RULESET_ID, CAREER_RELATION_TYPES, EXCLUDED_EVENT_TYPES, buildCareerTemporalProjectionPlan };
