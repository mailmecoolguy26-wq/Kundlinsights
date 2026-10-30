'use strict';

// This registry describes navigation to existing product experiences only. It
// intentionally contains no calculation, entitlement, or arbitrary route data.
const TaraDomainAction = Object.freeze({ OPEN_DOMAIN_HUB: 'OPEN_DOMAIN_HUB' });
const TaraDomain = Object.freeze({ PROPERTY: 'PROPERTY', VEHICLE: 'VEHICLE' });

const DOMAIN_TRANSITIONS = Object.freeze({
  [TaraDomain.PROPERTY]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'View Property outlook', HINGLISH: 'Property outlook dekhein' }),
    message: Object.freeze({
      ENGLISH: 'I can help you review your Property outlook and timing using your saved profile.',
      HINGLISH: 'Main aapka Property outlook aur timing check karne mein help kar sakti hoon.',
    }),
    specificMessage: Object.freeze({
      ENGLISH: 'I can help you review your Property timing and broader outlook, but I’m not yet able to evaluate a specific property purchase reliably.',
      HINGLISH: 'Main aapka Property timing aur broader outlook check karne mein help kar sakti hoon, lekin kisi specific Property purchase ko reliably evaluate karne ke liye abhi ready nahi hoon.',
    }),
  }),
  [TaraDomain.VEHICLE]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'View Vehicle outlook', HINGLISH: 'Vehicle outlook dekhein' }),
    message: Object.freeze({
      ENGLISH: 'I can help you review your Vehicle outlook and timing.',
      HINGLISH: 'Main aapka Vehicle outlook aur purchase timing dekhne mein help kar sakti hoon.',
    }),
  }),
});

function words(message) { return String(message || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function has(text, pattern) { return pattern.test(text); }

function unsupportedFinancialQuestion(text) {
  return has(text, /\b(stock|share|mutual fund|crypto|investment advice|loan\b.{0,20}\bapprov(?:ed|al)|mortgage\b.{0,20}\bapprov(?:ed|al)|price|appreciate|double in price|property tax|car mileage|vehicle mileage|foreign currency rate)\b/);
}

function classifyDomainHubIntent(message) {
  const text = words(message);
  if (!text) return null;
  if (unsupportedFinancialQuestion(text)) return Object.freeze({ kind: 'FINANCIAL_UNSUPPORTED' });
  const property = has(text, /\b(property|house|home|real estate|apartment|flat|ghar)\b/);
  const vehicle = has(text, /\b(vehicle|car|bike|scooter|gaadi|gadi|four wheeler|two wheeler)\b/);
  const wealth = has(text, /\b(wealth|money|financial|finance|invest(?:ment|ing)?)\b/);
  const personal = has(text, /\b(my|me|i |chart|kundli|timing|outlook|buy|buying|purchase|purchasing|kharid|lene|leni|chances?|when|should|good time|acha time|better time)\b/);
  if (property && wealth) return Object.freeze({ kind: 'CROSS_DOMAIN_FINANCIAL' });
  if ((property && has(text, /\b(object|dart|css|value|code|programming)\b/)) || (vehicle && has(text, /\b(api|http|transportation system|metaphor)\b/)) || has(text, /\b(phone|mobile)\s+switch\b/)) return Object.freeze({ kind: 'TECHNICAL_UNSUPPORTED' });
  // Wealth has no product module, reading, API, or route today. Keep it
  // explicit rather than accidentally forwarding money questions to Property.
  if (wealth && !property) return Object.freeze({ kind: 'WEALTH_UNSUPPORTED' });
  if (property && !has(text, /\b(object|dart|css|value|code|programming)\b/) && personal) return Object.freeze({ kind: 'DOMAIN_HUB', domain: TaraDomain.PROPERTY, specific: has(text, /\b(specific|this|\d+\s*(?:lakh|crore|million)|apartment|flat)\b/) });
  if (vehicle && !has(text, /\b(api|http|transportation system|metaphor)\b/) && personal) return Object.freeze({ kind: 'DOMAIN_HUB', domain: TaraDomain.VEHICLE, specific: false });
  return null;
}

function domainHubResponse(intent, language) {
  if (!intent) return null;
  if (intent.kind === 'CROSS_DOMAIN_FINANCIAL') {
    return Object.freeze({
      answerability: 'UNSUPPORTED',
      capability: null,
      message: language === 'HINGLISH'
        ? 'Main Wealth aur Property ko separately dekhne mein help kar sakti hoon, lekin in dono financial choices ko ek analysis mein reliably compare karne ke liye abhi ready nahi hoon.'
        : 'I can help you look at Wealth and Property separately, but I’m not yet able to compare those two financial choices reliably in one analysis.',
      action: null,
    });
  }
  if (intent.kind === 'WEALTH_UNSUPPORTED') {
    return Object.freeze({
      answerability: 'UNSUPPORTED',
      capability: null,
      message: language === 'HINGLISH'
        ? 'Main abhi Wealth ke liye reliable personalized outlook dene ke liye ready nahi hoon.'
        : 'I’m not ready to give you a reliable personalized Wealth outlook yet.',
      action: null,
    });
  }
  if (intent.kind === 'FINANCIAL_UNSUPPORTED' || intent.kind === 'TECHNICAL_UNSUPPORTED') {
    return Object.freeze({
      answerability: 'UNSUPPORTED',
      capability: null,
      message: language === 'HINGLISH'
        ? 'Main is specific request ke liye reliable personalized guidance dene ke liye ready nahi hoon.'
        : 'I’m not ready to give you reliable personalized guidance for that specific request.',
      action: null,
    });
  }
  const copy = DOMAIN_TRANSITIONS[intent.domain];
  if (!copy) return null;
  const style = language === 'HINGLISH' ? 'HINGLISH' : 'ENGLISH';
  return Object.freeze({
    answerability: 'SUPPORTED',
    capability: 'DOMAIN_HUB_ROUTING',
    message: intent.specific && copy.specificMessage ? copy.specificMessage[style] : copy.message[style],
    action: Object.freeze({ type: TaraDomainAction.OPEN_DOMAIN_HUB, label: copy.label[style], domain: intent.domain }),
  });
}

module.exports = { TaraDomainAction, TaraDomain, classifyDomainHubIntent, domainHubResponse };
