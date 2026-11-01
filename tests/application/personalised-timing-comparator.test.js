'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { rankPersonalisedTiming, REASON } = require('../../src/application/life-event-calibration/personalised-timing-comparator');

function candidate(id, group = 'tier') { return Object.freeze({ candidateId: id, personalizationGroup: group, start: `${id}-start`, end: `${id}-end` }); }
function calibration(rows) {
  return {
    annotations: rows.map(({ id, matches = 3, pattern = 'MODERATE', contradiction = false }) => ({ candidateId: id, tieBreakEligible: true, patternStrength: pattern, contradictionFlags: contradiction ? ['MATERIAL_PATTERN_VARIATION'] : [] })),
    customerDisplayReadiness: rows.map(({ id, matches = 3, precise = matches, families = 2, eligible = true }) => ({ candidateId: id, customerDisplayEligible: eligible, matchedEventCount: matches, highMediumMatchedEventCount: precise, matchedEvidenceFamilies: Array.from({ length: families }, (_, index) => `F${index}`) })),
  };
}

test('personalisation may reorder only equivalent, contiguous primary candidates', () => {
  const result = rankPersonalisedTiming({ candidates: [candidate('a'), candidate('b')], calibration: calibration([{ id: 'a', matches: 2 }, { id: 'b', matches: 3 }]) });
  assert.deepEqual(result.orderedCandidateIds, ['b', 'a']);
  assert.equal(result.applied, true);
  assert.equal(result.audit.find((row) => row.candidateId === 'b').reasonCode, REASON.ADVANTAGE);
});

test('different primary tiers cannot be crossed by historical similarity', () => {
  const result = rankPersonalisedTiming({ candidates: [candidate('supportive', 'SUPPORTIVE'), candidate('improving', 'IMPROVING')], calibration: calibration([{ id: 'supportive', matches: 2 }, { id: 'improving', matches: 8 }]) });
  assert.deepEqual(result.orderedCandidateIds, ['supportive', 'improving']);
  assert.equal(result.applied, false);
});

test('insufficient or contradictory history preserves primary order', () => {
  const insufficient = rankPersonalisedTiming({ candidates: [candidate('a'), candidate('b')], calibration: calibration([{ id: 'a', eligible: false }, { id: 'b', matches: 8 }]) });
  assert.deepEqual(insufficient.orderedCandidateIds, ['a', 'b']);
  const contradiction = rankPersonalisedTiming({ candidates: [candidate('a'), candidate('b')], calibration: calibration([{ id: 'a', matches: 2 }, { id: 'b', matches: 8, contradiction: true }]) });
  assert.deepEqual(contradiction.orderedCandidateIds, ['a', 'b']);
});

test('equal eligible history remains stable and candidate content is not mutated', () => {
  const input = [candidate('a'), candidate('b')];
  const result = rankPersonalisedTiming({ candidates: input, calibration: calibration([{ id: 'a' }, { id: 'b' }]) });
  assert.deepEqual(result.orderedCandidateIds, ['a', 'b']);
  assert.deepEqual(input, [candidate('a'), candidate('b')]);
});
