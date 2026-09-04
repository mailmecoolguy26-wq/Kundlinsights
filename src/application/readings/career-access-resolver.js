'use strict';
const { immutableCopy, requiredString, canonicalTime } = require('../../persistence/contracts');
const { CAREER_PROFILE_UNLOCK_SKU } = require('../../payment');
const CAREER_PREMIUM_SKU = 'career_premium_annual';
function usableSubscription(item, userId, at) {
  if (!item || item.userId !== userId || item.productId !== CAREER_PREMIUM_SKU) return false;
  const instant = Date.parse(at); const from = Date.parse(item.validFrom); const until = Date.parse(item.validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > instant || instant >= until) return false;
  if (item.status === 'ACTIVE' || item.status === 'CANCELED') return true;
  return item.status === 'GRACE_PERIOD' && (!item.graceUntil || instant < Date.parse(item.graceUntil));
}
class CareerAccessResolver {
  async resolveForProfile({ repositories, userId, birthProfileId, at } = {}) {
    requiredString(userId, 'INVALID_USER_ID'); requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); const instant = canonicalTime(at, 'INVALID_EVALUATION_TIME');
    const profile = await repositories.birthProfiles.getBirthProfile(birthProfileId); if (!profile || profile.userId !== userId) { const error = new Error('NOT_FOUND_OR_FORBIDDEN'); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; }
    const unlock = repositories.profileEntitlements && await repositories.profileEntitlements.findForProfile({ userId, birthProfileId, logicalSku: CAREER_PROFILE_UNLOCK_SKU });
    if (unlock) return immutableCopy({ eligible: true, mode: 'PROFILE_UNLOCK', consuming: false, sourceId: unlock.id, validUntil: null, remainingQuantity: null });
    const credit = (await repositories.entitlements.listActiveEntitlementsForUser(userId, instant)).find((item) => item.productKey === 'CAREER');
    return credit ? immutableCopy({ eligible: true, mode: 'CREDIT', consuming: true, sourceId: credit.id, validUntil: credit.validUntil == null ? null : credit.validUntil, remainingQuantity: Number.isInteger(credit.quantity) ? credit.quantity : null }) : immutableCopy({ eligible: false, mode: 'NONE', consuming: false, sourceId: null, validUntil: null, remainingQuantity: null });
  }
  async resolve({ repositories, userId, at } = {}) {
    requiredString(userId, 'INVALID_USER_ID'); const instant = canonicalTime(at, 'INVALID_EVALUATION_TIME');
    const subscriptions = repositories.subscriptions && typeof repositories.subscriptions.listForUser === 'function' ? await repositories.subscriptions.listForUser(userId) : [];
    const chosen = subscriptions.filter((item) => usableSubscription(item, userId, instant)).sort((a, b) => Date.parse(b.validUntil) - Date.parse(a.validUntil) || a.id.localeCompare(b.id))[0];
    if (chosen) return immutableCopy({ eligible: true, mode: 'SUBSCRIPTION', consuming: false, sourceId: chosen.id, validUntil: chosen.validUntil, remainingQuantity: null });
    const credit = (await repositories.entitlements.listActiveEntitlementsForUser(userId, instant)).find((item) => item.productKey === 'CAREER');
    return credit ? immutableCopy({ eligible: true, mode: 'CREDIT', consuming: true, sourceId: credit.id, validUntil: credit.validUntil == null ? null : credit.validUntil, remainingQuantity: Number.isInteger(credit.quantity) ? credit.quantity : null }) : immutableCopy({ eligible: false, mode: 'NONE', consuming: false, sourceId: null, validUntil: null, remainingQuantity: null });
  }
}
module.exports = { CareerAccessResolver, usableSubscription, CAREER_PREMIUM_SKU };
