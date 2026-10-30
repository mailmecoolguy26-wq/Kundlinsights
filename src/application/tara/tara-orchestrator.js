'use strict';

const { TaraLanguageStyle, detectTaraLanguageStyle, normalizeHinglishForIntent, resolvedTaraLanguageStyle } = require('./tara-language');
const { classifyDomainHubIntent, domainHubResponse } = require('./tara-domain-actions');

const DOMAINS = Object.freeze(['CAREER', 'TRANSIT', 'VEHICLE', 'RELATIONSHIPS', 'WEALTH_PROPERTY', 'CHART', 'TAROT', 'GENERAL']);

const DOMAIN_KEYWORDS = Object.freeze({
  TRANSIT: /\b(gochar|transit|transits|planetary movement|planet changing house|jupiter|saturn|rahu|ketu|mars|mercury)\b/i,
  CAREER: /\b(career|jobs?|offers?|joining|promotion|salary|switch|work|business)\b/i,
  VEHICLE: /\b(vehicle|car|bike|scooter|gaadi|gadi|four wheeler|two wheeler)\b/i,
  RELATIONSHIPS: /\b(relationship|marriage|marry|wedding|spouse|partner|love)\b/i,
  WEALTH_PROPERTY: /\b(wealth|property|home|house|real estate|investment|money)\b/i,
  CHART: /\b(chart|kundli|horoscope|lagna|ascendant|moon sign|birth chart)\b/i,
  TAROT: /\b(tarot|card reading|cards)\b/i,
});

function invalid(code) { const error = new Error(code); error.code = code; throw error; }
function classifyTaraDomain(message) {
  if (typeof message !== 'string' || !(message = message.trim()) || message.length > 2000) invalid('INVALID_TARA_MESSAGE');
  for (const domain of ['TRANSIT', 'CAREER', 'VEHICLE', 'RELATIONSHIPS', 'WEALTH_PROPERTY', 'CHART', 'TAROT']) if (DOMAIN_KEYWORDS[domain].test(message)) return domain;
  return 'GENERAL';
}
function unsupportedMessage(language) {
  return language === 'HINGLISH'
    ? 'Main abhi is area ke liye reliable personalized answer dene ke liye ready nahi hoon.'
    : 'I’m not ready to give you a reliable personalized answer for this area yet.';
}
function diagnostic(log, event, { state = null, action = null, messageId = null, birthProfileId = null } = {}) {
  if (typeof log !== 'function') return;
  log({ event, state, actionType: action && action.type || null, actionLabel: action && action.label || null, messageId, birthProfileId });
}

class TaraOrchestrator {
  constructor({ careerCapability, transitCapability, propertyCapability = null, vehicleCapability = null } = {}) {
    if (!careerCapability || typeof careerCapability.respond !== 'function') throw new TypeError('INVALID_TARA_CAREER_CAPABILITY');
    this.career = careerCapability;
    this.transit = transitCapability && typeof transitCapability.respond === 'function' ? transitCapability : null;
    this.property = propertyCapability && typeof propertyCapability.respond === 'function' ? propertyCapability : null;
    this.vehicle = vehicleCapability && typeof vehicleCapability.respond === 'function' ? vehicleCapability : null;
  }

  async respond({ principal, birthProfileId, message, conversationContext = [], language = 'ENGLISH', diagnosticLog = null } = {}) {
    const normalizedMessage = detectTaraLanguageStyle(message) === TaraLanguageStyle.HINGLISH
      ? normalizeHinglishForIntent(message)
      : message;
    const responseLanguage = resolvedTaraLanguageStyle({ message, requestedLanguage: language });
    const hubIntent = classifyDomainHubIntent(normalizedMessage);
    const hubResponse = domainHubResponse(hubIntent, responseLanguage);
    if (hubResponse) {
      diagnostic(diagnosticLog, 'TARA_BACKEND_ORCHESTRATOR', { state: 'DOMAIN_HUB_ROUTING', action: hubResponse.action, birthProfileId });
      return Object.freeze({ domain: hubIntent.kind === 'DOMAIN_HUB' ? hubIntent.domain : 'WEALTH_PROPERTY', ...hubResponse });
    }
    const domain = classifyTaraDomain(normalizedMessage);
    if (domain === 'TRANSIT') {
      if (!this.transit) return Object.freeze({ domain, answerability: 'UNSUPPORTED', capability: null, message: unsupportedMessage(responseLanguage) });
      const transit = await this.transit.respond({ principal, birthProfileId, message: normalizedMessage, conversationContext, language: responseLanguage, diagnosticLog });
      return Object.freeze({ domain, answerability: transit.answerability, capability: 'TRANSIT_GROUNDED', message: transit.message, transit, action: null });
    }
    if (domain === 'WEALTH_PROPERTY') {
      if (!this.property) return Object.freeze({ domain, answerability: 'UNSUPPORTED', capability: null, message: unsupportedMessage(responseLanguage) });
      const property = await this.property.respond({ principal, birthProfileId, message: normalizedMessage, conversationContext, language: responseLanguage, diagnosticLog });
      return Object.freeze({ domain, answerability: property.answerability, capability: 'PROPERTY_GROUNDED', message: property.message, property, action: null });
    }
    if (domain === 'VEHICLE') {
      if (!this.vehicle) return Object.freeze({ domain, answerability: 'UNSUPPORTED', capability: null, message: unsupportedMessage(responseLanguage) });
      const vehicle = await this.vehicle.respond({ principal, birthProfileId, message: normalizedMessage, conversationContext, language: responseLanguage, diagnosticLog });
      return Object.freeze({ domain, answerability: vehicle.answerability, capability: 'VEHICLE_GROUNDED', message: vehicle.message, vehicle, action: null });
    }
    if (domain !== 'CAREER') return Object.freeze({ domain, answerability: 'UNSUPPORTED', capability: null, message: unsupportedMessage(responseLanguage) });
    const career = await this.career.respond({ principal, birthProfileId, message: normalizedMessage, conversationContext, language: responseLanguage, diagnosticLog });
    diagnostic(diagnosticLog, 'TARA_BACKEND_ORCHESTRATOR', { state: career.state, action: career.action, birthProfileId });
    return Object.freeze({
      domain,
      answerability: career.answerability,
      capability: 'CAREER_GROUNDED',
      message: career.message,
      career,
      action: career.action || null,
    });
  }
}

module.exports = { DOMAINS, classifyTaraDomain, TaraOrchestrator };
