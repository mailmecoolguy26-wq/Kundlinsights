'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { createFact, createDerivedRelation, createMissingData, SOURCE_STRENGTHS } = require('../../src/synthesis');
const base = { subject: { entityType: 'GRAHA', entityId: 'Jupiter' }, sourceLayer: '5B', sourceRulesetId: 'state-v1', sourceIdentity: 'bodies.Jupiter', sourceStrength: 'CLASSICAL_TRANSLATION' };

test('creates immutable canonical FACT, relation, and missing-data nodes with stable identity', () => {
  const first = createFact({ ...base, fact: { rashiIndex: 4, isExalted: true } }); const second = createFact({ ...base, fact: { isExalted: true, rashiIndex: 4 } });
  assert.equal(first.id, second.id); assert.equal(Object.isFrozen(first.fact), true); assert.equal(first.domain, null); assert.equal(first.temporalContextId, null);
  const relation = createDerivedRelation({ ...base, sourceLayer: '12A', sourceRulesetId: 'relation-v1', sourceIdentity: 'relation', relationRulesetId: 'relation-v1', relationType: 'TESTS', inputNodeIds: [first.id] });
  assert.deepEqual(relation.inputNodeIds, [first.id]);
  const absent = createMissingData({ ...base, sourceLayer: '12A', sourceRulesetId: 'infra-v1', sourceIdentity: 'missing', dataKey: 'vargas', status: 'notProvided' });
  assert.equal(absent.fact.status, 'notProvided'); assert.equal(Object.isFrozen(absent), true);
});

test('rejects invalid node source strength, temporal/domain fields, and interpretation semantics', () => {
  assert.throws(() => createFact({ ...base, sourceStrength: 'HIGH', fact: {} }), /source strength/);
  assert.throws(() => createFact({ ...base, domain: 'CAREER', fact: {} }), /domain/);
  assert.throws(() => createFact({ ...base, temporalContextId: 'now', fact: {} }), /temporal/);
  assert.throws(() => createFact({ ...base, fact: { prediction: 'x' } }), /Forbidden/);
  assert.throws(() => createDerivedRelation({ ...base, relationType: 'x', relationRulesetId: 'x', inputNodeIds: [] }), /inputNodeIds/);
  assert.deepEqual(SOURCE_STRENGTHS, ['DIRECT_CLASSICAL', 'CLASSICAL_TRANSLATION', 'COMMENTARY', 'LATER_CONVENTION', 'ENGINE_CONVENTION', 'UNRESOLVED']);
});
