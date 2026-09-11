'use strict';

const DOMAIN = 'CAREER';
const INTENTS = Object.freeze({
  CAREER_STATUS: 'CAREER_STATUS', NEXT_JOB_TIMING: 'NEXT_JOB_TIMING', JOB_SWITCH_TIMING: 'JOB_SWITCH_TIMING',
  PROMOTION_TIMING: 'PROMOTION_TIMING', SALARY_GROWTH_TIMING: 'SALARY_GROWTH_TIMING', ROLE_CHANGE_TIMING: 'ROLE_CHANGE_TIMING',
  BUSINESS_VS_JOB: 'BUSINESS_VS_JOB', WORKPLACE_PRESSURE: 'WORKPLACE_PRESSURE', CAREER_UNCERTAINTY: 'CAREER_UNCERTAINTY',
  CAREER_TIMING_WINDOW: 'CAREER_TIMING_WINDOW', UNSUPPORTED_CAREER_QUESTION: 'UNSUPPORTED_CAREER_QUESTION', NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION', UNSUPPORTED_DOMAIN: 'UNSUPPORTED_DOMAIN',
});
const ANSWERABILITY = Object.freeze({ SUPPORTED: 'SUPPORTED', PARTIALLY_SUPPORTED: 'PARTIALLY_SUPPORTED', INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE', UNSUPPORTED: 'UNSUPPORTED' });
const COMMON_PROHIBITIONS = Object.freeze(['EXACT_JOB_DATE', 'GUARANTEED_JOB', 'GUARANTEED_PROMOTION', 'GUARANTEED_SALARY_GROWTH', 'EMPLOYER_IDENTITY', 'SALARY_AMOUNT', 'PROBABILITY', 'PLANET_CAUSED_OFFICE_POLITICS']);
const POLICY = Object.freeze({
  [INTENTS.CAREER_STATUS]: { required: ['CAREER_INSIGHTS'], optional: ['DASHA_TIMING', 'TRANSIT_TIMING', 'CONCURRENT_TIMING', 'D10_FACTS', 'CALIBRATION_CONTEXT'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.NEXT_JOB_TIMING]: { required: ['CAREER_TIMING'], optional: ['CONCURRENT_TIMING', 'FUTURE_RECURRENCE', 'CALIBRATION_CONTEXT', 'D10_FACTS', 'ASHTAKAVARGA_FACTS'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.JOB_SWITCH_TIMING]: { required: ['CAREER_TIMING'], optional: ['CONCURRENT_TIMING', 'FUTURE_RECURRENCE', 'CALIBRATION_CONTEXT'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.PROMOTION_TIMING]: { required: ['CAREER_TIMING'], optional: ['CONCURRENT_TIMING', 'CALIBRATION_CONTEXT'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.SALARY_GROWTH_TIMING]: { required: ['CAREER_TIMING'], optional: ['CONCURRENT_TIMING', 'CALIBRATION_CONTEXT'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.ROLE_CHANGE_TIMING]: { required: ['CAREER_TIMING'], optional: ['CONCURRENT_TIMING', 'CALIBRATION_CONTEXT'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.WORKPLACE_PRESSURE]: { required: ['CAREER_TIMING'], optional: ['CURRENT_TRANSIT_CONTEXT'], unsupported: [...COMMON_PROHIBITIONS, 'OFFICE_POLITICS_ASTROLOGICAL_PROOF'] },
  [INTENTS.CAREER_UNCERTAINTY]: { required: ['CAREER_INSIGHTS'], optional: ['CAREER_TIMING', 'CALIBRATION_CONTEXT'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.CAREER_TIMING_WINDOW]: { required: ['CAREER_TIMING'], optional: ['CONCURRENT_TIMING', 'FUTURE_RECURRENCE'], unsupported: COMMON_PROHIBITIONS },
  [INTENTS.BUSINESS_VS_JOB]: { required: [], optional: ['CAREER_INSIGHTS'], unsupported: [...COMMON_PROHIBITIONS, 'BUSINESS_VS_JOB_RECOMMENDATION'], answerability: ANSWERABILITY.UNSUPPORTED },
});
function normalized(text) { return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function horizon(text) { const match = text.match(/(?:next|agle?)\s*(\d+)\s*(day|days|month|months|mahine|din)/i) || text.match(/(\d+)\s*(day|days|month|months|mahine|din)/i); if (!match) return { unit: null, value: null }; const unit = /month|mahine/i.test(match[2]) ? 'MONTHS' : 'DAYS'; return { unit, value: Number(match[1]) }; }
function classifyCareerIntent({ userText, conversationContext = [] } = {}) {
  const text = normalized(userText); const event = /job chali|job loss|lost my job|laid off|laid-off|fired/.test(text) ? 'JOB_LOSS' : null;
  let intent = INTENTS.NEEDS_CLARIFICATION;
  if (!text) intent = INTENTS.NEEDS_CLARIFICATION;
  else if (/marriage|pregnan|health|medical|death|legal|gambl/.test(text)) intent = INTENTS.UNSUPPORTED_DOMAIN;
  else if (/business.*job|job.*business/.test(text)) intent = INTENTS.BUSINESS_VS_JOB;
  else if (/politics|boss|office.*issue|workplace pressure/.test(text)) intent = INTENTS.WORKPLACE_PRESSURE;
  else if (/promotion/.test(text)) intent = INTENTS.PROMOTION_TIMING;
  else if (/salary|increment|pay raise/.test(text)) intent = INTENTS.SALARY_GROWTH_TIMING;
  else if (/role change|new responsibility/.test(text)) intent = INTENTS.ROLE_CHANGE_TIMING;
  else if (/switch jobs?|change jobs?/.test(text)) intent = INTENTS.JOB_SWITCH_TIMING;
  else if (/next\s*(\d+)?\s*(day|month)|agle?\s*\d+|career timing/.test(text)) intent = INTENTS.CAREER_TIMING_WINDOW;
  else if (/new job|next job|job kab|job milegi|job mil/.test(text)) intent = INTENTS.NEXT_JOB_TIMING;
  else if (/kya chal raha|how.*career|career.*now/.test(text)) intent = INTENTS.CAREER_STATUS;
  else if (/uncertain|samajh nahi|unstable|what.*career.*do/.test(text)) intent = INTENTS.CAREER_UNCERTAINTY;
  else intent = INTENTS.UNSUPPORTED_CAREER_QUESTION;
  return Object.freeze({ domain: DOMAIN, intent, userText: String(userText || ''), normalizedQuestion: text, referencedEvent: event, requestedHorizon: horizon(text), conversationContext: Array.isArray(conversationContext) ? conversationContext.map((item) => ({ role: item.role, text: item.text })).filter((item) => ['USER', 'ASSISTANT'].includes(item.role) && typeof item.text === 'string').slice(-8) : [], clarificationNeeded: intent === INTENTS.NEEDS_CLARIFICATION });
}
function policyFor(intent) { return POLICY[intent] || { required: [], optional: [], unsupported: COMMON_PROHIBITIONS, answerability: ANSWERABILITY.UNSUPPORTED }; }
function buildEvidencePacket({ birthProfileId, intent, careerReading = null } = {}) {
  if (typeof birthProfileId !== 'string' || !birthProfileId.trim()) throw new TypeError('INVALID_BIRTH_PROFILE_ID');
  const insights = Array.isArray(careerReading && careerReading.insights) ? careerReading.insights : [];
  const timing = insights.flatMap((item) => item && item.technicalContext && item.technicalContext.timing || []);
  const currentTiming = timing.filter((item) => item && item.isCurrent === true);
  const upcomingTiming = timing.filter((item) => item && item.isCurrent !== true && item.start && Date.parse(item.start) > Date.now());
  const p = policyFor(intent.intent);
  return Object.freeze({ birthProfileId, domain: DOMAIN, intent, currentTiming, upcomingTiming, supportiveEvidence: insights.filter((x) => x.status === 'SUPPORTED'), limitingEvidence: insights.filter((x) => x.status === 'MIXED'), contradictoryEvidence: insights.filter((x) => x.status === 'CONTRADICTED'), calibrationContext: careerReading && careerReading.calibrationContext || null, factualContext: { d10: insights.flatMap((x) => x.technicalContext && x.technicalContext.d10CareerChart || []), ashtakavarga: insights.flatMap((x) => x.technicalContext && x.technicalContext.supportingContext || []).filter((x) => x.sourceFamily === 'ASHTAKAVARGA') }, answerPolicy: { exactDateAllowed: false, guaranteedOutcomeAllowed: false, supportedClaims: p.required, unsupportedClaims: p.unsupported } });
}
function answerContract(packet) { const policy = policyFor(packet.intent.intent); const timing = [...packet.currentTiming, ...packet.upcomingTiming]; const answerability = policy.answerability || (timing.length ? ANSWERABILITY.SUPPORTED : ANSWERABILITY.INSUFFICIENT_EVIDENCE); return Object.freeze({ intent: packet.intent.intent, answerability, headlineFact: answerability === ANSWERABILITY.INSUFFICIENT_EVIDENCE ? 'Available Career timing evidence is insufficient to estimate a supported window.' : answerability === ANSWERABILITY.UNSUPPORTED ? 'This question is outside the current Career Chat scope.' : 'Available Career timing evidence can be described without guaranteeing an outcome.', timingWindows: timing, evidenceSummary: policy.required, caveats: policy.unsupported, followUpOptions: packet.intent.intent === INTENTS.WORKPLACE_PRESSURE ? ['Show current Career timing', 'Check job-switch timing'] : ['Show my next Career timing window', 'Compare current vs upcoming Career period'], prohibitedClaims: policy.unsupported }); }
class CareerChatLanguageModel { async classifyIntent() { throw new Error('CAREER_CHAT_LANGUAGE_MODEL_NOT_CONFIGURED'); } async renderAnswer() { throw new Error('CAREER_CHAT_LANGUAGE_MODEL_NOT_CONFIGURED'); } }
module.exports = { DOMAIN, INTENTS, ANSWERABILITY, classifyCareerIntent, policyFor, buildEvidencePacket, answerContract, CareerChatLanguageModel };
