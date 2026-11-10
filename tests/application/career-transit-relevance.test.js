'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { rankCurrentCareerTransits, mergeCurrentCareerTransitContext } = require('../../src/application/insights');

const AT = '2026-10-18T07:08:17.000Z';
function evidence(planet, house, reasons, status = 'SUPPORTED', aspects = []) {
  return {
    status,
    temporalContext: {
      readingInstant: AT,
      mechanismFamilies: ['GOCHAR_SNAPSHOT'],
      transitContexts: [{
        kind: 'GOCHAR_SNAPSHOT', start: AT, isCurrent: true,
        transitPlanet: planet, natalHouseNumber: house,
        aspectTargetHouses: aspects, relevanceReasons: reasons,
      }],
    },
  };
}

test('direct and aspect-based H10 activation outrank secondary Rahu context', () => {
  const ranked = rankCurrentCareerTransits([
    evidence('Rahu', 12, ['SECONDARY_CONTEXT']),
    evidence('Jupiter', 6, ['ACTIVATES_6TH_HOUSE', 'ASPECTS_10TH_HOUSE'], 'SUPPORTED', [10]),
    evidence('Saturn', 10, ['DIRECT_10TH_HOUSE_TRANSIT']),
  ]);
  assert.deepEqual(ranked.map((item) => item.transitPlanet), ['Saturn', 'Jupiter', 'Rahu']);
  assert.equal(ranked[1].relevanceType, 'ASPECTS_10TH_HOUSE');
  assert.deepEqual(ranked[1].aspectTargetHouses, [10]);
});

test('10th-lord, 6th and 11th activations rank above secondary context in stable order', () => {
  const input = [
    evidence('Rahu', 12, ['SECONDARY_CONTEXT']),
    evidence('Venus', 11, ['ACTIVATES_11TH_HOUSE']),
    evidence('Mercury', 6, ['ACTIVATES_6TH_HOUSE']),
    evidence('Mars', 3, ['ACTIVATES_10TH_LORD']),
  ];
  assert.deepEqual(rankCurrentCareerTransits(input).map((item) => item.transitPlanet), ['Mars', 'Mercury', 'Venus']);
  assert.deepEqual(rankCurrentCareerTransits(input), rankCurrentCareerTransits([...input].reverse()));
});

test('Rahu remains secondary, only active contexts are eligible, and output is capped at three', () => {
  const past = evidence('Moon', 10, ['DIRECT_10TH_HOUSE_TRANSIT']);
  past.temporalContext.transitContexts[0].isCurrent = false;
  const ranked = rankCurrentCareerTransits([
    evidence('Rahu', 12, ['SECONDARY_CONTEXT']),
    evidence('Jupiter', 6, ['ACTIVATES_6TH_HOUSE']),
    evidence('Saturn', 11, ['ACTIVATES_11TH_HOUSE']),
    evidence('Venus', 2, ['ACTIVATES_2ND_HOUSE']),
    past,
  ]);
  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map((item) => item.transitPlanet), ['Jupiter', 'Saturn', 'Venus']);
  assert.equal(ranked.some((item) => item.transitPlanet === 'Moon'), false);
});

test('duplicate evidence merges reasons without changing supplied calculation facts', () => {
  const first = evidence('Jupiter', 6, ['ACTIVATES_6TH_HOUSE'], 'MIXED', [2, 10]);
  const second = evidence('Jupiter', 6, ['ASPECTS_10TH_HOUSE'], 'SUPPORTED', [10]);
  const before = JSON.stringify([first, second]);
  const merged = mergeCurrentCareerTransitContext([first, second]);
  assert.equal(merged.transitContexts.length, 1);
  assert.deepEqual(merged.transitContexts[0].relevanceReasons, ['ASPECTS_10TH_HOUSE', 'ACTIVATES_6TH_HOUSE']);
  assert.equal(merged.transitContexts[0].evidenceState, 'SUPPORTED');
  assert.equal(JSON.stringify([first, second]), before);
  assert.deepEqual(rankCurrentCareerTransits([]), []);
});
