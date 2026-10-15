'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PropertyIntent, natalEvidence, dashaEvidence, primaryDashaBounds, ashtakavargaEvidence, calibration, propertyTransitStateBoundaries, classifyPropertyWindow, candidateState, classify, selectPropertyWindow, strongerWindow, PROPERTY_WINDOW_COARSE_SCAN_STEP_MS } = require('../../src/application/property');
const { TaraPropertyCapability, TaraOrchestrator, intentFor, answer } = require('../../src/application/tara');

function houses({ fourthLord = 'Moon', secondLord = 'Mars', occupants = ['Moon'] } = {}) {
  return {
    houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashiHouseLord: index + 1 === 4 ? fourthLord : index + 1 === 2 ? secondLord : index + 1 === 11 ? 'Venus' : 'Sun', rashi: { rashiIndex: index + 1 } })),
    planetaryAssignments: [
      ...occupants.map((body) => ({ body, rashiHouseNumber: 4 })),
      { body: 'Mars', rashiHouseNumber: 2 }, { body: 'Venus', rashiHouseNumber: 11 }, { body: 'Saturn', rashiHouseNumber: 6 },
    ],
  };
}

test('Property Rules v1 requires a D1 fourth-house connection and acquisition connection for a strong natal promise', () => {
  // Moon supplies the fourth-house connection; Mars/Venus independently
  // supply the acquisition connections. The approved rule permits this.
  assert.equal(natalEvidence(houses()).classification, 'STRONG');
  const noAcquisition = houses({ occupants: [] });
  noAcquisition.planetaryAssignments.splice(0);
  assert.equal(natalEvidence(noAcquisition).classification, 'MODERATE');
  const acquisitionOnly = houses({ fourthLord: null, occupants: [] });
  acquisitionOnly.planetaryAssignments.splice(0, acquisitionOnly.planetaryAssignments.length, { body: 'Mars', rashiHouseNumber: 2 });
  // Without a meaningful fourth-house factor, acquisition alone cannot be STRONG.
  assert.notEqual(natalEvidence(acquisitionOnly).classification, 'STRONG');
});

test('Property window state boundaries are refined event boundaries, never a synthetic calendar cadence', () => {
  const start = '2026-01-01T00:00:00.000Z'; const end = '2026-12-31T00:00:00.000Z';
  const empty = propertyTransitStateBoundaries({ events: [] }, start, end);
  assert.deepEqual(empty, [start, end]);
  const refined = propertyTransitStateBoundaries({ events: [{ body: 'Jupiter', eventType: 'transitDrishtiStart', instant: '2026-11-17T14:30:00.000Z' }, { body: 'Saturn', eventType: 'rashiIngress', instant: '2026-12-03T02:15:00.000Z' }] }, start, end);
  assert.deepEqual(refined, [start, '2026-11-17T14:30:00.000Z', '2026-12-03T02:15:00.000Z', end]);
  assert.equal(refined.includes('2026-11-01T00:00:00.000Z'), false);
});

test('Property window scanning uses the shared scanner daily coarse cadence only after an eligible PD is found', () => {
  const calls = [];
  const result = strongerWindow({
    engine: {},
    scanner: (input) => {
      calls.push(input);
      return { events: [] };
    },
    birth: { latitude: 17.385, longitude: 78.4867 },
    natalBodies: {},
    houses: {},
    dashaTree: { periods: [] },
    natal: {},
    d1: {},
    d4: {},
    start: '2026-01-01T00:00:00.000Z',
  });
  assert.equal(result, null);
  assert.equal(calls.length, 0);
  assert.equal(PROPERTY_WINDOW_COARSE_SCAN_STEP_MS, 86_400_000);
});

test('Property final classification requires dynamic Dasha and major-transit agreement, while raw support layers cannot upgrade it', () => {
  const strong = classify({ natal: { classification: 'STRONG' }, d4: { confirmation: 'CONFIRMS' }, dasha: { classification: 'STRONG' }, transit: { active: true } });
  const moderate = classify({ natal: { classification: 'MODERATE' }, d4: { confirmation: 'NEUTRAL' }, dasha: { classification: 'MODERATE' }, transit: { active: true } });
  const weak = classify({ natal: { classification: 'STRONG' }, d4: { confirmation: 'CONFIRMS' }, dasha: { classification: 'STRONG' }, transit: { active: false } });
  assert.equal(strong, 'STRONG'); assert.equal(moderate, 'MODERATE'); assert.equal(weak, 'WEAK');
});

test('Property Dasha keeps MD/AD primary and lets PD refine only', () => {
  const chart = houses();
  const common = { start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z' };
  assert.equal(dashaEvidence(chart, { ...common, md: 'moon', ad: 'mars', pd: 'saturn' }).classification, 'STRONG');
  assert.equal(dashaEvidence(chart, { ...common, md: 'moon', ad: 'sun', pd: 'saturn' }).classification, 'MODERATE');
  assert.equal(dashaEvidence(chart, { ...common, md: 'sun', ad: 'sun', pd: 'moon' }).active, false);
});

test('Property Dasha preserves MD, AD, and PD levels when one planet rules more than one level', () => {
  const evidence = dashaEvidence(houses(), { start: '2026-01-01T00:00:00.000Z', end: '2026-02-01T00:00:00.000Z', md: 'moon', ad: 'moon', pd: 'moon' });
  assert.deepEqual(evidence.factors.map((factor) => factor.level), ['MD', 'AD', 'PD']);
});

test('Property timing uses MD/AD bounds rather than allowing PD to collapse the main window', () => {
  const bounds = primaryDashaBounds({
    mdStart: '2027-06-01T00:00:00.000Z',
    mdEnd: '2027-07-01T00:00:00.000Z',
    adStart: '2027-06-01T00:00:00.000Z',
    adEnd: '2027-07-01T00:00:00.000Z',
    pdStart: '2027-06-02T06:00:00.000Z',
    pdEnd: '2027-06-02T18:00:00.000Z',
  });
  assert.deepEqual(bounds, {
    start: '2027-06-01T00:00:00.000Z',
    end: '2027-07-01T00:00:00.000Z',
  });
});

test('Property PD candidates require eligible MD/AD and use transit as confirmation rather than as the entire window', () => {
  const natal = { classification: 'STRONG' }; const d4 = { confirmation: 'CONFIRMS' };
  const eligibleDasha = { active: true, classification: 'STRONG' };
  const activePd = { state: 'PROPERTY_ACTIVE' };
  assert.equal(candidateState({ natal, d4, dasha: eligibleDasha, pd: activePd, transit: { state: 'MAJOR_CONFIRMATION' } }), 'STRONG_CANDIDATE');
  assert.equal(candidateState({ natal, d4, dasha: { active: false, classification: 'LIMITED' }, pd: activePd, transit: { state: 'MAJOR_CONFIRMATION' } }), 'NOT_SUPPORTED');
  assert.equal(candidateState({ natal, d4, dasha: eligibleDasha, pd: activePd, transit: { state: 'NONE' } }), 'MIXED_CANDIDATE');
});

test('Property window classifications suppress invalid intervals and keep sub-day activations brief', () => {
  assert.equal(classifyPropertyWindow({ start: '2027-06-02T00:00:00.000Z', end: '2027-06-02T00:00:00.000Z' }), 'NO_RELIABLE_WINDOW');
  assert.equal(classifyPropertyWindow({ start: '2027-06-03T00:00:00.000Z', end: '2027-06-02T00:00:00.000Z' }), 'NO_RELIABLE_WINDOW');
  assert.equal(classifyPropertyWindow({ start: '2027-06-02T06:00:00.000Z', end: '2027-06-02T18:00:00.000Z' }), 'BRIEF_ACTIVATION');
  assert.equal(classifyPropertyWindow({ start: '2027-06-02T00:00:00.000Z', end: '2027-06-05T00:00:00.000Z' }), 'BOUNDED_WINDOW');
});

test('Property window selection retains a stronger bounded MD/AD-transit interval instead of returning a nested brief activation first', () => {
  const dasha = { classification: 'STRONG', periods: { md: 'jupiter', ad: 'moon' } };
  const transitConfirmation = { state: 'MAJOR_CONFIRMATION', hasCaution: false, peakActivation: { start: '2027-06-02T06:00:00.000Z', end: '2027-06-02T18:00:00.000Z' } };
  const pdRelevance = { state: 'PROPERTY_ACTIVE' };
  const bounded = {
    start: '2027-06-01T00:00:00.000Z',
    end: '2027-06-14T00:00:00.000Z',
    candidateState: 'STRONG_CANDIDATE',
    dasha,
    d4Confirmation: 'CONFIRMS',
    pdRelevance,
    transitConfirmation,
  };
  const brief = {
    start: '2027-06-02T06:00:00.000Z',
    end: '2027-06-02T18:00:00.000Z',
    candidateState: 'MODERATE_CANDIDATE',
    dasha,
    d4Confirmation: 'CONFIRMS',
    pdRelevance,
    transitConfirmation,
  };
  const result = selectPropertyWindow([brief, bounded]);
  assert.equal(result.selected.candidateState, 'STRONG_CANDIDATE');
  assert.equal(result.selected.start, bounded.start);
  assert.equal(result.selected.end, bounded.end);
  assert.deepEqual(result.secondary, [brief]);
});

test('Property Tara copy separates the current picture from future timing', () => {
  const base = { intent: PropertyIntent.PROPERTY_PURCHASE_TIMING, classification: 'MIXED' };
  const bounded = answer({ ...base, windowStatus: 'BOUNDED_WINDOW', strongerWindow: { start: '2027-06-02T00:00:00.000Z', end: '2027-06-10T00:00:00.000Z' } }, 'HINGLISH');
  assert.match(bounded, /^Property matters ke liye current support mixed hai\./);
  assert.match(bounded, /Aage ek stronger calculated Property period 02 Jun 2027 se 10 Jun 2027/);
  assert.doesNotMatch(bounded, /Current Dasha/);
  const brief = answer({ ...base, windowStatus: 'BRIEF_ACTIVATION', strongerWindow: { start: '2027-06-02T06:00:00.000Z', end: '2027-06-02T18:00:00.000Z' } }, 'HINGLISH');
  assert.match(brief, /brief calculated Property activation/);
  assert.doesNotMatch(brief, /to 02 Jun 2027/);
  const none = answer({ ...base, windowStatus: 'NO_RELIABLE_WINDOW', strongerWindow: null }, 'HINGLISH');
  assert.match(none, /sufficiently strong bounded Property window/);
});

test('Property Life Event calibration remains profile-factual context and never supplies a window by itself', () => {
  assert.equal(calibration([]).state, 'NONE');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE', lifeEventId: 'one', eventDate: { precision: 'YEAR', year: 2020 } }]).state, 'LIMITED');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE' }, { eventType: 'PROPERTY_SALE' }]).state, 'MODERATE');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE' }, { eventType: 'PROPERTY_SALE' }, { eventType: 'PROPERTY_PURCHASE' }]).state, 'STRONG');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE' }, { eventType: 'PROPERTY_PURCHASE' }]).recurringPattern, false);
});

test('Property Ashtakavarga context accepts the raw engine rashi shape and leaves missing values neutral', () => {
  const chart = houses();
  const raw = { rawSarvashtakavarga: { rashis: [{ rashiIndex: 2, favorableMarkCount: 31 }] } };
  const evidence = ashtakavargaEvidence(raw, chart);
  assert.equal(evidence.policy, 'CONTEXT_ONLY_NO_THRESHOLDS');
  assert.equal(evidence.sav.find((item) => item.house === 2).bindu, 31);
  assert.equal(evidence.sav.find((item) => item.house === 4).bindu, null);
});

test('Property Tara routing keeps purchase timing grounded, handles Hinglish, and returns a safe sale limitation', async () => {
  assert.equal(intentFor('Property lene ka acha time kab hai?'), PropertyIntent.PROPERTY_PURCHASE_TIMING);
  assert.equal(intentFor('Ghar kharidne ka stronger period kab hai?'), PropertyIntent.PROPERTY_STRONGER_WINDOW);
  assert.equal(intentFor('Abhi property ke liye time kaisa hai?'), PropertyIntent.PROPERTY_CURRENT_STRENGTH);
  assert.equal(intentFor('Property ke liye loan involvement dikh raha hai?'), PropertyIntent.PROPERTY_LOAN_CONTEXT);
  const calls = []; const capability = new TaraPropertyCapability({ propertyAnswerService: { answer: async (input) => { calls.push(input); return { intent: input.intent, answerability: input.intent === PropertyIntent.PROPERTY_SALE_TIMING ? 'LIMITED_EVIDENCE' : 'SUPPORTED', classification: 'MODERATE', windowStatus: 'BOUNDED_WINDOW', strongerWindow: { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' } }; } } });
  const purchase = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Property lene ka acha time kab hai?', language: 'HINGLISH' });
  const sale = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Should I sell my property?' });
  assert.equal(purchase.intent, PropertyIntent.PROPERTY_PURCHASE_TIMING); assert.match(purchase.message, /stronger calculated Property period/);
  assert.equal(sale.intent, PropertyIntent.PROPERTY_SALE_TIMING); assert.match(sale.message, /not yet reliably supported/i);
  assert.equal(calls[0].birthProfileId, 'profile-a');
});

test('Property orchestration is profile-scoped and never routes a Property question through Career', async () => {
  const calls = [];
  const tara = new TaraOrchestrator({
    careerCapability: { respond: async () => { throw new Error('CAREER_MUST_NOT_RUN'); } },
    propertyCapability: { respond: async (input) => { calls.push(input.birthProfileId); return { answerability: 'SUPPORTED', message: 'Property evidence.' }; } },
  });
  const first = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'When should I buy property?' });
  const second = await tara.respond({ principal: {}, birthProfileId: 'profile-b', message: 'When should I buy property?' });
  assert.equal(first.capability, 'PROPERTY_GROUNDED'); assert.equal(second.capability, 'PROPERTY_GROUNDED');
  assert.deepEqual(calls, ['profile-a', 'profile-b']);
});
