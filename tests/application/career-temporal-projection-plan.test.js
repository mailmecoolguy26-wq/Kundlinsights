'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BODIES } = require('../../src/gochar/reference-data');
const { EVENT_ORDER } = require('../../src/transit-events/reference-data');
const { buildCareerTemporalProjectionPlan } = require('../../src/application/insights');

const start = '2026-09-09T00:00:00.000Z';
const end = '2028-09-09T00:00:00.000Z';
function graph(relations) { return { domain: 'CAREER', derivedRelations: relations }; }
function relation(id, relationType, subject, target) { return { id, relationType, subject, target }; }

test('Career temporal projection plan derives stable Career subjects before any future scan', () => {
  const plan = buildCareerTemporalProjectionPlan({
    domainGraph: graph([
      relation('occupant', 'CAREER_HOUSE_OCCUPANT', { entityType: 'GRAHA', entityId: 'Venus' }, { entityType: 'HOUSE', entityId: '10' }),
      relation('primary', 'CAREER_PRIMARY_HOUSE', { entityType: 'HOUSE', entityId: '10' }, { entityType: 'DOMAIN', entityId: 'CAREER' }),
      relation('lord', 'CAREER_HOUSE_LORD', { entityType: 'HOUSE', entityId: '10' }, { entityType: 'GRAHA', entityId: 'Saturn' }),
      relation('irrelevant', 'CAREER_D10_TENTH_LORD', { entityType: 'D10_HOUSE', entityId: '10' }, { entityType: 'GRAHA', entityId: 'Mars' }),
    ]), horizonStart: start, horizonEnd: end,
  });
  assert.deepEqual(plan.careerSubjects, { natalHouses: [10], natalPlanets: ['Saturn', 'Venus'] });
  assert.deepEqual(plan.dasha.eligibleLords, ['Saturn', 'Venus']);
  assert.equal(plan.careerRelationIds.includes('irrelevant'), false);
  assert.equal(Object.isFrozen(plan), true);
});

test('Career projection explicitly excludes Sade Sati but makes no arbitrary transit reduction under generic Gochar rules', () => {
  const plan = buildCareerTemporalProjectionPlan({ domainGraph: graph([]), horizonStart: start, horizonEnd: end });
  assert.deepEqual(plan.transit.eligiblePlanets, BODIES);
  assert.deepEqual(plan.transit.eligibleEventTypes, EVENT_ORDER.filter((event) => event !== 'sadeSatiPhaseChange'));
  assert.equal(plan.transit.eligibleEventTypes.includes('sadeSatiPhaseChange'), false);
  assert.equal(plan.integrationGate.enabled, false);
  assert.deepEqual(plan.transit.projectionSafeGocharRules.map((rule) => rule.ruleId), ['career-transit-event-timing-context-v1']);
  assert.match(plan.integrationGate.reason, /dependency-unspecified/);
});

test('Career temporal projection plan is deterministic and rejects an invalid horizon or non-Career graph', () => {
  const input = { domainGraph: graph([relation('lord', 'CAREER_HOUSE_LORD', { entityType: 'HOUSE', entityId: '10' }, { entityType: 'GRAHA', entityId: 'Saturn' })]), horizonStart: start, horizonEnd: end };
  assert.deepEqual(buildCareerTemporalProjectionPlan(input), buildCareerTemporalProjectionPlan(input));
  assert.throws(() => buildCareerTemporalProjectionPlan({ ...input, horizonEnd: start }), /precede/);
  assert.throws(() => buildCareerTemporalProjectionPlan({ ...input, domainGraph: { domain: 'OTHER', derivedRelations: [] } }), /Career domain graph/);
});
