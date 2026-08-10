'use strict';

const { EVIDENCE_RULESET_ID } = require('./reference-data');
const { EvidenceGraphBuilder } = require('./evidence-graph');
const { validateNatalConsistency } = require('./input-validation');

function fact(builder, { subject, sourceLayer, sourceRulesetId, sourceIdentity, fact: value, sourceStrength = 'ENGINE_CONVENTION' }) {
  return builder.addFact({ subject, sourceLayer, sourceRulesetId, sourceIdentity, sourceStrength, fact: value });
}
function missing(builder, key) { return builder.addMissingData({ subject: { entityType: 'NATAL_CHART', entityId: 'natal' }, sourceLayer: '12A', sourceRulesetId: EVIDENCE_RULESET_ID, sourceIdentity: `missing:${key}`, sourceStrength: 'ENGINE_CONVENTION', dataKey: key, status: 'notProvided' }); }
function adaptLayer2Bodies(builder, layer2Bodies) {
  if (!layer2Bodies || typeof layer2Bodies !== 'object' || Array.isArray(layer2Bodies)) return missing(builder, 'layer2Classification');
  return Object.entries(layer2Bodies).map(([body, value]) => fact(builder, { subject: { entityType: body === 'Ascendant' ? 'ANGLE' : 'GRAHA', entityId: body }, sourceLayer: '2', sourceRulesetId: 'layer2-jyotish-classification-v1', sourceIdentity: `bodies.${body}`, fact: value }));
}
function adaptHouses(builder, houses) {
  if (houses === undefined) return missing(builder, 'd1Houses');
  if (!houses || !Array.isArray(houses.houses) || !Array.isArray(houses.planetaryAssignments)) throw new TypeError('Layer 5A houses must provide houses and planetaryAssignments arrays.');
  const ruleset = houses.rulesetId || 'parashari-rashi-house-v1';
  const nodes = houses.houses.map((house) => fact(builder, { subject: { entityType: 'HOUSE', entityId: String(house.houseNumber) }, sourceLayer: '5A', sourceRulesetId: ruleset, sourceIdentity: `houses.${house.houseNumber}`, fact: house }));
  houses.planetaryAssignments.forEach((assignment) => nodes.push(fact(builder, { subject: { entityType: 'GRAHA', entityId: assignment.body }, sourceLayer: '5A', sourceRulesetId: ruleset, sourceIdentity: `planetaryAssignments.${assignment.body}`, fact: assignment })));
  return nodes;
}
function adaptBodiesResult(builder, result, layer, key) {
  if (result === undefined) return missing(builder, key);
  if (!result || !result.bodies || typeof result.bodies !== 'object') throw new TypeError(`${key} must provide a bodies object.`);
  const ruleset = result.rulesetId || `${key}-ruleset`;
  return Object.entries(result.bodies).map(([body, value]) => fact(builder, { subject: { entityType: 'GRAHA', entityId: body }, sourceLayer: layer, sourceRulesetId: ruleset, sourceIdentity: `${key}.${body}`, fact: value }));
}
function adaptDrishti(builder, drishti) {
  if (drishti === undefined) return missing(builder, 'grahaDrishti');
  if (!drishti || !Array.isArray(drishti.rashiAspects)) throw new TypeError('grahaDrishti must provide rashiAspects.');
  return drishti.rashiAspects.map((aspect) => fact(builder, { subject: { entityType: 'GRAHA', entityId: aspect.fromBody }, sourceLayer: '6', sourceRulesetId: drishti.rulesetId || 'parashari-graha-drishti-v1', sourceIdentity: `rashiAspects.${aspect.fromBody}.${aspect.aspectNumber}.${aspect.targetRashi.rashiIndex}`, sourceStrength: 'DIRECT_CLASSICAL', fact: aspect }));
}
function adaptYogas(builder, yogas) {
  if (yogas === undefined) return missing(builder, 'yogas');
  const entries = yogas && (yogas.evaluations || yogas.yogas);
  if (!Array.isArray(entries)) throw new TypeError('yogas must provide evaluations or yogas.');
  return entries.map((yoga) => fact(builder, { subject: { entityType: 'YOGA', entityId: yoga.id || yoga.yogaId || yoga.name }, sourceLayer: '7', sourceRulesetId: yogas.rulesetId || yogas.rulesetBundleId || 'parashari-yoga-foundation-v1', sourceIdentity: `yogas.${yoga.id || yoga.yogaId || yoga.name}`, fact: yoga }));
}
function adaptAshtakavarga(builder, ashtakavarga) {
  if (ashtakavarga === undefined) return missing(builder, 'ashtakavarga');
  if (!ashtakavarga || typeof ashtakavarga !== 'object') throw new TypeError('ashtakavarga must be an object.');
  return fact(builder, { subject: { entityType: 'NATAL_CHART', entityId: 'natal' }, sourceLayer: '11', sourceRulesetId: ashtakavarga.rulesetId || 'ashtakavarga-composite', sourceIdentity: 'ashtakavarga', fact: ashtakavarga });
}
function adaptVargas(builder, vargas) {
  if (vargas === undefined) return missing(builder, 'vargas');
  if (!vargas || typeof vargas !== 'object' || Array.isArray(vargas)) throw new TypeError('vargas must be an object.');
  return Object.entries(vargas).map(([id, value]) => fact(builder, { subject: { entityType: 'VARGA', entityId: id }, sourceLayer: '3', sourceRulesetId: value.rulesetId || 'parashari-varga-engine-v1', sourceIdentity: `vargas.${id}`, fact: value }));
}
function assembleNatalEvidenceGraph(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Natal evidence input must be an object.');
  const natal = input.natal || input;
  if (!natal || typeof natal !== 'object' || Array.isArray(natal)) throw new TypeError('natal evidence must be an object.');
  if (Object.hasOwn(natal, 'temporal') || Object.hasOwn(input, 'temporal') || Object.hasOwn(natal, 'instant')) throw new RangeError('Layer 12A does not accept temporal context.');
  const layer2Bodies = natal.layer2Bodies || natal.classification;
  const houses = natal.houses;
  validateNatalConsistency({ layer2Bodies, houses });
  const builder = new EvidenceGraphBuilder({ sourceIdentity: input.sourceIdentity || 'natal-evidence-graph' });
  adaptLayer2Bodies(builder, layer2Bodies); adaptHouses(builder, houses); adaptBodiesResult(builder, natal.planetaryState, '5B', 'planetaryState'); adaptDrishti(builder, natal.grahaDrishti); adaptYogas(builder, natal.yogas); adaptAshtakavarga(builder, natal.ashtakavarga); adaptVargas(builder, natal.vargas);
  return builder.build();
}

module.exports = { assembleNatalEvidenceGraph, adaptLayer2Bodies, adaptHouses, adaptBodiesResult, adaptDrishti, adaptYogas, adaptAshtakavarga, adaptVargas };
