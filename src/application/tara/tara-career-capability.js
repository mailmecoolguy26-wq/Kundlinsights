'use strict';

const { CareerQuestionType, Answerability } = require('../career-answers');

const TaraCareerIntent = Object.freeze({ CURRENT_CAREER_PHASE: 'CURRENT_CAREER_PHASE', JOB_FAVOURABILITY_TIMING: 'JOB_FAVOURABILITY_TIMING', UNSUPPORTED_CAREER: 'UNSUPPORTED_CAREER' });
const TaraCareerResponseState = Object.freeze({ ENTITLED_RESULT: 'ENTITLED_RESULT', PREMIUM_REQUIRED: 'PREMIUM_REQUIRED', FEATURE_DISABLED: 'FEATURE_DISABLED', UNSUPPORTED_CAREER: 'UNSUPPORTED_CAREER' });

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function classifyTaraCareerIntent(message) {
  const text = normalize(message);
  if (!text) return TaraCareerIntent.UNSUPPORTED_CAREER;
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
  if (answer.answerability === Answerability.PREMIUM_REQUIRED) return 'I can see a stronger Career window for this profile, but the exact timing is part of Career Premium.';
  if (answer.questionType === CareerQuestionType.JOB_FAVOURABILITY_TIMING && answer.answerability === Answerability.SUPPORTED) {
    const window = range(answer.broadWindow);
    if (!window) return 'TaraVerse has grounded Career timing context, but cannot safely describe a bounded window right now.';
    return language === 'HINGLISH' ? `Aapka stronger Career window ${window} hai. Is period mein multiple Career-related signals align hote hain. Yeh employment, offer ya kisi specific outcome ki guarantee nahi deta.` : `Your stronger Career window is ${window}. Multiple Career-related signals align in this period. This does not guarantee employment, an offer, or any specific outcome.`;
  }
  if (answer.answer && typeof answer.answer.summary === 'string') return `${answer.answer.headline || 'Career insight'} ${answer.answer.summary} ${answer.answer.limitation || ''}`.trim();
  if (answer.answerability === Answerability.PROJECTION_DISABLED) return 'Stronger Career timing is not available until TaraVerse’s validated methodology gate is enabled.';
  return 'TaraVerse cannot safely provide a more specific grounded Career answer right now.';
}
class TaraCareerCapability {
  constructor({ careerAnswerService } = {}) { if (!careerAnswerService || typeof careerAnswerService.answer !== 'function') throw new TypeError('INVALID_TARA_CAREER_ANSWER_SERVICE'); this.answers = careerAnswerService; }
  async respond({ principal, birthProfileId, message, language = 'ENGLISH', diagnosticLog = null } = {}) {
    const intent = classifyTaraCareerIntent(message);
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
    const result = Object.freeze({ intent, state, answerability: answer.answerability, message: renderCareerAnswer(answer, language), answer, action: state === TaraCareerResponseState.PREMIUM_REQUIRED ? Object.freeze({ type: 'OPEN_CAREER_PREMIUM', label: 'Unlock Career Premium' }) : null });
    diagnostic(diagnosticLog, { state: result.state, action: result.action, birthProfileId });
    return result;
  }
}
module.exports = { TaraCareerIntent, TaraCareerResponseState, classifyTaraCareerIntent, TaraCareerCapability, renderCareerAnswer };
