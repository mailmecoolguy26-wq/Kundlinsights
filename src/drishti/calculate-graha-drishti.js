'use strict';

const { classifySiderealLongitude } = require('../jyotish/classify-sidereal-longitude');
const { RASHI_DEFINITIONS } = require('../jyotish/reference-data');
const { GRAHA_DRISHTI_RULESET_ID, D1_CHART_ID, LAYER_5A_HOUSE_SYSTEM_ID, CASTING_GRAHAS, FULL_ASPECTS_BY_GRAHA } = require('./reference-data');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function circularSeparation(first, second) {
  const difference = Math.abs(first - second) % 360;
  return Math.min(difference, 360 - difference);
}

function rashiSummary(rashi) {
  return { rashiIndex: rashi.rashiIndex, sanskritName: rashi.sanskritName, englishName: rashi.englishName, startDegrees: rashi.startDegrees, endDegrees: rashi.endDegrees };
}

function suppliedRashiIndex(input) {
  if (input.rashi === undefined) return undefined;
  if (typeof input.rashi === 'number') return input.rashi;
  if (input.rashi && typeof input.rashi.rashiIndex === 'number') return input.rashi.rashiIndex;
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

function validateRuleset({ chartId = D1_CHART_ID, rulesetId = GRAHA_DRISHTI_RULESET_ID } = {}) {
  if (chartId !== D1_CHART_ID) throw new RangeError(`Unsupported chart context: ${chartId}`);
  if (rulesetId !== GRAHA_DRISHTI_RULESET_ID) throw new RangeError(`Unsupported Graha Drishti ruleset: ${rulesetId}`);
  return { chartId, rulesetId };
}

function houseNumbersByRashi(houses, ascendant) {
  if (houses === undefined) return null;
  if (!houses || typeof houses !== 'object' || houses.rulesetId !== LAYER_5A_HOUSE_SYSTEM_ID || !Array.isArray(houses.houses) || houses.houses.length !== 12) throw new RangeError('houses must be a valid Layer 5A D1 Rashi-house result.');
  if (!ascendant) throw new RangeError('A Layer 5A house result requires Ascendant in the chart context.');
  if (!houses.ascendant || !houses.ascendant.rashi || houses.ascendant.rashi.rashiIndex !== ascendant.rashi.rashiIndex) throw new RangeError('Supplied Layer 5A house result contradicts the chart Ascendant Rashi.');
  const mapping = {};
  for (const house of houses.houses) {
    if (!house || !house.rashi || !Number.isInteger(house.houseNumber) || !Number.isInteger(house.rashi.rashiIndex)) throw new RangeError('Supplied Layer 5A house result is invalid.');
    const expectedRashiIndex = ((ascendant.rashi.rashiIndex - 1 + house.houseNumber - 1) % 12) + 1;
    if (house.houseNumber < 1 || house.houseNumber > 12 || house.rashi.rashiIndex !== expectedRashiIndex || mapping[house.rashi.rashiIndex] !== undefined) throw new RangeError('Supplied Layer 5A house result is inconsistent with the chart context.');
    mapping[house.rashi.rashiIndex] = house.houseNumber;
  }
  if (Object.keys(mapping).length !== 12) throw new RangeError('Supplied Layer 5A house result is incomplete.');
  return mapping;
}

function calculateGrahaDrishti({ bodies, houses, ...options } = {}) {
  if (!bodies || typeof bodies !== 'object' || Array.isArray(bodies)) throw new TypeError('bodies must be an object keyed by body name.');
  const { chartId, rulesetId } = validateRuleset(options);
  const normalizedBodies = Object.fromEntries(Object.entries(bodies).map(([body, input]) => [body, normalizeBody(body, input)]));
  const ascendant = normalizedBodies.Ascendant;
  const targetHouseNumbers = houseNumbersByRashi(houses, ascendant);
  const nonAscendantBodies = Object.values(normalizedBodies).filter((body) => body.body !== 'Ascendant');
  const rashiAspects = [];

  for (const fromBody of CASTING_GRAHAS) {
    const source = normalizedBodies[fromBody];
    if (!source) continue;
    for (const definition of FULL_ASPECTS_BY_GRAHA[fromBody]) {
      const targetRashiIndex = ((source.rashi.rashiIndex - 1 + definition.rashiOffset) % 12) + 1;
      const targetRashi = rashiSummary(RASHI_DEFINITIONS[targetRashiIndex - 1]);
      const targetBodies = nonAscendantBodies
        .filter((candidate) => candidate.rashi.rashiIndex === targetRashiIndex)
        .map((candidate) => ({ body: candidate.body, canonicalSiderealLongitudeDegrees: candidate.canonicalSiderealLongitudeDegrees, normalizedCanonicalSiderealLongitudeDegrees: candidate.normalizedCanonicalSiderealLongitudeDegrees, rashi: candidate.rashi }));
      const targetBodySeparations = targetBodies.map((target) => ({ toBody: target.body, circularLongitudeSeparationDegrees: circularSeparation(source.normalizedCanonicalSiderealLongitudeDegrees, target.normalizedCanonicalSiderealLongitudeDegrees) }));
      rashiAspects.push({
        fromBody,
        sourceRashi: source.rashi,
        aspectNumber: definition.aspectNumber,
        rashiOffset: definition.rashiOffset,
        aspectType: definition.aspectType,
        strengthClass: 'full',
        targetRashi,
        targetHouseNumber: targetHouseNumbers === null ? null : targetHouseNumbers[targetRashiIndex],
        targetBodies,
        targetsAscendant: Boolean(ascendant && ascendant.rashi.rashiIndex === targetRashiIndex),
        geometricMetadata: { sourceLongitude: source.canonicalSiderealLongitudeDegrees, targetBodySeparations },
        provenance: { ruleSource: 'DIRECT_CLASSICAL', fullAspectDecision: 'rashi-offset', degreeAspectDecision: 'not-used-for-full-positional-drishti' }
      });
    }
  }

  return deepFreeze({
    rulesetId,
    chartContext: { chartId, coordinateAuthority: 'canonical-sidereal', degreeAspectDecision: 'not-used-for-full-positional-drishti' },
    rashiAspects,
    provenance: {
      providerIndependent: true,
      coordinateFrame: 'canonical-sidereal',
      ayanamshaCalculation: 'not-performed',
      astronomicalCalculation: 'not-performed',
      houseCalculation: 'not-performed',
      vargaCalculation: 'not-performed',
      excludedRulesets: ['parashari-graha-drishti-fractional-v1', 'parashari-sphuta-drishti-v1', 'parashari-rashi-drishti-v1']
    }
  });
}

module.exports = { calculateGrahaDrishti, circularSeparation, validateRuleset };
