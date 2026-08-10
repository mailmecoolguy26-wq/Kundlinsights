'use strict';

const { RASHI_DEFINITIONS, SIGN_CLASSIFICATIONS, VARGA_DEFINITIONS, ENGINE_COORDINATE_PROVENANCE } = require('./reference-data');

const TOTAL_DEGREES = 360;
const RASHI_SPAN_DEGREES = 30;

function normalizeSiderealLongitude(longitudeDegrees) {
  if (typeof longitudeDegrees !== 'number' || !Number.isFinite(longitudeDegrees)) throw new TypeError('siderealLongitudeDegrees must be a finite number.');
  const remainder = longitudeDegrees % TOTAL_DEGREES;
  return remainder < 0 ? remainder + TOTAL_DEGREES : remainder;
}

function signClass(rashiIndex, classes) {
  const match = Object.entries(classes).find(([, indexes]) => indexes.includes(rashiIndex));
  if (!match) throw new RangeError(`No sign classification found for Rashi ${rashiIndex}.`);
  return match[0];
}

function rashiAt(index) { return RASHI_DEFINITIONS[((index % 12) + 12) % 12]; }

function startingRashiIndex(definition, natalRashi) {
  switch (definition.mappingStrategy) {
    case 'identity': return natalRashi.rashiIndex;
    case 'equal-by-sign-modality': return natalRashi.rashiIndex + definition.startOffsetByModality[signClass(natalRashi.rashiIndex, { movable: SIGN_CLASSIFICATIONS.movable, fixed: SIGN_CLASSIFICATIONS.fixed, dual: SIGN_CLASSIFICATIONS.dual })];
    case 'equal-by-sign-parity': return natalRashi.rashiIndex + definition.startOffsetByParity[signClass(natalRashi.rashiIndex, { odd: SIGN_CLASSIFICATIONS.odd, even: SIGN_CLASSIFICATIONS.even })];
    default: throw new RangeError(`Unsupported Varga mapping strategy: ${definition.mappingStrategy}.`);
  }
}

function deriveVargaFromSiderealLongitude(vargaId, siderealLongitudeDegrees) {
  const definition = VARGA_DEFINITIONS[vargaId];
  if (!definition) throw new RangeError(`Unsupported Varga: ${vargaId}.`);

  const normalizedSiderealLongitudeDegrees = normalizeSiderealLongitude(siderealLongitudeDegrees);
  const natalRashi = RASHI_DEFINITIONS[Math.floor(normalizedSiderealLongitudeDegrees / RASHI_SPAN_DEGREES)];
  const degreesWithinNatalRashi = normalizedSiderealLongitudeDegrees - natalRashi.startDegrees;
  const subdivisionSpanDegrees = RASHI_SPAN_DEGREES / definition.divisor;
  // Use the global equal-division grid. It represents the same mathematical
  // boundaries as the local Rashi grid while avoiding cancellation at values
  // such as 36°40′, which are exact D9 boundaries in decimal notation.
  const globalSubdivisionIndex = Math.floor(normalizedSiderealLongitudeDegrees * definition.divisor / RASHI_SPAN_DEGREES);
  const subdivisionZeroIndex = globalSubdivisionIndex % definition.divisor;
  const subdivisionStartDegreesWithinNatalRashi = subdivisionZeroIndex * subdivisionSpanDegrees;
  const subdivisionEndDegreesWithinNatalRashi = (subdivisionZeroIndex + 1) * subdivisionSpanDegrees;
  const globalSubdivisionStartDegrees = globalSubdivisionIndex * subdivisionSpanDegrees;
  const startingIndex = startingRashiIndex(definition, natalRashi);
  const resultingRashi = rashiAt(startingIndex - 1 + subdivisionZeroIndex);
  // A value classified onto an exact grid boundary can differ from the same
  // boundary reconstructed by multiplication by less than one ULP. Clamp only
  // that representation artefact at the half-open interval's zero seam; the
  // canonical input itself is never rounded.
  const degreesWithinResultingRashi = Math.max(0, (normalizedSiderealLongitudeDegrees - globalSubdivisionStartDegrees) * definition.divisor);

  return Object.freeze({
    varga: Object.freeze({ id: definition.id, name: definition.name, divisor: definition.divisor, mappingStrategy: definition.mappingStrategy, classicalMappingProvenance: definition.classicalMapping, engineCoordinateProvenance: ENGINE_COORDINATE_PROVENANCE }),
    normalizedSiderealLongitudeDegrees,
    natalRashi: Object.freeze({ ...natalRashi, degreesWithinNatalRashi }),
    subdivision: Object.freeze({ index: subdivisionZeroIndex + 1, startDegreesWithinNatalRashi: subdivisionStartDegreesWithinNatalRashi, endDegreesWithinNatalRashi: subdivisionEndDegreesWithinNatalRashi, spanDegrees: subdivisionSpanDegrees, degreesWithinSubdivision: degreesWithinNatalRashi - subdivisionStartDegreesWithinNatalRashi }),
    resultingRashi: Object.freeze({ ...resultingRashi, degreesWithinResultingRashi })
  });
}

module.exports = { deriveVargaFromSiderealLongitude, normalizeSiderealLongitude };
