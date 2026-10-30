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

test('routes clear English and Hinglish Wealth outlook requests to the existing Wealth hub', async () => {
  for (const [message, language, label] of [['How is my wealth outlook?', 'ENGLISH', 'View Wealth outlook'], ['Is this a good financial period?', 'ENGLISH', 'View Wealth outlook'], ['When is my stronger Wealth period?', 'ENGLISH', 'View Wealth outlook'], ['Mera wealth outlook kaisa hai?', 'HINGLISH', 'Wealth outlook dekhein'], ['Paiso ka time kaisa hai?', 'HINGLISH', 'Wealth outlook dekhein'], ['Financial growth ka time kaisa hai?', 'HINGLISH', 'Wealth outlook dekhein']]) {
    const wealth = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language });
    assert.equal(wealth.domain, 'WEALTH');
    assert.deepEqual(wealth.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label, domain: 'WEALTH' });
  }
  const crossDomain = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message: 'Should I buy a house or invest the money?' });
  assert.equal(crossDomain.answerability, 'UNSUPPORTED');
  assert.equal(crossDomain.action, null);
  assert.match(crossDomain.message, /separately/i);
});

test('does not create domain CTAs for technical and financial false positives', async () => {
  for (const message of ['What are object properties in Dart?', 'Set this property value.', 'What vehicle does this API use?', 'Which stock should I buy?', 'What is wealth tax?', 'USD INR rate kya hai?', 'Savings account interest kitna hai?', 'What does a wealth manager do?', 'Mutual fund NAV kya hai?']) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.notEqual(response.action?.type, 'OPEN_DOMAIN_HUB', message);
  }
});

test('keeps investment, loan, and exact-money questions behind a safe boundary with a Wealth hub transition', async () => {
  for (const [message, label] of [['Should I invest 10 lakh now?', 'View Wealth outlook'], ['Will my home loan be approved?', 'View Wealth outlook'], ['Main kitna paisa kamaunga?', 'Wealth outlook dekhein']]) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'HINGLISH' });
    assert.equal(response.answerability, 'UNSUPPORTED');
    assert.match(response.message, /specific investment|lender approval|specific investment|recommend/i);
    assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label, domain: 'WEALTH' });
  }
  const crypto = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message: 'Crypto mein invest karu?', language: 'HINGLISH' });
  assert.equal(crypto.action, null);
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
    assert.match(response.message, /reliable personalized guidance|reliable personalized answer|reliably|broader Wealth outlook/i, message);
  }
});

test('routes conservative Relationship, marriage, and Family Expansion planning prompts to one existing hub', async () => {
  const english = ['How is my relationship outlook?', 'When is my stronger relationship period?', 'How is my love life phase?', 'How is my married life phase?', 'What does my chart say about marriage?', 'How is my marriage outlook?', 'When is a stronger time for marriage?', 'Is this a supportive time for family expansion?', 'How is my Family Expansion outlook?', 'When is a stronger family-oriented period?'];
  for (const message of english) { const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message }); assert.equal(response.domain, 'RELATIONSHIPS', message); assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label: 'View Relationships & Family', domain: 'RELATIONSHIPS' }, message); }
  const hinglish = ['Relationship ka time kaisa hai?', 'Mera relationship outlook kaisa hai?', 'Love life ka phase kaisa hai?', 'Relationship timing check karo.', 'Shaadi ka time kaisa hai?', 'Mera marriage outlook kaisa hai?', 'Marriage timing check karo.', 'Family planning ke liye timing kaisi hai?', 'Family expansion ka time kaisa hai?', 'Family badhane ka phase kaisa hai?'];
  for (const message of hinglish) { const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'HINGLISH' }); assert.equal(response.domain, 'RELATIONSHIPS', message); assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label: 'Relationships & Family dekhein', domain: 'RELATIONSHIPS' }, message); }
});

test('keeps relationship certainty, spouse identity, divorce, and reproductive questions behind explicit no-action boundaries', async () => {
  const unsafe = ['Will I definitely get married this year?', 'Will I get married in 2027?', 'Kya meri shaadi iss saal pakki hogi?', 'Who will I marry?', "What will my spouse's name be?", 'What will my husband do?', 'Mere husband ka naam kya hoga?', 'Main kis se shaadi karunga?', 'Will I get divorced?', 'Kya meri shaadi toot jayegi?', 'Will my partner leave me?', 'Will my ex come back?', 'Is my partner cheating?', 'Am I fertile?', 'Am I infertile?', 'Will I conceive?', 'When will I conceive?', 'Pregnancy kab hogi?', 'What are my chances of pregnancy?', 'Will I miscarry?', 'Will my baby be healthy?', 'Boy or girl?', 'How many children will I have?', 'Kitne bacche honge?'];
  for (const message of unsafe) { const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'HINGLISH' }); assert.equal(response.action, null, message); assert.equal(response.answerability, 'UNSUPPORTED', message); assert.doesNotMatch(response.message, /will marry|likely to conceive|fertility score|pregnancy chance/i, message); }
});

test('keeps trying-for-a-baby questions behind the non-medical family boundary', async () => {
  for (const message of ['We are trying for a baby. Is this a good time?', 'Hum baby ke liye try kar rahe hain, kya yeh acha time hai?']) {
    const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'HINGLISH' });
    assert.equal(response.answerability, 'UNSUPPORTED', message);
    assert.equal(response.action, null, message);
    assert.match(response.message, /non-medical|fertility|conception|pregnancy/i, message);
  }
});

test('uses one Relationship action for a combined marriage and family-planning outlook', async () => {
  const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message: 'Marriage aur family planning dono ka time kaisa hai?', language: 'HINGLISH' });
  assert.deepEqual(response.action, { type: TaraDomainAction.OPEN_DOMAIN_HUB, label: 'Relationships & Family dekhein', domain: 'RELATIONSHIPS' });
});

test('does not create Relationship CTAs for legal, technical, insurance, or generic-advice false positives', async () => {
  for (const message of ['What is an entity relationship diagram?', 'Marriage registration ka process kya hai?', 'What does the Marriage Act say?', 'Family health insurance kaunsa acha hai?', 'Family mobile plan kya hai?', 'How do I repair my relationship?', 'Job aur shaadi dono ka time kaisa hai?', 'Shaadi aur ghar lene ka time kaisa hai?']) { const response = await tara().respond({ principal: {}, birthProfileId: 'profile-a', message, language: 'HINGLISH' }); assert.notEqual(response.action?.domain, 'RELATIONSHIPS', message); }
});
