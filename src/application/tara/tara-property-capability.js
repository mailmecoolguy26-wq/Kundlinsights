'use strict';

const { PropertyIntent } = require('../property');

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
  const range = result.strongerWindow ? `${format(result.strongerWindow.start)} to ${format(result.strongerWindow.end)}` : null;
  if (result.intent === PropertyIntent.PROPERTY_SALE_TIMING) return language === 'HINGLISH' ? 'Main current Property activation aur related context explain kar sakti hoon, lekin dedicated Property-sale timing abhi reliably supported nahi hai.' : 'I can explain current Property activation and its context, but dedicated Property-sale timing is not yet reliably supported.';
  const opening = language === 'HINGLISH' ? `Property matters ke liye current support ${result.classification.toLowerCase()} hai.` : `Current support for Property matters is ${result.classification.toLowerCase()}.`;
  const timing = range ? language === 'HINGLISH' ? `Current Dasha–transit overlap ${range} tak hai.` : `The current Dasha–transit overlap runs through ${range}.` : language === 'HINGLISH' ? 'Abhi koi stronger bounded Property window reliably identify nahi hui hai.' : 'No stronger bounded Property window is reliably identified right now.';
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
      log('PROPERTY_TARA_RESPONSE', { stage: 'RESPONSE', state: 'SUCCEEDED', evidenceCount: result.evidence && result.evidence.transit && result.evidence.transit.activeMajor.length || 0 });
      return Object.freeze({ intent, answerability: result.answerability, state: result.state, message: answer(result, language), property: result, action: null });
    } catch (error) {
      log('PROPERTY_TARA_RESPONSE', { stage: 'RESPONSE', state: 'FAILED', safeErrorCode: error && error.code || 'PROPERTY_CALCULATION_FAILED', errorClass: error && error.name || 'Error' });
      throw error;
    }
  }
}
module.exports = { TaraPropertyCapability, intentFor };
