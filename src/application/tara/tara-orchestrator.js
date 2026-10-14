'use strict';

const DOMAINS = Object.freeze(['CAREER', 'RELATIONSHIPS', 'WEALTH_PROPERTY', 'CHART', 'TAROT', 'GENERAL']);

const DOMAIN_KEYWORDS = Object.freeze({
  CAREER: /\b(career|job|offer|joining|promotion|salary|switch|work|business)\b/i,
  RELATIONSHIPS: /\b(relationship|marriage|marry|wedding|spouse|partner|love)\b/i,
  WEALTH_PROPERTY: /\b(wealth|property|home|house|real estate|investment|money)\b/i,
  CHART: /\b(chart|kundli|horoscope|lagna|ascendant|moon sign|birth chart)\b/i,
  TAROT: /\b(tarot|card reading|cards)\b/i,
});

function invalid(code) { const error = new Error(code); error.code = code; throw error; }
function classifyTaraDomain(message) {
  if (typeof message !== 'string' || !(message = message.trim()) || message.length > 2000) invalid('INVALID_TARA_MESSAGE');
  for (const domain of ['CAREER', 'RELATIONSHIPS', 'WEALTH_PROPERTY', 'CHART', 'TAROT']) if (DOMAIN_KEYWORDS[domain].test(message)) return domain;
  return 'GENERAL';
}
function unsupportedMessage(language) {
  return language === 'HINGLISH'
    ? 'Main abhi is area ke liye reliable personalized answer dene ke liye ready nahi hoon.'
    : 'I’m not ready to give you a reliable personalized answer for this area yet.';
}

class TaraOrchestrator {
  constructor({ careerCapability } = {}) {
    if (!careerCapability || typeof careerCapability.respond !== 'function') throw new TypeError('INVALID_TARA_CAREER_CAPABILITY');
    this.career = careerCapability;
  }

  async respond({ principal, birthProfileId, message, conversationContext = [], language = 'ENGLISH' } = {}) {
    const domain = classifyTaraDomain(message);
    if (domain !== 'CAREER') return Object.freeze({ domain, answerability: 'UNSUPPORTED', capability: null, message: unsupportedMessage(language) });
    const career = await this.career.respond({ principal, birthProfileId, message, conversationContext, language });
    return Object.freeze({
      domain,
      answerability: career.answer.answerability,
      capability: 'CAREER_GROUNDED',
      message: career.renderedAnswer && career.renderedAnswer.message ? career.renderedAnswer.message : career.answer.headlineFact,
      career,
    });
  }
}

module.exports = { DOMAINS, classifyTaraDomain, TaraOrchestrator };
