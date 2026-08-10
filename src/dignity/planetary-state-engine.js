'use strict';

const { classifySiderealLongitude } = require('../jyotish/classify-sidereal-longitude');
const {
  SEVEN_GRAHA_DIGNITY_RULESET_ID, NODE_DIGNITY_RULESET_ID, NATURAL_MAITRI_RULESET_ID,
  TEMPORARY_MAITRI_RULESET_ID, PANCHADHA_MAITRI_RULESET_ID, COMBUSTION_RULESET_ID,
  SEVEN_CLASSICAL_BODIES, NODE_BODIES, RASHI_LORDS, SEVEN_GRAHA_DIGNITIES, NODE_DIGNITIES,
  NATURAL_MAITRI, TEMPORARY_FRIEND_OFFSETS, COMBUSTION_THRESHOLDS, rashiByIndex
} = require('./reference-data');

const PROVIDER_STATES = new Set(['direct', 'retrograde', 'stationary', 'unknown']);

function freezeRecord(record) { return Object.freeze(record); }

function resolveRulesets({ dignityRulesetId = SEVEN_GRAHA_DIGNITY_RULESET_ID, nodeDignityRulesetId = NODE_DIGNITY_RULESET_ID, naturalMaitriRulesetId = NATURAL_MAITRI_RULESET_ID, temporaryMaitriRulesetId = TEMPORARY_MAITRI_RULESET_ID, panchadhaMaitriRulesetId = PANCHADHA_MAITRI_RULESET_ID, combustionRulesetId = COMBUSTION_RULESET_ID } = {}) {
  if (dignityRulesetId !== SEVEN_GRAHA_DIGNITY_RULESET_ID) throw new RangeError(`Unsupported dignity ruleset: ${dignityRulesetId}`);
  if (nodeDignityRulesetId !== null && nodeDignityRulesetId !== NODE_DIGNITY_RULESET_ID) throw new RangeError(`Unsupported node dignity ruleset: ${nodeDignityRulesetId}`);
  if (naturalMaitriRulesetId !== NATURAL_MAITRI_RULESET_ID) throw new RangeError(`Unsupported natural Maitri ruleset: ${naturalMaitriRulesetId}`);
  if (temporaryMaitriRulesetId !== TEMPORARY_MAITRI_RULESET_ID) throw new RangeError(`Unsupported temporary Maitri ruleset: ${temporaryMaitriRulesetId}`);
  if (panchadhaMaitriRulesetId !== PANCHADHA_MAITRI_RULESET_ID) throw new RangeError(`Unsupported Panchadha Maitri ruleset: ${panchadhaMaitriRulesetId}`);
  if (combustionRulesetId !== COMBUSTION_RULESET_ID) throw new RangeError(`Unsupported combustion ruleset: ${combustionRulesetId}`);
  return freezeRecord({ dignityRulesetId, nodeDignityRulesetId, naturalMaitriRulesetId, temporaryMaitriRulesetId, panchadhaMaitriRulesetId, combustionRulesetId });
}

function canonicalLongitudeFor(body, input) {
  const canonical = input && input.canonicalSiderealLongitudeDegrees;
  const sidereal = input && input.siderealLongitudeDegrees;
  if (canonical !== undefined && sidereal !== undefined && canonical !== sidereal) throw new RangeError(`Body ${body} supplies contradictory canonical sidereal longitudes.`);
  const longitude = canonical === undefined ? sidereal : canonical;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new TypeError(`Body ${body} must provide a finite canonicalSiderealLongitudeDegrees.`);
  return longitude;
}

function suppliedRashiIndex(input) {
  if (input.rashi === undefined) return undefined;
  if (typeof input.rashi === 'number') return input.rashi;
  if (input.rashi && typeof input.rashi.rashiIndex === 'number') return input.rashi.rashiIndex;
  throw new TypeError('Supplied rashi must be a Rashi index or an object containing rashiIndex.');
}

function normalizeInputBody(body, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`Body ${body} must be an object.`);
  const canonicalSiderealLongitudeDegrees = canonicalLongitudeFor(body, input);
  const coordinates = classifySiderealLongitude(canonicalSiderealLongitudeDegrees);
  const rashiIndex = suppliedRashiIndex(input);
  if (rashiIndex !== undefined && rashiIndex !== coordinates.rashi.rashiIndex) throw new RangeError(`Body ${body} supplied Rashi contradicts canonical sidereal longitude.`);
  if (input.degreesWithinRashi !== undefined && input.degreesWithinRashi !== coordinates.rashi.degreesWithinRashi) throw new RangeError(`Body ${body} supplied degreesWithinRashi contradicts canonical sidereal longitude.`);
  const providerState = input.motion && input.motion.providerState !== undefined ? input.motion.providerState : input.providerState === undefined ? (input.motion || 'unknown') : input.providerState;
  if (typeof providerState !== 'string' || !PROVIDER_STATES.has(providerState)) throw new RangeError(`Body ${body} has unsupported providerState: ${providerState}`);
  return freezeRecord({
    body,
    canonicalSiderealLongitudeDegrees,
    normalizedCanonicalSiderealLongitudeDegrees: coordinates.normalizedLongitudeDegrees,
    rashi: freezeRecord({ ...coordinates.rashi }),
    degreesWithinRashi: coordinates.rashi.degreesWithinRashi,
    providerState
  });
}

function circularDistance(a, b) {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

function naturalRelationship(source, target) {
  const definition = NATURAL_MAITRI[source];
  if (!definition || !SEVEN_CLASSICAL_BODIES.includes(target)) return null;
  if (definition.friends.includes(target)) return 'friend';
  if (definition.neutrals.includes(target)) return 'neutral';
  if (definition.enemies.includes(target)) return 'enemy';
  return null;
}

function temporaryRelationship(source, target) {
  const offset = (target.rashi.rashiIndex - source.rashi.rashiIndex + 12) % 12;
  return TEMPORARY_FRIEND_OFFSETS.includes(offset) ? 'friend' : 'enemy';
}

function compoundRelationship(natural, temporary) {
  if (natural === 'friend' && temporary === 'friend') return 'greatFriend';
  if (natural === 'friend' && temporary === 'enemy') return 'neutral';
  if (natural === 'neutral' && temporary === 'friend') return 'friend';
  if (natural === 'neutral' && temporary === 'enemy') return 'enemy';
  if (natural === 'enemy' && temporary === 'friend') return 'neutral';
  if (natural === 'enemy' && temporary === 'enemy') return 'greatEnemy';
  return null;
}

function dignityFor(body, state, nodeDignityRulesetId) {
  const definition = SEVEN_GRAHA_DIGNITIES[body] || (nodeDignityRulesetId === NODE_DIGNITY_RULESET_ID ? NODE_DIGNITIES[body] : null);
  if (!definition) return freezeRecord({
    isOwnSign: null, isMoolatrikona: null, isExalted: null, isDebilitated: null,
    exactExaltationPoint: null, exactDebilitationPoint: null,
    exaltationPointDegreesWithinRashi: null, debilitationPointDegreesWithinRashi: null,
    distanceFromExactExaltationDegrees: null, distanceFromExactDebilitationDegrees: null,
    status: 'notDefinedByRuleset'
  });
  const isMoolatrikona = definition.moolatrikona && state.rashi.rashiIndex === definition.moolatrikona.rashiIndex && state.degreesWithinRashi >= definition.moolatrikona.startDegrees && state.degreesWithinRashi < definition.moolatrikona.endDegrees;
  const exaltationLongitude = definition.exaltationPointDegreesWithinRashi === null ? null : rashiByIndex(definition.exaltationRashiIndex).startDegrees + definition.exaltationPointDegreesWithinRashi;
  const debilitationLongitude = definition.debilitationPointDegreesWithinRashi === null ? null : rashiByIndex(definition.debilitationRashiIndex).startDegrees + definition.debilitationPointDegreesWithinRashi;
  return freezeRecord({
    isOwnSign: definition.ownRashis.includes(state.rashi.rashiIndex),
    isMoolatrikona: Boolean(isMoolatrikona),
    isExalted: state.rashi.rashiIndex === definition.exaltationRashiIndex,
    isDebilitated: state.rashi.rashiIndex === definition.debilitationRashiIndex,
    exactExaltationPoint: exaltationLongitude === null ? null : state.normalizedCanonicalSiderealLongitudeDegrees === exaltationLongitude,
    exactDebilitationPoint: debilitationLongitude === null ? null : state.normalizedCanonicalSiderealLongitudeDegrees === debilitationLongitude,
    exaltationPointDegreesWithinRashi: definition.exaltationPointDegreesWithinRashi,
    debilitationPointDegreesWithinRashi: definition.debilitationPointDegreesWithinRashi,
    distanceFromExactExaltationDegrees: exaltationLongitude === null ? null : circularDistance(state.normalizedCanonicalSiderealLongitudeDegrees, exaltationLongitude),
    distanceFromExactDebilitationDegrees: debilitationLongitude === null ? null : circularDistance(state.normalizedCanonicalSiderealLongitudeDegrees, debilitationLongitude),
    status: 'defined'
  });
}

function combustionFor(body, state, sun) {
  const thresholds = COMBUSTION_THRESHOLDS[body];
  if (!thresholds) return freezeRecord({ applicable: false, status: 'notApplicable', combust: null, angularDistanceFromSunDegrees: null, thresholdDegrees: null, rulesetId: COMBUSTION_RULESET_ID, equalityPolicy: '<=' });
  if (!sun) return freezeRecord({ applicable: true, status: 'unavailableMissingSun', combust: null, angularDistanceFromSunDegrees: null, thresholdDegrees: null, rulesetId: COMBUSTION_RULESET_ID, equalityPolicy: '<=' });
  const angularDistanceFromSunDegrees = circularDistance(state.normalizedCanonicalSiderealLongitudeDegrees, sun.normalizedCanonicalSiderealLongitudeDegrees);
  const directThreshold = thresholds.direct;
  const retrogradeThreshold = thresholds.retrograde;
  if (state.providerState === 'unknown' && directThreshold !== retrogradeThreshold) return freezeRecord({ applicable: true, status: 'indeterminateUnknownMotion', combust: null, angularDistanceFromSunDegrees, thresholdDegrees: null, rulesetId: COMBUSTION_RULESET_ID, equalityPolicy: '<=' });
  const thresholdDegrees = state.providerState === 'retrograde' ? retrogradeThreshold : directThreshold;
  return freezeRecord({ applicable: true, status: 'determined', combust: angularDistanceFromSunDegrees <= thresholdDegrees, angularDistanceFromSunDegrees, thresholdDegrees, rulesetId: COMBUSTION_RULESET_ID, equalityPolicy: '<=' });
}

function relationshipsFor(body, state, states) {
  if (!SEVEN_CLASSICAL_BODIES.includes(body)) return freezeRecord({ naturalByBody: freezeRecord({}), temporaryByBody: freezeRecord({}), compoundByBody: freezeRecord({}), naturalToSignLord: null, temporaryToSignLord: null, compoundToSignLord: null, signLordRelationshipStatus: 'notDefinedByRuleset' });
  const relationshipBodies = SEVEN_CLASSICAL_BODIES.filter((target) => target !== body && states[target]);
  const naturalByBody = {};
  const temporaryByBody = {};
  const compoundByBody = {};
  for (const target of relationshipBodies) {
    const natural = naturalRelationship(body, target);
    const temporary = temporaryRelationship(state, states[target]);
    naturalByBody[target] = natural;
    temporaryByBody[target] = temporary;
    compoundByBody[target] = compoundRelationship(natural, temporary);
  }
  const signLord = RASHI_LORDS[state.rashi.rashiIndex];
  if (signLord === body) return freezeRecord({ naturalByBody: freezeRecord(naturalByBody), temporaryByBody: freezeRecord(temporaryByBody), compoundByBody: freezeRecord(compoundByBody), naturalToSignLord: null, temporaryToSignLord: null, compoundToSignLord: null, signLordRelationshipStatus: 'notApplicableSelf' });
  const naturalToSignLord = naturalRelationship(body, signLord);
  if (!states[signLord]) return freezeRecord({ naturalByBody: freezeRecord(naturalByBody), temporaryByBody: freezeRecord(temporaryByBody), compoundByBody: freezeRecord(compoundByBody), naturalToSignLord, temporaryToSignLord: null, compoundToSignLord: null, signLordRelationshipStatus: 'unavailableSignLordPosition' });
  const temporaryToSignLord = temporaryRelationship(state, states[signLord]);
  return freezeRecord({ naturalByBody: freezeRecord(naturalByBody), temporaryByBody: freezeRecord(temporaryByBody), compoundByBody: freezeRecord(compoundByBody), naturalToSignLord, temporaryToSignLord, compoundToSignLord: compoundRelationship(naturalToSignLord, temporaryToSignLord), signLordRelationshipStatus: 'available' });
}

function evaluatePlanetaryState({ bodies, ...ruleOptions } = {}) {
  if (!bodies || typeof bodies !== 'object' || Array.isArray(bodies)) throw new TypeError('bodies must be an object keyed by body name.');
  const rulesets = resolveRulesets(ruleOptions);
  const states = Object.fromEntries(Object.entries(bodies).map(([body, input]) => [body, normalizeInputBody(body, input)]));
  const sun = states.Sun;
  const results = Object.fromEntries(Object.entries(states).map(([body, state]) => [body, freezeRecord({
    body,
    canonicalSiderealLongitudeDegrees: state.canonicalSiderealLongitudeDegrees,
    normalizedCanonicalSiderealLongitudeDegrees: state.normalizedCanonicalSiderealLongitudeDegrees,
    rashi: state.rashi,
    degreesWithinRashi: state.degreesWithinRashi,
    dignity: dignityFor(body, state, rulesets.nodeDignityRulesetId),
    motion: freezeRecord({ providerState: state.providerState, isRetrograde: state.providerState === 'retrograde' }),
    combustion: combustionFor(body, state, sun),
    relationships: relationshipsFor(body, state, states)
  })]));
  return freezeRecord({
    rulesets,
    bodies: freezeRecord(results),
    provenance: freezeRecord({ providerIndependent: true, coordinateFrame: 'canonical-sidereal', coordinateAuthority: 'canonicalSiderealLongitudeDegrees', ayanamshaCalculation: 'not-performed', astronomicalCalculation: 'not-performed', sourceStatuses: freezeRecord({ sevenGrahaDignity: 'A/B', nodeDignity: 'A/B', naturalMaitri: 'A/B', temporaryMaitri: 'A/B', panchadhaMaitri: 'A/B', combustionThresholds: 'C' }) })
  });
}

module.exports = { evaluatePlanetaryState, resolveRulesets, circularDistance, compoundRelationship };
