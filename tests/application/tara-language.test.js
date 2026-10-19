'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TaraLanguageStyle,
  detectTaraLanguageStyle,
  normalizeHinglishForIntent,
  resolvedTaraLanguageStyle,
  TaraOrchestrator,
  TaraCareerCapability,
  TaraCareerIntent,
  TaraCareerResponseState,
  classifyTaraDomain,
  classifyTaraTransitIntent,
  TaraTransitIntent,
} = require('../../src/application/tara');

test('detects Hinglish and normalizes compact high-value phrases without changing the persisted user message', () => {
  assert.equal(detectTaraLanguageStyle('Mera career kab improve hoga?'), TaraLanguageStyle.HINGLISH);
  assert.equal(detectTaraLanguageStyle('When will my career improve?'), TaraLanguageStyle.ENGLISH);
  assert.match(normalizeHinglishForIntent('Job switch karne ka acha time kab hai?'), /favourable time to switch job/);
  assert.match(normalizeHinglishForIntent('Job switch karne ka accha time kab hai?'), /favourable time to switch job/);
  assert.match(normalizeHinglishForIntent('Meri naukri ka kya hoga?'), /job/);
  assert.match(normalizeHinglishForIntent('Meri nokri ka kya hoga?'), /job/);
  assert.match(normalizeHinglishForIntent('Shaadi ke liye gochar kaisa hai?'), /marriage/);
  assert.match(normalizeHinglishForIntent('Shadi ke liye gochar kaisa hai?'), /marriage/);
  for (const word of ['effect', 'affect', 'impact']) assert.match(normalizeHinglishForIntent(`Jupiter ka ${word} kya hai?`), new RegExp(word));
});

test('uses message language first and selected style only for ambiguous Tara messages', () => {
  assert.equal(
    resolvedTaraLanguageStyle({
      message: 'When will my career improve?',
      requestedLanguage: TaraLanguageStyle.HINGLISH,
    }),
    TaraLanguageStyle.ENGLISH,
  );
  assert.equal(
    resolvedTaraLanguageStyle({
      message: 'Mera career kab improve hoga?',
      requestedLanguage: TaraLanguageStyle.ENGLISH,
    }),
    TaraLanguageStyle.HINGLISH,
  );
  assert.equal(detectTaraLanguageStyle('Career?'), TaraLanguageStyle.AMBIGUOUS);
  assert.equal(
    resolvedTaraLanguageStyle({ message: 'Career?', requestedLanguage: TaraLanguageStyle.HINGLISH }),
    TaraLanguageStyle.HINGLISH,
  );
  assert.equal(
    resolvedTaraLanguageStyle({ message: 'Career?', requestedLanguage: TaraLanguageStyle.ENGLISH }),
    TaraLanguageStyle.ENGLISH,
  );
});

test('keeps clear English Tara questions in English regardless of selected Hinglish', () => {
  const exactProductionQuestion = 'what is the right time for purchasing the property ?';
  assert.equal(detectTaraLanguageStyle(exactProductionQuestion), TaraLanguageStyle.ENGLISH);
  assert.equal(
    resolvedTaraLanguageStyle({ message: exactProductionQuestion, requestedLanguage: TaraLanguageStyle.HINGLISH }),
    TaraLanguageStyle.ENGLISH,
  );
  assert.equal(
    resolvedTaraLanguageStyle({ message: 'Is this a good time to buy a car?', requestedLanguage: TaraLanguageStyle.HINGLISH }),
    TaraLanguageStyle.ENGLISH,
  );
  assert.equal(
    resolvedTaraLanguageStyle({ message: 'Car lene ka sahi time kab aayega?', requestedLanguage: TaraLanguageStyle.ENGLISH }),
    TaraLanguageStyle.HINGLISH,
  );
  assert.equal(
    resolvedTaraLanguageStyle({ message: 'property', requestedLanguage: TaraLanguageStyle.HINGLISH }),
    TaraLanguageStyle.HINGLISH,
  );
  assert.equal(
    resolvedTaraLanguageStyle({ message: 'property', requestedLanguage: TaraLanguageStyle.ENGLISH }),
    TaraLanguageStyle.ENGLISH,
  );
  assert.equal(classifyTaraDomain(exactProductionQuestion), 'WEALTH_PROPERTY');
  assert.equal(classifyTaraDomain('Is this a good time to buy a car?'), 'VEHICLE');
});

test('routes Hinglish Career and Transit questions through the existing grounded capabilities', async () => {
  const calls = [];
  const career = new TaraCareerCapability({
    careerAnswerService: { answer: async (input) => { calls.push(input); return { questionType: 'JOB_FAVOURABILITY_TIMING', answerability: 'SUPPORTED', broadWindow: { start: '2026-11-20', end: '2027-01-10' } }; } },
  });
  const transitCalls = [];
  const tara = new TaraOrchestrator({
    careerCapability: career,
    transitCapability: { respond: async (input) => { transitCalls.push(input); return { answerability: 'SUPPORTED', message: 'Grounded Gochar.' }; } },
  });
  for (const message of ['Mera career kab improve hoga?', 'Job switch karne ka acha time kab hai?']) {
    const response = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message });
    assert.equal(response.domain, 'CAREER');
    assert.match(response.message, /Aapka stronger Career window/i);
  }
  assert.ok(calls.every((call) => call.body.questionType === 'JOB_FAVOURABILITY_TIMING'));
  const lifeArea = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Jupiter ka gochar mere career ko kaise affect karega?' });
  assert.equal(lifeArea.domain, 'TRANSIT');
  assert.equal(transitCalls[0].language, TaraLanguageStyle.HINGLISH);
  assert.equal(classifyTaraTransitIntent(transitCalls[0].message).intent, TaraTransitIntent.LIFE_AREA_TRANSIT_EFFECT);
  await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Rahu house change karega to kya hoga?' });
  assert.equal(classifyTaraTransitIntent(transitCalls[1].message).intent, TaraTransitIntent.UPCOMING_TRANSIT_EFFECT);
  await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Abhi kaunsa area zyada activate ho raha hai?' });
  assert.equal(classifyTaraTransitIntent(transitCalls[2].message).intent, TaraTransitIntent.CURRENT_TRANSIT_OVERVIEW);
});

test('keeps premium protection and action metadata while rendering Hinglish copy', async () => {
  const career = new TaraCareerCapability({
    careerAnswerService: { answer: async () => ({ questionType: 'JOB_FAVOURABILITY_TIMING', answerability: 'PREMIUM_REQUIRED', broadWindow: { start: '2026-11-20', end: '2027-01-10' } }) },
  });
  const response = await career.respond({ principal: {}, birthProfileId: 'profile-a', message: 'career improve', language: TaraLanguageStyle.HINGLISH });
  assert.equal(response.intent, TaraCareerIntent.JOB_FAVOURABILITY_TIMING);
  assert.equal(response.state, TaraCareerResponseState.PREMIUM_REQUIRED);
  assert.deepEqual(response.action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
  assert.match(response.message, /TaraVerse Premium ka part hai/i);
  assert.doesNotMatch(response.message, /2026|Nov|Jan/);
});

test('keeps grounded Career dates identical while changing only English or Hinglish presentation copy', async () => {
  const career = new TaraCareerCapability({
    careerAnswerService: { answer: async () => ({ questionType: 'JOB_FAVOURABILITY_TIMING', answerability: 'SUPPORTED', broadWindow: { start: '2026-11-20', end: '2027-01-10' } }) },
  });
  const english = await career.respond({ principal: {}, birthProfileId: 'profile-a', message: 'career improve', language: TaraLanguageStyle.ENGLISH });
  const hinglish = await career.respond({ principal: {}, birthProfileId: 'profile-a', message: 'career improve', language: TaraLanguageStyle.HINGLISH });
  assert.match(english.message, /^Your stronger Career window is 20 Nov 2026 to 10 Jan 2027/i);
  assert.match(hinglish.message, /^Aapka stronger Career window 20 Nov 2026 to 10 Jan 2027/i);
  assert.deepEqual(hinglish.answer, english.answer);
});

test('renders a safe Hinglish unsupported response', async () => {
  const tara = new TaraOrchestrator({ careerCapability: { respond: async () => { throw new Error('should not route'); } } });
  const response = await tara.respond({ principal: {}, birthProfileId: 'profile-a', message: 'Tarot ke cards mere liye kya kehte hain?' });
  assert.equal(response.answerability, 'UNSUPPORTED');
  assert.match(response.message, /reliable personalized answer dene ke liye ready nahi hoon/i);
  assert.doesNotMatch(response.message, /unsupported intent|current scope|capability unavailable/i);
});
