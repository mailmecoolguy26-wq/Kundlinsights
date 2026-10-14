'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { TaraTransitCapability, TaraTransitIntent, classifyTaraTransitIntent, TaraOrchestrator } = require('../../src/application/tara');

function context(profile = 'profile-a', jupiterHouse = 10) {
  const body = (planet, house, motion = 'direct') => ({ body: planet, transitRashi: { englishName: planet === 'Jupiter' ? 'Gemini' : 'Pisces' }, transitNatalHouseNumber: house, motion, sameRashiNatalBodies: [], aspectsNatalBodies: [], aspectsNatalHouses: [] });
  return { birthProfileId: profile, snapshot: { transitBodies: { Jupiter: body('Jupiter', jupiterHouse), Saturn: body('Saturn', 6, 'retrograde'), Rahu: body('Rahu', 2), Ketu: body('Ketu', 8), Mars: body('Mars', 11) } }, natalHouses: { houses: [{ houseNumber: 10, rashiHouseLord: { name: 'Jupiter' } }, { houseNumber: 6, rashiHouseLord: { name: 'Saturn' } }] }, insightContext: { upcomingTransitions: [{ type: 'INGRESS', planet: 'Rahu', at: '2027-01-01T00:00:00.000Z' }] } };
}
function capability(calls) { return new TaraTransitCapability({ transitSnapshotService: { contextForTara: async (input) => { calls.push(input); return context(input.birthProfileId, input.birthProfileId === 'profile-b' ? 4 : 10); } }, clock: () => '2026-10-14T00:00:00.000Z' }); }

test('classifies Gochar questions deterministically and keeps career timing with Career', () => {
  assert.equal(classifyTaraTransitIntent('What kind of effect gochar will have on my kundli?').intent, TaraTransitIntent.CURRENT_TRANSIT_OVERVIEW);
  assert.deepEqual(classifyTaraTransitIntent('How is Jupiter affecting me right now?'), { intent: TaraTransitIntent.PLANET_TRANSIT_EFFECT, planet: 'jupiter', area: 'GENERAL' });
  assert.deepEqual(classifyTaraTransitIntent('What happens when Rahu changes houses?'), { intent: TaraTransitIntent.UPCOMING_TRANSIT_EFFECT, planet: 'rahu', area: 'GENERAL' });
  assert.equal(classifyTaraTransitIntent('How are current transits affecting my career?').intent, TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT);
});
test('uses the selected profile context and factual transit evidence without hardcoded placements', async () => {
  const calls = []; const transit = capability(calls);
  const first = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting my career?' });
  const second = await transit.respond({ principal: {}, birthProfileId: 'profile-b', message: 'How is Jupiter affecting my career?' });
  assert.equal(calls.length, 2); assert.equal(calls[0].birthProfileId, 'profile-a'); assert.equal(calls[1].birthProfileId, 'profile-b');
  assert.equal(first.evidence[0].currentHouse, 10); assert.equal(second.evidence[0].currentHouse, 4);
  assert.deepEqual(first.evidence[0].natalHouseLordship, [10]);
  assert.match(first.message, /10th natal house/); assert.match(second.message, /4th natal house/);
  assert.doesNotMatch(first.message, /probability|will happen/i);
});
test('uses multi-theme houses and chart-specific lordship rather than reducing houses to generic life labels', async () => {
  const calls = []; const transit = capability(calls);
  const jupiter = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting me right now?' });
  assert.match(jupiter.message, /career, profession, authority/i);
  assert.match(jupiter.message, /also rules the 10th house/i);
  assert.doesNotMatch(jupiter.message, /bringing emphasis to relationships/i);
  const fifth = { ...context('profile-a', 5), natalHouses: { houses: [{ houseNumber: 2, rashiHouseLord: { name: 'Jupiter' } }] } };
  const fifthTransit = new TaraTransitCapability({ transitSnapshotService: { contextForTara: async () => fifth }, clock: () => '2026-10-14T00:00:00.000Z' });
  const result = await fifthTransit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting me right now?' });
  assert.match(result.message, /children, creativity, learning, romance, speculation/i);
  assert.doesNotMatch(result.message, /bringing emphasis to relationships/i);
});
test('career filtering uses relevant house and lordship evidence rather than a static planet label', async () => {
  const transit = capability([]);
  const result = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How are current transits affecting my career?' });
  assert.match(result.message, /work routines, service, competition, problem-solving/i);
  assert.doesNotMatch(result.message, /Ketu.*career/i);
});
test('routes a transit question through the transit capability, while job timing remains Career', async () => {
  const calls = []; const tara = new TaraOrchestrator({ careerCapability: { respond: async () => ({ answerability: 'SUPPORTED', message: 'Career result.' }) }, transitCapability: capability(calls) });
  const transit = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How are current transits affecting me?' });
  assert.deepEqual({ domain: transit.domain, capability: transit.capability }, { domain: 'TRANSIT', capability: 'TRANSIT_GROUNDED' });
  const career = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When should I switch jobs?' });
  assert.equal(career.domain, 'CAREER'); assert.equal(calls.length, 1);
});
