'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { BAV_RULESET_ID, CONTRIBUTOR_ORDER, PLANETARY_TARGET_ORDER, FIXED_TOTALS, RAW_FAVORABLE_REKHA_TABLE, validateReferenceData } = require('../../src/ashtakavarga');
const { targetRashiIndex, calculateBhinnashtakavarga } = require('../../src/ashtakavarga/bhinnashtakavarga');

const placements = () => Object.fromEntries(CONTRIBUTOR_ORDER.map((body) => [body, { rashiIndex: 1 }]));

test('maps every target/contributor allowed and disallowed position from all twelve starting Rashis', () => {
  for (const targetBody of [...PLANETARY_TARGET_ORDER, 'Ascendant']) {
    for (const contributor of CONTRIBUTOR_ORDER) {
      const allowed = RAW_FAVORABLE_REKHA_TABLE[targetBody][contributor];
      for (let contributorRashiIndex = 1; contributorRashiIndex <= 12; contributorRashiIndex += 1) {
        const input = placements(); input[contributor] = { rashiIndex: contributorRashiIndex };
        const result = calculateBhinnashtakavarga({ rashiPlacements: input, targetBody });
        for (let relativePosition = 1; relativePosition <= 12; relativePosition += 1) {
          const rashi = result.rashis[targetRashiIndex(contributorRashiIndex, relativePosition) - 1];
          assert.equal(rashi.contributors[contributor], allowed.includes(relativePosition), `${targetBody}/${contributor}/${contributorRashiIndex}/${relativePosition}`);
        }
      }
    }
  }
});

test('locks canonical orders, fixed totals, contributor evidence, and reference-data safety', () => {
  const input = placements();
  for (const targetBody of [...PLANETARY_TARGET_ORDER, 'Ascendant']) {
    const result = calculateBhinnashtakavarga({ rashiPlacements: input, targetBody });
    assert.equal(result.rulesetId, BAV_RULESET_ID);
    assert.equal(result.rashis.length, 12);
    assert.equal(result.totalFavorableMarks, FIXED_TOTALS[targetBody]);
    for (const rashi of result.rashis) {
      assert.deepEqual(Object.keys(rashi.contributors), CONTRIBUTOR_ORDER);
      assert.equal(rashi.favorableMarkCount, Object.values(rashi.contributors).filter(Boolean).length);
    }
  }
  assert.equal(validateReferenceData(), true);
  const invalid = { ...RAW_FAVORABLE_REKHA_TABLE, Sun: { ...RAW_FAVORABLE_REKHA_TABLE.Sun, Sun: [1, 1] } };
  assert.throws(() => validateReferenceData(invalid), /Invalid relative positions/);
});

test('validates required canonical Rashi input and ignores unrelated node data', () => {
  const valid = placements();
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Sun: undefined }, targetBody: 'Sun' }), /Sun/);
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Ascendant: undefined }, targetBody: 'Sun' }), /Ascendant/);
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Moon: { rashiIndex: 13 } }, targetBody: 'Sun' }), /Moon/);
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Mars: { rashiIndex: NaN } }, targetBody: 'Sun' }), /Mars/);
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Mercury: { rashiIndex: Infinity } }, targetBody: 'Sun' }), /Mercury/);
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Venus: { rashiIndex: 1, sanskritName: 'Karka' } }, targetBody: 'Sun' }), /contradictory/);
  const withoutNodes = calculateBhinnashtakavarga({ rashiPlacements: valid, targetBody: 'Sun' });
  const withNodes = calculateBhinnashtakavarga({ rashiPlacements: { ...valid, Rahu: { rashiIndex: 1 }, Ketu: { rashiIndex: 7 } }, targetBody: 'Sun' });
  assert.deepEqual(withNodes, withoutNodes);
  assert.throws(() => calculateBhinnashtakavarga({ rashiPlacements: valid, targetBody: 'Rahu' }), /Unsupported/);
});
