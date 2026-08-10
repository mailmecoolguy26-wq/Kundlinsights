'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CONTRIBUTOR_ORDER, PLANETARY_TARGET_ORDER, RAW_SAV_TOTAL, SAV_RULESET_ID, calculateAllBhinnashtakavargas, calculateRawSarvashtakavarga } = require('../../src/ashtakavarga');

function placements(offset = 0) { return Object.fromEntries(CONTRIBUTOR_ORDER.map((body, index) => [body, { rashiIndex: ((index + offset) % 12) + 1 }])); }

test('aggregates exactly seven planetary BAVs with complete reconstructible SAV evidence', () => {
  for (const offset of [0, 3, 8]) {
    const { planetaryBavs, lagnaBav } = calculateAllBhinnashtakavargas({ rashiPlacements: placements(offset) });
    const result = calculateRawSarvashtakavarga({ planetaryBavs });
    assert.equal(result.rulesetId, SAV_RULESET_ID);
    assert.equal(result.rashis.length, 12);
    assert.equal(result.totalFavorableMarks, RAW_SAV_TOTAL);
    for (const [index, rashi] of result.rashis.entries()) {
      assert.deepEqual(Object.keys(rashi.byTargetBav), PLANETARY_TARGET_ORDER);
      assert.equal(rashi.favorableMarkCount, Object.values(rashi.byTargetBav).reduce((sum, value) => sum + value, 0));
      assert.equal(rashi.favorableMarkCount, PLANETARY_TARGET_ORDER.reduce((sum, target) => sum + planetaryBavs[target].rashis[index].favorableMarkCount, 0));
    }
    assert.equal(lagnaBav.totalFavorableMarks, 47);
    assert.equal(result.totalFavorableMarks, 337);
  }
});

test('rejects incomplete or malformed planetary BAV evidence', () => {
  const { planetaryBavs } = calculateAllBhinnashtakavargas({ rashiPlacements: placements() });
  assert.throws(() => calculateRawSarvashtakavarga({ planetaryBavs: { ...planetaryBavs, Sun: undefined } }), /Sun/);
  const corrupt = { ...planetaryBavs, Moon: { ...planetaryBavs.Moon, rashis: [...planetaryBavs.Moon.rashis] } };
  corrupt.Moon.rashis[0] = { ...corrupt.Moon.rashis[0], favorableMarkCount: 9 };
  assert.throws(() => calculateRawSarvashtakavarga({ planetaryBavs: corrupt }), /Moon/);
});
