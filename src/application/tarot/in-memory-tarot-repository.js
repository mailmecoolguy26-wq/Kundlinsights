'use strict';

function clone(value) { return value == null ? value : structuredClone(value); }
class InMemoryTarotRepository {
  constructor({ paidCredits = {} } = {}) { this.readings = new Map(); this.creationKeys = new Map(); this.selectionKeys = new Map(); this.freeDays = new Set(); this.creditBalances = new Map(Object.entries(paidCredits)); }
  async createWithEntitlement(input) {
    const creationKey = `${input.userId}:${input.idempotencyKey}`;
    const priorId = this.creationKeys.get(creationKey);
    if (priorId) return { reading: clone(this.readings.get(priorId)), created: false };
    const freeKey = `${input.userId}:${input.quotaDay}`;
    let entitlementSource;
    if (!this.freeDays.has(freeKey)) { this.freeDays.add(freeKey); entitlementSource = 'FREE_DAILY'; }
    else {
      const balance = this.creditBalances.get(input.userId) || 0;
      if (balance < 1) return { purchaseRequired: true };
      this.creditBalances.set(input.userId, balance - 1); entitlementSource = 'PAID_CREDIT';
    }
    const reading = { ...clone(input), entitlementSource, status: 'DRAWING', selectedCards: [], interpretation: null, interpretationVersion: null, completedAt: null };
    this.readings.set(reading.id, reading); this.creationKeys.set(creationKey, reading.id);
    return { reading: clone(reading), created: true };
  }
  async selectCard({ userId, readingId, token, idempotencyKey, selectedAt }) {
    const key = `${readingId}:${idempotencyKey}`;
    if (this.selectionKeys.has(key)) { const prior = clone(this.selectionKeys.get(key)); prior.reading = clone(this.readings.get(readingId)); prior.needsInterpretation = false; return prior; }
    const reading = this.readings.get(readingId);
    if (!reading || reading.userId !== userId) { const error = new Error(); error.code = 'TAROT_READING_NOT_FOUND'; throw error; }
    if (reading.selectedCards.length >= 3) { const error = new Error(); error.code = 'TAROT_READING_COMPLETE'; throw error; }
    const hidden = reading.deck.find((entry) => entry.token === token);
    if (!hidden || reading.selectedCards.some((card) => card.token === token)) { const error = new Error(); error.code = 'INVALID_TAROT_SELECTION'; throw error; }
    const selected = { token, cardId: hidden.cardId, position: reading.selectedCards.length + 1, orientation: 'UPRIGHT', selectedAt };
    reading.selectedCards.push(selected); reading.status = reading.selectedCards.length === 3 ? 'INTERPRETING' : 'DRAWING'; reading.updatedAt = selectedAt;
    const result = { reading: clone(reading), selectedCard: clone(selected), needsInterpretation: reading.status === 'INTERPRETING' };
    this.selectionKeys.set(key, result); return clone(result);
  }
  async get({ userId, readingId }) { const reading = this.readings.get(readingId); if (!reading || reading.userId !== userId) { const error = new Error(); error.code = 'TAROT_READING_NOT_FOUND'; throw error; } return clone(reading); }
  async list({ userId, limit = 20, cursor = null }) { return [...this.readings.values()].filter((r) => r.userId === userId && !r.deletedAt && (!cursor || `${r.createdAt}:${r.id}` < cursor)).sort((a,b) => `${b.createdAt}:${b.id}`.localeCompare(`${a.createdAt}:${a.id}`)).slice(0, limit).map(clone); }
  async finalize({ userId, readingId, interpretation, interpretationVersion, completedAt }) { const reading = await this.get({ userId, readingId }); const stored = this.readings.get(reading.id); if (stored.status === 'COMPLETED') return clone(stored); stored.status = 'COMPLETED'; stored.interpretation = clone(interpretation); stored.interpretationVersion = interpretationVersion; stored.completedAt = completedAt; stored.updatedAt = completedAt; return clone(stored); }
  async markRetryable({ userId, readingId, updatedAt }) { const reading = await this.get({ userId, readingId }); const stored = this.readings.get(reading.id); if (stored.status !== 'COMPLETED') stored.status = 'INTERPRETATION_RETRYABLE'; stored.updatedAt = updatedAt; return clone(stored); }
  async beginRetry({ userId, readingId, updatedAt }) { const reading = await this.get({ userId, readingId }); const stored = this.readings.get(reading.id); if (stored.status !== 'INTERPRETATION_RETRYABLE') { const error = new Error(); error.code = 'TAROT_INTERPRETATION_NOT_RETRYABLE'; throw error; } stored.status = 'INTERPRETING'; stored.updatedAt = updatedAt; return clone(stored); }
  async entitlement({ userId, quotaDay }) { return { freeReadingAvailableToday: !this.freeDays.has(`${userId}:${quotaDay}`), paidCreditsRemaining: this.creditBalances.get(userId) || 0 }; }
  async grantCredits({ userId, quantity }) { this.creditBalances.set(userId, (this.creditBalances.get(userId) || 0) + quantity); }
}
module.exports = { InMemoryTarotRepository };
