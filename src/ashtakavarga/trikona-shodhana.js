'use strict';

const { BAV_RULESET_ID, PLANETARY_TARGET_ORDER, RASHI_DEFINITIONS, TRIKONA_GROUPS, TRIKONA_SHODHANA_RULESET_ID } = require('./reference-data');

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function validateRawBav(rawBav) {
  if (!rawBav || typeof rawBav !== 'object' || Array.isArray(rawBav)) throw new TypeError('rawBav must be an object.');
  if (![...PLANETARY_TARGET_ORDER, 'Ascendant'].includes(rawBav.targetBody)) throw new RangeError(`Unsupported Shodhana target: ${rawBav.targetBody}`);
  if (rawBav.rulesetId !== BAV_RULESET_ID) throw new RangeError('rawBav must use the Layer 11A raw BAV ruleset.');
  if (!Array.isArray(rawBav.rashis) || rawBav.rashis.length !== 12) throw new RangeError('rawBav must contain exactly 12 canonical Rashis.');
  rawBav.rashis.forEach((rashi, index) => {
    const expected = RASHI_DEFINITIONS[index];
    if (!rashi || rashi.rashiIndex !== expected.rashiIndex || rashi.rashiName !== expected.sanskritName) throw new RangeError('rawBav Rashis must be in canonical order.');
    if (!Number.isInteger(rashi.favorableMarkCount) || rashi.favorableMarkCount < 0) throw new RangeError('rawBav favorableMarkCount values must be non-negative integers.');
  });
  return rawBav;
}

function calculateTrikonaShodhana({ rawBav } = {}) {
  validateRawBav(rawBav);
  const values = rawBav.rashis.map((rashi) => rashi.favorableMarkCount);
  const operations = TRIKONA_GROUPS.map((rashiIndices) => {
    const beforeValues = rashiIndices.map((index) => values[index - 1]);
    const minimum = Math.min(...beforeValues);
    let afterValues = beforeValues;
    let decision = 'zero-member-unchanged';
    if (minimum !== 0 && beforeValues.every((value) => value === beforeValues[0])) {
      afterValues = [0, 0, 0]; decision = 'positive-equal-set-to-zero';
    } else if (minimum !== 0) {
      afterValues = beforeValues.map((value) => value - minimum); decision = 'minimum-subtracted';
    }
    rashiIndices.forEach((index, position) => { values[index - 1] = afterValues[position]; });
    return { rashiIndices, beforeValues, afterValues, minimum, decision, changed: beforeValues.some((value, index) => value !== afterValues[index]) };
  });
  const rashis = RASHI_DEFINITIONS.map((rashi, index) => ({ rashiIndex: rashi.rashiIndex, rashiName: rashi.sanskritName, rawFavorableMarkCount: rawBav.rashis[index].favorableMarkCount, afterTrikonaFavorableMarkCount: values[index] }));
  return freeze({ targetBody: rawBav.targetBody, rawBavRulesetId: rawBav.rulesetId, trikonaShodhanaRulesetId: TRIKONA_SHODHANA_RULESET_ID, rashis, totalFavorableMarks: values.reduce((sum, value) => sum + value, 0), operations, provenance: { arithmetic: 'CLASSICAL_TRANSLATION', operation: 'Trikona Shodhana', sourceConvention: 'BPHS-Santhanam', astronomyCalculation: 'not-performed', interpretation: 'not-performed' } });
}

module.exports = { validateRawBav, calculateTrikonaShodhana };
