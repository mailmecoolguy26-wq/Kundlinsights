'use strict';

// This registry describes navigation to existing product experiences only. It
// intentionally contains no calculation, entitlement, or arbitrary route data.
const TaraDomainAction = Object.freeze({ OPEN_DOMAIN_HUB: 'OPEN_DOMAIN_HUB' });
const TaraDomain = Object.freeze({ PROPERTY: 'PROPERTY', VEHICLE: 'VEHICLE', WEALTH: 'WEALTH' });

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
  [TaraDomain.WEALTH]: Object.freeze({
    label: Object.freeze({ ENGLISH: 'View Wealth outlook', HINGLISH: 'Wealth outlook dekhein' }),
    message: Object.freeze({
      ENGLISH: 'I can help you review your broader Wealth outlook, current financial phase and stronger Wealth timing using your saved profile.',
      HINGLISH: 'Main aapke saved profile ke basis par Wealth outlook, current financial phase aur stronger Wealth timing dekhne mein help kar sakti hoon.',
    }),
  }),
});

function words(message) { return String(message || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function has(text, pattern) { return pattern.test(text); }

function financialBoundary(text) {
  if (has(text, /\b(stock|share|mutual fund|crypto|bitcoin|nav|wealth tax|property tax|wealth management|wealth manager|exchange rate|usd inr|currency|money transfer|savings account|interest rate|banking|mileage)\b/)) return 'SPECIFIC_FINANCIAL_PRODUCT';
  if (has(text, /\b(loan|mortgage)\b|\bapprov(?:e|ed|al)\b/)) return 'LOAN_APPROVAL';
  if (has(text, /\b(invest|investment)\b.*\b(\d+|lakh|crore|amount|now)\b|\b(earn|net worth|rich|paisa kama|money kama|kitna paisa|kitna money)\b.*\b(\d+|crore|lakh|how much|kitna)?/)) return 'EXACT_FINANCIAL_OUTCOME';
  return null;
}

function classifyDomainHubIntent(message) {
  const text = words(message);
  if (!text) return null;
  const boundary = financialBoundary(text);
  if (boundary) return Object.freeze({ kind: 'FINANCIAL_BOUNDARY', boundary });
  const property = has(text, /\b(property|house|home|real estate|apartment|flat|ghar)\b/);
  const vehicle = has(text, /\b(vehicle|car|bike|scooter|gaadi|gadi|four wheeler|two wheeler)\b/);
  const wealth = has(text, /\b(wealth|money|financial|finance|paisa|paise|paiso|savings?)\b/);
  const personal = has(text, /\b(my|me|i |chart|kundli|timing|outlook|buy|buying|purchase|purchasing|kharid|lene|leni|chances?|when|should|good time|acha time|better time|period|phase|growth|time|kaisa|kaisi|kab|paisa|paise|paiso)\b/);
  if (property && wealth) return Object.freeze({ kind: 'CROSS_DOMAIN_FINANCIAL' });
  if ((property && has(text, /\b(object|dart|css|value|code|programming)\b/)) || (vehicle && has(text, /\b(api|http|transportation system|metaphor)\b/)) || has(text, /\b(phone|mobile)\s+switch\b/)) return Object.freeze({ kind: 'TECHNICAL_UNSUPPORTED' });
  if (wealth && !property && personal) return Object.freeze({ kind: 'DOMAIN_HUB', domain: TaraDomain.WEALTH, specific: false });
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
  if (intent.kind === 'FINANCIAL_BOUNDARY') {
    return Object.freeze({
      answerability: 'UNSUPPORTED',
      capability: null,
      message: language === 'HINGLISH'
        ? 'Main aapka broader Wealth outlook aur timing dekhne mein help kar sakti hoon, lekin specific investment, amount ya lender approval recommend ya predict nahi karti.'
        : 'I can help you review your broader Wealth outlook and timing, but TaraVerse does not recommend specific investments, amounts, or lender approvals.',
      action: intent.boundary === 'SPECIFIC_FINANCIAL_PRODUCT' ? null : Object.freeze({ type: TaraDomainAction.OPEN_DOMAIN_HUB, label: DOMAIN_TRANSITIONS[TaraDomain.WEALTH].label[language === 'HINGLISH' ? 'HINGLISH' : 'ENGLISH'], domain: TaraDomain.WEALTH }),
    });
  }
  if (intent.kind === 'TECHNICAL_UNSUPPORTED') {
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
