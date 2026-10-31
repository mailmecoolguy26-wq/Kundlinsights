'use strict';

const { TaraLanguageStyle } = require('./tara-language');

// This is intentionally a rendering boundary, not a calibration adapter. It
// accepts only the already-public summary and never reads calibration evidence.
function publicSummary(context) {
  if (!context || typeof context !== 'object' || context.available !== true) return null;
  const summary = typeof context.summary === 'string' ? context.summary.trim() : '';
  return summary && summary.length <= 500 ? summary : null;
}

function wrapper(domain, language) {
  const hinglish = language === TaraLanguageStyle.HINGLISH || language === 'HINGLISH';
  const copy = {
    CAREER: hinglish
      ? 'Aapki recorded Career history bhi is timing ko additional context deti hai.'
      : 'Your recorded Career history also adds context to this timing.',
    PROPERTY: hinglish
      ? 'Aapki recorded Property history bhi is timing ko additional context deti hai.'
      : 'Your recorded Property history also adds context to this timing.',
    VEHICLE: hinglish
      ? 'Aapki recorded Vehicle history bhi is timing ko additional context deti hai.'
      : 'Your recorded Vehicle history also adds context to this timing.',
    RELATIONSHIP: hinglish
      ? 'Aapki recorded relationship history bhi is timing ko additional context deti hai.'
      : 'Your recorded relationship history also adds context to this timing.',
    FAMILY_EXPANSION: hinglish
      ? 'Aapki recorded family history broader Family Expansion timing ko additional context deti hai.'
      : 'Your recorded family history adds additional context to this broader Family Expansion timing.',
  };
  return copy[domain] || null;
}

function appendHistoricalContext(message, { domain, historicalContext, language } = {}) {
  const summary = publicSummary(historicalContext);
  const lead = wrapper(domain, language);
  if (!summary || !lead || typeof message !== 'string' || !message.trim()) return message;
  return `${message.trim()}\n\n${lead} ${summary}`;
}

module.exports = { appendHistoricalContext, publicSummary };
