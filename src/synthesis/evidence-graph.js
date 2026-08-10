'use strict';

const { EVIDENCE_RULESET_ID, EDGE_TYPES, NODE_KINDS } = require('./reference-data');
const { hash, stable, freeze, assertNoForbidden, createFact, createDerivedRelation, createMissingData } = require('./evidence-node');

function same(value, other) { return stable(value) === stable(other); }
function validateNode(node) {
  if (!node || typeof node !== 'object' || typeof node.id !== 'string' || !node.id || !NODE_KINDS.includes(node.kind) || node.domain !== null || node.temporalContextId !== null || !node.subject || typeof node.subject.entityType !== 'string' || typeof node.subject.entityId !== 'string') throw new TypeError('Invalid evidence node.');
  assertNoForbidden(node);
}
class EvidenceGraphBuilder {
  constructor({ rulesetId = EVIDENCE_RULESET_ID, sourceIdentity = 'natal-evidence-graph' } = {}) {
    if (rulesetId !== EVIDENCE_RULESET_ID || typeof sourceIdentity !== 'string' || !sourceIdentity) throw new RangeError('Unsupported evidence graph configuration.');
    this.rulesetId = rulesetId; this.sourceIdentity = sourceIdentity; this.nodes = new Map(); this.edges = new Map();
  }
  addNode(node) {
    validateNode(node);
    const previous = this.nodes.get(node.id);
    if (previous && !same(previous, node)) throw new RangeError(`Duplicate node identity has different payload: ${node.id}`);
    this.nodes.set(node.id, node); return node;
  }
  addFact(input) { return this.addNode(createFact(input)); }
  addMissingData(input) { return this.addNode(createMissingData(input)); }
  addDerivedRelation(input) {
    if (input.inputNodeIds.some((id) => !this.nodes.has(id))) throw new RangeError('Derived relation references a nonexistent inputNodeId.');
    const node = this.addNode(createDerivedRelation(input));
    for (const fromId of node.inputNodeIds) this.addEdge({ type: 'DERIVES_FROM', fromId: node.id, toId: fromId });
    return node;
  }
  addEdge({ type, fromId, toId, fact = null } = {}) {
    if (!EDGE_TYPES.includes(type)) throw new RangeError(`Unsupported evidence edge type: ${type}`);
    if (typeof fromId !== 'string' || typeof toId !== 'string' || !this.nodes.has(fromId) || !this.nodes.has(toId)) throw new RangeError('Evidence edge references nonexistent endpoint.');
    if (type === 'CONTRADICTS' && fromId === toId) throw new RangeError('A node cannot contradict itself.');
    assertNoForbidden(fact);
    const identity = { type, fromId, toId };
    const edge = freeze({ id: `edge:${hash(identity)}`, type, fromId, toId, fact, provenance: { infrastructureRulesetId: EVIDENCE_RULESET_ID } });
    const previous = this.edges.get(edge.id);
    if (previous && !same(previous, edge)) throw new RangeError(`Duplicate edge identity has different payload: ${edge.id}`);
    this.edges.set(edge.id, edge); return edge;
  }
  build() {
    const nodes = [...this.nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
    const edges = [...this.edges.values()].sort((left, right) => left.id.localeCompare(right.id));
    const missingData = nodes.filter((node) => node.kind === 'MISSING_DATA');
    const graphId = `graph:${hash({ rulesetId: this.rulesetId, sourceIdentity: this.sourceIdentity, nodeIds: nodes.map((node) => node.id), edgeIds: edges.map((edge) => edge.id) })}`;
    return freeze({ graphId, nodes, edges, missingData, provenance: { layer: '12A', rulesetId: this.rulesetId, sourceIdentity: this.sourceIdentity, ordering: 'nodes-and-edges-sorted-lexicographically-by-stable-id', astronomyCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', longitudeCalculation: 'not-performed', houseCalculation: 'not-performed', vargaCalculation: 'not-performed', dashaCalculation: 'not-performed', transitCalculation: 'not-performed', ashtakavargaCalculation: 'not-performed', interpretation: 'not-performed', prediction: 'not-performed' } });
  }
}
module.exports = { EvidenceGraphBuilder };
