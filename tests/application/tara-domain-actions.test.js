'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaraOrchestrator, TaraDomainAction } = require('../../src/application/tara');

function tara() {
  return new TaraOrchestrator({
    careerCapability: { respond: async () => { throw new Error('CAREER_MUST_NOT_RUN'); } },
    propertyCapability: { respond: async () => { throw new Error('PROPERTY_CALCULATION_MUST_NOT_RUN'); } },
    vehicleCapability: { respond: async () => { throw new Error('VEHICLE_CALCULATION_MUST_NOT_RUN'); } },
  });
}

test('routes clear Property requests to the existing Property hub without calculating in Ask Tara', async () => {
  for (const message of ['Is this a good time to buy property?', 'How is my property outlook?', 'What about buying a house?']) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.equal(response.domain, 'PROPERTY');
    assert.equal(response.capability, 'DOMAIN_HUB_ROUTING');
    assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label: 'View Property outlook', domain: 'PROPERTY' });
  }
});

test('routes clear Vehicle requests to the existing Vehicle hub without calculating in Ask Tara', async () => {
  for (const message of ['Is this a good time to buy a car?', 'How is my vehicle timing?']) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.equal(response.domain, 'VEHICLE');
    assert.equal(response.capability, 'DOMAIN_HUB_ROUTING');
    assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label: 'View Vehicle outlook', domain: 'VEHICLE' });
  }
});

test('keeps Wealth unsupported because no Wealth module exists and handles cross-domain choices safely', async () => {
  const wealth = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message: 'How is my wealth outlook?' });
  assert.equal(wealth.answerability, 'UNSUPPORTED');
  assert.equal(wealth.action, null);
  const crossDomain = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message: 'Should I buy a house or invest the money?' });
  assert.equal(crossDomain.answerability, 'UNSUPPORTED');
  assert.equal(crossDomain.action, null);
  assert.match(crossDomain.message, /separately/i);
});

test('does not create domain CTAs for technical, financial, or general false positives', async () => {
  for (const message of ['What are object properties in Dart?', 'Set this property value.', 'What vehicle does this API use?', 'Which stock should I buy?', 'Will my home loan be approved?']) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.notEqual(response.action?.type, 'OPEN_DOMAIN_HUB', message);
  }
});

test('uses Hinglish transition wording without changing the allowlisted Property action', async () => {
  const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message: 'Ghar kharidne ka acha time kab hai?', language: 'HINGLISH' });
  assert.equal(response.domain, 'PROPERTY');
  assert.match(response.message, /Property outlook aur timing/i);
  assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label: 'Property outlook dekhein', domain: 'PROPERTY' });
});

test('routes common Hinglish Property and Vehicle timing phrasing to the existing hubs', async () => {
  const cases = [
    ['Property lene ka time sahi hai?', 'PROPERTY', 'Property outlook dekhein'],
    ['Ghar kharidne ka acha time hai?', 'PROPERTY', 'Property outlook dekhein'],
    ['Flat lene ka time sahi hai kya?', 'PROPERTY', 'Property outlook dekhein'],
    ['Car lene ka time sahi hai?', 'VEHICLE', 'Vehicle outlook dekhein'],
    ['Gaadi kharidne ka acha time hai?', 'VEHICLE', 'Vehicle outlook dekhein'],
    ['Kya abhi gadi leni chahiye?', 'VEHICLE', 'Vehicle outlook dekhein'],
  ];
  for (const [message, domain, label] of cases) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'ENGLISH' });
    assert.equal(response.domain, domain, message);
    assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label, domain }, message);
    assert.match(response.message, /Main aapka/i, message);
  }
});

test('keeps Hinglish practical and financial questions outside domain-hub actions', async () => {
  for (const message of ['Phone switch kaise karu?', 'Car mileage kitna hai?', 'Property tax kitna lagega?', 'Foreign currency rate kya hai?', 'Kaunsa stock kharidu?']) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'HINGLISH' });
    assert.notEqual(response.action?.type, TaraDomainAction.OPEN_DOMAIN_HUB, message);
    assert.match(response.message, /reliable personalized guidance|reliable personalized answer|reliably/i, message);
  }
});
