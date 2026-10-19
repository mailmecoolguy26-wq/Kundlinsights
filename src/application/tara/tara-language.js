'use strict';

const TaraLanguageStyle = Object.freeze({ ENGLISH: 'ENGLISH', HINGLISH: 'HINGLISH', AMBIGUOUS: 'AMBIGUOUS' });

const HINGLISH_MARKERS = new Set([
  'mera', 'meri', 'mere', 'mujhe', 'aapka', 'aapke', 'aapki', 'kab', 'kaisa', 'kaise', 'kya',
  'acha', 'accha', 'achha', 'sahi', 'hoga', 'hai', 'hain', 'karne', 'karna', 'karega', 'lene', 'karun',
  'aayega', 'chahiye', 'abhi', 'kaunsa', 'zyada',
  'paisa', 'dhan', 'shaadi', 'shadi', 'naukri', 'nokri', 'gochaar', 'ghar', 'bacche', 'liye', 'saath', 'aur',
]);
const ENGLISH_MARKERS = new Set([
  'when', 'what', 'where', 'why', 'how', 'should', 'could', 'would', 'will',
  'is', 'are', 'do', 'does', 'my', 'your', 'the', 'and', 'for', 'about',
  'please', 'explain', 'tell', 'show', 'current', 'next', 'improve',
]);

function normalizedWords(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectTaraLanguageStyle(message) {
  const words = normalizedWords(message).split(' ').filter(Boolean);
  if (!words.length || words.length <= 2) return TaraLanguageStyle.AMBIGUOUS;
  if (words.some((word) => HINGLISH_MARKERS.has(word))) return TaraLanguageStyle.HINGLISH;
  // Once a message is sentence-like and has no Latin-Hindi signal, preserve
  // its English wording rather than overriding it with the selected app style.
  // The English marker set documents common evidence, while normal sentences
  // without Hinglish evidence are also English by this product policy.
  if (words.some((word) => ENGLISH_MARKERS.has(word)) || words.length > 2) return TaraLanguageStyle.ENGLISH;
  return TaraLanguageStyle.AMBIGUOUS;
}

function normalizeHinglishForIntent(message) {
  let text = normalizedWords(message);
  if (!text) return text;
  text = text
    .replace(/\b(job|career)\s+switch\s+karne\s+ka\s+(?:acha|accha|better)\s+time\s+kab\s+hai\b/g, 'when is a favourable time to switch job')
    .replace(/\b(?:job|naukri|nokri)\s+(?:change|switch)\s+karna\b/g, 'change job')
    .replace(/\bcareer\s+kab\s+(?:improve|better|growth)\s+hoga\b/g, 'career improve')
    .replace(/\babhi\s+kaunsa\s+area\s+zyada\s+activate\s+ho\s+raha\s+hai\b/g, 'current transit overview active area')
    .replace(/\bgochaar\b/g, 'gochar')
    .replace(/\b(?:naukri|nokri)\b/g, 'job')
    .replace(/\b(?:shaadi|shadi)\b/g, 'marriage')
    .replace(/\b(?:paisa|dhan)\b/g, 'money')
    .replace(/\bghar\b/g, 'property')
    .replace(/\bbacche\b/g, 'children')
    .replace(/\b(?:acha|accha)\b/g, 'favourable')
    .replace(/\b(?:mera|meri|mere|mujhe|aapka|aapke|aapki)\b/g, '')
    .replace(/\bkab\b/g, 'when')
    .replace(/\b(?:kaisa|kaise)\b/g, 'how')
    .replace(/\bkya\b/g, 'what')
    .replace(/\babhi\b/g, 'current')
    .replace(/\bkaunsa\b/g, 'what')
    .replace(/\bzyada\b/g, 'stronger')
    .replace(/\b(?:karne|karna|karega)\b/g, '')
    .replace(/\b(?:hoga|hai|hain)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  return text;
}

function resolvedTaraLanguageStyle({ message, requestedLanguage = null } = {}) {
  const detected = detectTaraLanguageStyle(message);
  if (detected === TaraLanguageStyle.HINGLISH) return TaraLanguageStyle.HINGLISH;
  if (detected === TaraLanguageStyle.ENGLISH) return TaraLanguageStyle.ENGLISH;
  return requestedLanguage === TaraLanguageStyle.HINGLISH ? TaraLanguageStyle.HINGLISH : TaraLanguageStyle.ENGLISH;
}

module.exports = { TaraLanguageStyle, detectTaraLanguageStyle, normalizeHinglishForIntent, resolvedTaraLanguageStyle };
