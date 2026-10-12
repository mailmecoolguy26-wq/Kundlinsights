'use strict';
const { repositoryError, immutableCopy } = require('../persistence/contracts');
const { getProduct, CAREER_PROFILE_UNLOCK_SKU } = require('./index');
const { ProfileUnlockAssignmentService } = require('./profile-unlock-assignment-service');
function fail(code) { throw repositoryError(code); }
class PurchaseProviderRegistry { constructor(adapters = {}) { this.adapters = adapters; } resolve(provider) { const adapter = this.adapters[provider]; if (!adapter) fail('PURCHASE_PROVIDER_UNSUPPORTED'); return adapter; } }
class FakePurchaseProvider {
  constructor({ enabled = process.env.NODE_ENV !== 'production' } = {}) { this.enabled = enabled; }
  async verify({ provider, environment, productId, evidence }) { if (!this.enabled) fail('PURCHASE_PROVIDER_UNSUPPORTED'); if (!evidence || evidence.kind !== 'FAKE_PURCHASE' || typeof evidence.transactionId !== 'string') fail('PURCHASE_EVIDENCE_INVALID'); return { provider, environment, productId, providerTransactionId: evidence.transactionId, originalTransactionId: evidence.originalTransactionId || evidence.transactionId, status: evidence.status || 'ACTIVE', purchasedAt: evidence.purchasedAt, validFrom: evidence.validFrom, validUntil: evidence.validUntil, providerEventTime: evidence.providerEventTime || evidence.purchasedAt }; }
  async restore(input) { if (!Array.isArray(input.evidence && input.evidence.items)) fail('PURCHASE_RESTORE_FAILED'); return Promise.all(input.evidence.items.map((evidence) => this.verify({ ...input, evidence })) ); }
}
class PurchaseVerificationService {
  constructor({ authUserResolver, repositories, unitOfWork = null, registry, careerAccessResolver, profileUnlockAssignmentService = null, idGenerator, clock, analytics = null } = {}) { this.authUserResolver = authUserResolver; this.repositories = repositories; this.unitOfWork = unitOfWork; this.registry = registry; this.careerAccessResolver = careerAccessResolver; this.profileUnlockAssignmentService = profileUnlockAssignmentService || new ProfileUnlockAssignmentService({ unitOfWork, idGenerator, clock }); this.idGenerator = idGenerator; this.clock = clock; this.analytics = analytics; }
  async persistVerified({ principal, normalized, birthProfileId = null, isRestore = false }) { return this.persistVerifiedForUser({ user: await this.authUserResolver(principal), normalized, birthProfileId, isRestore }); }
  async reconcileRazorpayCareerPremiumProfileEntitlement({ user, birthProfileId, purchaseRecordId, transaction } = {}) {
    if (!user || typeof user.id !== 'string' || !user.id) fail('INVALID_USER_ID');
    if (typeof birthProfileId !== 'string' || !birthProfileId) fail('INVALID_BIRTH_PROFILE_ID');
    if (!transaction) fail('INVALID_PAYMENT_TRANSACTION');
    return this.profileUnlockAssignmentService.assignInTransaction({
      tx: transaction,
      userId: user.id,
      birthProfileId,
      purchaseRecordId,
      purchaseProductId: 'career_premium_annual',
    });
  }
  async persistVerifiedForUser({ user, normalized, birthProfileId = null, transaction = null, createRazorpayProfileEntitlement = false, isRestore = false }) { if (!user || typeof user.id !== 'string' || !user.id) fail('INVALID_USER_ID'); let product; try { product = getProduct(normalized.productId); } catch { fail('PURCHASE_PRODUCT_UNSUPPORTED'); } const repos = this.repositories(); const alreadyPersisted = await repos.purchases.findByProviderTransaction({ provider: normalized.provider, environment: normalized.environment, providerTransactionId: normalized.providerTransactionId }); const existingSubscription = normalized.originalTransactionId == null ? null : await repos.subscriptions.findByProviderOriginalTransaction({ provider: normalized.provider, environment: normalized.environment, originalTransactionId: normalized.originalTransactionId }); const now = this.clock();
    // Add-ons are one-time provider purchases. Their duration is server-side
    // and extends the exact linked profile from max(now, current validUntil).
    if (product.kind === 'ADDON_TIMED') { if (typeof birthProfileId !== 'string' || !birthProfileId) fail('INVALID_BIRTH_PROFILE_ID'); if (!alreadyPersisted) { const all = await repos.subscriptions.listForUser(user.id); const previous = all.filter((item) => item.birthProfileId === birthProfileId && item.entitlementKey === product.entitlementKey && ['ACTIVE', 'GRACE_PERIOD', 'CANCELED'].includes(item.status)).sort((a,b) => Date.parse(b.validUntil) - Date.parse(a.validUntil))[0]; const start = previous && Date.parse(previous.validUntil) > Date.parse(now) ? previous.validUntil : now; const untilDate = new Date(start); untilDate.setUTCMonth(untilDate.getUTCMonth() + product.billingMonths); normalized = { ...normalized, validFrom: start, validUntil: untilDate.toISOString(), status: 'ACTIVE' }; } }
    const persistPurchase = async (tx) => tx.purchases.insert({ id: this.idGenerator(), userId: user.id, provider: normalized.provider, environment: normalized.environment, productId: product.logicalSku, providerTransactionId: normalized.providerTransactionId, originalTransactionId: normalized.originalTransactionId, status: 'VERIFIED', purchasedAt: normalized.purchasedAt, validFrom: normalized.validFrom, validUntil: normalized.validUntil, verifiedAt: now, createdAt: now });
    if (product.logicalSku === CAREER_PROFILE_UNLOCK_SKU) {
      if (typeof birthProfileId !== 'string' || !birthProfileId) fail('INVALID_BIRTH_PROFILE_ID');
      const persist = async (tx) => { const purchase = await persistPurchase(tx); const entitlement = await this.profileUnlockAssignmentService.assignInTransaction({ tx, userId: user.id, birthProfileId, purchaseRecordId: purchase.id }); return { purchase, entitlement }; };
      const { purchase, entitlement } = transaction ? await persist(transaction) : this.unitOfWork ? await this.unitOfWork.run(persist) : await persist(repos);
      const access = await this.careerAccessResolver.resolveForProfile({ repositories: repos, userId: user.id, birthProfileId, at: now });
      return this._recordVerified(immutableCopy({ purchase: { id: purchase.id, provider: purchase.provider, environment: purchase.environment, logicalProductSku: purchase.productId, productId: purchase.productId, status: purchase.status, purchasedAt: purchase.purchasedAt, validFrom: purchase.validFrom, validUntil: purchase.validUntil }, profileEntitlement: { id: entitlement.id, birthProfileId: entitlement.birthProfileId, logicalSku: entitlement.logicalSku }, entitlement: { career: { eligible: access.eligible, mode: access.mode, consuming: access.consuming, validUntil: access.validUntil } } }), { user, alreadyPersisted, isRestore });
    }
    const razorpayCareerPremiumProfileEntitlement = createRazorpayProfileEntitlement === true && normalized.provider === 'RAZORPAY' && product.logicalSku === 'career_premium_annual';
    if (razorpayCareerPremiumProfileEntitlement) {
      if (typeof birthProfileId !== 'string' || !birthProfileId) fail('INVALID_BIRTH_PROFILE_ID');
      const persist = async (tx) => {
        const purchase = await persistPurchase(tx);
        const subscription = await tx.subscriptions.upsertVerifiedState({ id: this.idGenerator(), userId: user.id, birthProfileId, provider: normalized.provider, environment: normalized.environment, productId: product.logicalSku, providerProductId: normalized.providerProductId || null, entitlementKey: product.entitlementKey, originalTransactionId: normalized.originalTransactionId, status: normalized.status, validFrom: normalized.validFrom, validUntil: normalized.validUntil, latestPurchaseRecordId: purchase.id, providerEventTime: normalized.providerEventTime, createdAt: now });
        const entitlement = await this.profileUnlockAssignmentService.assignInTransaction({ tx, userId: user.id, birthProfileId, purchaseRecordId: purchase.id, purchaseProductId: product.logicalSku });
        return { purchase, subscription, entitlement };
      };
      const { purchase, subscription, entitlement } = transaction ? await persist(transaction) : this.unitOfWork ? await this.unitOfWork.run(persist) : await persist(repos);
      const access = await this.careerAccessResolver.resolveForProfile({ repositories: repos, userId: user.id, birthProfileId, at: now });
      return this._recordVerified(immutableCopy({ purchase: { id: purchase.id, provider: purchase.provider, environment: purchase.environment, logicalProductSku: purchase.productId, productId: purchase.productId, status: purchase.status, purchasedAt: purchase.purchasedAt, validFrom: purchase.validFrom, validUntil: purchase.validUntil }, subscription: { status: subscription.status, validFrom: subscription.validFrom, validUntil: subscription.validUntil }, profileEntitlement: { id: entitlement.id, birthProfileId: entitlement.birthProfileId, logicalSku: entitlement.logicalSku }, entitlement: { career: { eligible: access.eligible, mode: access.mode, consuming: access.consuming, validUntil: access.validUntil } } }), { user, alreadyPersisted, isRestore });
    }
    let linkedBirthProfileId = birthProfileId;
    if (product.entitlementKey) {
      if (isRestore) {
        if (!existingSubscription || !existingSubscription.birthProfileId) fail('SUBSCRIPTION_PROFILE_RECONCILIATION_REQUIRED');
        if (existingSubscription.userId !== user.id) fail('PURCHASE_OWNERSHIP_CONFLICT');
        linkedBirthProfileId = existingSubscription.birthProfileId;
      } else if (!product.legacy) {
        if (typeof linkedBirthProfileId !== 'string' || !linkedBirthProfileId) fail('INVALID_BIRTH_PROFILE_ID');
        if (existingSubscription && existingSubscription.userId !== user.id) fail('PURCHASE_OWNERSHIP_CONFLICT');
        if (existingSubscription && existingSubscription.birthProfileId && existingSubscription.birthProfileId !== linkedBirthProfileId) fail('SUBSCRIPTION_PROFILE_IMMUTABLE');
      }
    }
    const assertOwnedProfile = async (tx, profileId) => {
      if (!profileId || !tx.birthProfiles || typeof tx.birthProfiles.getBirthProfile !== 'function') return;
      const profile = await tx.birthProfiles.getBirthProfile(profileId);
      if (!profile || profile.userId !== user.id) fail('NOT_FOUND_OR_FORBIDDEN');
    };
    const persist = async (tx) => {
      if (linkedBirthProfileId) await assertOwnedProfile(tx, linkedBirthProfileId);
      const purchase = await persistPurchase(tx);
      const subscription = await tx.subscriptions.upsertVerifiedState({ id: this.idGenerator(), userId: user.id, birthProfileId: linkedBirthProfileId, provider: normalized.provider, environment: normalized.environment, productId: product.logicalSku, providerProductId: normalized.providerProductId || null, entitlementKey: product.entitlementKey, entitlementSource: product.entitlementSource, originalTransactionId: normalized.originalTransactionId, status: normalized.status, validFrom: normalized.validFrom, validUntil: normalized.validUntil, autoRenewEnabled: normalized.autoRenewEnabled == null ? null : normalized.autoRenewEnabled, latestPurchaseRecordId: purchase.id, providerEventTime: normalized.providerEventTime, createdAt: now });
      return { purchase, subscription };
    };
    const { purchase, subscription } = transaction ? await persist(transaction) : this.unitOfWork ? await this.unitOfWork.run(persist) : await persist(repos);
    const access = linkedBirthProfileId ? await this.careerAccessResolver.resolveForProfile({ repositories: repos, userId: user.id, birthProfileId: linkedBirthProfileId, at: now }) : await this.careerAccessResolver.resolve({ repositories: repos, userId: user.id, at: now });
    return this._recordVerified(immutableCopy({ purchase: { id: purchase.id, provider: purchase.provider, environment: purchase.environment, logicalProductSku: purchase.productId, productId: purchase.productId, status: purchase.status, purchasedAt: purchase.purchasedAt, validFrom: purchase.validFrom, validUntil: purchase.validUntil }, subscription: { birthProfileId: subscription.birthProfileId, status: subscription.status, validFrom: subscription.validFrom, validUntil: subscription.validUntil, entitlementSource: subscription.entitlementSource }, entitlement: { career: { eligible: access.eligible, mode: access.mode, validUntil: access.validUntil } } }), { user, alreadyPersisted, isRestore }); }
  async verify({ principal, body }) { return this.persistVerified({ principal, normalized: await this.registry.resolve(body.provider).verify(body), birthProfileId: body.birthProfileId, isRestore: body.isRestore === true }); }
  async restore({ principal, body }) { const values = await this.registry.resolve(body.provider).restore(body); const restored = []; for (const normalized of values) restored.push(await this.persistVerified({ principal, normalized, birthProfileId: body.birthProfileId, isRestore: true })); return { restored }; }
  async _recordVerified(result, { user, alreadyPersisted, isRestore }) { if (!alreadyPersisted && !isRestore && this.analytics) { try { await this.analytics.record('purchase_completed', { user_id: user.id, birth_profile_id: result.profileEntitlement && result.profileEntitlement.birthProfileId, sku: result.purchase.logicalProductSku, payment_provider: result.purchase.provider, product_type: 'career_premium' }); if (result.profileEntitlement) await this.analytics.record('career_unlocked', { user_id: user.id, birth_profile_id: result.profileEntitlement.birthProfileId, sku: result.profileEntitlement.logicalSku, product_type: 'career_premium' }); } catch (_) {} } return result; }
  async list({ principal }) { const user = await this.authUserResolver(principal); return (await this.repositories().purchases.listForUser(user.id)).map((p) => ({ provider: p.provider, logicalProductSku: p.productId, status: p.status, purchasedAt: p.purchasedAt, validFrom: p.validFrom, validUntil: p.validUntil })); }
}
module.exports = { PurchaseProviderRegistry, FakePurchaseProvider, PurchaseVerificationService };
