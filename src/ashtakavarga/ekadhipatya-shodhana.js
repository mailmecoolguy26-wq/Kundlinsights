'use strict';

const { BAV_RULESET_ID, EKADHIPATYA_OCCUPANCY_BODIES, EKADHIPATYA_OCCUPANCY_POLICY_ID, EKADHIPATYA_PAIRS, EKADHIPATYA_SHODHANA_RULESET_ID, PLANETARY_TARGET_ORDER, RASHI_DEFINITIONS, TRIKONA_SHODHANA_RULESET_ID } = require('./reference-data');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function normalizePlacement(body, input) {
  const placement = typeof input === 'number' ? { rashiIndex: input } : input && input.rashi ? input.rashi : input;
  if (!placement || typeof placement !== 'object' || !Number.isInteger(placement.rashiIndex) || placement.rashiIndex < 1 || placement.rashiIndex > 12) throw new TypeError(`${body} must provide a canonical Rashi index.`);
  const expected = RASHI_DEFINITIONS[placement.rashiIndex - 1];
  for (const key of ['rashiName', 'sanskritName', 'englishName']) if (placement[key] !== undefined && placement[key] !== expected.sanskritName && placement[key] !== expected.englishName) throw new RangeError(`${body} supplies contradictory Rashi metadata.`);
  return placement.rashiIndex;
}
function occupiedRashiIndices(rashiPlacements) {
  if (!rashiPlacements || typeof rashiPlacements !== 'object' || Array.isArray(rashiPlacements)) throw new TypeError('rashiPlacements must be an object.');
  const occupied = new Set();
  for (const body of EKADHIPATYA_OCCUPANCY_BODIES) occupied.add(normalizePlacement(body, rashiPlacements[body]));
  return occupied;
}
function validateTrikonaResult(trikonaShodhana) {
  if (!trikonaShodhana || typeof trikonaShodhana !== 'object' || !Array.isArray(trikonaShodhana.rashis) || trikonaShodhana.rashis.length !== 12) throw new TypeError('trikonaShodhana must contain exactly 12 Rashis.');
  if (![...PLANETARY_TARGET_ORDER, 'Ascendant'].includes(trikonaShodhana.targetBody)) throw new RangeError(`Unsupported Shodhana target: ${trikonaShodhana.targetBody}`);
  if (trikonaShodhana.rawBavRulesetId !== BAV_RULESET_ID || trikonaShodhana.trikonaShodhanaRulesetId !== TRIKONA_SHODHANA_RULESET_ID) throw new RangeError('trikonaShodhana must use the approved Layer 11B Trikona ruleset.');
  trikonaShodhana.rashis.forEach((rashi, index) => {
    const expected = RASHI_DEFINITIONS[index];
    if (!rashi || rashi.rashiIndex !== expected.rashiIndex || rashi.rashiName !== expected.sanskritName || !Number.isInteger(rashi.afterTrikonaFavorableMarkCount) || rashi.afterTrikonaFavorableMarkCount < 0) throw new RangeError('trikonaShodhana Rashis must contain canonical non-negative integer values.');
  });
}
function calculateEkapadhipatyaShodhana({ trikonaShodhana, rashiPlacements } = {}) {
  validateTrikonaResult(trikonaShodhana);
  const occupied = occupiedRashiIndices(rashiPlacements);
  const values = trikonaShodhana.rashis.map((rashi) => rashi.afterTrikonaFavorableMarkCount);
  const operations = EKADHIPATYA_PAIRS.map(({ owner, rashiIndices }) => {
    const [firstIndex, secondIndex] = rashiIndices;
    const beforeValues = [values[firstIndex - 1], values[secondIndex - 1]];
    const occupancy = [occupied.has(firstIndex), occupied.has(secondIndex)];
    let afterValues = beforeValues;
    let decision = 'zero-member-unchanged';
    if (beforeValues[0] !== 0 && beforeValues[1] !== 0) {
      if (occupancy[0] && occupancy[1]) decision = 'both-occupied-unchanged';
      else if (!occupancy[0] && !occupancy[1]) {
        if (beforeValues[0] === beforeValues[1]) { afterValues = [0, 0]; decision = 'both-empty-equal-set-to-zero'; }
        else { const minimum = Math.min(...beforeValues); afterValues = [minimum, minimum]; decision = 'both-empty-unequal-set-to-minimum'; }
      } else {
        const occupiedPosition = occupancy[0] ? 0 : 1;
        const emptyPosition = occupiedPosition === 0 ? 1 : 0;
        afterValues = [...beforeValues];
        afterValues[emptyPosition] = beforeValues[occupiedPosition] < beforeValues[emptyPosition] ? beforeValues[emptyPosition] - beforeValues[occupiedPosition] : 0;
        decision = beforeValues[occupiedPosition] < beforeValues[emptyPosition] ? 'occupied-retained-empty-reduced' : 'occupied-retained-empty-set-to-zero';
      }
    }
    rashiIndices.forEach((index, position) => { values[index - 1] = afterValues[position]; });
    return { owner, rashiIndices, beforeValues, afterValues, occupancy, decision, changed: beforeValues.some((value, index) => value !== afterValues[index]) };
  });
  const rashis = RASHI_DEFINITIONS.map((rashi, index) => ({ ...trikonaShodhana.rashis[index], afterEkapadhipatyaFavorableMarkCount: values[index], favorableMarkCount: values[index] }));
  return freeze({ targetBody: trikonaShodhana.targetBody, rawBavRulesetId: trikonaShodhana.rawBavRulesetId, trikonaShodhanaRulesetId: trikonaShodhana.trikonaShodhanaRulesetId, ekadhipatyaShodhanaRulesetId: EKADHIPATYA_SHODHANA_RULESET_ID, occupancyPolicyId: EKADHIPATYA_OCCUPANCY_POLICY_ID, rashis, totalFavorableMarks: values.reduce((sum, value) => sum + value, 0), operations, provenance: { arithmetic: 'CLASSICAL_TRANSLATION', ownershipPairs: 'CLASSICAL_TRANSLATION', operationOrdering: 'CLASSICAL_TRANSLATION', occupancyPolicy: { authority: 'ENGINE_CONVENTION', id: EKADHIPATYA_OCCUPANCY_POLICY_ID, includedBodies: EKADHIPATYA_OCCUPANCY_BODIES, excludedBodies: ['Ascendant', 'Rahu', 'Ketu'] }, astronomyCalculation: 'not-performed', interpretation: 'not-performed' } });
}

module.exports = { normalizePlacement, occupiedRashiIndices, calculateEkapadhipatyaShodhana };
