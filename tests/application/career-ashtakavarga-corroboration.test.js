'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCareerAshtakavargaCorroboration } = require('../../src/application/ashtakavarga/career-ashtakavarga-corroboration');

const structure = (sav = 31) => ({
  h10: { house: 10, sav },
  h10Lord: { planet: 'Mars', house: 7, houseSav: 31 },
  h7: { house: 7, sav: 25 },
  h7Lord: { planet: 'Saturn', house: 6, houseSav: 23 },
  tenthFromH10Lord: { house: 4, sav: 35 },
});
const conclusion = (topic, conclusionStatus = 'SUPPORTED') => ({ topic, conclusionStatus });

test('H10 SAV cannot originate a Career Ashtakavarga corroboration without supported D1 Career foundation evidence', () => {
  assert.equal(buildCareerAshtakavargaCorroboration({
    conclusions: [], careerAshtakavargaStructure: structure(),
  }), null);
  assert.equal(buildCareerAshtakavargaCorroboration({
    conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT', 'INSUFFICIENT_EVIDENCE')],
    careerAshtakavargaStructure: structure(),
  }), null);
  assert.equal(buildCareerAshtakavargaCorroboration({
    conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT')],
    careerAshtakavargaStructure: { ...structure(), h10: { house: 10 } },
  }), null);
});

test('supported D1 H10 foundation gates a factual, non-ranking H10 SAV corroboration only', () => {
  const value = buildCareerAshtakavargaCorroboration({
    conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT')],
    careerAshtakavargaStructure: structure(35),
  });
  assert.deepEqual(value, {
    kind: 'H10_NATAL_CONTEXT',
    chart: 'D1',
    corroborates: 'CAREER_FOUNDATION',
    h10: { house: 10, sav: 35 },
    limitation: 'NOT_STANDALONE_PREDICTION',
  });
  assert.equal(Object.isFrozen(value), true);
  assert.equal(JSON.stringify(value).match(/score|weight|confidence|probability|rank|threshold|strong|weak|favorable|timing|promotion|income/i), null);
});

test('H7 and other Phase16B facts cannot create a generic Career or business interpretation', () => {
  const onlyH7 = { ...structure(), h10: undefined };
  assert.equal(buildCareerAshtakavargaCorroboration({
    conclusions: [conclusion('CAREER_H10_SIGNIFICATION_SCOPE_PRESENT')],
    careerAshtakavargaStructure: onlyH7,
  }), null);
  assert.equal(buildCareerAshtakavargaCorroboration({
    conclusions: [conclusion('CAREER_H10_LORD_NATAL_CONNECTION_PRESENT')],
    careerAshtakavargaStructure: { h10: { house: 10, sav: 0 } },
  }).h10.sav, 0);
});
