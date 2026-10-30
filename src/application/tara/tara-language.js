'use strict';

const TaraLanguageStyle = Object.freeze({ ENGLISH: 'ENGLISH', HINGLISH: 'HINGLISH', AMBIGUOUS: 'AMBIGUOUS' });

const HINGLISH_MARKERS = new Set([
  'mera', 'meri', 'mere', 'mujhe', 'aapka', 'aapke', 'aapki', 'kab', 'kaisa', 'kaise', 'kya',
  'acha', 'accha', 'achha', 'sahi', 'hoga', 'hai', 'hain', 'karne', 'karna', 'karega', 'lene', 'karun',
  'aayega', 'aayegi', 'milega', 'milegi', 'mila', 'mil', 'chahiye', 'chaiye', 'abhi', 'kaunsa', 'zyada',
  'paisa', 'dhan', 'shaadi', 'shadi', 'naukri', 'nokri', 'gochaar', 'ghar', 'bacche', 'liye', 'saath', 'aur',
  'dono', 'ka', 'ke', 'ki', 'mein', 'se', 'par', 'apna', 'bahar', 'baahar', 'chhod', 'chhodni',
  'shuru', 'soch', 'raha', 'rahi', 'hoon', 'ho', 'karo', 'karu', 'karoon', 'le', 'lo', 'naya', 'nayi',
  'dekhna', 'dhundhna', 'dhoondhna', 'kharidne', 'kharidna', 'leni', 'hone', 'sakta', 'sakti', 'hogi',
  'yog', 'maangne', 'banne',
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
    // Keep intent recognition deterministic: normalize common Roman-Hindi
    // decision phrases into the existing English intent vocabulary rather
    // than maintaining a second classifier for every language.
    .replace(/\b(?:mere\s+paas|mujhe\s+(?:ek\s+)?)\s*(?:naya\s+)?(?:job\s+)?offer\s+(?:mila|mil(?:a|aa)|aaya|aya)\b/g, 'job offer')
    .replace(/\b(?:do|dono|2)\s+(?:job\s+)?offers?\b/g, 'two job offers')
    .replace(/\b(?:do|dono|2)\s+compan(?:y|ies)\s+se\s+(?:job\s+)?offer\s+(?:mila|mil(?:a|aa)|aaya|aya)\b/g, 'two job offers')
    .replace(/\b\w+\s+company\s+se\s+(?:job\s+)?offer\s+(?:mila|mil(?:a|aa)|aaya|aya)\b/g, 'job offer')
    .replace(/\boffer\s+a\s+aur\s+offer\s+b\b/g, 'compare two job offers')
    .replace(/\b(?:ye|this)\s+(?:job\s+)?offer\s+(?:accept|analyse|analyze|evaluate|sahi|better)\b/g, 'job offer')
    .replace(/\b(?:current\s+)?company\s+(?:chhodni|chhodna|leave)\b/g, 'switch job')
    .replace(/\b(?:nayi|naya|new)\s+(?:job|naukri|nokri)\s+(?:dekhna|dhundhna|dhoondhna|explore)\b/g, 'switch job')
    .replace(/\bswitch\s+(?:ka|karne\s+ka)\s+time\b/g, 'switch job timing')
    .replace(/\b(?:job|naukri|nokri)\s+(?:change|switch|badalna)\s+(?:karna|karni)\b/g, 'switch job')
    .replace(/\b(?:salary\s+)?hike\s+(?:ke\s+)?chances?\b/g, 'salary growth')
    .replace(/\bpromotion\s+(?:ke\s+)?chances?\b/g, 'promotion')
    .replace(/\bcareer\s+growth\s+(?:ka\s+)?time\b/g, 'promotion timing')
    .replace(/\bleadership\s+role\s+(?:mil\s+)?(?:sakta|sakti|chahiye)\b/g, 'leadership role')
    .replace(/\b(?:apna\s+kaam|apna\s+business|startup)\s+(?:shuru|start)\b/g, 'start business')
    .replace(/\bbusiness\s+start\s+(?:karna|karni|karne)\b/g, 'start business')
    .replace(/\b(?:job|naukri|nokri)\s+chhod\s+ke\s+business\b/g, 'start business')
    .replace(/\b(?:bahar|baahar)\s+(?:job|naukri|nokri)\b/g, 'foreign job')
    .replace(/\b(?:kharidne|kharidna|leni|lene)\b/g, 'buy')
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
    .replace(/\b(?:gaadi|gadi)\b/g, 'vehicle')
    .replace(/\b(?:bahar|baahar)\b/g, 'foreign')
    .replace(/\bdono\b/g, 'both')
    .replace(/\bdo\b/g, 'two')
    .replace(/\b(?:mera|meri|mere|mujhe|aapka|aapke|aapki)\b/g, '')
    .replace(/\bkab\b/g, 'when')
    .replace(/\b(?:kaisa|kaise)\b/g, 'how')
    .replace(/\bkya\b/g, 'what')
    .replace(/\babhi\b/g, 'current')
    .replace(/\bkaunsa\b/g, 'what')
    .replace(/\bzyada\b/g, 'stronger')
    .replace(/\b(?:karne|karna|karni|karega|karo|karu|karoon)\b/g, '')
    .replace(/\b(?:hoga|hai|hain|ho|hoon)\b/g, '')
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
