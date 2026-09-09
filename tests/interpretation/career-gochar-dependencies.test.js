'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BODIES } = require('../../src/gochar/reference-data');
const {
  DEPENDENCY_STATUS,
  CAREER_GOCHAR_RULE_DEPENDENCIES,
  permitsCurrentCareerGocharActivation,
} = require('../../src/interpretation');

test('every current Career Gochar rule has an audited dependency status and provenance', () => {
  assert.deepEqual(CAREER_GOCHAR_RULE_DEPENDENCIES.map((item) => [item.ruleId, item.dependencyStatus]), [
    ['career-gochar-structural-connection-v1', DEPENDENCY_STATUS.UNSPECIFIED],
    ['career-transit-event-timing-context-v1', DEPENDENCY_STATUS.DERIVED_FROM_EXISTING_RULE],
  ]);
  assert.equal(CAREER_GOCHAR_RULE_DEPENDENCIES.every((item) => item.provenance.sourceStatus && item.provenance.sourceRefs.length > 0), true);
});

test('the existing event convention retains its exact all-graha except Sade Sati boundary', () => {
  const timing = CAREER_GOCHAR_RULE_DEPENDENCIES[1];
  assert.deepEqual(timing.transitPlanets, BODIES);
  assert.equal(timing.eventTypes.includes('sadeSatiPhaseChange'), false);
  assert.equal(permitsCurrentCareerGocharActivation({ ruleId: timing.ruleId, node: { sourceLayer: '10', fact: { body: 'Jupiter', eventType: 'rashiIngress' } } }), true);
  assert.equal(permitsCurrentCareerGocharActivation({ ruleId: timing.ruleId, node: { sourceLayer: '10', fact: { body: 'Jupiter', eventType: 'sadeSatiPhaseChange' } } }), false);
});

test('dependency-unspecified structural Gochar remains current-time permissive', () => {
  assert.equal(permitsCurrentCareerGocharActivation({ ruleId: 'career-gochar-structural-connection-v1', node: { sourceLayer: '9', fact: { body: 'Moon' } } }), true);
});
