'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PropertyIntent, natalEvidence, dashaEvidence, calibration, propertyTransitStateBoundaries, classify } = require('../../src/application/property');
const { TaraPropertyCapability, TaraOrchestrator, intentFor } = require('../../src/application/tara');

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

test('Property Life Event calibration remains profile-factual context and never supplies a window by itself', () => {
  assert.equal(calibration([]).state, 'NONE');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE', lifeEventId: 'one', eventDate: { precision: 'YEAR', year: 2020 } }]).state, 'LIMITED');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE' }, { eventType: 'PROPERTY_SALE' }]).state, 'MODERATE');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE' }, { eventType: 'PROPERTY_SALE' }, { eventType: 'PROPERTY_PURCHASE' }]).state, 'STRONG');
  assert.equal(calibration([{ eventType: 'PROPERTY_PURCHASE' }, { eventType: 'PROPERTY_PURCHASE' }]).recurringPattern, false);
});

test('Property Tara routing keeps purchase timing grounded, handles Hinglish, and returns a safe sale limitation', async () => {
  assert.equal(intentFor('Property lene ka acha time kab hai?'), PropertyIntent.PROPERTY_PURCHASE_TIMING);
  assert.equal(intentFor('Property ke liye loan involvement dikh raha hai?'), PropertyIntent.PROPERTY_LOAN_CONTEXT);
  const calls = []; const capability = new TaraPropertyCapability({ propertyAnswerService: { answer: async (input) => { calls.push(input); return { intent: input.intent, answerability: input.intent === PropertyIntent.PROPERTY_SALE_TIMING ? 'LIMITED_EVIDENCE' : 'SUPPORTED', classification: 'MODERATE', strongerWindow: { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' } }; } } });
  const purchase = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Property lene ka acha time kab hai?', language: 'HINGLISH' });
  const sale = await capability.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Should I sell my property?' });
  assert.equal(purchase.intent, PropertyIntent.PROPERTY_PURCHASE_TIMING); assert.match(purchase.message, /Dasha/);
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
