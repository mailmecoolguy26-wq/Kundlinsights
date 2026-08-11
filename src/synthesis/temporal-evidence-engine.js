'use strict';

const { hash, stable, freeze } = require('./evidence-node');
const { TEMPORAL_RULESET_ID, TEMPORAL_RELATION_TYPES, SUPPORTED_TRANSIT_EVENT_TYPES } = require('./temporal-reference-data');

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function utc(value, name = 'instant') { if (typeof value !== 'string' || !value.endsWith('Z') || Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be a valid UTC ISO timestamp.`); return value; }
function same(left, right) { return stable(left) === stable(right); }
function subject(entityType, entityId) { return Object.freeze({ entityType, entityId: String(entityId) }); }
function staticGraph(graph) { if (!object(graph) || typeof graph.graphId !== 'string' || !Array.isArray(graph.nodes) || !graph.provenance || graph.provenance.layer !== '12A') throw new TypeError('Temporal evidence requires a built Layer 12A natal graph.'); return graph; }
function careerGraph(graph) { if (graph === undefined) return null; if (!object(graph) || graph.domain !== 'CAREER' || !Array.isArray(graph.derivedRelations) || typeof graph.sourceGraphId !== 'string') throw new TypeError('domainGraph must be the Layer 12B Career evidence result.'); return graph; }
function node(identity, { kind, subject: nodeSubject, sourceLayer, sourceRulesetId, sourceStrength, fact, temporalContext }) {
  const id = `${kind === 'MISSING_DATA' ? 'missing' : 'temporal-fact'}:${hash({ rulesetId: TEMPORAL_RULESET_ID, kind, subject: nodeSubject, sourceLayer, sourceRulesetId, identity })}`;
  return freeze({ id, kind, domain: null, subject: nodeSubject, sourceLayer, sourceRulesetId, sourceStrength, temporalContextId: temporalContext.id, temporalContext, fact, relationType: null, inputNodeIds: [], provenance: { sourceIdentity: identity, temporalRulesetId: TEMPORAL_RULESET_ID, upstreamCalculation: 'consumed-not-performed' } });
}
function relation(type, temporalNode, staticReference, fact = null) {
  if (!TEMPORAL_RELATION_TYPES.includes(type)) throw new RangeError(`Unsupported temporal relation type: ${type}`);
  const identity = { rulesetId: TEMPORAL_RULESET_ID, type, temporalNodeId: temporalNode.id, staticReferenceId: staticReference.id };
  return freeze({ id: `temporal-relation:${hash(identity)}`, kind: 'DERIVED_RELATION', domain: null, subject: staticReference.subject, sourceLayer: '12C', sourceRulesetId: TEMPORAL_RULESET_ID, sourceStrength: staticReference.sourceStrength || 'ENGINE_CONVENTION', temporalContextId: temporalNode.temporalContextId, temporalContext: temporalNode.temporalContext, relationType: type, inputNodeIds: [temporalNode.id, staticReference.id].sort(), fact, provenance: { temporalEvidenceNodeId: temporalNode.id, staticEvidenceReferenceId: staticReference.id, relationshipCalculation: 'structural-match-of-supplied-evidence-only' } });
}
function periodMillis(period, side) { const value = period && period[`${side}Instant`]; const text = value && (value.utc || value); return Date.parse(utc(text, `${side}Instant`)); }
function contains(period, milliseconds) { return periodMillis(period, 'start') <= milliseconds && milliseconds < periodMillis(period, 'end'); }
function flattenPeriods(periods, output = []) { (periods || []).forEach((period) => { output.push(period); flattenPeriods(period.children, output); }); return output; }
function activePeriods(dasha, instant) {
  if (!object(dasha)) return [];
  const time = Date.parse(instant);
  const candidates = Array.isArray(dasha.periods) ? flattenPeriods(dasha.periods) : Object.values(dasha.activeAt || dasha.activeAtBirth || {});
  const active = candidates.filter((period) => object(period) && typeof period.level === 'string' && contains(period, time));
  const byLevel = new Map();
  active.forEach((period) => { if (byLevel.has(period.level) && byLevel.get(period.level).lord.id !== period.lord.id) throw new RangeError(`Contradictory active ${period.level} lords.`); byLevel.set(period.level, period); });
  return [...byLevel.values()].sort((left, right) => ['mahadasha', 'antardasha', 'pratyantardasha'].indexOf(left.level) - ['mahadasha', 'antardasha', 'pratyantardasha'].indexOf(right.level));
}
function staticReferences(natalGraph, domainGraph) {
  const nodes = natalGraph.nodes.map((item) => ({ id: item.id, subject: item.subject, sourceStrength: item.sourceStrength, sourceLayer: item.sourceLayer, kind: 'NATAL_FACT' }));
  const relations = domainGraph ? domainGraph.derivedRelations.map((item) => ({ id: item.id, subject: item.subject, target: item.target, sourceStrength: item.sourceStrength, sourceLayer: '12B', kind: 'DOMAIN_RELATION', relationType: item.relationType })) : [];
  return [...nodes, ...relations];
}
function add(map, value) { const prior = map.get(value.id); if (prior && !same(prior, value)) throw new RangeError(`Contradictory duplicate temporal identity: ${value.id}`); map.set(value.id, value); }
function relatedToBody(reference, body) { return reference.subject && reference.subject.entityId === body || reference.target && reference.target.entityId === body; }
function relatedToHouse(reference, number) { return reference.subject && reference.subject.entityType === 'HOUSE' && reference.subject.entityId === String(number) || reference.target && reference.target.entityType === 'HOUSE' && reference.target.entityId === String(number); }
function buildTemporalEvidence(input = {}) {
  if (!object(input)) throw new TypeError('Temporal evidence input must be an object.');
  const instant = utc(input.instant);
  const natalGraph = staticGraph(input.natalGraph); const domainGraph = careerGraph(input.domainGraph);
  if (domainGraph && domainGraph.sourceGraphId !== natalGraph.graphId) throw new RangeError('Career domain graph must reference the supplied Layer 12A natal graph.');
  const temporalNodes = new Map(); const temporalRelations = new Map(); const missingData = [];
  const refs = staticReferences(natalGraph, domainGraph);
  const missing = (key) => { const value = node(`missing:${key}`, { kind: 'MISSING_DATA', subject: subject('TEMPORAL_CONTEXT', instant), sourceLayer: '12C', sourceRulesetId: TEMPORAL_RULESET_ID, sourceStrength: 'ENGINE_CONVENTION', temporalContext: { id: instant, type: 'POINT', instant }, fact: { dataKey: key, status: 'notProvided', neutrality: 'absence-is-not-negative-evidence' } }); add(temporalNodes, value); missingData.push(value); };
  if (!domainGraph) missing('careerDomainGraph');
  if (input.dasha === undefined) missing('dasha');
  else {
    const active = activePeriods(input.dasha, instant);
    if (active.length === 0) throw new RangeError('No supplied Dasha interval is active at the requested temporal instant.');
    active.forEach((period) => {
    const lord = period.lord && (period.lord.id || period.lord.name); if (typeof lord !== 'string') throw new TypeError('Active Dasha period must provide a lord.');
    const temporal = node(period.id, { kind: 'FACT', subject: subject('DASHA_LORD', lord), sourceLayer: '4', sourceRulesetId: period.rulesetId || input.dasha.ruleset && input.dasha.ruleset.id || 'vimshottari-supplied', sourceStrength: 'CLASSICAL_TRANSLATION', temporalContext: { id: period.id, type: 'INTERVAL', startInstant: period.startInstant.utc || period.startInstant, endInstant: period.endInstant.utc || period.endInstant }, fact: { dashaLevel: period.level, lord, startInstant: period.startInstant, endInstant: period.endInstant, upstreamPeriodId: period.id, upstreamProvenance: input.dasha.provenance || null } });
    add(temporalNodes, temporal); refs.filter((reference) => relatedToBody(reference, lord)).forEach((reference) => add(temporalRelations, relation('TEMPORALLY_ACTIVATES', temporal, reference, { mechanism: 'active-vimshottari-period', dashaLevel: period.level })));
    });
  }
  if (input.gochar === undefined) missing('gochar');
  else {
    if (!object(input.gochar) || utc(input.gochar.snapshotInstant, 'gochar.snapshotInstant') !== instant || !object(input.gochar.transitBodies)) throw new RangeError('Gochar snapshot must match the requested temporal instant and provide transitBodies.');
    for (const [body, fact] of Object.entries(input.gochar.transitBodies)) {
      if (!fact || fact.body && fact.body !== body) throw new RangeError(`Contradictory Gochar body fact for ${body}.`);
      const temporal = node(`gochar:${body}:${instant}`, { kind: 'FACT', subject: subject('TRANSIT_GRAHA', body), sourceLayer: '9', sourceRulesetId: input.gochar.rulesets && input.gochar.rulesets.transitHouse || 'gochar-supplied', sourceStrength: 'ENGINE_CONVENTION', temporalContext: { id: instant, type: 'POINT', instant }, fact: { body, siderealLongitudeDegrees: fact.transitCanonicalSiderealLongitudeDegrees ?? null, rashi: fact.transitRashi || null, natalHouseNumber: fact.transitNatalHouseNumber ?? null, motion: fact.motion || null, upstreamEvidence: fact, upstreamProvenance: input.gochar.provenance || null } });
      add(temporalNodes, temporal); const targets = new Set();
      refs.filter((reference) => relatedToBody(reference, body)).forEach((reference) => targets.add(reference));
      (fact.sameRashiNatalBodies || []).forEach((target) => refs.filter((reference) => relatedToBody(reference, target.body || target)).forEach((reference) => targets.add(reference)));
      (fact.aspectsNatalBodies || []).forEach((target) => refs.filter((reference) => relatedToBody(reference, target.natalBody || target.body)).forEach((reference) => targets.add(reference)));
      if (fact.transitNatalHouseNumber !== undefined) refs.filter((reference) => relatedToHouse(reference, fact.transitNatalHouseNumber)).forEach((reference) => targets.add(reference));
      targets.forEach((reference) => add(temporalRelations, relation('TEMPORALLY_ACTIVATES', temporal, reference, { mechanism: 'supplied-gochar-snapshot' })));
    }
  }
  if (input.transitEvents === undefined) missing('transitEvents');
  else {
    const events = Array.isArray(input.transitEvents) ? input.transitEvents : input.transitEvents.events;
    if (!Array.isArray(events)) throw new TypeError('transitEvents must be an array or Layer 10 scan result.');
    const seen = new Map();
    events.forEach((event) => {
      if (!object(event) || !SUPPORTED_TRANSIT_EVENT_TYPES.includes(event.eventType)) throw new RangeError(`Unsupported Layer 10 event type: ${event && event.eventType}`);
      const eventInstant = utc(event.instant, 'transit event instant'); const identity = event.id || [event.eventType, event.body || event.transitBody || '', eventInstant, event.natalBody || '', event.aspectOrdinal || ''].join('|');
      if (seen.has(identity) && !same(seen.get(identity), event)) throw new RangeError(`Contradictory transit event identity: ${identity}`); seen.set(identity, event);
      const temporal = node(`event:${identity}`, { kind: 'FACT', subject: subject('TRANSIT_EVENT', event.body || event.transitBody || event.eventType), sourceLayer: '10', sourceRulesetId: input.transitEvents.rulesetId || 'transit-event-scanner-v1', sourceStrength: 'ENGINE_CONVENTION', temporalContext: { id: eventInstant, type: 'POINT', instant: eventInstant }, fact: { eventType: event.eventType, instant: eventInstant, body: event.body || event.transitBody || null, natalBody: event.natalBody || null, targetHouseNumber: event.targetHouseNumber ?? event.toHouseNumber ?? null, sourceEventIdentity: identity, upstreamEvidence: event, upstreamProvenance: input.transitEvents.provenance || null } });
      add(temporalNodes, temporal); const body = event.body || event.transitBody; const targets = new Set();
      if (event.natalBody) refs.filter((reference) => relatedToBody(reference, event.natalBody)).forEach((reference) => targets.add(reference));
      if (body) refs.filter((reference) => relatedToBody(reference, body)).forEach((reference) => targets.add(reference));
      const house = event.targetHouseNumber ?? event.toHouseNumber; if (house !== undefined) refs.filter((reference) => relatedToHouse(reference, house)).forEach((reference) => targets.add(reference));
      targets.forEach((reference) => add(temporalRelations, relation('TEMPORALLY_ACTIVATES', temporal, reference, { mechanism: 'supplied-transit-event', eventType: event.eventType })));
    });
  }
  const activationBySubject = new Map();
  [...temporalRelations.values()].filter((item) => item.relationType === 'TEMPORALLY_ACTIVATES').forEach((item) => { const key = `${item.subject.entityType}:${item.subject.entityId}`; if (!activationBySubject.has(key)) activationBySubject.set(key, []); activationBySubject.get(key).push(item); });
  activationBySubject.forEach((activations) => {
    const dasha = activations.filter((item) => temporalNodes.get(item.inputNodeIds.find((id) => temporalNodes.has(id))).sourceLayer === '4');
    const transit = activations.filter((item) => ['9', '10'].includes(temporalNodes.get(item.inputNodeIds.find((id) => temporalNodes.has(id))).sourceLayer));
    dasha.forEach((left) => transit.forEach((right) => {
      const identity = { rulesetId: TEMPORAL_RULESET_ID, type: 'TEMPORAL_CO_ACTIVATION', dashaRelationId: left.id, transitRelationId: right.id, staticSubject: left.subject };
      add(temporalRelations, freeze({ id: `temporal-relation:${hash(identity)}`, kind: 'DERIVED_RELATION', domain: null, subject: left.subject, sourceLayer: '12C', sourceRulesetId: TEMPORAL_RULESET_ID, sourceStrength: 'ENGINE_CONVENTION', temporalContextId: instant, temporalContext: { id: instant, type: 'POINT', instant }, relationType: 'TEMPORAL_CO_ACTIVATION', inputNodeIds: [left.id, right.id].sort(), fact: { dashaRelationId: left.id, transitRelationId: right.id, staticSubject: left.subject }, provenance: { relationshipCalculation: 'independent-dasha-and-transit-structural-activation-only' } }));
    }));
  });
  const nodes = [...temporalNodes.values()].sort((left, right) => left.id.localeCompare(right.id)); const relations = [...temporalRelations.values()].sort((left, right) => left.id.localeCompare(right.id));
  return freeze({ graphId: `temporal-graph:${hash({ rulesetId: TEMPORAL_RULESET_ID, instant, natalGraphId: natalGraph.graphId, domainGraphId: domainGraph && domainGraph.sourceGraphId || null, nodeIds: nodes.map((item) => item.id), relationIds: relations.map((item) => item.id) })}`, rulesetId: TEMPORAL_RULESET_ID, instant, natalGraphId: natalGraph.graphId, domainGraphId: domainGraph ? domainGraph.sourceGraphId : null, nodes, temporalNodes: nodes, relations, missingData: missingData.sort((left, right) => left.id.localeCompare(right.id)), provenance: { layer: '12C', staticEvidence: 'Layer-12A-and-optional-Layer-12B-consumed', astronomyCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', dashaCalculation: 'not-performed', gocharCalculation: 'not-performed', transitScanning: 'not-performed', natalInterpretation: 'not-performed', prediction: 'not-performed', ordering: 'stable-id-lexicographic' } });
}

module.exports = { buildTemporalEvidence, activePeriods };
