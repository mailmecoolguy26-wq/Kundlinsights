'use strict';

const crypto = require('node:crypto');
const { classifySiderealLongitude } = require('../jyotish/classify-sidereal-longitude');
const { NATAL_SAME_RASHI_ASSOCIATION_RULESET_ID, ASSOCIATION_PARTICIPANTS } = require('./reference-data');
const { minimumCircularLongitudeSeparationDegrees } = require('./angular-distance');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function stable(value) { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`; }
function id(value) { return crypto.createHash('sha256').update(stable(value)).digest('hex'); }
function rashiSummary(rashi) { return { rashiIndex: rashi.rashiIndex, sanskritName: rashi.sanskritName, englishName: rashi.englishName }; }
function longitudeFor(body, input) {
  const canonical = input && input.canonicalSiderealLongitudeDegrees;
  const sidereal = input && input.siderealLongitudeDegrees;
  const layer2 = input && input.jyotishCoordinates && input.jyotishCoordinates.normalizedLongitudeDegrees;
  if (canonical !== undefined && sidereal !== undefined && canonical !== sidereal) throw new RangeError(`Body ${body} supplies contradictory canonical sidereal longitudes.`);
  if (canonical !== undefined && layer2 !== undefined && classifySiderealLongitude(canonical).normalizedLongitudeDegrees !== layer2) throw new RangeError(`Body ${body} Layer 2 longitude contradicts canonical sidereal longitude.`);
  if (sidereal !== undefined && layer2 !== undefined && classifySiderealLongitude(sidereal).normalizedLongitudeDegrees !== layer2) throw new RangeError(`Body ${body} Layer 2 longitude contradicts canonical sidereal longitude.`);
  const longitude = canonical === undefined ? (sidereal === undefined ? layer2 : sidereal) : canonical;
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new TypeError(`Body ${body} must provide a finite canonical sidereal longitude.`);
  return longitude;
}
function suppliedRashiIndex(input) {
  const values = [input && input.rashi, input && input.jyotishCoordinates && input.jyotishCoordinates.rashi].filter((value) => value !== undefined);
  const indexes = values.map((value) => typeof value === 'number' ? value : value && value.rashiIndex);
  if (indexes.some((value) => !Number.isInteger(value))) throw new TypeError('Supplied Rashi must be an index or an object containing rashiIndex.');
  if (new Set(indexes).size > 1) throw new RangeError('Supplied Rashi facts are contradictory.');
  return indexes[0];
}
function normalizeBody(body, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError(`Body ${body} must be an object.`);
  const canonicalSiderealLongitudeDegrees = longitudeFor(body, input);
  const coordinates = classifySiderealLongitude(canonicalSiderealLongitudeDegrees);
  const supplied = suppliedRashiIndex(input);
  if (supplied !== undefined && supplied !== coordinates.rashi.rashiIndex) throw new RangeError(`Body ${body} supplied Rashi contradicts canonical sidereal longitude.`);
  return freeze({ body, canonicalSiderealLongitudeDegrees, normalizedCanonicalSiderealLongitudeDegrees: coordinates.normalizedLongitudeDegrees, rashi: rashiSummary(coordinates.rashi) });
}
function calculateNatalSameRashiAssociations({ bodies, rulesetId = NATAL_SAME_RASHI_ASSOCIATION_RULESET_ID } = {}) {
  if (rulesetId !== NATAL_SAME_RASHI_ASSOCIATION_RULESET_ID) throw new RangeError(`Unsupported natal association ruleset: ${rulesetId}`);
  if (!bodies || typeof bodies !== 'object' || Array.isArray(bodies)) throw new TypeError('bodies must be an object keyed by body name.');
  Object.keys(bodies).forEach((body) => { if (body !== 'Ascendant' && !ASSOCIATION_PARTICIPANTS.includes(body)) throw new RangeError(`Unsupported association participant: ${body}`); });
  const normalizedBodies = ASSOCIATION_PARTICIPANTS.filter((body) => Object.hasOwn(bodies, body)).map((body) => normalizeBody(body, bodies[body]));
  const associations = [];
  for (let left = 0; left < normalizedBodies.length; left += 1) for (let right = left + 1; right < normalizedBodies.length; right += 1) {
    const first = normalizedBodies[left]; const second = normalizedBodies[right];
    if (first.rashi.rashiIndex !== second.rashi.rashiIndex) continue;
    const pair = [first.body, second.body]; const rashi = first.rashi;
    associations.push(freeze({ associationId: `natal-association:${id({ rulesetId, pair, rashiIndex: rashi.rashiIndex })}`, pair: freeze(pair), rashi: freeze({ ...rashi }), minimumCircularLongitudeSeparationDegrees: minimumCircularLongitudeSeparationDegrees(first.normalizedCanonicalSiderealLongitudeDegrees, second.normalizedCanonicalSiderealLongitudeDegrees), provenance: freeze({ coordinateFrame: 'canonical-sidereal', associationDefinition: 'same-rashi-only', orbCalculation: 'not-performed', interpretation: 'not-performed', providerIndependent: true }) }));
  }
  return freeze({ rulesetId, associations, provenance: freeze({ coordinateFrame: 'canonical-sidereal', boundaryPolicy: '[start, end)', normalizationPolicy: 'Layer-2 canonical normalization', associationDefinition: 'same-rashi-only', orbCalculation: 'not-performed', conjunctionInterpretation: 'not-performed', grahaYuddha: 'not-performed', providerIndependent: true, astronomicalCalculation: 'not-performed', ayanamshaCalculation: 'not-performed' }) });
}

module.exports = { calculateNatalSameRashiAssociations, normalizeBody, suppliedRashiIndex };
