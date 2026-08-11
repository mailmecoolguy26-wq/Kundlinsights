'use strict';

const { freeze, hash, stable } = require('./evidence-node');
const { resolveLineage, classifyPair, familyId } = require('./evidence-lineage');

const RULESET_ID = 'parashari-evidence-independence-gate-v1'; const PAIRWISE_NODE_LIMIT = 256;
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validNatal(graph) { if (!object(graph) || !Array.isArray(graph.nodes) || !graph.provenance || graph.provenance.layer !== '12A') throw new TypeError('A built Layer 12A natal graph is required.'); return graph; }
function add(map, item) { const old = map.get(item.id); if (old && stable(old) !== stable(item)) throw new RangeError(`Conflicting evidence identity: ${item.id}`); map.set(item.id, item); }
function composite(input) {
  const natal = validNatal(input.graph || input.natalGraph); const all = new Map(); natal.nodes.forEach((node) => add(all, node));
  const domain = input.domainGraph || null; if (domain !== null) { if (!object(domain) || domain.sourceGraphId !== natal.graphId || !Array.isArray(domain.derivedRelations)) throw new RangeError('Domain overlay must reference the supplied Layer 12A natal graph.'); domain.derivedRelations.forEach((node) => add(all, { ...node, kind: 'DERIVED_RELATION', domain: node.domain || null, temporalContextId: null })); }
  const temporal = input.temporalGraph || null; if (temporal !== null) { if (!object(temporal) || temporal.natalGraphId !== natal.graphId || !Array.isArray(temporal.nodes) || !Array.isArray(temporal.relations)) throw new RangeError('Temporal overlay must reference the supplied Layer 12A natal graph.'); temporal.nodes.forEach((node) => add(all, node)); temporal.relations.forEach((node) => add(all, node)); }
  return { natal, domain, temporal, nodes: [...all.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}
function selectedNodes(nodes, domain, domainGraph) {
  if (domain === null || domain === undefined) return nodes;
  if (domain !== 'CAREER' || !domainGraph || domainGraph.domain !== domain) throw new RangeError('Only a supplied CAREER domain overlay can be filtered.');
  const index = new Map(nodes.map((node) => [node.id, node])); const selected = new Set(domainGraph.derivedRelations.map((node) => node.id)); let changed = true;
  while (changed) { changed = false; for (const node of nodes) if (selected.has(node.id)) for (const input of node.inputNodeIds || []) if (!selected.has(input)) { if (!index.has(input)) throw new RangeError(`Evidence relation references nonexistent node: ${input}`); selected.add(input); changed = true; } for (const node of nodes) if ((node.inputNodeIds || []).some((id) => selected.has(id)) && node.sourceLayer === '12C' && !selected.has(node.id)) { selected.add(node.id); changed = true; } }
  return nodes.filter((node) => selected.has(node.id));
}
function analyzeEvidenceIndependence(input = {}) {
  if (!object(input)) throw new TypeError('Evidence-independence input must be an object.'); const assembled = composite(input); const nodes = selectedNodes(assembled.nodes, input.domain || null, assembled.domain);
  if (nodes.length > PAIRWISE_NODE_LIMIT) throw new RangeError(`Pairwise evidence analysis limit exceeded: ${PAIRWISE_NODE_LIMIT}.`);
  const { analysis } = resolveLineage(nodes);
  const contradictionSet = new Set(); (assembled.natal.edges || []).filter((edge) => edge.type === 'CONTRADICTS').forEach((edge) => contradictionSet.add([edge.fromId, edge.toId].sort().join('|')));
  const nodeAnalysis = nodes.map((node) => analysis.get(node.id)).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const pairwiseRelations = []; for (let left = 0; left < nodeAnalysis.length; left += 1) for (let right = left; right < nodeAnalysis.length; right += 1) { const a = nodeAnalysis[left]; const b = nodeAnalysis[right]; pairwiseRelations.push(freeze({ leftNodeId: a.nodeId, rightNodeId: b.nodeId, classification: classifyPair(a, b, contradictionSet), sharedRootSourceIds: a.rootSourceIds.filter((id) => b.rootSourceIds.includes(id)) })); }
  const families = []; const visited = new Set(); const nonMissing = nodeAnalysis.filter((item) => item.kind !== 'MISSING_DATA');
  nonMissing.forEach((start) => { if (visited.has(start.nodeId)) return; const members = new Set([start.nodeId]); let expanded = true; while (expanded) { expanded = false; nonMissing.forEach((candidate) => { if (members.has(candidate.nodeId)) return; const linked = [...members].some((id) => { const member = analysis.get(id); return member.rootSourceIds.some((root) => candidate.rootSourceIds.includes(root)); }); if (linked) { members.add(candidate.nodeId); expanded = true; } }); } members.forEach((id) => visited.add(id)); const entries = [...members].map((id) => analysis.get(id)); const roots = [...new Set(entries.flatMap((item) => item.rootSourceIds))].sort(); families.push(freeze({ familyId: familyId([...members], roots), memberNodeIds: [...members].sort(), rootSourceIds: roots, sourceLayers: [...new Set(entries.flatMap((item) => item.sourceLayers))].sort(), sourceStrengths: [...new Set(entries.flatMap((item) => item.sourceStrengths))].sort(), relationTypes: nodes.filter((node) => members.has(node.id) && node.relationType).map((node) => node.relationType).sort(), temporalStaticMembership: [...new Set(entries.map((item) => item.temporalMembership))].sort() })); });
  const contradictions = pairwiseRelations.filter((item) => item.classification === 'CONTRADICTORY').map((item) => freeze({ contradictionGroupId: `contradiction:${hash([item.leftNodeId, item.rightNodeId].sort())}`, memberNodeIds: [item.leftNodeId, item.rightNodeId].sort() }));
  const missingData = nodes.filter((node) => node.kind === 'MISSING_DATA').map((node) => freeze({ nodeId: node.id, status: node.fact && node.fact.status || null })).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const analysisId = `evidence-analysis:${hash({ rulesetId: RULESET_ID, graphId: assembled.natal.graphId, domain: input.domain || null, nodeIds: nodes.map((node) => node.id) })}`;
  return freeze({ analysisId, rulesetId: RULESET_ID, graphId: assembled.natal.graphId, domain: input.domain || null, nodeAnalysis, pairwiseRelations, evidenceFamilies: families.sort((a, b) => a.familyId.localeCompare(b.familyId)), mechanismFamilies: [...new Set(nodeAnalysis.flatMap((item) => item.mechanismFamilies))].sort(), contradictionGroups: contradictions.sort((a, b) => a.contradictionGroupId.localeCompare(b.contradictionGroupId)), missingData, provenance: { evidenceAnalysisOnly: true, astronomyCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', dashaCalculation: 'not-performed', gocharCalculation: 'not-performed', transitScanning: 'not-performed', astrologyScoring: 'not-performed', interpretation: 'not-performed', prediction: 'not-performed', pairwisePolicy: `all-selected-non-missing-and-missing-nodes; maximum-${PAIRWISE_NODE_LIMIT}`, providerDependency: 'none' } });
}
module.exports = { analyzeEvidenceIndependence, RULESET_ID, PAIRWISE_NODE_LIMIT };
