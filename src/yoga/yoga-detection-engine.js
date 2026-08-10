'use strict';

const { classifySiderealLongitude } = require('../jyotish/classify-sidereal-longitude');
const { YOGA_BUNDLE_ID, D1_CHART_ID, LAYER_5A_HOUSE_SYSTEM_ID, YOGA_DEFINITIONS, MAHAPURUSHA_PLANETS } = require('./reference-data');
const { normalizedRashiOffset, isKendraFromRashi, kendraOrdinal, isKendraHouse, isDusthanaHouse } = require('./predicates');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function rashiSummary(rashi) {
  return { rashiIndex: rashi.rashiIndex, sanskritName: rashi.sanskritName, englishName: rashi.englishName };
}

function suppliedRashiIndex(input) {
  if (input.rashi === undefined) return undefined;
  if (typeof input.rashi === 'number') return input.rashi;
  if (input.rashi && Number.isInteger(input.rashi.rashiIndex)) return input.rashi.rashiIndex;
  throw new TypeError('Supplied rashi must be a Rashi index or an object containing rashiIndex.');
}

function canonicalLongitudeFor(body, input) {
  const canonical = input && input.canonicalSiderealLongitudeDegrees;
  const sidereal = input && input.siderealLongitudeDegrees;
  if (canonical !== undefined && sidereal !== undefined && canonical !== sidereal) throw new RangeError(`Body ${body} supplies contradictory canonical sidereal longitudes.`);
  const longitude = canonical === undefined ? sidereal : canonical;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new TypeError(`Body ${body} must provide a finite canonicalSiderealLongitudeDegrees.`);
  return longitude;
}

function normalizeBody(body, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`Body ${body} must be an object.`);
  const canonicalSiderealLongitudeDegrees = canonicalLongitudeFor(body, input);
  const coordinates = classifySiderealLongitude(canonicalSiderealLongitudeDegrees);
  const rashiIndex = suppliedRashiIndex(input);
  if (rashiIndex !== undefined && rashiIndex !== coordinates.rashi.rashiIndex) throw new RangeError(`Body ${body} supplied Rashi contradicts canonical sidereal longitude.`);
  if (input.degreesWithinRashi !== undefined && input.degreesWithinRashi !== coordinates.rashi.degreesWithinRashi) throw new RangeError(`Body ${body} supplied degreesWithinRashi contradicts canonical sidereal longitude.`);
  return { body, canonicalSiderealLongitudeDegrees, normalizedCanonicalSiderealLongitudeDegrees: coordinates.normalizedLongitudeDegrees, rashi: rashiSummary(coordinates.rashi) };
}

function validateChartOptions({ chartId = D1_CHART_ID, rulesetBundleId = YOGA_BUNDLE_ID } = {}) {
  if (chartId !== D1_CHART_ID) throw new RangeError(`Unsupported chart context: ${chartId}`);
  if (rulesetBundleId !== YOGA_BUNDLE_ID) throw new RangeError(`Unsupported yoga ruleset bundle: ${rulesetBundleId}`);
  return { chartId, rulesetBundleId };
}

function validateHouses(houses, bodies) {
  if (!houses || typeof houses !== 'object' || houses.rulesetId !== LAYER_5A_HOUSE_SYSTEM_ID || !Array.isArray(houses.houses) || houses.houses.length !== 12 || !Array.isArray(houses.planetaryAssignments)) throw new RangeError('houses must be a valid Layer 5A D1 Rashi-house result.');
  const ascendant = bodies.Ascendant;
  if (!ascendant) throw new RangeError('A Layer 5A house result requires Ascendant in the chart context.');
  if (!houses.ascendant || !houses.ascendant.rashi || houses.ascendant.rashi.rashiIndex !== ascendant.rashi.rashiIndex) throw new RangeError('Supplied Layer 5A house result contradicts the chart Ascendant Rashi.');
  const houseByRashi = {};
  const lordshipsByBody = {};
  for (const house of houses.houses) {
    if (!house || !Number.isInteger(house.houseNumber) || house.houseNumber < 1 || house.houseNumber > 12 || !house.rashi || !Number.isInteger(house.rashi.rashiIndex) || !house.rashiHouseLord || typeof house.rashiHouseLord.name !== 'string') throw new RangeError('Supplied Layer 5A house result is invalid.');
    const expectedRashiIndex = ((ascendant.rashi.rashiIndex - 1 + house.houseNumber - 1) % 12) + 1;
    if (house.rashi.rashiIndex !== expectedRashiIndex || houseByRashi[house.rashi.rashiIndex] !== undefined) throw new RangeError('Supplied Layer 5A house result is inconsistent with the chart context.');
    houseByRashi[house.rashi.rashiIndex] = house.houseNumber;
    const lord = house.rashiHouseLord.name;
    lordshipsByBody[lord] = lordshipsByBody[lord] || [];
    lordshipsByBody[lord].push(house.houseNumber);
  }
  if (Object.keys(houseByRashi).length !== 12) throw new RangeError('Supplied Layer 5A house result is incomplete.');
  const assignmentByBody = {};
  for (const assignment of houses.planetaryAssignments) {
    if (!assignment || typeof assignment.body !== 'string' || !bodies[assignment.body] || !assignment.rashi || !Number.isInteger(assignment.rashi.rashiIndex) || !Number.isInteger(assignment.rashiHouseNumber)) throw new RangeError('Supplied Layer 5A planetary assignment is invalid.');
    const body = bodies[assignment.body];
    if (typeof assignment.canonicalSiderealLongitude === 'number' && Number.isFinite(assignment.canonicalSiderealLongitude) && classifySiderealLongitude(assignment.canonicalSiderealLongitude).normalizedLongitudeDegrees !== body.normalizedCanonicalSiderealLongitudeDegrees) throw new RangeError(`Supplied Layer 5A house result contradicts canonical placement for ${assignment.body}.`);
    if (assignmentByBody[assignment.body] || assignment.rashi.rashiIndex !== body.rashi.rashiIndex || assignment.rashiHouseNumber !== houseByRashi[body.rashi.rashiIndex]) throw new RangeError(`Supplied Layer 5A house result contradicts body placement for ${assignment.body}.`);
    assignmentByBody[assignment.body] = assignment;
  }
  return { houses: houses.houses, houseByRashi, lordshipsByBody, assignmentByBody };
}

function validateDignityResult(dignityResult, bodies) {
  if (!dignityResult || typeof dignityResult !== 'object' || !dignityResult.bodies || typeof dignityResult.bodies !== 'object') throw new RangeError('dignityResult must be a valid Layer 5B planetary-state result.');
  const states = {};
  for (const bodyName of MAHAPURUSHA_PLANETS) {
    const state = dignityResult.bodies[bodyName];
    const body = bodies[bodyName];
    if (!body || !state || state.body !== bodyName || !state.rashi || !state.dignity || typeof state.dignity.isOwnSign !== 'boolean' || typeof state.dignity.isExalted !== 'boolean') throw new RangeError(`Layer 5B dignity result is missing required facts for ${bodyName}.`);
    const longitude = state.canonicalSiderealLongitudeDegrees;
    if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new RangeError(`Layer 5B dignity result is missing canonical longitude for ${bodyName}.`);
    const coordinates = classifySiderealLongitude(longitude);
    if (coordinates.rashi.rashiIndex !== body.rashi.rashiIndex || coordinates.normalizedLongitudeDegrees !== body.normalizedCanonicalSiderealLongitudeDegrees || state.rashi.rashiIndex !== body.rashi.rashiIndex) throw new RangeError(`Layer 5B dignity result contradicts body placement for ${bodyName}.`);
    states[bodyName] = state;
  }
  return states;
}

function assignmentFor(bodyName, assignments) {
  const assignment = assignments[bodyName];
  if (!assignment) throw new RangeError(`Layer 5A house result is missing placement for ${bodyName}.`);
  return assignment;
}

function mahapurushaModifiers(state) {
  return {
    combust: state.combustion && Object.hasOwn(state.combustion, 'combust') ? state.combustion.combust : null,
    retrograde: state.motion && Object.hasOwn(state.motion, 'isRetrograde') ? state.motion.isRetrograde : null,
    debilitated: state.dignity && Object.hasOwn(state.dignity, 'isDebilitated') ? state.dignity.isDebilitated : null
  };
}

function evaluateGajaKesari(definition, bodies) {
  const moon = bodies.Moon;
  const jupiter = bodies.Jupiter;
  if (!moon || !jupiter) throw new RangeError('Gaja Kesari requires Moon and Jupiter canonical D1 placements.');
  const offset = normalizedRashiOffset(moon.rashi.rashiIndex, jupiter.rashi.rashiIndex);
  return {
    detected: isKendraFromRashi(offset),
    evidence: {
      moonRashi: moon.rashi,
      jupiterRashi: jupiter.rashi,
      normalizedRashiOffset: offset,
      kendraOrdinal: kendraOrdinal(offset)
    },
    modifiers: {}
  };
}

function evaluateMahapurusha(definition, bodies, assignments, dignities) {
  const body = bodies[definition.planet];
  const assignment = assignmentFor(definition.planet, assignments);
  const dignity = dignities[definition.planet];
  const qualifiesByDignity = dignity.dignity.isOwnSign || dignity.dignity.isExalted;
  const qualifiesByKendra = isKendraHouse(assignment.rashiHouseNumber);
  return {
    detected: qualifiesByDignity && qualifiesByKendra,
    evidence: {
      planet: definition.planet,
      planetRashi: body.rashi,
      planetHouse: assignment.rashiHouseNumber,
      isOwnSign: dignity.dignity.isOwnSign,
      isExalted: dignity.dignity.isExalted,
      qualifiesByDignity,
      qualifiesByKendra
    },
    modifiers: mahapurushaModifiers(dignity)
  };
}

function evaluateVipareeta(definition, bodies, houses) {
  const sourceHouse = definition.sourceHouse;
  const source = houses.houses[sourceHouse - 1];
  if (!source || !source.rashiHouseLord || typeof source.rashiHouseLord.name !== 'string') throw new RangeError(`Layer 5A house result is missing lord for House ${sourceHouse}.`);
  const sourceHouseLord = source.rashiHouseLord.name;
  const lord = bodies[sourceHouseLord];
  if (!lord) throw new RangeError(`Layer 5A house lord ${sourceHouseLord} requires a canonical D1 placement.`);
  const lordHouse = houses.houseByRashi[lord.rashi.rashiIndex];
  if (!lordHouse) throw new RangeError(`Layer 5A house result cannot resolve placement for ${sourceHouseLord}.`);
  return {
    detected: isDusthanaHouse(lordHouse),
    evidence: {
      sourceHouse,
      sourceHouseLord,
      sourceHouseLordships: houses.lordshipsByBody[sourceHouseLord] || [],
      lordRashi: lord.rashi,
      lordHouse,
      qualifyingDusthana: isDusthanaHouse(lordHouse)
    },
    modifiers: {}
  };
}

function detectCoreYogas({ bodies, houses, dignityResult, ...options } = {}) {
  if (!bodies || typeof bodies !== 'object' || Array.isArray(bodies)) throw new TypeError('bodies must be an object keyed by body name.');
  const { chartId, rulesetBundleId } = validateChartOptions(options);
  const normalizedBodies = Object.fromEntries(Object.entries(bodies).map(([body, input]) => [body, normalizeBody(body, input)]));
  if (!normalizedBodies.Moon || !normalizedBodies.Jupiter) throw new RangeError('Gaja Kesari requires Moon and Jupiter canonical D1 placements.');
  const validatedHouses = validateHouses(houses, normalizedBodies);
  const dignities = validateDignityResult(dignityResult, normalizedBodies);
  const evaluations = YOGA_DEFINITIONS.map((definition) => {
    let evaluated;
    if (definition.kind === 'gajaKesari') evaluated = evaluateGajaKesari(definition, normalizedBodies);
    else if (definition.kind === 'mahaPurusha') evaluated = evaluateMahapurusha(definition, normalizedBodies, validatedHouses.assignmentByBody, dignities);
    else evaluated = evaluateVipareeta(definition, normalizedBodies, validatedHouses);
    return {
      yogaId: definition.yogaId,
      yogaName: definition.yogaName,
      detected: evaluated.detected,
      evidence: evaluated.evidence,
      modifiers: evaluated.modifiers,
      provenance: { rulesetBundleId, yogaRulesetId: definition.yogaId, applicableChart: chartId, providerIndependent: true, sourceStatus: definition.sourceStatus }
    };
  });
  return deepFreeze({
    rulesetBundleId,
    chartContext: { chartId, coordinateAuthority: 'canonical-sidereal' },
    yogaEvaluations: evaluations,
    provenance: {
      providerIndependent: true,
      coordinateFrame: 'canonical-sidereal',
      astronomicalCalculation: 'not-performed',
      ayanamshaCalculation: 'not-performed',
      houseCalculation: 'not-performed',
      dignityCalculation: 'not-performed',
      aspectCalculation: 'not-performed',
      vargaCalculation: 'not-performed',
      dashaCalculation: 'not-performed'
    }
  });
}

module.exports = { detectCoreYogas, validateChartOptions, normalizedRashiOffset };
