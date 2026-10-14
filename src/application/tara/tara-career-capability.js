'use strict';

const { CareerQuestionType, Answerability } = require('../career-answers');

const TaraCareerIntent = Object.freeze({ CURRENT_CAREER_PHASE: 'CURRENT_CAREER_PHASE', JOB_FAVOURABILITY_TIMING: 'JOB_FAVOURABILITY_TIMING', UNSUPPORTED_CAREER: 'UNSUPPORTED_CAREER' });

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function classifyTaraCareerIntent(message) {
  const text = normalize(message);
  if (!text) return TaraCareerIntent.UNSUPPORTED_CAREER;
  const timing = [/\bswitch(?:ing)? (?:the )?jobs?\b/, /\bchange (?:the )?jobs?\b/, /\bnew jobs?\b/, /\bjob opportunit(?:y|ies)\b/, /\bbetter opportunit(?:y|ies)\b/, /\bcareer timing\b/, /\bfavou?rable (?:time )?periods?\b/, /\bstronger career windows?\b/, /\bcareer activity stronger\b/, /\bcareer opportunit(?:y|ies) improve\b/, /\bgood (?:time|period) to (?:look for|change)\b/];
  if (timing.some((pattern) => pattern.test(text))) return TaraCareerIntent.JOB_FAVOURABILITY_TIMING;
  if (/\bcurrent career phase\b|\bcareer (?:right )?now\b|\bwhat.*career.*(?:now|current)\b/.test(text)) return TaraCareerIntent.CURRENT_CAREER_PHASE;
  return TaraCareerIntent.UNSUPPORTED_CAREER;
}
function range(window) { return window && typeof window.start === 'string' && typeof window.end === 'string' ? `${window.start} to ${window.end}` : null; }
function unsupportedCareerMessage(language) { return language === 'HINGLISH' ? 'Main abhi aapki Career phase aur stronger Career timing windows mein help kar sakti hoon, lekin is specific Career question ka reliable answer dene ke liye ready nahi hoon.' : 'I can currently help with your Career phase and stronger Career timing windows, but I’m not ready to answer that specific Career question reliably yet.'; }
function renderCareerAnswer(answer, language) {
  if (answer.answerability === Answerability.PREMIUM_REQUIRED) return answer.teaser && answer.teaser.subtitle || 'A stronger Career window has been identified. Unlock Career Premium to view the complete timing insight.';
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
  async respond({ principal, birthProfileId, message, language = 'ENGLISH' } = {}) {
    const intent = classifyTaraCareerIntent(message);
    if (intent === TaraCareerIntent.UNSUPPORTED_CAREER) return Object.freeze({ intent, answerability: Answerability.UNSUPPORTED, message: unsupportedCareerMessage(language), answer: null });
    const questionType = CareerQuestionType[intent];
    const answer = await this.answers.answer({ principal, birthProfileId, body: { questionType } });
    return Object.freeze({ intent, answerability: answer.answerability, message: renderCareerAnswer(answer, language), answer });
  }
}
module.exports = { TaraCareerIntent, classifyTaraCareerIntent, TaraCareerCapability, renderCareerAnswer };
