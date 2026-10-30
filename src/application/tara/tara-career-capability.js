'use strict';

const { CareerQuestionType, Answerability } = require('../career-answers');

const TaraCareerIntent = Object.freeze({ CURRENT_CAREER_PHASE: 'CURRENT_CAREER_PHASE', JOB_FAVOURABILITY_TIMING: 'JOB_FAVOURABILITY_TIMING', JOB_OFFER: 'JOB_OFFER', SWITCH_JOB: 'SWITCH_JOB', COMPARE_OFFERS: 'COMPARE_OFFERS', PROMOTION_GROWTH: 'PROMOTION_GROWTH', START_BUSINESS: 'START_BUSINESS', CAREER_ABROAD: 'CAREER_ABROAD', UNSUPPORTED_CAREER: 'UNSUPPORTED_CAREER' });
const TaraCareerResponseState = Object.freeze({ ENTITLED_RESULT: 'ENTITLED_RESULT', PREMIUM_REQUIRED: 'PREMIUM_REQUIRED', FEATURE_DISABLED: 'FEATURE_DISABLED', UNSUPPORTED_CAREER: 'UNSUPPORTED_CAREER' });

const CAREER_DECISION_TRANSITIONS = Object.freeze({
  [TaraCareerIntent.JOB_OFFER]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'Evaluate this job offer', HINGLISH: 'Job offer evaluate karein' }),
    message: Object.freeze({ ENGLISH: 'I can help you evaluate this offer using your Career timing and saved Career evidence. I’ll first need a few details about the offer.', HINGLISH: 'Main aapki Career timing aur saved Career evidence ke basis par is offer ko evaluate karne mein help kar sakti hoon. Pehle offer ki kuch details chahiye.' }),
  }),
  [TaraCareerIntent.SWITCH_JOB]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'Check job-switch timing', HINGLISH: 'Job switch timing check karein' }),
    message: Object.freeze({ ENGLISH: 'I can check whether the current period supports exploring a job change. I’ll first need a little context about your reasons.', HINGLISH: 'Main dekh sakti hoon ki current period job change explore karne ke liye support dikha raha hai ya nahi. Iske liye aapke reasons ki thodi context chahiye.' }),
  }),
  [TaraCareerIntent.COMPARE_OFFERS]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'Compare the offers', HINGLISH: 'Offers compare karein' }),
    message: Object.freeze({ ENGLISH: 'I can compare two offers against your Career timing and priorities. I’ll first need the key details of both offers.', HINGLISH: 'Main dono offers ko aapki Career timing aur priorities ke against compare kar sakti hoon. Pehle dono offers ki key details chahiye.' }),
  }),
  [TaraCareerIntent.PROMOTION_GROWTH]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'Assess promotion or growth', HINGLISH: 'Promotion ya growth assess karein' }),
    message: Object.freeze({ ENGLISH: 'I can assess your promotion or growth context using grounded Career evidence. I’ll first need a few details about your situation.', HINGLISH: 'Main grounded Career evidence ke basis par aapka promotion ya growth context assess kar sakti hoon. Pehle aapki situation ki kuch details chahiye.' }),
  }),
  [TaraCareerIntent.START_BUSINESS]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'Assess starting a business', HINGLISH: 'Business start karna assess karein' }),
    message: Object.freeze({ ENGLISH: 'I can assess the timing context for starting a business. I’ll first need a few practical details about your plan.', HINGLISH: 'Main business start karne ke timing context ko assess kar sakti hoon. Pehle aapke plan ki kuch practical details chahiye.' }),
  }),
  [TaraCareerIntent.CAREER_ABROAD]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'Assess Career abroad', HINGLISH: 'Career abroad assess karein' }),
    message: Object.freeze({ ENGLISH: 'I can assess the timing context for a Career move abroad. I’ll first need a few details about your plan.', HINGLISH: 'Main Career abroad move ke timing context ko assess kar sakti hoon. Pehle aapke plan ki kuch details chahiye.' }),
  }),
});

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function classifyTaraCareerIntent(message) {
  const text = normalize(message);
  if (!text) return TaraCareerIntent.UNSUPPORTED_CAREER;
  // Product, coupon, and administrative questions must never open a Career
  // decision flow merely because they contain a decision keyword.
  if (/\b(promotion code|discount offer|coupon|service offer|startup india|business registration|registration process)\b/.test(text)) return TaraCareerIntent.UNSUPPORTED_CAREER;
  // Decision requests take precedence over general timing phrasing. They do
  // not calculate a result here: they only offer the existing decision form.
  if ((/\b(compare|comparison)\b/.test(text) || /\b(two|both|2)\b/.test(text) || /\boffer a\b.*\boffer b\b/.test(text)) && /\b(offers?|jobs?|roles?)\b/.test(text)) return TaraCareerIntent.COMPARE_OFFERS;
  if (!/\b(discount|sale|coupon|service) offers?\b/.test(text) && (/\b(i |ive |i ve |got|received|have) (?:a )?(?:job )?offer\b/.test(text) || /\bjob offer\b/.test(text) || (/\boffer\b/.test(text) && /\b(accept|analyse|analyze|evaluate|sahi|better)\b/.test(text)))) return TaraCareerIntent.JOB_OFFER;
  if (/\b(promotion|promoted|growth at work|grow in my role|salary growth|salary hike|leadership role|more responsibility)\b/.test(text) || /\bgrowth\s+(?:when|kab|hogi|hoga)\b/.test(text)) return TaraCareerIntent.PROMOTION_GROWTH;
  if (/\b(start|starting|launch|launching|build|building) (?:a )?business\b|\bentrepreneur(?:ship)?\b|\bown company\b/.test(text)) return TaraCareerIntent.START_BUSINESS;
  if (/\b(abroad|overseas|international|internationally|foreign)\b/.test(text) && (/\b(career|jobs?|work|relocate|relocating|relocation|move|shift)\b/.test(text))) return TaraCareerIntent.CAREER_ABROAD;
  if ((/\b(switch|change|leave|quit|new|another)\b/.test(text) && /\b(jobs?|career|company|work|roles?)\b/.test(text)) || /\bthinking of switching\b/.test(text)) return TaraCareerIntent.SWITCH_JOB;
  const timing = [/\bswitch(?:ing)? (?:the )?jobs?\b/, /\bchange (?:the )?jobs?\b/, /\bnew jobs?\b/, /\bjob opportunit(?:y|ies)\b/, /\bbetter (?:career )?opportunit(?:y|ies)\b/, /\bcareer timing\b/, /\bfavou?rable (?:time )?periods?\b/, /\bstronger career windows?\b/, /\bcareer activity stronger\b/, /\bcareer opportunit(?:y|ies) (?:improve|better)\b/, /\bcareer (?:likely to )?(?:improve|improvement|get better|growth)\b/, /\bthings improve professionally\b/, /\bprofessional(?:ly)? (?:improve|improvement|better)\b/, /\bgood (?:time|period) to (?:look for|change)\b/];
  if (timing.some((pattern) => pattern.test(text))) return TaraCareerIntent.JOB_FAVOURABILITY_TIMING;
  if (/\bcurrent career phase\b|\bcareer (?:right )?now\b|\bwhat.*career.*(?:now|current)\b/.test(text)) return TaraCareerIntent.CURRENT_CAREER_PHASE;
  return TaraCareerIntent.UNSUPPORTED_CAREER;
}
function displayDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}
function range(window) { const start = displayDate(window && window.start); const end = displayDate(window && window.end); return start && end ? `${start} to ${end}` : null; }
function diagnostic(log, { state = null, action = null, birthProfileId = null } = {}) { if (typeof log === 'function') log({ event: 'TARA_BACKEND_CAPABILITY', state, actionType: action && action.type || null, actionLabel: action && action.label || null, messageId: null, birthProfileId }); }
function unsupportedCareerMessage(language) { return language === 'HINGLISH' ? 'Main abhi aapki Career phase aur stronger Career timing windows mein help kar sakti hoon, lekin is specific Career question ka reliable answer dene ke liye ready nahi hoon.' : 'I can currently help with your Career phase and stronger Career timing windows, but I’m not ready to answer that specific Career question reliably yet.'; }
function renderCareerAnswer(answer, language) {
  if (answer.answerability === Answerability.PREMIUM_REQUIRED) return language === 'HINGLISH' ? 'Is profile ke personalized insights TaraVerse Premium ka part hain.' : 'Personalized insights for this profile are part of TaraVerse Premium.';
  if (answer.questionType === CareerQuestionType.JOB_FAVOURABILITY_TIMING && answer.answerability === Answerability.SUPPORTED) {
    const window = range(answer.broadWindow);
    if (!window) return 'TaraVerse has grounded Career timing context, but cannot safely describe a bounded window right now.';
    return language === 'HINGLISH' ? `Aapka stronger Career window ${window} hai. Is period mein multiple Career-related signals align hote hain. Yeh employment, offer ya kisi specific outcome ki guarantee nahi deta.` : `Your stronger Career window is ${window}. Multiple Career-related signals align in this period. This does not guarantee employment, an offer, or any specific outcome.`;
  }
  if (answer.answer && typeof answer.answer.summary === 'string') return language === 'HINGLISH' ? `Aapke Career ke liye: ${answer.answer.headline || 'Career insight'} ${answer.answer.summary} ${answer.answer.limitation || ''}`.trim() : `${answer.answer.headline || 'Career insight'} ${answer.answer.summary} ${answer.answer.limitation || ''}`.trim();
  if (answer.answerability === Answerability.PROJECTION_DISABLED) return language === 'HINGLISH' ? 'Stronger Career timing abhi TaraVerse ki validated methodology gate enable hone tak available nahi hai.' : 'Stronger Career timing is not available until TaraVerse’s validated methodology gate is enabled.';
  return language === 'HINGLISH' ? 'TaraVerse abhi is Career question ka safely more specific grounded answer nahi de sakta.' : 'TaraVerse cannot safely provide a more specific grounded Career answer right now.';
}
class TaraCareerCapability {
  constructor({ careerAnswerService } = {}) { if (!careerAnswerService || typeof careerAnswerService.answer !== 'function') throw new TypeError('INVALID_TARA_CAREER_ANSWER_SERVICE'); this.answers = careerAnswerService; }
  async respond({ principal, birthProfileId, message, language = 'ENGLISH', diagnosticLog = null } = {}) {
    const intent = classifyTaraCareerIntent(message);
    const transition = CAREER_DECISION_TRANSITIONS[intent];
    if (transition) {
      const copy = language === 'HINGLISH' ? transition.message.HINGLISH : transition.message.ENGLISH;
      const label = language === 'HINGLISH' ? transition.label.HINGLISH : transition.label.ENGLISH;
      const result = Object.freeze({ intent, state: 'DECISION_CONTEXT_REQUIRED', answerability: Answerability.SUPPORTED, message: copy, answer: null, action: Object.freeze({ type: 'OPEN_CAREER_DECISION', label, decisionType: intent }) });
      diagnostic(diagnosticLog, { state: result.state, action: result.action, birthProfileId });
      return result;
    }
    if (intent === TaraCareerIntent.UNSUPPORTED_CAREER) {
      const result = Object.freeze({ intent, state: TaraCareerResponseState.UNSUPPORTED_CAREER, answerability: Answerability.UNSUPPORTED, message: unsupportedCareerMessage(language), answer: null, action: null });
      diagnostic(diagnosticLog, { state: result.state, action: result.action, birthProfileId });
      return result;
    }
    const questionType = CareerQuestionType[intent];
    const answer = await this.answers.answer({ principal, birthProfileId, body: { questionType } });
    const state = answer.answerability === Answerability.PREMIUM_REQUIRED ? TaraCareerResponseState.PREMIUM_REQUIRED
      : answer.answerability === Answerability.PROJECTION_DISABLED ? TaraCareerResponseState.FEATURE_DISABLED
        : TaraCareerResponseState.ENTITLED_RESULT;
    const result = Object.freeze({ intent, state, answerability: answer.answerability, message: renderCareerAnswer(answer, language), answer, action: state === TaraCareerResponseState.PREMIUM_REQUIRED ? Object.freeze({ type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' }) : null });
    diagnostic(diagnosticLog, { state: result.state, action: result.action, birthProfileId });
    return result;
  }
}
module.exports = { TaraCareerIntent, TaraCareerResponseState, classifyTaraCareerIntent, TaraCareerCapability, renderCareerAnswer };
