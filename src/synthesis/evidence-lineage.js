'use strict';

const { freeze, hash } = require('./evidence-node');

function mechanismForLayer(layer) { return ({ '3': 'VARGA', '4': 'DASHA', '5B': 'DIGNITY', '6': 'DRISHTI', '7': 'YOGA', '9': 'GOCHAR_SNAPSHOT', '10': 'TRANSIT_EVENT', '11': 'ASHTAKAVARGA' })[layer] || 'NATAL_STRUCTURE'; }
function isTemporal(node) { return node && (node.sourceLayer === '4' || node.sourceLayer === '9' || node.sourceLayer === '10' || node.temporalContextId !== null && node.temporalContextId !== undefined); }
function resolveLineage(nodes) {
  const index = new Map(nodes.map((node) => [node.id, node]));
  if (index.size !== nodes.length) throw new RangeError('Evidence analysis requires unique node identities.');
  const state = new Map(); const cache = new Map();
  function visit(id, stack = []) {
    const node = index.get(id); if (!node) throw new RangeError(`Evidence relation references nonexistent node: ${id}`);
    if (state.get(id) === 'visiting') throw new RangeError(`Evidence lineage cycle detected: ${[...stack, id].join(' -> ')}`);
    if (cache.has(id)) return cache.get(id);
    state.set(id, 'visiting'); let roots;
    if (node.kind === 'MISSING_DATA') roots = [];
    else if (node.kind === 'FACT' || !Array.isArray(node.inputNodeIds) || node.inputNodeIds.length === 0) roots = [id];
    else roots = [...new Set(node.inputNodeIds.flatMap((input) => visit(input, [...stack, id]).rootSourceIds))].sort();
    const rootNodes = roots.map((root) => index.get(root));
    const sourceLayers = [...new Set([node.sourceLayer, ...rootNodes.map((item) => item.sourceLayer)].filter(Boolean))].sort();
    const mechanisms = [...new Set([node.sourceLayer, ...rootNodes.map((item) => item.sourceLayer)].filter(Boolean).map(mechanismForLayer))].sort();
    const temporal = [node, ...rootNodes].some(isTemporal); const staticPart = [node, ...rootNodes].some((item) => !isTemporal(item) && item.kind !== 'MISSING_DATA');
    const result = freeze({ nodeId: id, kind: node.kind, rootSourceIds: roots, sourceLayers, sourceStrengths: [...new Set([node.sourceStrength, ...rootNodes.map((item) => item.sourceStrength)].filter(Boolean))].sort(), mechanismFamilies: mechanisms, temporalMembership: temporal && staticPart ? 'MIXED' : temporal ? 'TEMPORAL' : node.kind === 'MISSING_DATA' ? 'NOT_COMPARABLE' : 'STATIC', dependentOnNodeIds: [...(node.inputNodeIds || [])].sort() });
    state.set(id, 'done'); cache.set(id, result); return result;
  }
  nodes.forEach((node) => visit(node.id)); return { index, analysis: cache };
}
function classifyPair(left, right, explicitContradictions = new Set()) {
  if (left.nodeId === right.nodeId) return 'IDENTICAL';
  if (left.kind === 'MISSING_DATA' || right.kind === 'MISSING_DATA' || left.rootSourceIds.length === 0 || right.rootSourceIds.length === 0) return 'NOT_COMPARABLE';
  const key = [left.nodeId, right.nodeId].sort().join('|'); if (explicitContradictions.has(key)) return 'CONTRADICTORY';
  const common = left.rootSourceIds.filter((id) => right.rootSourceIds.includes(id));
  if (common.length === 0) return 'INDEPENDENT';
  if (common.length === left.rootSourceIds.length && common.length === right.rootSourceIds.length) return 'FULLY_DEPENDENT';
  return 'PARTIALLY_OVERLAPPING';
}
function familyId(memberNodeIds, rootSourceIds) { return `evidence-family:${hash({ memberNodeIds: [...memberNodeIds].sort(), rootSourceIds: [...rootSourceIds].sort() })}`; }

module.exports = { mechanismForLayer, isTemporal, resolveLineage, classifyPair, familyId };
