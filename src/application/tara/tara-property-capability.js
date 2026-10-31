'use strict';

const { PropertyIntent } = require('../property');
const { appendHistoricalContext } = require('./tara-historical-context');

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function intentFor(message) {
  const text = normalize(message);
  if (/sell|sale|bech|bechna/.test(text)) return PropertyIntent.PROPERTY_SALE_TIMING;
  if (/loan|mortgage|debt|karz/.test(text)) return PropertyIntent.PROPERTY_LOAN_CONTEXT;
  if (/inherit|inheritance|virasat|shared property/.test(text)) return PropertyIntent.PROPERTY_INHERITANCE_CONTEXT;
  if (/stronger (?:period|window)|stronger.*(?:period|window)|(?:acha|favourable|favorable|better) (?:period|window)/.test(text)) return PropertyIntent.PROPERTY_STRONGER_WINDOW;
  if (/when|kab|timing|stronger|acha time|better period|buy|purchase|kharid|lene/.test(text)) return PropertyIntent.PROPERTY_PURCHASE_TIMING;
  return PropertyIntent.PROPERTY_CURRENT_STRENGTH;
}
function format(value) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)); }
function answer(result, language) {
  if (result.intent === PropertyIntent.PROPERTY_SALE_TIMING) return language === 'HINGLISH' ? 'Main current Property activation aur related context explain kar sakti hoon, lekin dedicated Property-sale timing abhi reliably supported nahi hai.' : 'I can explain current Property activation and its context, but dedicated Property-sale timing is not yet reliably supported.';
  const opening = language === 'HINGLISH' ? `Property matters ke liye current support ${result.classification.toLowerCase()} hai.` : `Current support for Property matters is ${result.classification.toLowerCase()}.`;
  const window = result.strongerWindow;
  const isMixedCandidate = window && window.classification === 'MIXED_CANDIDATE';
  const peak = window && window.peakActivation;
  const distinctPeak = peak && (peak.start !== window.start || peak.end !== window.end);
  const peakCopy = distinctPeak
    ? language === 'HINGLISH'
      ? ` Is period ke andar ${format(peak.start)} ke around activation aur sharp hoti hai.`
      : ` Within it, activation becomes sharper around ${format(peak.start)}.`
    : '';
  const timing = window && result.windowStatus === 'BOUNDED_WINDOW' && window.temporalStatus === 'CURRENT'
    ? language === 'HINGLISH'
      ? `Ek calculated Property activation abhi active hai aur ${format(window.end)} tak chal rahi hai.${peakCopy}`
      : `A calculated Property activation is active now and continues until ${format(window.end)}.${peakCopy}`
    : window && result.windowStatus === 'BOUNDED_WINDOW'
    ? language === 'HINGLISH'
      ? isMixedCandidate
        ? `Aage ${format(window.start)} se ${format(window.end)} ke beech ek calculated Property period mixed support ke saath dikh raha hai.${peakCopy}`
        : `Aage ek stronger calculated Property period ${format(window.start)} se ${format(window.end)} ke beech dikh raha hai.${peakCopy}`
      : isMixedCandidate
      ? `A calculated Property period with mixed support appears from ${format(window.start)} to ${format(window.end)}.${peakCopy}`
      : `An upcoming stronger calculated Property period appears from ${format(window.start)} to ${format(window.end)}.${peakCopy}`
    : window && result.windowStatus === 'BRIEF_ACTIVATION'
    ? language === 'HINGLISH'
      ? `Aage ${format(window.start)} ke around ek brief calculated Property activation dikh rahi hai.`
      : `A brief calculated Property activation appears around ${format(window.start)}.`
    : language === 'HINGLISH'
    ? 'Abhi support available hai, lekin mujhe abhi koi sufficiently strong bounded Property window nahi mil raha.'
    : 'Current support is available, but no sufficiently strong bounded Property window is reliably identified right now.';
  const why = language === 'HINGLISH' ? 'Yeh D1 Property promise, D4 confirmation, active Dasha aur calculated transits ke combined evidence par based hai. Yeh purchase, loan ya outcome ki guarantee nahi deta.' : 'This is based on the combined evidence from the D1 Property promise, D4 confirmation, active Dasha, and calculated transits. It does not guarantee a purchase, loan, or outcome.';
  return `${opening}\n\n${timing}\n\nWhy: ${why}`;
}
class TaraPropertyCapability {
  constructor({ propertyAnswerService } = {}) { if (!propertyAnswerService || typeof propertyAnswerService.answer !== 'function') throw new TypeError('INVALID_TARA_PROPERTY_CAPABILITY'); this.property = propertyAnswerService; Object.freeze(this); }
  async respond({ principal, birthProfileId, message, language = 'ENGLISH', diagnosticLog = null } = {}) {
    const intent = intentFor(message);
    const log = (event, fields = {}) => {
      if (typeof diagnosticLog === 'function') diagnosticLog(Object.freeze({ event, birthProfileId, intent, ...fields }));
    };
    log('PROPERTY_ROUTE', { stage: 'ROUTE', state: 'ROUTED' });
    try {
      const result = await this.property.answer({ principal, birthProfileId, intent, diagnosticLog });
      if (result.answerability === 'PREMIUM_REQUIRED') return Object.freeze({ intent, answerability: result.answerability, state: result.state, message: language === 'HINGLISH' ? 'Is profile ke personalized insights TaraVerse Premium ka part hain.' : 'Personalized insights for this profile are part of TaraVerse Premium.', property: null, action: result.action });
      log('PROPERTY_TARA_RESPONSE', { stage: 'RESPONSE', state: 'SUCCEEDED', evidenceCount: result.evidence && result.evidence.transit && result.evidence.transit.activeMajor.length || 0 });
      const rendered = answer(result, language);
      const message = result.answerability === 'SUPPORTED'
        ? appendHistoricalContext(rendered, { domain: 'PROPERTY', historicalContext: result.historicalContext, language })
        : rendered;
      return Object.freeze({ intent, answerability: result.answerability, state: result.state, message, property: result, action: null });
    } catch (error) {
      log('PROPERTY_TARA_RESPONSE', { stage: 'RESPONSE', state: 'FAILED', safeErrorCode: error && error.code || 'PROPERTY_CALCULATION_FAILED', errorClass: error && error.name || 'Error' });
      throw error;
    }
  }
}
module.exports = { TaraPropertyCapability, intentFor, answer };
