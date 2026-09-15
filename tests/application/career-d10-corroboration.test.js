'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCareerD10Corroboration } = require('../../src/application/divisional-charts');

const supportedFoundation = [{ family: 'CAREER_FOUNDATION', status: 'SUPPORTED' }];
const noFoundation = [{ family: 'CAREER_FOUNDATION', status: 'MIXED' }];
const sign = (rashiIndex) => ({ rashiIndex, englishName: `Rashi ${rashiIndex}` });

function d10({ lagnaOccupants = [], lagnaLord = 'Mercury', tenthOccupants = [], tenthLord = 'Saturn', shaniHouse = 8 } = {}) {
  return {
    chart: 'D10',
    lagna: { house: 1, sign: sign(1), lord: lagnaLord, lordHouse: 1, occupants: lagnaOccupants, aspectsReceived: [] },
    tenthHouse: { house: 10, sign: sign(10), lord: tenthLord, lordHouse: 10, occupants: tenthOccupants, aspectsReceived: [] },
    shani: { planet: 'Saturn', house: shaniHouse, sign: sign(shaniHouse), conjunctions: [], aspectsToHouses: [], aspectsToPlanets: [] },
  };
}

test('gates deterministic Budh, Guru Dev, and Rahu D10 themes behind supported D1 Career foundation', () => {
  const value = buildCareerD10Corroboration({
    insights: supportedFoundation,
    careerD10Structure: d10({
      lagnaLord: 'Mercury',
      tenthOccupants: [
        { planet: 'Jupiter', house: 10, sign: sign(10) },
        { planet: 'Rahu', house: 10, sign: sign(10) },
      ],
    }),
  });
  assert.deepEqual(value, {
    chart: 'D10',
    corroborates: 'CAREER_FOUNDATION',
    themes: [
      { theme: 'COMMUNICATION_COMMERCE_TECH', supportingFactors: [{ source: 'D10_LAGNA_LORD', planet: 'Mercury', house: 1 }], interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION' },
      { theme: 'ADVISORY_KNOWLEDGE', supportingFactors: [{ source: 'D10_TENTH_OCCUPANT', planet: 'Jupiter', house: 10 }], interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION' },
      { theme: 'STRUCTURE_OPERATIONS', supportingFactors: [{ source: 'D10_SHANI', planet: 'Saturn', house: 8 }, { source: 'D10_TENTH_LORD', planet: 'Saturn', house: 10 }], interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION' },
      { theme: 'UNCONVENTIONAL_TECH_GLOBAL', supportingFactors: [{ source: 'D10_TENTH_OCCUPANT', planet: 'Rahu', house: 10 }], interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION' },
    ],
  });
});

test('deduplicates same-theme factors without scores, rankings, timing, or outcome semantics', () => {
  const value = buildCareerD10Corroboration({
    insights: supportedFoundation,
    careerD10Structure: d10({
      lagnaLord: 'Mercury',
      lagnaOccupants: [{ planet: 'Mercury', house: 1, sign: sign(1) }],
      tenthOccupants: [{ planet: 'Mercury', house: 10, sign: sign(10) }],
      tenthLord: 'Mercury',
    }),
  });
  const theme = value.themes.find((item) => item.theme === 'COMMUNICATION_COMMERCE_TECH');
  assert.equal(value.themes.filter((item) => item.theme === 'COMMUNICATION_COMMERCE_TECH').length, 1);
  assert.deepEqual(theme.supportingFactors, [
    { source: 'D10_LAGNA_LORD', planet: 'Mercury', house: 1 },
    { source: 'D10_LAGNA_OCCUPANT', planet: 'Mercury', house: 1 },
    { source: 'D10_TENTH_LORD', planet: 'Mercury', house: 10 },
    { source: 'D10_TENTH_OCCUPANT', planet: 'Mercury', house: 10 },
  ]);
  assert.equal(JSON.stringify(value).match(/score|weight|rank|confidence|probability|timing|promotion|job.?change|business|success|failure|wealth|debt|foreign.?guarantee|vakri|5th|9th|second.?house/i), null);
});

test('omits D10 corroboration without a supported D1 foundation or a valid factual D10 structure', () => {
  assert.equal(buildCareerD10Corroboration({ insights: noFoundation, careerD10Structure: d10() }), null);
  assert.equal(buildCareerD10Corroboration({ insights: supportedFoundation, careerD10Structure: null }), null);
  assert.equal(buildCareerD10Corroboration({ insights: supportedFoundation, careerD10Structure: { chart: 'D10' } }), null);
});

test('ignores unsupported Shani rules and D10 extras rather than deriving a verdict or additional theme', () => {
  const structure = d10({ lagnaLord: 'Unknown', tenthLord: 'Unknown' });
  structure.shani = {
    ...structure.shani,
    retrograde: true,
    secondFromShani: { planet: 'Sun', house: 9 },
    fifthFromShani: { planet: 'Jupiter', house: 12 },
    ninthFromShani: { planet: 'Rahu', house: 4 },
  };
  const value = buildCareerD10Corroboration({ insights: supportedFoundation, careerD10Structure: structure });
  assert.deepEqual(value.themes, [{
    theme: 'STRUCTURE_OPERATIONS',
    supportingFactors: [{ source: 'D10_SHANI', planet: 'Saturn', house: 8 }],
    interpretationLevel: 'CONTEXTUAL',
    limitation: 'NOT_STANDALONE_PREDICTION',
  }]);
  assert.equal(JSON.stringify(value).match(/second|5th|9th|vakri|verdict|profession|job|business|success|failure|wealth|debt|foreign|timing|promotion|age/i), null);
});
