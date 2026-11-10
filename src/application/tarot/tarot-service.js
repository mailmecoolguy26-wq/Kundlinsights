'use strict';

const crypto = require('node:crypto');
const { tarotCard } = require('./tarot-catalog');
const { TAROT_RULES_VERSION, SPREADS, TAROT_PACKS, classifySafety, classifyQuestion, secureDeck } = require('./tarot-rules');

function fail(code) { const error = new Error(); error.code = code; throw error; }
function requiredText(value, code, max = 1000) { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(code); return value.trim(); }
function quotaDay(at) { return new Date(at).toISOString().slice(0, 10); }
function iso(clock) { return new Date(clock()).toISOString(); }
function publicCard(selected, spread) { const card = tarotCard(selected.cardId); return { position: selected.position, positionName: spread[selected.position - 1], cardId: card.cardId, cardName: card.displayName, arcana: card.arcana, ...(card.suit ? { suit: card.suit } : {}), coreTheme: card.coreThemes[0], orientation: 'UPRIGHT', selectedAt: selected.selectedAt }; }
function publicReading(reading, { detail = true } = {}) {
  const spread = SPREADS[reading.spreadType];
  const selectedCards = reading.selectedCards.map((card) => publicCard(card, spread));
  const base = { readingId: reading.id, question: reading.question, category: reading.category, spread: { spreadType: reading.spreadType, positions: spread.map((name, i) => ({ position: i + 1, name })) }, status: reading.status, rulesVersion: reading.rulesVersion, entitlementSource: reading.entitlementSource, selectedCards, createdAt: reading.createdAt, updatedAt: reading.updatedAt, completedAt: reading.completedAt };
  if (!detail) return { ...base, interpretationPreview: reading.interpretation && reading.interpretation.overview || null };
  return { ...base, deckSize: 78, selectableTokens: reading.status === 'DRAWING' ? reading.deck.filter((hidden) => !reading.selectedCards.some((card) => card.token === hidden.token)).map((hidden) => hidden.token) : [], interpretation: reading.interpretation };
}
function validateInterpretation(output, cards) {
  if (!output || typeof output !== 'object') fail('INVALID_TAROT_INTERPRETATION');
  for (const key of ['overview','combinedMessage','practicalReflection','nextStep','caution','disclaimer']) if (typeof output[key] !== 'string' || !output[key].trim()) fail('INVALID_TAROT_INTERPRETATION');
  if (!Array.isArray(output.cards) || output.cards.length !== 3) fail('INVALID_TAROT_INTERPRETATION');
  for (let i = 0; i < 3; i += 1) if (output.cards[i].position !== i + 1 || output.cards[i].cardId !== cards[i].cardId || typeof output.cards[i].interpretation !== 'string') fail('INVALID_TAROT_INTERPRETATION');
  return { overview: output.overview.trim(), cards: output.cards.map((item, i) => ({ position: i + 1, cardId: cards[i].cardId, cardName: cards[i].displayName, interpretation: item.interpretation.trim() })), combinedMessage: output.combinedMessage.trim(), practicalReflection: output.practicalReflection.trim(), nextStep: output.nextStep.trim(), caution: output.caution.trim(), disclaimer: output.disclaimer.trim() };
}
function fallbackInterpretation(reading, cards) {
  const hinglish = reading.language === 'HINGLISH';
  return {
    overview: hinglish ? 'Yeh teen cards aapke sawaal ko reflection aur grounded perspective ke saath dekhne ka invitation dete hain.' : 'These three cards invite you to view your question with reflection and a grounded perspective.',
    cards: cards.map((card, index) => ({
      position: index + 1,
      cardId: card.cardId,
      cardName: card.displayName,
      interpretation: `${card.coreThemes[0]}. ${card.reflectiveGuidance}`,
    })),
    combinedMessage: cards.map((card) => card.coreThemes[0]).join('; '),
    practicalReflection: hinglish ? 'Ek practical next step choose karein aur decision se pehle facts ko bhi verify karein.' : 'Choose one practical next step and verify the relevant facts before making a decision.',
    nextStep: hinglish ? 'Jo baat sabse zyada relevant lagi, us par ek chhota grounded action decide karein.' : 'Choose one small, grounded action based on the point that felt most relevant.',
    caution: hinglish ? 'Cards ko certainty ya kisi doosre vyakti ke baare mein fact na samjhein.' : 'Do not treat the cards as certainty or as facts about another person.',
    disclaimer: hinglish ? 'Tarot reflection aur guidance ke liye hai; yeh certainty ya professional advice nahi hai.' : 'Tarot is intended for reflection and guidance, not certainty or professional advice.',
  };
}

class TarotService {
  constructor({ authUserResolver, repository, interpreter = null, idGenerator = crypto.randomUUID, clock = () => new Date(), deckFactory = secureDeck } = {}) {
    if (typeof authUserResolver !== 'function' || !repository) throw new TypeError('INVALID_TAROT_DEPENDENCY');
    this.resolveUser = authUserResolver; this.repository = repository; this.interpreter = interpreter; this.idGenerator = idGenerator; this.clock = clock; this.deckFactory = deckFactory;
  }
  async create({ principal, body = {}, idempotencyKey }) {
    const question = requiredText(body.question, 'INVALID_TAROT_QUESTION');
    const safety = classifySafety(question);
    if (!safety.allowed) return { state: 'SAFETY_BOUNDARY', safety: { reason: safety.reason, message: safety.message, suggestedQuestion: safety.suggestedQuestion } };
    const key = requiredText(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY', 128); const user = await this.resolveUser(principal); const now = iso(this.clock); const category = classifyQuestion(question);
    const result = await this.repository.createWithEntitlement({ principal, id: this.idGenerator(), userId: user.id, question, category, spreadType: category, rulesVersion: TAROT_RULES_VERSION, language: body.language === 'HINGLISH' ? 'HINGLISH' : 'ENGLISH', deck: this.deckFactory(), quotaDay: quotaDay(now), idempotencyKey: key, createdAt: now, updatedAt: now });
    if (result.purchaseRequired) return { state: 'PURCHASE_REQUIRED', entitlement: await this.entitlement({ principal }), products: TAROT_PACKS };
    return { state: 'READING_READY', reading: publicReading(result.reading), idempotentReplay: !result.created };
  }
  async select({ principal, readingId, body = {}, idempotencyKey }) {
    const user = await this.resolveUser(principal); const now = iso(this.clock);
    const result = await this.repository.selectCard({ principal, userId: user.id, readingId: requiredText(readingId, 'INVALID_TAROT_READING_ID', 128), token: requiredText(body.selectionToken, 'INVALID_TAROT_SELECTION', 256), idempotencyKey: requiredText(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY', 128), selectedAt: now });
    let reading = result.reading;
    if (result.needsInterpretation) reading = await this._interpret(user.id, reading, principal);
    return { revealedCard: publicCard(result.selectedCard, SPREADS[reading.spreadType]), reading: publicReading(reading) };
  }
  async _interpret(userId, reading, principal) {
    if (!this.interpreter || typeof this.interpreter.interpret !== 'function') return this.repository.markRetryable({ principal, userId, readingId: reading.id, updatedAt: iso(this.clock) });
    try {
      const cards = reading.selectedCards.map((selected) => tarotCard(selected.cardId));
      const output = await this.interpreter.interpret({ rulesVersion: TAROT_RULES_VERSION, question: reading.question, category: reading.category, spread: SPREADS[reading.spreadType], cards: cards.map((card, index) => ({ position: index + 1, positionName: SPREADS[reading.spreadType][index], ...card })), language: reading.language, safetyConstraints: ['No guaranteed outcomes','No factual accusations','No medical, reproductive, legal, death or investment certainty','No astrology or additional cards'] });
      return this.repository.finalize({ principal, userId, readingId: reading.id, interpretation: validateInterpretation(output, cards), interpretationVersion: output.version || 'tarot-synthesis-v1', completedAt: iso(this.clock) });
    } catch (_) {
      const cards = reading.selectedCards.map((selected) => tarotCard(selected.cardId));
      try {
        return await this.repository.finalize({ principal, userId, readingId: reading.id, interpretation: fallbackInterpretation(reading, cards), interpretationVersion: 'tarot-deterministic-fallback-v1', completedAt: iso(this.clock) });
      } catch (_) {
        return this.repository.markRetryable({ principal, userId, readingId: reading.id, updatedAt: iso(this.clock) });
      }
    }
  }
  async retry({ principal, readingId }) { const user = await this.resolveUser(principal); const reading = await this.repository.beginRetry({ principal, userId: user.id, readingId, updatedAt: iso(this.clock) }); return { reading: publicReading(await this._interpret(user.id, reading, principal)) }; }
  async get({ principal, readingId }) { const user = await this.resolveUser(principal); return { reading: publicReading(await this.repository.get({ principal, userId: user.id, readingId })) }; }
  async list({ principal, limit = 20, cursor = null }) { const user = await this.resolveUser(principal); if (!Number.isInteger(limit) || limit < 1 || limit > 50) fail('INVALID_TAROT_LIST_LIMIT'); const items = await this.repository.list({ principal, userId: user.id, limit: limit + 1, cursor }); const hasMore = items.length > limit; const readings = items.slice(0, limit); return { readings: readings.map((r) => publicReading(r, { detail: false })), nextCursor: hasMore ? `${readings.at(-1).createdAt}:${readings.at(-1).id}` : null }; }
  async entitlement({ principal }) { const user = await this.resolveUser(principal); const now = new Date(this.clock()); const quota = quotaDay(now); const state = await this.repository.entitlement({ principal, userId: user.id, quotaDay: quota }); const next = new Date(`${quota}T00:00:00.000Z`); next.setUTCDate(next.getUTCDate() + 1); return { ...state, eligibleToday: state.freeReadingAvailableToday, usedToday: !state.freeReadingAvailableToday, nextFreeAt: next.toISOString() }; }
}
module.exports = { TarotService, publicReading, validateInterpretation, fallbackInterpretation };
