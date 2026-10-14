'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { TaraTransitCapability, TaraTransitIntent, classifyTaraTransitIntent, TaraOrchestrator } = require('../../src/application/tara');
const { calculateRashiHouses } = require('../../src/bhava');
const { BODIES, calculateGocharSnapshot } = require('../../src/gochar');

function context(profile = 'profile-a', jupiterHouse = 10) {
  const body = (planet, house, motion = 'direct') => ({ body: planet, transitRashi: { englishName: planet === 'Jupiter' ? 'Gemini' : 'Pisces' }, transitNatalHouseNumber: house, motion, sameRashiNatalBodies: [], aspectsNatalBodies: [], aspectsNatalHouses: [] });
  return { birthProfileId: profile, snapshot: { transitBodies: { Jupiter: body('Jupiter', jupiterHouse), Saturn: body('Saturn', 6, 'retrograde'), Rahu: body('Rahu', 2), Ketu: body('Ketu', 8), Mars: body('Mars', 11) } }, natalHouses: { houses: [{ houseNumber: 10, rashiHouseLord: { name: 'Jupiter' } }, { houseNumber: 6, rashiHouseLord: { name: 'Saturn' } }] }, insightContext: { upcomingTransitions: [{ type: 'INGRESS', planet: 'Rahu', at: '2027-01-01T00:00:00.000Z' }] } };
}
function capability(calls) { return new TaraTransitCapability({ transitSnapshotService: { contextForTara: async (input) => { calls.push(input); return context(input.birthProfileId, input.birthProfileId === 'profile-b' ? 4 : 10); } }, clock: () => '2026-10-14T00:00:00.000Z' }); }
function longitude(rashi) { return (rashi - 1) * 30 + 1; }
function engineFutureContext(planet) {
  const natalBodies = { Ascendant: { canonicalSiderealLongitudeDegrees: longitude(1), siderealLongitudeDegrees: longitude(1) } };
  for (const [index, body] of BODIES.entries()) natalBodies[body] = { canonicalSiderealLongitudeDegrees: longitude(index + 1), siderealLongitudeDegrees: longitude(index + 1), motion: 'direct' };
  const natalHouses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: longitude(1), bodies: natalBodies });
  const snapshot = calculateGocharSnapshot({
    snapshotInstant: '2027-01-10T00:00:00.000Z', natalBodies, natalHouses,
    transitBodies: { [planet]: { canonicalSiderealLongitudeDegrees: longitude(6), motion: 'direct' } }, bodies: [planet],
  });
  return { birthProfileId: 'profile-a', snapshot, natalHouses, insightContext: { upcomingTransitions: [{ type: 'INGRESS', planet, at: '2027-01-10T00:00:00.000Z' }] } };
}

test('classifies Gochar questions deterministically and keeps career timing with Career', () => {
  assert.equal(classifyTaraTransitIntent('What kind of effect gochar will have on my kundli?').intent, TaraTransitIntent.CURRENT_TRANSIT_OVERVIEW);
  assert.deepEqual(classifyTaraTransitIntent('How is Jupiter affecting me right now?'), { intent: TaraTransitIntent.PLANET_TRANSIT_EFFECT, planet: 'jupiter', area: 'GENERAL' });
  assert.deepEqual(classifyTaraTransitIntent('What happens when Rahu changes houses?'), { intent: TaraTransitIntent.UPCOMING_TRANSIT_EFFECT, planet: 'rahu', area: 'GENERAL' });
  assert.equal(classifyTaraTransitIntent('How are current transits affecting my career?').intent, TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT);
});
test('gives an explicit future date or change cue priority over a planet’s current transit', () => {
  const dated = classifyTaraTransitIntent('Rahu ka transit on 5th dec mere liye kaisa rahega');
  assert.equal(dated.intent, TaraTransitIntent.UPCOMING_TRANSIT_EFFECT);
  assert.equal(dated.planet, 'rahu');
  assert.deepEqual(dated.requestedDate, { day: 5, month: 11, label: '5 Dec' });
  assert.equal(classifyTaraTransitIntent('5 dec ko Rahu house change karega to kya hoga').intent, TaraTransitIntent.UPCOMING_TRANSIT_EFFECT);
  assert.equal(classifyTaraTransitIntent('Rahu abhi mujhe kaise affect kar raha hai').intent, TaraTransitIntent.PLANET_TRANSIT_EFFECT);
  assert.equal(classifyTaraTransitIntent('Rahu ka next transit kaisa rahega').intent, TaraTransitIntent.UPCOMING_TRANSIT_EFFECT);
});
test('uses the selected profile context and factual transit evidence without hardcoded placements', async () => {
  const calls = []; const transit = capability(calls);
  const first = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting my career?' });
  const second = await transit.respond({ principal: {}, birthProfileId: 'profile-b', message: 'How is Jupiter affecting my career?' });
  assert.equal(calls.length, 2); assert.equal(calls[0].birthProfileId, 'profile-a'); assert.equal(calls[1].birthProfileId, 'profile-b');
  assert.equal(first.evidence[0].currentHouse, 10); assert.equal(second.evidence[0].currentHouse, 4);
  assert.deepEqual(first.evidence[0].natalHouseLordship, [10]);
  assert.match(first.message, /10th house/); assert.match(second.message, /4th house/);
  assert.doesNotMatch(first.message, /probability|will happen/i);
});
test('uses multi-theme houses and chart-specific lordship rather than reducing houses to generic life labels', async () => {
  const calls = []; const transit = capability(calls);
  const jupiter = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting me right now?' });
  assert.match(jupiter.message, /career, profession, authority/i);
  assert.match(jupiter.message, /also rules your 10th house/i);
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
test('renders concise customer-facing sections without dumping every planet or internal fallback wording', async () => {
  const transit = capability([]);
  const overview = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'What kind of effect will gochar have on my kundli?' });
  assert.match(overview.message, /The strongest transit influences/i);
  assert.match(overview.message, /What to pay attention to:/);
  assert.match(overview.message, /Why:/);
  assert.doesNotMatch(overview.message, /available chart context|grounded area of emphasis|current priorities|transit-related part/i);
  assert.doesNotMatch(overview.message, /Mars:/);
  const jupiter = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting me right now?' });
  assert.match(jupiter.message, /^Jupiter is currently activating/m);
  assert.match(jupiter.message, /What to pay attention to:/);
  assert.match(jupiter.message, /Why: Jupiter is transiting/);
});
test('renders Hinglish copy without changing calculated Transit evidence', async () => {
  const transit = capability([]);
  const english = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting me right now?', language: 'ENGLISH' });
  const hinglish = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is Jupiter affecting me right now?', language: 'HINGLISH' });
  assert.deepEqual(hinglish.evidence, english.evidence);
  assert.match(hinglish.message, /Jupiter abhi aapke 10th house ko activate kar raha hai/i);
  assert.match(hinglish.message, /Dhyaan dene wali cheez:/i);
  assert.match(hinglish.message, /Why: Jupiter abhi Gemini mein aapke 10th house se transit kar raha hai/i);
});
test('explains an upcoming Jupiter ingress through calculated occupation, aspects, lordship, and natal interactions', async () => {
  const current = context('profile-a', 10);
  current.insightContext.upcomingTransitions = [{ type: 'INGRESS', planet: 'Jupiter', at: '2027-01-10T00:00:00.000Z' }];
  const future = context('profile-a', 6);
  future.natalHouses = { houses: [{ houseNumber: 1, rashiHouseLord: { name: 'Jupiter' } }, { houseNumber: 7, rashiHouseLord: { name: 'Jupiter' } }] };
  future.snapshot.transitBodies.Jupiter = {
    ...future.snapshot.transitBodies.Jupiter,
    transitNatalHouseNumber: 6,
    aspectsNatalHouses: [{ houseNumber: 2 }, { houseNumber: 10 }, { houseNumber: 12 }],
    aspectsNatalBodies: [{ natalBody: 'Mars' }],
    sameRashiNatalBodies: [{ body: 'Venus' }],
  };
  const calls = [];
  const transit = new TaraTransitCapability({
    transitSnapshotService: { contextForTara: async (input) => { calls.push(input); return input.at === '2027-01-10T00:00:00.000Z' ? future : current; } },
    clock: () => '2026-10-14T00:00:00.000Z',
  });
  const result = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'What happens when Jupiter changes houses?' });
  assert.equal(calls.length, 2);
  assert.match(result.message, /When Jupiter moves into your 6th house on 10 Jan 2027/i);
  assert.match(result.message, /Jupiter will also aspect your 2nd, 10th, 12th houses/i);
  assert.match(result.message, /Because Jupiter rules your 1st and 7th houses/i);
  assert.match(result.message, /natal Mars and Venus/i);
  assert.match(result.message, /direct 6th-house themes/i);
  assert.match(result.message, /aspect-activated houses: 2nd, 10th, 12th/i);
  assert.match(result.message, /lordship-related houses: 1st and 7th/i);
  assert.doesNotMatch(result.message, /available chart context|grounded area of emphasis/i);
});
test('uses the calculated post-ingress Rahu snapshot instead of answering from the current house', async () => {
  const current = context('profile-a', 10);
  current.insightContext.upcomingTransitions = [{ type: 'INGRESS', planet: 'Rahu', at: '2026-12-05T12:00:00.000Z' }];
  const future = context('profile-a', 10);
  future.snapshot.transitBodies.Rahu = { ...future.snapshot.transitBodies.Rahu, transitNatalHouseNumber: 6 };
  const calls = [];
  const transit = new TaraTransitCapability({
    transitSnapshotService: { contextForTara: async (input) => { calls.push(input); return input.at === '2026-12-05T12:00:00.000Z' ? future : current; } },
    clock: () => '2026-10-14T00:00:00.000Z',
  });
  const result = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Rahu ka transit on 5th dec mere liye kaisa rahega', language: 'HINGLISH' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].horizonDays, 66);
  assert.match(result.message, /Rahu aapke 6th house mein move karega, 05 Dec 2026 ko/i);
  assert.match(result.message, /Current transit ke comparison mein focus finances, savings, family, speech, possessions se work routines, service, competition, debts, disputes, health, problem-solving ki taraf shift hoga/i);
  assert.doesNotMatch(result.message, /Rahu abhi aapke 2nd house/i);
});
test('treats a typed future date as a hint and corrects it with the calculated ingress date', async () => {
  const current = context('profile-a', 10);
  current.insightContext.upcomingTransitions = [{ type: 'INGRESS', planet: 'Rahu', at: '2026-12-07T12:00:00.000Z' }];
  const future = context('profile-a', 10);
  future.snapshot.transitBodies.Rahu = { ...future.snapshot.transitBodies.Rahu, transitNatalHouseNumber: 6 };
  const transit = new TaraTransitCapability({
    transitSnapshotService: { contextForTara: async (input) => input.at === '2026-12-07T12:00:00.000Z' ? future : current },
    clock: () => '2026-10-14T00:00:00.000Z',
  });
  const result = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Rahu transit on 5th Dec kya hoga?' });
  assert.match(result.message, /You asked about 5 Dec, but the calculated Rahu ingress is on 07 Dec 2026/i);
  assert.match(result.message, /moves into your 6th house on 07 Dec 2026/i);
});
test('uses each planet’s own engine-supported future aspect pattern and natal lordship', async () => {
  const cases = [
    { planet: 'Jupiter', aspects: '2nd, 10th, 12th', lordships: '9th and 12th' },
    { planet: 'Mars', aspects: '1st, 9th, 12th', lordships: '1st and 8th' },
    { planet: 'Saturn', aspects: '3rd, 8th, 12th', lordships: '10th and 11th' },
    { planet: 'Mercury', aspects: '12th', lordships: '3rd and 6th' },
  ];
  for (const expected of cases) {
    const factual = engineFutureContext(expected.planet);
    const transit = new TaraTransitCapability({
      transitSnapshotService: { contextForTara: async () => factual },
      clock: () => '2026-10-14T00:00:00.000Z',
    });
    const result = await transit.respond({ principal: {}, birthProfileId: 'profile-a', message: `What happens when ${expected.planet} changes houses?` });
    assert.match(result.message, new RegExp(`${expected.planet} will also aspect your ${expected.aspects} house`, 'i'));
    assert.match(result.message, new RegExp(`${expected.planet} rules your ${expected.lordships} house`, 'i'));
  }
});
test('routes a transit question through the transit capability, while job timing remains Career', async () => {
  const calls = []; const tara = new TaraOrchestrator({ careerCapability: { respond: async () => ({ answerability: 'SUPPORTED', message: 'Career result.' }) }, transitCapability: capability(calls) });
  const transit = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'How are current transits affecting me?' });
  assert.deepEqual({ domain: transit.domain, capability: transit.capability }, { domain: 'TRANSIT', capability: 'TRANSIT_GROUNDED' });
  const career = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When should I switch jobs?' });
  assert.equal(career.domain, 'CAREER'); assert.equal(calls.length, 1);
});
