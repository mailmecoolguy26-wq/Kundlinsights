'use strict';

const { hash, freeze, stable, assertNoForbidden } = require('./evidence-node');
const { CAREER_DOMAIN, CAREER_RULESET_ID, CAREER_RELATION_TYPES, CAREER_RELATION_SOURCE_STRENGTHS } = require('./career-reference-data');

function same(left, right) { return stable(left) === stable(right); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function requireGraph(graph) {
  if (!isObject(graph) || typeof graph.graphId !== 'string' || !Array.isArray(graph.nodes) || !isObject(graph.provenance) || graph.provenance.layer !== '12A') throw new TypeError('Career evidence requires a built Layer 12A natal evidence graph.');
  graph.nodes.forEach((node) => {
    if (!isObject(node) || node.domain !== null || node.temporalContextId !== null) throw new RangeError('Career evidence accepts natal Layer 12A nodes only; temporal or domain nodes are not allowed.');
  });
  return graph;
}
function sourceNodes(graph, layer) { return graph.nodes.filter((node) => node.kind === 'FACT' && node.sourceLayer === layer); }
function missingNode(graph, key) { return graph.nodes.find((node) => node.kind === 'MISSING_DATA' && node.fact && node.fact.dataKey === key) || null; }
function nodeFact(node) { return node && node.fact; }
function houseNumber(value) { return value && Number(value.houseNumber); }
function bodyOfAssignment(value) { return value && typeof value.body === 'string' ? value.body : null; }
function assignedHouse(value) { return value && Number(value.rashiHouseNumber ?? value.bhavaNumber); }
function rashiIndex(value) { const index = value && value.rashi && Number(value.rashi.rashiIndex); return Number.isInteger(index) && index >= 1 && index <= 12 ? index : null; }
function relation({ relationType, subject, target, inputNodeIds, fact = null }) {
  if (!CAREER_RELATION_TYPES.includes(relationType)) throw new RangeError(`Unsupported Career relation type: ${relationType}`);
  const ids = [...new Set(inputNodeIds)].sort();
  const identity = { rulesetId: CAREER_RULESET_ID, relationType, subject, target, inputNodeIds: ids };
  const value = { id: `career-relation:${hash(identity)}`, domain: CAREER_DOMAIN, rulesetId: CAREER_RULESET_ID, relationType, sourceStrength: CAREER_RELATION_SOURCE_STRENGTHS[relationType], subject, target, inputNodeIds: ids, fact, provenance: { sourceGraphLayer: '12A', sourceGraphRulesetBoundary: 'generic-natal-evidence-only', relationshipCalculation: 'selection-of-supplied-facts-only', scope: 'natal-structural-evidence-only' } };
  assertNoForbidden(value);
  return freeze(value);
}
function addRelation(map, value) {
  const previous = map.get(value.id);
  if (previous && !same(previous, value)) throw new RangeError(`Career relation identity has different payload: ${value.id}`);
  map.set(value.id, value);
}
function findH10(graph) {
  const matches = sourceNodes(graph, '5A').filter((node) => node.subject.entityType === 'HOUSE' && houseNumber(nodeFact(node)) === 10);
  if (matches.length === 0) throw new RangeError('Career evidence requires supplied Layer 5A House 10 facts.');
  const lords = new Set(matches.map((node) => nodeFact(node).rashiHouseLord && nodeFact(node).rashiHouseLord.name).filter(Boolean));
  if (lords.size !== 1) throw new RangeError('Career evidence found contradictory or missing Layer 5A House 10 lords.');
  if (matches.some((node) => houseNumber(nodeFact(node)) !== 10)) throw new RangeError('Career House 10 fact is inconsistent.');
  return { node: matches.sort((a, b) => a.id.localeCompare(b.id))[0], lord: [...lords][0] };
}
function findContextHouse(graph, number) {
  const matches = sourceNodes(graph, '5A').filter((node) => node.subject.entityType === 'HOUSE' && houseNumber(nodeFact(node)) === number);
  if (matches.length === 0) return null;
  const lords = new Set(matches.map((node) => nodeFact(node).rashiHouseLord && nodeFact(node).rashiHouseLord.name).filter(Boolean));
  if (lords.size !== 1) throw new RangeError(`Career evidence found contradictory or missing Layer 5A House ${number} lords.`);
  return { node: matches.sort((a, b) => a.id.localeCompare(b.id))[0], lord: [...lords][0] };
}
function stateFlags(state) {
  const dignity = state && state.dignity || {};
  const combustion = state && state.combustion || {};
  const motion = state && state.motion || {};
  return {
    ownSign: dignity.isOwnSign ?? dignity.ownSign ?? null,
    exalted: dignity.isExalted ?? dignity.exalted ?? null,
    debilitated: dignity.isDebilitated ?? dignity.debilitated ?? null,
    moolatrikona: dignity.isMoolatrikona ?? dignity.moolatrikona ?? null,
    combust: combustion.isCombust ?? combustion.combust ?? null,
    retrograde: motion.isRetrograde ?? motion.retrograde ?? null
  };
}
function d10BodyFact(node, body) {
  const fact = nodeFact(node);
  if (!fact || !isObject(fact)) return null;
  return fact.bodies && fact.bodies[body] || fact[body] || null;
}
function rashiEntry(container, index) { return container && Array.isArray(container.rashis) ? container.rashis.find((entry) => entry && entry.rashiIndex === index) || null : null; }
function ashtakavargaSelections(fact, careerRashiIndex, lord, lordRashiIndex) {
  const selections = [];
  const rawSav = fact && (fact.rawSarvashtakavarga || fact.rawSav || fact.sarvashtakavarga);
  const rawEntry = rashiEntry(rawSav, careerRashiIndex);
  if (rawEntry) selections.push({ context: 'H10_RASHI_RAW_SAV', sourcePath: 'rawSarvashtakavarga.rashis', rashiIndex: careerRashiIndex, rawValue: rawEntry.favorableMarkCount });
  const bav = fact && fact.planetaryBavs && fact.planetaryBavs[lord];
  const bavEntry = rashiEntry(bav, lordRashiIndex);
  if (bavEntry) selections.push({ context: 'H10_LORD_RAW_BAV_AT_NATAL_RASHI', sourcePath: `planetaryBavs.${lord}.rashis`, rashiIndex: lordRashiIndex, rawValue: bavEntry.favorableMarkCount });
  const shodhita = fact && (fact.shodhitaAshtakavarga || fact.shodhita);
  const shodhitaBav = shodhita && shodhita.planetaryBavs && shodhita.planetaryBavs[lord];
  const shodhitaEntry = rashiEntry(shodhitaBav, lordRashiIndex);
  if (shodhitaEntry) selections.push({ context: 'H10_LORD_SHODHITA_BAV_AT_NATAL_RASHI', sourcePath: `shodhita.planetaryBavs.${lord}.rashis`, rashiIndex: lordRashiIndex, rawValue: shodhitaEntry.favorableMarkCount });
  const pinda = fact && (fact.pindaByTarget || fact.pindas || fact.pinda);
  const pindaValue = pinda && (Array.isArray(pinda) ? pinda.find((entry) => entry && entry.targetBody === lord) : pinda[lord]);
  if (pindaValue) selections.push({ context: 'H10_LORD_PINDA', sourcePath: 'pindaByTarget', targetBody: lord, rawValue: pindaValue.totalPinda ?? pindaValue });
  return selections;
}
function buildCareerEvidence(input = {}) {
  if (!isObject(input) || Array.isArray(input)) throw new TypeError('Career evidence input must be an object.');
  if (Object.hasOwn(input, 'temporal') || Object.hasOwn(input, 'dasha') || Object.hasOwn(input, 'transit') || Object.hasOwn(input, 'events')) throw new RangeError('Layer 12B Career evidence accepts no temporal activation input.');
  const graph = requireGraph(input.natalGraph || input.graph);
  const { node: h10, lord } = findH10(graph);
  const careerRashiIndex = rashiIndex(nodeFact(h10));
  const assignments = sourceNodes(graph, '5A').filter((node) => node.subject.entityType === 'GRAHA' && bodyOfAssignment(nodeFact(node)));
  const byBody = new Map(); assignments.forEach((node) => {
    const body = bodyOfAssignment(nodeFact(node)); const previous = byBody.get(body);
    if (previous && !same(nodeFact(previous), nodeFact(node))) throw new RangeError(`Career evidence found contradictory Layer 5A assignments for ${body}.`);
    byBody.set(body, node);
  });
  const lordAssignment = byBody.get(lord) || null;
  const occupants = [...byBody.values()].filter((node) => assignedHouse(nodeFact(node)) === 10).sort((a, b) => bodyOfAssignment(nodeFact(a)).localeCompare(bodyOfAssignment(nodeFact(b))));
  const relations = new Map();
  const house = { entityType: 'HOUSE', entityId: '10' };
  addRelation(relations, relation({ relationType: 'CAREER_PRIMARY_HOUSE', subject: house, target: { entityType: 'DOMAIN', entityId: CAREER_DOMAIN }, inputNodeIds: [h10.id], fact: { primaryCareerHouseNumber: 10 } }));
  addRelation(relations, relation({ relationType: 'CAREER_HOUSE_LORD', subject: house, target: { entityType: 'GRAHA', entityId: lord }, inputNodeIds: [h10.id], fact: { derivation: 'supplied-Layer-5A-house-lord' } }));
  occupants.forEach((node) => addRelation(relations, relation({ relationType: 'CAREER_HOUSE_OCCUPANT', subject: { entityType: 'GRAHA', entityId: bodyOfAssignment(nodeFact(node)) }, target: house, inputNodeIds: [node.id], fact: { derivation: 'supplied-Layer-5A-rashi-house-assignment' } })));
  const missing = [];
  function missingOptional(key) { const node = missingNode(graph, key); missing.push(freeze({ dataKey: key, status: node ? node.fact.status : 'notProvided', sourceNodeId: node ? node.id : null, neutrality: 'absence-is-not-negative-evidence' })); }
  const states = sourceNodes(graph, '5B');
  if (states.length === 0) missingOptional('planetaryState');
  else [lord, ...occupants.map((node) => bodyOfAssignment(nodeFact(node)))].filter((body, index, values) => values.indexOf(body) === index).forEach((body) => {
    const state = states.find((node) => node.subject.entityId === body);
    if (!state) return;
    addRelation(relations, relation({ relationType: body === lord ? 'CAREER_HOUSE_LORD_STATE' : 'CAREER_OCCUPANT_STATE', subject: { entityType: 'GRAHA', entityId: body }, target: { entityType: 'EVIDENCE_NODE', entityId: state.id }, inputNodeIds: [state.id], fact: { suppliedStateFlags: stateFlags(nodeFact(state)) } }));
  });
  const aspects = sourceNodes(graph, '6');
  if (aspects.length === 0) missingOptional('grahaDrishti');
  else aspects.forEach((node) => {
    const aspect = nodeFact(node); if (!aspect || typeof aspect.fromBody !== 'string') return;
    const metadata = { aspectNumber: aspect.aspectNumber, targetRashi: aspect.targetRashi || null, targetHouseNumber: aspect.targetHouseNumber ?? null, sourceRulesetId: node.sourceRulesetId };
    if (Number(aspect.targetHouseNumber) === 10) addRelation(relations, relation({ relationType: 'CAREER_HOUSE_ASPECT', subject: { entityType: 'GRAHA', entityId: aspect.fromBody }, target: house, inputNodeIds: [node.id], fact: metadata }));
    if (Array.isArray(aspect.targetBodies) && aspect.targetBodies.some((target) => target && target.body === lord)) addRelation(relations, relation({ relationType: 'CAREER_HOUSE_LORD_ASPECT', subject: { entityType: 'GRAHA', entityId: aspect.fromBody }, target: { entityType: 'GRAHA', entityId: lord }, inputNodeIds: [node.id], fact: metadata }));
  });
  const d10 = sourceNodes(graph, '3').filter((node) => node.subject.entityId === 'D10');
  if (d10.length === 0) missingOptional('D10');
  else [lord, ...occupants.map((node) => bodyOfAssignment(nodeFact(node)))].filter((body, index, values) => values.indexOf(body) === index).forEach((body) => {
    const placements = d10.map((node) => ({ node, placement: d10BodyFact(node, body) })).filter((entry) => entry.placement);
    const identities = new Set(placements.map((entry) => stable(entry.placement.rashi || entry.placement.resultingRashi || entry.placement)));
    if (identities.size > 1) throw new RangeError(`Career evidence found contradictory supplied D10 Rashi facts for ${body}.`);
    if (placements.length === 0) { missing.push(freeze({ dataKey: `D10.${body}`, status: 'notProvided', sourceNodeId: null, neutrality: 'absence-is-not-negative-evidence' })); return; }
    placements.forEach(({ node, placement }) => addRelation(relations, relation({ relationType: 'CAREER_D10_PLACEMENT', subject: { entityType: 'GRAHA', entityId: body }, target: { entityType: 'EVIDENCE_NODE', entityId: node.id }, inputNodeIds: [node.id], fact: { body, suppliedD10Rashi: placement.rashi || placement.resultingRashi || placement } })));
  });
  const ashtaka = sourceNodes(graph, '11');
  if (ashtaka.length === 0) missingOptional('ashtakavarga');
  else ashtaka.forEach((node) => {
    const selections = ashtakavargaSelections(nodeFact(node), careerRashiIndex, lord, lordAssignment ? rashiIndex(nodeFact(lordAssignment)) : null);
    const pindaSelections = selections.filter((selection) => selection.context === 'H10_LORD_PINDA');
    const houseSelections = selections.filter((selection) => selection.context !== 'H10_LORD_PINDA');
    if (houseSelections.length) addRelation(relations, relation({ relationType: 'CAREER_ASHTAKAVARGA_CONTEXT', subject: house, target: { entityType: 'EVIDENCE_NODE', entityId: node.id }, inputNodeIds: [node.id], fact: { selections: houseSelections, thresholdOrRanking: 'not-performed' } }));
    if (pindaSelections.length) addRelation(relations, relation({ relationType: 'CAREER_ASHTAKAVARGA_CONTEXT', subject: { entityType: 'GRAHA', entityId: lord }, target: { entityType: 'EVIDENCE_NODE', entityId: node.id }, inputNodeIds: [node.id], fact: { selections: pindaSelections, thresholdOrRanking: 'not-performed' } }));
  });
  const contextDefinitions = [
    { number: 2, houseRelation: 'CAREER_RESOURCE_HOUSE', role: 'RESOURCE_CONTEXT', classicalSignification: 'wealth-and-material-resources' },
    { number: 11, houseRelation: 'CAREER_GAIN_HOUSE', role: 'GAIN_CONTEXT', classicalSignification: 'gains-and-acquisition' }
  ];
  const contextHouses = contextDefinitions.map((definition) => ({ ...definition, value: findContextHouse(graph, definition.number) })).filter((definition) => definition.value !== null);
  contextDefinitions.filter((definition) => !contextHouses.some((context) => context.number === definition.number)).forEach((definition) => {
    const absent = missingNode(graph, `H${definition.number}`);
    if (absent) missing.push(freeze({ dataKey: `H${definition.number}`, status: absent.fact.status, sourceNodeId: absent.id, neutrality: 'absence-is-not-negative-evidence' }));
  });
  contextHouses.forEach(({ number, houseRelation, role, classicalSignification, value }) => {
    const contextHouse = { entityType: 'HOUSE', entityId: String(number) };
    addRelation(relations, relation({ relationType: houseRelation, subject: contextHouse, target: { entityType: 'DOMAIN', entityId: CAREER_DOMAIN }, inputNodeIds: [value.node.id], fact: { contextualHouseNumber: number, careerDomainRole: role, classicalHouseSignification: classicalSignification, careerDomainSelection: 'source-interpretation-neutral-context-only' } }));
    addRelation(relations, relation({ relationType: 'CAREER_CONTEXT_HOUSE_LORD', subject: contextHouse, target: { entityType: 'GRAHA', entityId: value.lord }, inputNodeIds: [value.node.id], fact: { contextualHouseNumber: number, careerDomainRole: role, derivation: 'supplied-Layer-5A-house-lord' } }));
    const contextOccupants = [...byBody.values()].filter((node) => assignedHouse(nodeFact(node)) === number).sort((left, right) => bodyOfAssignment(nodeFact(left)).localeCompare(bodyOfAssignment(nodeFact(right))));
    contextOccupants.forEach((node) => addRelation(relations, relation({ relationType: 'CAREER_CONTEXT_HOUSE_OCCUPANT', subject: { entityType: 'GRAHA', entityId: bodyOfAssignment(nodeFact(node)) }, target: contextHouse, inputNodeIds: [node.id], fact: { contextualHouseNumber: number, careerDomainRole: role, derivation: 'supplied-Layer-5A-rashi-house-assignment' } })));
    if (states.length > 0) [value.lord, ...contextOccupants.map((node) => bodyOfAssignment(nodeFact(node)))].filter((body, index, values) => values.indexOf(body) === index).forEach((body) => {
      const state = states.find((node) => node.subject.entityId === body); if (!state) return;
      addRelation(relations, relation({ relationType: body === value.lord ? 'CAREER_CONTEXT_HOUSE_LORD_STATE' : 'CAREER_CONTEXT_OCCUPANT_STATE', subject: { entityType: 'GRAHA', entityId: body }, target: { entityType: 'EVIDENCE_NODE', entityId: state.id }, inputNodeIds: [state.id], fact: { contextualHouseNumber: number, careerDomainRole: role, suppliedStateFlags: stateFlags(nodeFact(state)) } }));
    });
    if (aspects.length > 0) aspects.forEach((node) => {
      const aspect = nodeFact(node); if (!aspect || typeof aspect.fromBody !== 'string') return;
      const metadata = { contextualHouseNumber: number, careerDomainRole: role, aspectNumber: aspect.aspectNumber, targetRashi: aspect.targetRashi || null, targetHouseNumber: aspect.targetHouseNumber ?? null, sourceRulesetId: node.sourceRulesetId };
      if (Number(aspect.targetHouseNumber) === number) addRelation(relations, relation({ relationType: 'CAREER_CONTEXT_HOUSE_ASPECT', subject: { entityType: 'GRAHA', entityId: aspect.fromBody }, target: contextHouse, inputNodeIds: [node.id], fact: metadata }));
      if (Array.isArray(aspect.targetBodies) && aspect.targetBodies.some((target) => target && target.body === value.lord)) addRelation(relations, relation({ relationType: 'CAREER_CONTEXT_HOUSE_LORD_ASPECT', subject: { entityType: 'GRAHA', entityId: aspect.fromBody }, target: { entityType: 'GRAHA', entityId: value.lord }, inputNodeIds: [node.id], fact: metadata }));
    });
  });
  const selectedHouseLords = [{ number: 10, lord, node: h10 }, ...contextHouses.map(({ number, value }) => ({ number, lord: value.lord, node: value.node }))];
  selectedHouseLords.forEach((from) => {
    const assignment = byBody.get(from.lord); if (!assignment) return;
    const to = selectedHouseLords.find((candidate) => candidate.number === assignedHouse(nodeFact(assignment)));
    if (!to || to.number === from.number) return;
    addRelation(relations, relation({ relationType: 'CAREER_HOUSE_DOMAIN_CONNECTION', subject: { entityType: 'HOUSE', entityId: String(from.number) }, target: { entityType: 'HOUSE', entityId: String(to.number) }, inputNodeIds: [from.node.id, assignment.id], fact: { fromHouseNumber: from.number, toHouseNumber: to.number, lord: from.lord, connection: 'supplied-house-lord-placement-only' } }));
  });
  const derivedRelations = [...relations.values()].sort((left, right) => left.id.localeCompare(right.id));
  const evidenceNodeIds = [...new Set(derivedRelations.flatMap((item) => item.inputNodeIds))].sort();
  const result = { domain: CAREER_DOMAIN, rulesetId: CAREER_RULESET_ID, sourceGraphId: graph.graphId, evidenceNodeIds, derivedRelations, derivedRelationIds: derivedRelations.map((item) => item.id), missingData: missing.sort((left, right) => left.dataKey.localeCompare(right.dataKey)), provenance: { sourceGraphLayer: '12A', sourceGraphId: graph.graphId, selectionOnly: true, primaryHousePolicy: 'H10-only; H2-H6-H11 deferred', expandedContextHousePolicy: 'H2-resource-context and H11-gain-context; H6 deferred', yogaCareerMapping: 'deferred-no-audited-mapping', naturalKarakaMapping: 'deferred-no-audited-mapping', d10HouseCalculation: 'not-performed', d10ContextPolicy: 'H10-lord-and-occupants-only; H2-H11-not-expanded', dignityEvaluation: 'not-performed', ashtakavargaThresholds: 'not-performed', ashtakavargaContextPolicy: 'H10-only; H2-H11-not-expanded', scope: 'natal-structural-evidence-only' } };
  assertNoForbidden(result);
  return freeze(result);
}

module.exports = { buildCareerEvidence, ashtakavargaSelections, stateFlags };
