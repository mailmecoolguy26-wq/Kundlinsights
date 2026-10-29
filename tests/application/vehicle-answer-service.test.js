'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  VehicleAnswerService, d1Evidence, natalPromise, vehicleFactor, mdAdEvidence, pdRefinement,
  transitEvidence, ashtakavargaEvidence, calibration, classifyCandidate,
  classifyWindowShape, coalesceVehicleCandidates, selectVehicleWindow, selectPeak, transitBoundaries,
} = require('../../src/application/vehicle');
const { TaraVehicleCapability, TaraOrchestrator, vehicleAnswer } = require('../../src/application/tara');

function houses({ fourthLord = 'Moon', occupants = ['Moon'], extra = [] } = {}) {
  return {
    houses: Array.from({ length: 12 }, (_, index) => ({
      houseNumber: index + 1,
      rashiHouseLord: index + 1 === 4 ? fourthLord : index + 1 === 2 ? 'Mars' : index + 1 === 11 ? 'Venus' : index + 1 === 3 ? 'Mercury' : index + 1 === 6 ? 'Saturn' : 'Sun',
      rashi: { rashiIndex: index + 1 },
    })),
    planetaryAssignments: [...occupants.map((body) => ({ body, rashiHouseNumber: 4 })), { body: 'Mars', rashiHouseNumber: 2 }, { body: 'Venus', rashiHouseNumber: 11 }, { body: 'Saturn', rashiHouseNumber: 6 }, ...extra],
  };
}
function d16({ confirmation = 'CONFIRMS' } = {}) { return { confirmation, d16Houses: houses() }; }
function eligibleDasha({ md = 'moon', ad = 'mars', pd = 'moon' } = {}) { return { md, ad, pd, mdStart: '2026-01-01T00:00:00.000Z', mdEnd: '2027-01-01T00:00:00.000Z', adStart: '2026-01-01T00:00:00.000Z', adEnd: '2027-01-01T00:00:00.000Z', pdStart: '2026-02-01T00:00:00.000Z', pdEnd: '2026-03-01T00:00:00.000Z' }; }
function snapshot({ jupiter = null, saturn = null, venus = null, mars = null, rahu = null, ketu = null } = {}) {
  const entry = (house) => house == null ? null : { transitNatalHouseNumber: house, aspectsNatalHouses: [], aspectsNatalBodies: [], sameRashiNatalBodies: [] };
  return { transitBodies: { Jupiter: entry(jupiter), Saturn: entry(saturn), Venus: entry(venus), Mars: entry(mars), Rahu: entry(rahu), Ketu: entry(ketu) } };
}
function supportedSegment({ start, end, strength = 'MODERATE_CANDIDATE', major = 'PARTIAL_MAJOR_CONFIRMATION', pd = 'PRIMARY_REFINEMENT', pdLord = 'mercury', source = [] } = {}) {
  const hasMajor = major !== 'NO_MAJOR_CONFIRMATION';
  return {
    start, end, candidateStrength: strength, windowShape: classifyWindowShape({ start, end }), natalPromise: 'STRONG', d16Confirmation: 'CONFIRMS',
    mdAd: { eligible: true, classification: 'STRONG_MD_AD_SUPPORT', periods: { pd: pdLord } }, pd: { state: pd },
    transit: { hasMajorConfirmation: hasMajor, majorConfirmation: major, majorDirect: major === 'MAJOR_CONFIRMATION' ? [{ planet: 'Jupiter' }] : [], majorSupporting: major === 'PARTIAL_MAJOR_CONFIRMATION' ? [{ planet: 'Jupiter' }] : [], contexts: [{ planet: 'Saturn', kind: 'MAJOR', contextualHouses: [3] }] },
    transitChanges: source,
  };
}
function vehicleResult({ classification = 'MODERATE_CANDIDATE', window = null, contexts = [] } = {}) {
  return {
    intent: 'VEHICLE_PURCHASE_TIMING', answerability: classification === 'NOT_SUPPORTED' ? 'LIMITED_EVIDENCE' : 'SUPPORTED', classification,
    natalPromise: 'STRONG', windowShape: window && window.windowShape || 'NO_RELIABLE_WINDOW', strongerWindow: window,
    evidence: {
      d16: { confirmation: 'CONFIRMS' },
      mdAd: { classification: 'STRONG_MD_AD_SUPPORT', eligible: true },
      pd: { state: classification === 'NOT_SUPPORTED' ? 'NOT_RELEVANT' : 'PRIMARY_REFINEMENT' },
      transit: { majorConfirmation: classification === 'MIXED_CANDIDATE' ? 'MIXED_MAJOR_CONFIRMATION' : 'PARTIAL_MAJOR_CONFIRMATION', contexts },
    },
    diagnostics: [{ event: 'VEHICLE_TEST_DIAGNOSTIC', state: classification }],
  };
}

test('Vehicle v1 requires a direct D1 fourth-house seed; acquisition alone is not a Vehicle promise', () => {
  const direct = d1Evidence(houses());
  assert.equal(direct.d1Seed, true);
  const acquisitionOnly = houses({ fourthLord: null, occupants: [], extra: [] });
  acquisitionOnly.planetaryAssignments = [{ body: 'Mars', rashiHouseNumber: 2 }, { body: 'Venus', rashiHouseNumber: 11 }];
  const noSeed = d1Evidence(acquisitionOnly);
  assert.equal(noSeed.d1Seed, false);
  assert.equal(natalPromise(noSeed, d16()), 'NO_VEHICLE_PROMISE');
});

test('D16 can confirm or weaken a D1 seed but cannot create it, and WEAKENS blocks STRONG', () => {
  const d1 = d1Evidence(houses());
  assert.equal(natalPromise(d1, d16({ confirmation: 'CONFIRMS' })), 'STRONG');
  assert.equal(natalPromise(d1, d16({ confirmation: 'WEAKENS' })), 'LIMITED');
  const noSeed = { ...d1, d1Seed: false };
  assert.equal(natalPromise(noSeed, d16({ confirmation: 'CONFIRMS' })), 'NO_VEHICLE_PROMISE');
});

test('MD/AD requires one direct Vehicle-active factor; two supporting factors are insufficient and PD cannot rescue it', () => {
  const d1 = houses(); const factors = mdAdEvidence(d1, d16(), eligibleDasha({ md: 'moon', ad: 'moon' }));
  assert.equal(factors.classification, 'STRONG_MD_AD_SUPPORT');
  const supportingOnly = mdAdEvidence(houses({ fourthLord: 'Sun', occupants: [] }), d16({ confirmation: 'NEUTRAL' }), eligibleDasha({ md: 'mars', ad: 'venus', pd: 'moon' }));
  assert.equal(supportingOnly.classification, 'INSUFFICIENT_MD_AD_SUPPORT');
  assert.equal(pdRefinement(supportingOnly).state, 'PRIMARY_REFINEMENT');
  assert.equal(classifyCandidate({ promise: 'STRONG', d16: { confirmation: 'CONFIRMS' }, mdAd: supportingOnly, pd: pdRefinement(supportingOnly), transit: { hasMajorConfirmation: true, majorConfirmation: 'MAJOR_CONFIRMATION' } }), 'NOT_SUPPORTED');
});

test('Jupiter/Saturn are the only major Gochar confirmation; Venus/Mars and nodes cannot upgrade a candidate', () => {
  const d1 = houses();
  const venusOnly = transitEvidence(snapshot({ venus: 4, mars: 2, rahu: 4, ketu: 11 }), d1);
  assert.equal(venusOnly.hasMajorConfirmation, false);
  assert.equal(venusOnly.majorConfirmation, 'NO_MAJOR_CONFIRMATION');
  const jupiter = transitEvidence(snapshot({ jupiter: 4, venus: 4, rahu: 4 }), d1);
  assert.equal(jupiter.hasMajorConfirmation, true);
  assert.equal(jupiter.majorConfirmation, 'MIXED_MAJOR_CONFIRMATION');
});

test('SAV/BAV and strictly prior Life Events remain context and never determine candidate strength', () => {
  const context = ashtakavargaEvidence({ rawSarvashtakavarga: { rashis: [{ rashiIndex: 2, favorableMarkCount: 1 }, { rashiIndex: 4, favorableMarkCount: 99 }] } }, houses());
  assert.equal(context.policy, 'CONTEXT_ONLY_NO_THRESHOLDS');
  const history = calibration([{ lifeEventId: 'past', eventType: 'VEHICLE_PURCHASE', eventDate: { precision: 'YEAR', year: 2020 } }, { lifeEventId: 'future', eventType: 'VEHICLE_SALE', eventDate: { precision: 'YEAR', year: 2030 } }], '2026-01-01T00:00:00.000Z');
  assert.equal(history.eventCount, 1);
  const base = { promise: 'MODERATE', d16: { confirmation: 'CONFIRMS' }, mdAd: { eligible: true, classification: 'MODERATE_MD_AD_SUPPORT' }, pd: { state: 'CONFIRMING_REFINEMENT' }, transit: { hasMajorConfirmation: false, majorConfirmation: 'NO_MAJOR_CONFIRMATION' } };
  assert.equal(classifyCandidate(base), 'NOT_SUPPORTED');
});

test('Vehicle candidate selection prefers active bounded evidence and hides elapsed peaks', () => {
  const candidate = (start, end, strength) => ({ start, end, candidateStrength: strength, windowShape: classifyWindowShape({ start, end }) });
  const now = '2026-10-15T00:00:00.000Z';
  const active = candidate('2026-10-01T00:00:00.000Z', '2026-11-20T00:00:00.000Z', 'MIXED_CANDIDATE');
  const future = candidate('2026-12-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 'STRONG_CANDIDATE');
  const brief = candidate('2026-10-16T06:00:00.000Z', '2026-10-16T18:00:00.000Z', 'STRONG_CANDIDATE');
  assert.equal(selectVehicleWindow([future, active, brief], { now }).selected, active);
  assert.equal(selectPeak([{ start: '2026-08-01T00:00:00.000Z', end: '2026-08-02T00:00:00.000Z', evidence: { hasMajorConfirmation: true, majorDirect: [{}], majorSupporting: [] } }], now), null);
  const refined = transitBoundaries({ events: [{ body: 'Jupiter', instant: '2026-11-17T14:30:00.000Z' }, { body: 'Saturn', instant: '2026-12-03T02:15:00.000Z' }] }, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
  assert.deepEqual(refined, ['2026-01-01T00:00:00.000Z', '2026-11-17T14:30:00.000Z', '2026-12-03T02:15:00.000Z', '2026-12-31T00:00:00.000Z']);
  assert.equal(refined.includes('2026-11-01T00:00:00.000Z'), false);
});

test('Vehicle customer windows coalesce adjacent same-strength supported transit segments while retaining internal phases', () => {
  const now = '2026-10-18T00:00:00.000Z';
  const marsIngress = supportedSegment({ start: '2026-09-18T10:58:01.263Z', end: '2026-10-31T06:02:48.666Z', source: [{ planet: 'Mars', eventType: 'rashiIngress' }] });
  const jupiterIngress = supportedSegment({ start: '2026-10-31T06:02:48.666Z', end: '2026-11-05T19:29:13.773Z', source: [{ planet: 'Jupiter', eventType: 'rashiIngress' }] });
  const windows = coalesceVehicleCandidates([marsIngress, jupiterIngress], { now });
  assert.equal(windows.length, 1);
  assert.equal(windows[0].start, marsIngress.start);
  assert.equal(windows[0].end, jupiterIngress.end);
  assert.equal(windows[0].candidateStrength, 'MODERATE_CANDIDATE');
  assert.deepEqual(windows[0].internalPhases.map((phase) => phase.transitChanges[0].eventType), ['rashiIngress', 'rashiIngress']);
  assert.deepEqual(windows[0].internalPhases.map((phase) => phase.transitChanges[0].planet), ['Mars', 'Jupiter']);
});

test('Vehicle customer windows split only for material support changes, gaps, or relevant PD refinement changes', () => {
  const first = supportedSegment({ start: '2026-10-01T00:00:00.000Z', end: '2026-10-10T00:00:00.000Z' });
  const strengthChanged = supportedSegment({ start: '2026-10-10T00:00:00.000Z', end: '2026-10-20T00:00:00.000Z', strength: 'MIXED_CANDIDATE', major: 'MIXED_MAJOR_CONFIRMATION' });
  assert.equal(coalesceVehicleCandidates([first, strengthChanged]).length, 2);
  const noMajor = supportedSegment({ start: '2026-10-10T00:00:00.000Z', end: '2026-10-20T00:00:00.000Z', strength: 'NOT_SUPPORTED', major: 'NO_MAJOR_CONFIRMATION' });
  const afterGap = supportedSegment({ start: '2026-10-20T00:00:00.000Z', end: '2026-10-30T00:00:00.000Z' });
  assert.equal(coalesceVehicleCandidates([first, noMajor, afterGap]).length, 2);
  const changedPd = supportedSegment({ start: '2026-10-10T00:00:00.000Z', end: '2026-10-20T00:00:00.000Z', pd: 'CONFIRMING_REFINEMENT', pdLord: 'rahu' });
  assert.equal(coalesceVehicleCandidates([first, changedPd]).length, 2);
});

test('Vehicle customer wording uses a coalesced support-window end rather than an internal phase end', () => {
  const message = vehicleAnswer({ classification: 'MODERATE_CANDIDATE', strongerWindow: { start: '2026-09-18T10:58:01.263Z', end: '2026-11-20T12:46:11.911Z', windowShape: 'BOUNDED_WINDOW', temporalStatus: 'CURRENT', internalPhases: [] } }, 'ENGLISH');
  assert.match(message, /20 Nov 2026/);
  assert.doesNotMatch(message, /31 Oct 2026/);
});

test('Vehicle renders deterministic English and Latin-Hinglish copy without changing factual output', async () => {
  const cases = [
    {
      name: 'current active window', result: vehicleResult({ window: { start: '2026-10-01T00:00:00.000Z', end: '2026-11-20T00:00:00.000Z', windowShape: 'BOUNDED_WINDOW', temporalStatus: 'CURRENT', internalPhases: [] }, contexts: [{ contextualHouses: [6, 12] }] }),
      hinglish: /moderate support dikha rahe hain[\s\S]*abhi active hai[\s\S]*20 Nov 2026[\s\S]*maintenance aur possible expenses/im,
    },
    {
      name: 'future moderate window', result: vehicleResult({ classification: 'NOT_SUPPORTED', window: { start: '2027-01-10T00:00:00.000Z', end: '2027-06-02T00:00:00.000Z', windowShape: 'BOUNDED_WINDOW', temporalStatus: 'UPCOMING', internalPhases: [] } }),
      hinglish: /strong Vehicle timing support nahi dikh raha[\s\S]*10 Jan 2027 se 02 Jun 2027 tak/im,
    },
    {
      name: 'mixed window', result: vehicleResult({ classification: 'MIXED_CANDIDATE', window: { start: '2027-06-02T00:00:00.000Z', end: '2027-07-20T00:00:00.000Z', windowShape: 'BOUNDED_WINDOW', temporalStatus: 'CURRENT', internalPhases: [] } }),
      hinglish: /Vehicle support hai, lekin kuch mixed factors bhi hain/im,
    },
    {
      name: 'unsupported gap', result: vehicleResult({ classification: 'NOT_SUPPORTED', contexts: [{ contextualHouses: [6, 12] }] }),
      hinglish: /strong Vehicle timing support nahi dikh raha[\s\S]*maintenance aur possible expenses/im,
    },
  ];
  for (const sample of cases) {
    const diagnostics = { english: [], hinglish: [] };
    const capability = new TaraVehicleCapability({ vehicleAnswerService: { answer: async (input) => { input.diagnosticLog({ event: 'VEHICLE_TEST_DIAGNOSTIC', state: sample.result.classification }); return sample.result; } } });
    const english = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When should I buy a vehicle?', language: 'ENGLISH', diagnosticLog: (entry) => diagnostics.english.push(entry) });
    const hinglish = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Vehicle kab lena chahiye?', language: 'HINGLISH', diagnosticLog: (entry) => diagnostics.hinglish.push(entry) });
    assert.equal(english.intent, hinglish.intent, sample.name);
    assert.deepEqual(english.vehicle, hinglish.vehicle, sample.name);
    assert.deepEqual(english.vehicle.natalPromise, hinglish.vehicle.natalPromise, sample.name);
    assert.deepEqual(english.vehicle.evidence.d16, hinglish.vehicle.evidence.d16, sample.name);
    assert.deepEqual(english.vehicle.evidence.mdAd, hinglish.vehicle.evidence.mdAd, sample.name);
    assert.deepEqual(english.vehicle.evidence.pd, hinglish.vehicle.evidence.pd, sample.name);
    assert.deepEqual(english.vehicle.evidence.transit, hinglish.vehicle.evidence.transit, sample.name);
    assert.deepEqual(english.vehicle.strongerWindow, hinglish.vehicle.strongerWindow, sample.name);
    assert.deepEqual(english.vehicle.diagnostics, hinglish.vehicle.diagnostics, sample.name);
    assert.deepEqual(diagnostics.english, diagnostics.hinglish, sample.name);
    assert.match(hinglish.message, sample.hinglish, sample.name);
    assert.match(hinglish.message, /guarantee nahi deta/i, sample.name);
  }
});

test('Vehicle Ask Tara routing is isolated from Career and opens the existing Vehicle hub', async () => {
  const calls = [];
  const tara = new TaraOrchestrator({
    careerCapability: { respond: async () => { throw new Error('CAREER_MUST_NOT_RUN'); } },
    vehicleCapability: { respond: async (input) => { calls.push(input.birthProfileId); return { answerability: 'SUPPORTED', message: 'Vehicle evidence.' }; } },
  });
  const result = await tara.respond({ principal: {}, birthProfileId: 'profile-vehicle', message: 'Car lene ka acha time kab hai?' });
  assert.equal(result.domain, 'VEHICLE');
  assert.equal(result.capability, 'DOMAIN_HUB_ROUTING');
  assert.deepEqual(result.action, { type: 'OPEN_DOMAIN_HUB', label: 'Vehicle outlook dekhein', domain: 'VEHICLE' });
  assert.deepEqual(calls, []);
  const capability = new TaraVehicleCapability({ vehicleAnswerService: { answer: async (input) => ({ intent: input.intent, answerability: 'SUPPORTED', classification: 'MODERATE_CANDIDATE', strongerWindow: null, windowShape: 'NO_RELIABLE_WINDOW' }) } });
  assert.match((await capability.respond({ message: 'Vehicle kab lena chahiye?', birthProfileId: 'profile-vehicle' })).message, /Vehicle support window/);
});

test('Vehicle Tara returns a profile-premium action without exposing calculation data when locked', async () => {
  const capability = new TaraVehicleCapability({ vehicleAnswerService: { answer: async () => ({ answerability: 'PREMIUM_REQUIRED', state: 'PREMIUM_REQUIRED', action: { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' } }) } });
  const result = await capability.respond({ principal: {}, birthProfileId: 'profile-b', message: 'When should I buy a car?' });
  assert.equal(result.answerability, 'PREMIUM_REQUIRED');
  assert.equal(result.vehicle, null);
  assert.deepEqual(result.action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
});

test('Vehicle service checks profile premium before profile or astrology calculation', async () => {
  let profileRead = false;
  const service = new VehicleAnswerService({ birthProfileService: { get: async () => { profileRead = true; throw new Error('MUST_NOT_CALCULATE'); } }, lifeEventService: { getRelevantLifeEvents: async () => [] }, astronomicalEngine: { calculate: () => { throw new Error('MUST_NOT_CALCULATE'); } }, canonicalSiderealSunSampler: () => 0, entitlementService: { getReadingEntitlementStatus: async () => ({ profilePremium: { eligible: false } }) } });
  const result = await service.answer({ principal: {}, birthProfileId: 'profile-b' });
  assert.equal(profileRead, false);
  assert.equal(result.answerability, 'PREMIUM_REQUIRED');
  assert.equal(result.evidence, null);
});
