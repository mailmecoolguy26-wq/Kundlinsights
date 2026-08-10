'use strict';

const { RASHI_DEFINITIONS, SIGN_CLASSIFICATIONS, VARGA_DEFINITIONS, ENGINE_COORDINATE_PROVENANCE, D60_RULESETS } = require('./reference-data');
const TOTAL_DEGREES = 360;
const RASHI_SPAN_DEGREES = 30;

function normalizeSiderealLongitude(value) { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('siderealLongitudeDegrees must be a finite number.'); const r = value % TOTAL_DEGREES; return r < 0 ? r + TOTAL_DEGREES : r; }
function rashiAt(index) { return RASHI_DEFINITIONS[((index - 1) % 12 + 12) % 12]; }
function kind(index, names) { return names.find((name) => SIGN_CLASSIFICATIONS[name].includes(index)); }
function provenance(definition, rulesetVersion) { return Object.freeze({ classicalPartRule: Object.freeze({ source: 'Brihat Parashara Hora Shastra, Chapter 6', rule: definition.mappingStrategy }), classicalLordRule: Object.freeze({ source: 'Brihat Parashara Hora Shastra, Chapter 6', rule: definition.id === 'D30' ? 'Trimshamsha lord sequence' : 'Not separately modelled for this Varga.' }), classicalDeityRule: Object.freeze({ source: 'Brihat Parashara Hora Shastra, Chapter 6', rule: definition.id === 'D30' ? 'Trimshamsha deity sequence' : 'Not separately modelled for this Varga.' }), derivedVargaRashiRule: Object.freeze({ source: definition.id === 'D30' ? 'Parashari Trimshamsha projection convention' : 'Audited Varga mapping', rulesetVersion }), engineCoordinateRule: ENGINE_COORDINATE_PROVENANCE, rulesetVersion }); }
function start(def, natal) {
  switch (def.mappingStrategy) {
    case 'identity': return natal.rashiIndex;
    case 'equal-by-sign-modality': return natal.rashiIndex + def.startOffsetByModality[kind(natal.rashiIndex, ['movable', 'fixed', 'dual'])];
    case 'equal-by-sign-parity': return natal.rashiIndex + def.startOffsetByParity[kind(natal.rashiIndex, ['odd', 'even'])];
    case 'equal-sequential-from-natal': return natal.rashiIndex + (def.startOffsetByParity ? def.startOffsetByParity[kind(natal.rashiIndex, ['odd', 'even'])] : 0);
    case 'equal-absolute-anchor-by-parity': return def.anchorByParity[kind(natal.rashiIndex, ['odd', 'even'])];
    case 'equal-absolute-anchor-by-modality': return def.anchorByModality[kind(natal.rashiIndex, ['movable', 'fixed', 'dual'])];
    case 'equal-absolute-anchor-by-element': return def.anchorByElement[kind(natal.rashiIndex, ['fire', 'earth', 'air', 'water'])];
    default: return natal.rashiIndex;
  }
}
function makeResult(def, normalized, natal, degree, part, rashi, resultDegree, lord, deity, rulesetVersion) {
  const p = Object.freeze({ index: part.index + 1, startDegreesWithinNatalRashi: part.start, endDegreesWithinNatalRashi: part.end, spanDegrees: part.end - part.start, degreesWithinSubdivision: degree - part.start });
  const prov = provenance(def, rulesetVersion);
  const resultRashi = Object.freeze({ ...rashi, degreesWithinResultingRashi: Math.max(0, resultDegree) });
  return Object.freeze({ varga: Object.freeze({ id: def.id, name: def.name, divisor: def.divisor, mappingStrategy: def.mappingStrategy, rulesetVersion, classicalMappingProvenance: prov.classicalPartRule, engineCoordinateProvenance: ENGINE_COORDINATE_PROVENANCE, provenance: prov }), normalizedSiderealLongitudeDegrees: normalized, natalRashi: Object.freeze({ ...natal, degreesWithinNatalRashi: degree }), subdivision: p, classical: Object.freeze({ interval: Object.freeze({ startDegreesWithinNatalRashi: p.startDegreesWithinNatalRashi, endDegreesWithinNatalRashi: p.endDegreesWithinNatalRashi }), lord, deity }), derivedVargaRashi: resultRashi, resultingRashi: resultRashi });
}
function deriveVargaFromSiderealLongitude(vargaId, longitude, options = {}) {
  const def = VARGA_DEFINITIONS[vargaId]; if (!def) throw new RangeError(`Unsupported Varga: ${vargaId}.`);
  const normalized = normalizeSiderealLongitude(longitude); const natal = RASHI_DEFINITIONS[Math.floor(normalized / 30)]; const degree = normalized - natal.startDegrees;
  if (def.mappingStrategy === 'irregular-range-table') {
    const group = kind(natal.rashiIndex, ['odd', 'even']); const item = def.partTableByParity[group].find((x) => degree >= x.start && degree < x.end); const part = { index: def.partTableByParity[group].indexOf(item), start: item.start, end: item.end };
    return makeResult(def, normalized, natal, degree, part, rashiAt(item.rashiIndex), (degree - item.start) / (item.end - item.start) * 30, item.lord, item.deity, def.rulesetVersion);
  }
  const span = 30 / def.divisor; const scaled = normalized * def.divisor; const global = Math.floor((scaled + Math.abs(scaled) * Number.EPSILON) / 30); const part = { index: global % def.divisor, start: (global % def.divisor) * span, end: ((global % def.divisor) + 1) * span }; let rashiIndex; let lord = null; let deity = null; let rulesetVersion = def.rulesetVersion;
  if (def.mappingStrategy === 'versioned-custom-strategy') {
    rulesetVersion = options.rulesetVersion || def.rulesetVersion; if (!D60_RULESETS[rulesetVersion]) throw new RangeError(`Unsupported D60 ruleset: ${rulesetVersion}.`); const remainder = (part.index % 12) + 1; rashiIndex = rulesetVersion === 'santhanam-natal-count-d60-v1' ? natal.rashiIndex + remainder - 1 : remainder; deity = def.deitySequence[kind(natal.rashiIndex, ['odd', 'even']) === 'odd' ? part.index : def.divisor - 1 - part.index];
  } else if (def.mappingStrategy === 'explicit-part-mapping-table') { const item = def.partTableByParity[kind(natal.rashiIndex, ['odd', 'even'])][part.index]; rashiIndex = item.rashiIndex; lord = item.lord; }
  else if (def.mappingStrategy === 'equal-ordinal-offset-table') rashiIndex = natal.rashiIndex + def.offsets[part.index];
  else rashiIndex = start(def, natal) + part.index;
  return makeResult(def, normalized, natal, degree, part, rashiAt(rashiIndex), (normalized - global * span) * def.divisor, lord, deity, rulesetVersion);
}
module.exports = { deriveVargaFromSiderealLongitude, normalizeSiderealLongitude };
