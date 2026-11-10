'use strict';

const crypto = require('node:crypto');
const { TAROT_CATALOG } = require('./tarot-catalog');

const TAROT_RULES_VERSION = 'tarot-rules-v1';
const SPREADS = Object.freeze({
  GENERAL_GUIDANCE: Object.freeze(['Current Energy','What To Understand','Guidance']),
  CAREER: Object.freeze(['Current Career Energy','Opportunity or Challenge','Direction']),
  RELATIONSHIP: Object.freeze(['Current Dynamic','What Needs Attention','Guidance']),
  MONEY: Object.freeze(['Current Financial Energy','What to Watch','Practical Direction']),
  PERSONAL_GROWTH: Object.freeze(['Current Pattern','What To Develop','Guidance']),
  DECISION: Object.freeze(['What Supports This','What Needs Caution','Guidance']),
});
const TAROT_PACKS = Object.freeze({
  TAROT_3_READINGS: Object.freeze({ quantity: 3, priceMinor: 19900, currency: 'INR' }),
  TAROT_5_READINGS: Object.freeze({ quantity: 5, priceMinor: 29900, currency: 'INR' }),
  TAROT_10_READINGS: Object.freeze({ quantity: 10, priceMinor: 49900, currency: 'INR' }),
});

const SAFETY = [
  ['DEATH', /\b(death|die|dying|mrityu)\b/i, 'I cannot use Tarot to predict death or its timing.'],
  ['MEDICAL', /\b(diagnos|cancer|tumou?r|serious illness|disease|medical result|medicine|medication|treatment|dose|doctor|surgery)\w*/i, 'Tarot cannot determine medical outcomes or replace medical advice. Please speak with a qualified healthcare professional.'],
  ['REPRODUCTIVE', /\b(fertil|pregnan|conceiv|conception|miscarriage|delivery safety|child gender)\w*/i, 'I cannot use Tarot to predict reproductive or child-health outcomes.'],
  ['SELF_HARM', /\b(suicide|kill myself|self[- ]?harm|hurt myself)\b/i, 'I cannot provide a Tarot reading for self-harm. Please seek immediate support from local emergency services or a trusted crisis resource.'],
  ['CRIMINAL_LEGAL', /\b(guilty|criminal|court verdict|legal verdict|court case|win (?:the )?(?:court )?case)\b/i, 'I cannot use Tarot to determine guilt or a legal outcome.'],
  ['FINANCIAL_GUARANTEE', /\b(guaranteed(?: investment)? return|guarantee.*profit|will .*stock.*rise|sure profit|which (?:stock|share|crypto)|buy (?:stock|share|crypto)|trade tomorrow)\b/i, 'Tarot cannot choose investments or guarantee financial returns. Consider qualified financial guidance and your own risk assessment.'],
  ['HIDDEN_BEHAVIOR', /\b(cheating|unfaithful|having an affair|secretly lying)\b/i, 'I cannot use Tarot to state another person’s hidden behavior as fact.'],
];
function classifySafety(question) {
  for (const [category, pattern, message] of SAFETY) if (pattern.test(question)) return Object.freeze({ allowed: false, category: 'UNSUPPORTED_SAFETY', reason: category, message, suggestedQuestion: category === 'HIDDEN_BEHAVIOR' ? 'What should I pay attention to in this relationship?' : null });
  return Object.freeze({ allowed: true, category: null });
}
function classifyQuestion(question) {
  if (/\b(job|career|work|business|promotion|offer)\b/i.test(question)) return 'CAREER';
  if (/\b(relationship|partner|marriage|love|family)\b/i.test(question)) return 'RELATIONSHIP';
  if (/\b(money|financial|finance|income|expense|investment)\b/i.test(question)) return 'MONEY';
  if (/\b(grow|growth|confidence|habit|purpose|self|personal|heal|healing|mindset)\w*\b/i.test(question)) return 'PERSONAL_GROWTH';
  if (/\b(choose|choice|decide|decision|should i|option)\b/i.test(question)) return 'DECISION';
  return 'GENERAL_GUIDANCE';
}
function secureDeck({ randomInt = crypto.randomInt, randomBytes = crypto.randomBytes } = {}) {
  const cards = TAROT_CATALOG.map((card) => card.cardId);
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1); [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return Object.freeze(cards.map((cardId) => Object.freeze({ token: randomBytes(24).toString('base64url'), cardId })));
}
module.exports = { TAROT_RULES_VERSION, SPREADS, TAROT_PACKS, classifySafety, classifyQuestion, secureDeck };
