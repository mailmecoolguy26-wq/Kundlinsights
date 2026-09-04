'use strict';
const { requiredString, canonicalTime, immutableCopy } = require('../persistence/contracts');
const { CAREER_PROFILE_UNLOCK_SKU: SKU } = require('./index');
function fail(code) { const error = new Error(code); error.code = code; throw error; }
class ProfileUnlockAssignmentService {
  constructor({ unitOfWork, idGenerator, clock } = {}) { this.unitOfWork = unitOfWork; this.idGenerator = idGenerator; this.clock = clock; }
  async assignInTransaction({ tx, userId, birthProfileId, purchaseRecordId } = {}) {
    userId = requiredString(userId, 'INVALID_USER_ID'); birthProfileId = requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); purchaseRecordId = requiredString(purchaseRecordId, 'INVALID_PURCHASE_ID');
    const purchase = await tx.purchases.findById(purchaseRecordId); if (!purchase) fail('PURCHASE_NOT_FOUND'); if (purchase.status !== 'VERIFIED') fail('PURCHASE_NOT_VERIFIED'); if (purchase.productId !== SKU) fail('PURCHASE_PRODUCT_UNSUPPORTED'); if (purchase.userId !== userId) fail('PURCHASE_OWNERSHIP_CONFLICT');
    const profile = await tx.birthProfiles.getBirthProfile(birthProfileId); if (!profile || profile.userId !== userId) fail('NOT_FOUND_OR_FORBIDDEN');
    const assigned = await tx.profileEntitlements.findByPurchaseRecordId(purchaseRecordId); if (assigned) { if (assigned.userId === userId && assigned.birthProfileId === birthProfileId && assigned.logicalSku === SKU) return assigned; fail('PURCHASE_ALREADY_ASSIGNED'); }
    const existing = await tx.profileEntitlements.findForProfile({ userId, birthProfileId, logicalSku: SKU }); if (existing) fail('PROFILE_ALREADY_UNLOCKED');
    const now = canonicalTime(this.clock(), 'INVALID_PROFILE_ENTITLEMENT_TIMESTAMP'); return tx.profileEntitlements.create({ id: this.idGenerator(), userId, birthProfileId, logicalSku: SKU, purchaseRecordId, unlockedAt: now, createdAt: now });
  }
  async assign({ userId, birthProfileId, purchaseRecordId } = {}) {
    return this.unitOfWork.run((tx) => this.assignInTransaction({ tx, userId, birthProfileId, purchaseRecordId }));
  }
}
module.exports = { ProfileUnlockAssignmentService, CAREER_PROFILE_UNLOCK_SKU: SKU };
