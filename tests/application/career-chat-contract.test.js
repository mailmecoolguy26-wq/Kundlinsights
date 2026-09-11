'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { INTENTS, ANSWERABILITY, classifyCareerIntent, policyFor, buildEvidencePacket, answerContract } = require('../../src/application/career-chat');
test('classifies English and Hinglish Career questions without astrology claims', () => {
  const cases = [['Meri job chali gayi hai aur mujhe nayi job kab milegi?', INTENTS.NEXT_JOB_TIMING, 'JOB_LOSS'], ['Mujhe promotion kab milega?', INTENTS.PROMOTION_TIMING], ['Mere office mein bohot politics ho rahi hai.', INTENTS.WORKPLACE_PRESSURE], ['Should I switch jobs now?', INTENTS.JOB_SWITCH_TIMING], ['Salary kab increase hogi?', INTENTS.SALARY_GROWTH_TIMING], ['Career mein abhi kya chal raha hai?', INTENTS.CAREER_STATUS], ['Business better hai ya job?', INTENTS.BUSINESS_VS_JOB], ['Next 90 days career?', INTENTS.CAREER_TIMING_WINDOW]];
  for (const [text, intent, event = null] of cases) { const actual = classifyCareerIntent({ userText: text }); assert.equal(actual.intent, intent); assert.equal(actual.referencedEvent, event); assert.equal('prediction' in actual, false); }
  assert.deepEqual(classifyCareerIntent({ userText: 'Next 90 days career?' }).requestedHorizon, { unit: 'DAYS', value: 90 });
});
test('policies constrain evidence and prohibit unsupported outcomes', () => {
  assert.deepEqual(policyFor(INTENTS.NEXT_JOB_TIMING).required, ['CAREER_TIMING']);
  assert.ok(policyFor(INTENTS.PROMOTION_TIMING).unsupported.includes('GUARANTEED_PROMOTION'));
  assert.ok(policyFor(INTENTS.WORKPLACE_PRESSURE).unsupported.includes('OFFICE_POLITICS_ASTROLOGICAL_PROOF'));
  assert.equal(policyFor(INTENTS.BUSINESS_VS_JOB).answerability, ANSWERABILITY.UNSUPPORTED);
});
test('profile-scoped packet reuses sanitized Career Reading timing and never invents claims', () => {
  const intent = classifyCareerIntent({ userText: 'Meri job chali gayi hai, nayi job kab milegi?' });
  const packet = buildEvidencePacket({ birthProfileId: 'profile-a', intent, careerReading: { insights: [{ status: 'SUPPORTED', technicalContext: { timing: [{ kind: 'DASHA_PERIOD', start: '2027-01-01T00:00:00.000Z', end: '2027-02-01T00:00:00.000Z', isCurrent: false }] } }] } });
  assert.equal(packet.birthProfileId, 'profile-a'); assert.equal(packet.upcomingTiming.length, 1); assert.equal(packet.answerPolicy.exactDateAllowed, false); assert.ok(packet.answerPolicy.unsupportedClaims.includes('GUARANTEED_JOB'));
  const answer = answerContract(packet); assert.equal(answer.answerability, ANSWERABILITY.SUPPORTED); assert.ok(answer.prohibitedClaims.includes('EXACT_JOB_DATE'));
  assert.throws(() => buildEvidencePacket({ intent }), /INVALID_BIRTH_PROFILE_ID/);
});
test('unsupported domains and insufficient timing have safe deterministic fallbacks', () => {
  assert.equal(classifyCareerIntent({ userText: 'What is my marriage timing?' }).intent, INTENTS.UNSUPPORTED_DOMAIN);
  const packet = buildEvidencePacket({ birthProfileId: 'profile-a', intent: classifyCareerIntent({ userText: 'Promotion kab milega?' }) });
  assert.equal(answerContract(packet).answerability, ANSWERABILITY.INSUFFICIENT_EVIDENCE);
});
