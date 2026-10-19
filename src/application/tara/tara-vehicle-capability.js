'use strict';

const { VehicleIntent } = require('../vehicle');
const { normalizeHinglishForIntent, resolvedTaraLanguageStyle, TaraLanguageStyle } = require('./tara-language');

function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function intentFor(message) {
  const text = normalize(normalizeHinglishForIntent(message));
  if (/stronger (?:period|window)|stronger.*(?:period|window)|(?:acha|favourable|favorable|better) (?:period|window)/.test(text)) return VehicleIntent.VEHICLE_STRONGER_WINDOW;
  if (/when|kab|timing|stronger|acha time|better period|buy|purchase|kharid|lene|vehicle|car|bike|scooter|gaadi|gadi/.test(text)) return VehicleIntent.VEHICLE_PURCHASE_TIMING;
  return VehicleIntent.VEHICLE_CURRENT_STRENGTH;
}
function format(value) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)); }
function hasContext(result, house) {
  return Boolean(result && result.evidence && result.evidence.transit && (result.evidence.transit.contexts || []).some((item) => (item.contextualHouses || []).includes(house)));
}
function answer(result, language) {
  const hinglish = language === TaraLanguageStyle.HINGLISH;
  const opening = result.classification === 'STRONG_CANDIDATE'
    ? hinglish ? 'Vehicle-related factors abhi stronger tarah se active hain.' : 'Vehicle-related factors are more actively aligned now.'
    : result.classification === 'MODERATE_CANDIDATE'
    ? hinglish ? 'Is period mein Vehicle-related factors moderate support dikha rahe hain.' : 'Vehicle-related factors show meaningful support.'
    : result.classification === 'MIXED_CANDIDATE'
    ? hinglish ? 'Is period mein Vehicle support hai, lekin kuch mixed factors bhi hain.' : 'Vehicle support is present, but some factors are mixed.'
    : hinglish ? 'Is period mein strong Vehicle timing support nahi dikh raha.' : 'Strong Vehicle timing support is not visible in this period.';
  const window = result.strongerWindow;
  const timing = window && window.windowShape === 'BOUNDED_WINDOW'
    ? window.temporalStatus === 'CURRENT'
      ? hinglish ? `Ek calculated Vehicle support period abhi active hai aur ${format(window.end)} tak chal raha hai.` : `A calculated Vehicle support period is active now and continues until ${format(window.end)}.`
      : hinglish ? `${format(window.start)} se ${format(window.end)} tak ek calculated Vehicle support period dikh raha hai.` : `A calculated Vehicle support period appears from ${format(window.start)} to ${format(window.end)}.`
    : window && window.windowShape === 'BRIEF_ACTIVATION'
    ? hinglish ? `Ek brief Vehicle-related activation ${format(window.start)} ke around dikh rahi hai.` : `A brief Vehicle-related activation appears around ${format(window.start)}.`
    : hinglish ? 'Abhi koi sufficiently supported bounded Vehicle window reliably identify nahi ho raha.' : 'No sufficiently supported bounded Vehicle window is reliably identified right now.';
  const maintenance = hasContext(result, 6); const expenses = hasContext(result, 12);
  const action = hinglish
    ? `What to do: Options compare karein aur cost, financing${maintenance ? ', maintenance' : ''}${expenses ? ' aur possible expenses' : ''} ko dhyan mein rakhkar planning karein.`
    : `What to do: Compare options and plan practical costs, financing${maintenance ? ', maintenance' : ''}${expenses ? ', and possible expenses' : ''} carefully.`;
  const why = hinglish
    ? 'Why: Yeh result D1 Vehicle structure, D16 confirmation, active Dasha aur calculated Jupiter/Saturn transit evidence par based hai. Yeh Vehicle purchase, loan approval, delivery ya ownership ki guarantee nahi deta.'
    : 'Why: This is based on D1 Vehicle structure, D16 confirmation, active Dasha, and calculated Jupiter/Saturn transit evidence. It does not guarantee a Vehicle purchase, loan approval, delivery, or ownership.';
  return `${opening}\n\nVehicle support window: ${timing}\n\n${action}\n\n${why}`;
}

class TaraVehicleCapability {
  constructor({ vehicleAnswerService } = {}) { if (!vehicleAnswerService || typeof vehicleAnswerService.answer !== 'function') throw new TypeError('INVALID_TARA_VEHICLE_CAPABILITY'); this.vehicle = vehicleAnswerService; Object.freeze(this); }
  async respond({ principal, birthProfileId, message, language = 'ENGLISH', diagnosticLog = null } = {}) {
    const intent = intentFor(message);
    const responseLanguage = resolvedTaraLanguageStyle({ message, requestedLanguage: language });
    try {
      const result = await this.vehicle.answer({ principal, birthProfileId, intent, diagnosticLog });
      if (result.answerability === 'PREMIUM_REQUIRED') return freeze({ intent, answerability: result.answerability, state: result.state, message: responseLanguage === TaraLanguageStyle.HINGLISH ? 'Is profile ke personalized insights TaraVerse Premium ka part hain.' : 'Personalized insights for this profile are part of TaraVerse Premium.', vehicle: null, action: result.action });
      return freeze({ intent, answerability: result.answerability, state: result.classification, message: answer(result, responseLanguage), vehicle: result, action: null });
    } catch (error) {
      if (typeof diagnosticLog === 'function') diagnosticLog(freeze({ event: 'VEHICLE_TARA_RESPONSE', birthProfileId, intent, state: 'FAILED', safeErrorCode: error && error.code || 'VEHICLE_CALCULATION_FAILED', errorClass: error && error.name || 'Error' }));
      throw error;
    }
  }
}
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

// Export names are deliberately capability-specific: the Tara barrel also
// exports Property's intentFor/answer helpers for its established tests.
module.exports = { TaraVehicleCapability, vehicleIntentFor: intentFor, vehicleAnswer: answer };
