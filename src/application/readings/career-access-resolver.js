'use strict';
const { immutableCopy, requiredString, canonicalTime } = require('../../persistence/contracts');
const { CAREER_PROFILE_UNLOCK_SKU, CAREER_PREMIUM_ENTITLEMENT, CAREER_PREMIUM_SUBSCRIPTION_SKUS } = require('../../payment');
function usableSubscription(item, userId, birthProfileId, at) {
  if (!item || item.userId !== userId || item.birthProfileId !== birthProfileId || (item.entitlementKey != null ? item.entitlementKey !== CAREER_PREMIUM_ENTITLEMENT : !CAREER_PREMIUM_SUBSCRIPTION_SKUS.includes(item.productId))) return false;
  const instant = Date.parse(at); const from = Date.parse(item.validFrom); const until = Date.parse(item.validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > instant || instant >= until) return false;
  if (item.status === 'ACTIVE' || item.status === 'CANCELED') return true;
  return item.status === 'GRACE_PERIOD' && (!item.graceUntil || instant < Date.parse(item.graceUntil));
}
class CareerAccessResolver {
  async purchaseModeForProfile({ repositories, userId, birthProfileId, at } = {}) {
    const subscriptions = repositories.subscriptions && typeof repositories.subscriptions.listForUser === 'function' ? await repositories.subscriptions.listForUser(userId) : [];
    const hasPrimaryElsewhere = subscriptions.some((item) => item.birthProfileId !== birthProfileId && item.entitlementSource === 'PRIMARY_SUBSCRIPTION' && usableSubscription(item, userId, item.birthProfileId, at));
    return hasPrimaryElsewhere ? 'ADDON' : 'PRIMARY_SUBSCRIPTION';
  }
  async resolveSubscription({ repositories, userId, birthProfileId, at } = {}) {
    requiredString(userId, 'INVALID_USER_ID'); requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); const instant = canonicalTime(at, 'INVALID_EVALUATION_TIME');
    const subscriptions = repositories.subscriptions && typeof repositories.subscriptions.listForUser === 'function' ? await repositories.subscriptions.listForUser(userId) : [];
    const chosen = subscriptions.filter((item) => usableSubscription(item, userId, birthProfileId, instant)).sort((a, b) => Date.parse(b.providerEventTime || 0) - Date.parse(a.providerEventTime || 0) || Date.parse(b.validUntil) - Date.parse(a.validUntil) || a.id.localeCompare(b.id))[0];
    return chosen ? immutableCopy({ eligible: true, mode: 'SUBSCRIPTION', sourceId: chosen.id, entitlementKey: CAREER_PREMIUM_ENTITLEMENT, entitlementSource: chosen.entitlementSource, planKey: chosen.productId, birthProfileId: chosen.birthProfileId, validUntil: chosen.validUntil, subscriptionStatus: chosen.status, remainingQuantity: null }) : null;
  }
  async resolveForProfile({ repositories, userId, birthProfileId, at } = {}) {
    requiredString(userId, 'INVALID_USER_ID'); requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); const instant = canonicalTime(at, 'INVALID_EVALUATION_TIME');
    const profile = repositories.birthProfiles && typeof repositories.birthProfiles.getBirthProfile === 'function' ? await repositories.birthProfiles.getBirthProfile(birthProfileId) : null; if (repositories.birthProfiles && (!profile || profile.userId !== userId)) { const error = new Error('NOT_FOUND_OR_FORBIDDEN'); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; }
    const subscription = await this.resolveSubscription({ repositories, userId, birthProfileId, at: instant });
    if (subscription) return immutableCopy({ ...subscription, consuming: false, purchaseMode: null });
    const unlock = repositories.profileEntitlements && await repositories.profileEntitlements.findForProfile({ userId, birthProfileId, logicalSku: CAREER_PROFILE_UNLOCK_SKU });
    if (unlock) return immutableCopy({ eligible: true, mode: 'LEGACY_PROFILE_UNLOCK', consuming: false, sourceId: unlock.id, entitlementKey: CAREER_PREMIUM_ENTITLEMENT, entitlementSource: 'LEGACY_PROFILE_UNLOCK', planKey: null, birthProfileId, validUntil: null, subscriptionStatus: null, remainingQuantity: null, purchaseMode: null });
    const credit = (await repositories.entitlements.listActiveEntitlementsForUser(userId, instant)).find((item) => item.productKey === 'CAREER');
    return credit ? immutableCopy({ eligible: true, mode: 'CREDIT', consuming: true, sourceId: credit.id, entitlementKey: null, entitlementSource: null, planKey: null, birthProfileId, validUntil: credit.validUntil == null ? null : credit.validUntil, subscriptionStatus: null, remainingQuantity: Number.isInteger(credit.quantity) ? credit.quantity : null, purchaseMode: null }) : immutableCopy({ eligible: false, mode: 'NONE', consuming: false, sourceId: null, entitlementKey: CAREER_PREMIUM_ENTITLEMENT, entitlementSource: null, planKey: null, birthProfileId, validUntil: null, subscriptionStatus: null, remainingQuantity: null, purchaseMode: await this.purchaseModeForProfile({ repositories, userId, birthProfileId, at: instant }) });
  }
  async resolve({ repositories, userId, at } = {}) {
    requiredString(userId, 'INVALID_USER_ID'); const instant = canonicalTime(at, 'INVALID_EVALUATION_TIME');
    const credit = (await repositories.entitlements.listActiveEntitlementsForUser(userId, instant)).find((item) => item.productKey === 'CAREER');
    return credit ? immutableCopy({ eligible: true, mode: 'CREDIT', consuming: true, sourceId: credit.id, entitlementKey: null, planKey: null, birthProfileId: null, validUntil: credit.validUntil == null ? null : credit.validUntil, subscriptionStatus: null, remainingQuantity: Number.isInteger(credit.quantity) ? credit.quantity : null }) : immutableCopy({ eligible: false, mode: 'NONE', consuming: false, sourceId: null, entitlementKey: null, planKey: null, birthProfileId: null, validUntil: null, subscriptionStatus: null, remainingQuantity: null });
  }
}
module.exports = { CareerAccessResolver, usableSubscription, CAREER_PREMIUM_SKU: 'career_premium_annual' };
