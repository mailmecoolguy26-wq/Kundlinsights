'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { EvidenceGraphBuilder, EDGE_TYPES } = require('../../src/synthesis');
function input(body, identity) { return { subject: { entityType: 'GRAHA', entityId: body }, sourceLayer: '5B', sourceRulesetId: 'state-v1', sourceIdentity: identity, sourceStrength: 'CLASSICAL_TRANSLATION', fact: { body } }; }

test('deduplicates equal facts/relations but preserves distinct relations sharing a fact', () => {
  const builder = new EvidenceGraphBuilder(); const jupiter = builder.addFact(input('Jupiter', 'bodies.Jupiter'));
  assert.equal(builder.addFact(input('Jupiter', 'bodies.Jupiter')).id, jupiter.id);
  const one = builder.addDerivedRelation({ ...input('Jupiter', 'relation.one'), sourceLayer: '12A', sourceRulesetId: 'r-v1', relationRulesetId: 'r-v1', relationType: 'ONE', inputNodeIds: [jupiter.id] });
  assert.equal(builder.addDerivedRelation({ ...input('Jupiter', 'relation.one'), sourceLayer: '12A', sourceRulesetId: 'r-v1', relationRulesetId: 'r-v1', relationType: 'ONE', inputNodeIds: [jupiter.id] }).id, one.id);
  const two = builder.addDerivedRelation({ ...input('Jupiter', 'relation.two'), sourceLayer: '12A', sourceRulesetId: 'r-v1', relationRulesetId: 'r-v1', relationType: 'TWO', inputNodeIds: [jupiter.id] });
  const graph = builder.build(); assert.equal(graph.nodes.filter((node) => node.kind === 'DERIVED_RELATION').length, 2); assert.equal(graph.edges.filter((edge) => edge.type === 'DERIVES_FROM').length, 2); assert.notEqual(one.id, two.id);
});

test('rejects conflicting duplicate facts, invalid edges, nonexistent endpoints, and nonexistent relation inputs', () => {
  const builder = new EvidenceGraphBuilder(); const fact = builder.addFact(input('Jupiter', 'bodies.Jupiter'));
  assert.throws(() => builder.addFact({ ...input('Jupiter', 'bodies.Jupiter'), fact: { body: 'Jupiter', rashi: 4 } }), /different payload/);
  assert.throws(() => builder.addDerivedRelation({ ...input('Jupiter', 'r'), sourceLayer: '12A', sourceRulesetId: 'r', relationRulesetId: 'r', relationType: 'x', inputNodeIds: ['missing'] }), /nonexistent/);
  assert.throws(() => builder.addEdge({ type: 'BAD', fromId: fact.id, toId: fact.id }), /Unsupported/);
  assert.throws(() => builder.addEdge({ type: 'TARGETS', fromId: fact.id, toId: 'missing' }), /nonexistent/);
  assert.throws(() => builder.addEdge({ type: 'CONTRADICTS', fromId: fact.id, toId: fact.id }), /contradict/);
  assert.throws(() => builder.addNode({ id: 'bad', kind: 'FACT', domain: null, temporalContextId: null, subject: { entityType: 'GRAHA', entityId: 'Sun' }, fact: { score: 1 } }), /Forbidden/);
  assert.throws(() => builder.addEdge({ type: 'TARGETS', fromId: fact.id, toId: fact.id, fact: { outcome: 'x' } }), /Forbidden/);
  assert.deepEqual(EDGE_TYPES, ['DERIVES_FROM', 'RELATES_TO_DOMAIN', 'TARGETS', 'MODIFIES', 'ACTIVE_IN_CONTEXT', 'OCCURS_AT', 'OCCURS_WITHIN', 'CONTRADICTS']);
});

test('has stable graph identity and ordering across reverse insertion order and frozen inputs', () => {
  const make = (reverse) => { const builder = new EvidenceGraphBuilder({ sourceIdentity: 'stable' }); const inputs = [input('Jupiter', 'j'), input('Saturn', 's')]; if (reverse) inputs.reverse(); inputs.forEach((value) => builder.addFact(Object.freeze(value))); return builder.build(); };
  const first = make(false), reverse = make(true), repeated = make(false);
  assert.deepEqual(first, reverse); assert.deepEqual(first, repeated); assert.equal(Object.isFrozen(first), true); assert.equal(Object.isFrozen(first.nodes), true); assert.equal(Object.isFrozen(first.nodes[0].fact), true); assert.equal(first.nodes.every((node, index, all) => index === 0 || all[index - 1].id.localeCompare(node.id) <= 0), true);
});
