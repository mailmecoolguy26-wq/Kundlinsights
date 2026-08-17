'use strict';

const { READING_RECORD_SCHEMA_VERSION } = require('../../readings');
const { freeze } = require('../../synthesis/evidence-node');
const { fail, requiredString, canonicalTime, immutableCopy, compareCreatedAscending } = require('../contracts');

function status(value, code = 'INVALID_STATUS') { return requiredString(value, code); }
function nullableUtc(value, code) { return value === null || value === undefined ? null : canonicalTime(value, code); }
function nonNegativeInteger(value, code) { if (!Number.isInteger(value) || value < 0) fail(code); return value; }
function copyResult(value) { return immutableCopy(value); }
function birthData(value) {
  if (!value || typeof value !== 'object') fail('INVALID_BIRTH_DATA');
  const localDate = requiredString(value.localDate, 'INVALID_BIRTH_DATA');
  const localTime = requiredString(value.localTime, 'INVALID_BIRTH_DATA');
  const timezone = requiredString(value.timezone, 'INVALID_BIRTH_DATA');
  const utc = canonicalTime(value.utc, 'INVALID_BIRTH_DATA');
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90 || !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) fail('INVALID_BIRTH_DATA');
  if (!value.timezoneProvenance || typeof value.timezoneProvenance !== 'object') fail('INVALID_BIRTH_DATA');
  return immutableCopy({ localDate, localTime, timezone, utc, latitude: value.latitude, longitude: value.longitude, timezoneProvenance: value.timezoneProvenance }, 'INVALID_BIRTH_DATA');
}
function verifyReadingRecord(record) {
  if (!record || typeof record !== 'object' || record.schemaVersion !== READING_RECORD_SCHEMA_VERSION) fail('INVALID_READING_RECORD');
  requiredString(record.readingId, 'INVALID_READING_RECORD'); requiredString(record.engineProfileId, 'INVALID_READING_RECORD');
  if (!record.integrity || !record.integrity.calculation || !record.integrity.output) fail('INVALID_READING_RECORD');
  return immutableCopy(record, 'INVALID_READING_RECORD');
}

class InMemoryUserRepository {
  constructor() { this.users = new Map(); this.subjectIds = new Map(); }
  createUser(input = {}) { const id = requiredString(input.id, 'INVALID_USER_ID'); const authSubject = requiredString(input.authSubject, 'INVALID_AUTH_SUBJECT'); if (this.users.has(id)) fail('DUPLICATE_USER_ID'); if (this.subjectIds.has(authSubject)) fail('DUPLICATE_AUTH_SUBJECT'); const item = immutableCopy({ id, authSubject, status: status(input.status || 'active'), createdAt: canonicalTime(input.createdAt), updatedAt: canonicalTime(input.updatedAt || input.createdAt) }); this.users.set(id, item); this.subjectIds.set(authSubject, id); return copyResult(item); }
  getUser(id) { requiredString(id, 'INVALID_USER_ID'); const item = this.users.get(id); if (!item) fail('USER_NOT_FOUND'); return copyResult(item); }
  getUserByAuthSubject(authSubject) { authSubject = requiredString(authSubject, 'INVALID_AUTH_SUBJECT'); const id = this.subjectIds.get(authSubject); return id ? copyResult(this.users.get(id)) : null; }
  updateUserStatus(id, nextStatus, updatedAt) { const prior = this.getUser(id); const item = immutableCopy({ ...prior, status: status(nextStatus), updatedAt: canonicalTime(updatedAt) }); this.users.set(id, item); return copyResult(item); }
}

class InMemoryBirthProfileRepository {
  constructor() { this.profiles = new Map(); }
  createBirthProfile(input = {}) { const id = requiredString(input.id, 'INVALID_BIRTH_PROFILE_ID'); if (this.profiles.has(id)) fail('DUPLICATE_BIRTH_PROFILE_ID'); const item = immutableCopy({ id, userId: requiredString(input.userId, 'INVALID_USER_ID'), displayLabel: input.displayLabel === null || input.displayLabel === undefined ? null : requiredString(input.displayLabel, 'INVALID_DISPLAY_LABEL'), birthData: birthData(input.birthData), status: status(input.status || 'active'), createdAt: canonicalTime(input.createdAt), updatedAt: canonicalTime(input.updatedAt || input.createdAt), archivedAt: nullableUtc(input.archivedAt, 'INVALID_ARCHIVED_AT') }); this.profiles.set(id, item); return copyResult(item); }
  getBirthProfile(id) { requiredString(id, 'INVALID_BIRTH_PROFILE_ID'); const item = this.profiles.get(id); if (!item) fail('BIRTH_PROFILE_NOT_FOUND'); return copyResult(item); }
  listBirthProfilesForUser(userId) { requiredString(userId, 'INVALID_USER_ID'); return freeze([...this.profiles.values()].filter((item) => item.userId === userId).sort(compareCreatedAscending).map(copyResult)); }
  updateBirthProfile(id, changes = {}) { const prior = this.getBirthProfile(id); if ('userId' in changes || 'id' in changes || 'createdAt' in changes || 'archivedAt' in changes || 'status' in changes) fail('INVALID_BIRTH_PROFILE_UPDATE'); const item = immutableCopy({ ...prior, displayLabel: 'displayLabel' in changes ? (changes.displayLabel === null ? null : requiredString(changes.displayLabel, 'INVALID_DISPLAY_LABEL')) : prior.displayLabel, birthData: 'birthData' in changes ? birthData(changes.birthData) : prior.birthData, updatedAt: canonicalTime(changes.updatedAt) }); this.profiles.set(id, item); return copyResult(item); }
  archiveBirthProfile(id, archivedAt) { const prior = this.getBirthProfile(id); const item = immutableCopy({ ...prior, status: 'archived', archivedAt: canonicalTime(archivedAt, 'INVALID_ARCHIVED_AT'), updatedAt: canonicalTime(archivedAt, 'INVALID_ARCHIVED_AT') }); this.profiles.set(id, item); return copyResult(item); }
}

class InMemoryReadingRepository {
  constructor() { this.readings = new Map(); }
  insertReadingRecord(input = {}) { const record = verifyReadingRecord(input.record); const readingId = record.readingId; const userId = requiredString(input.userId, 'INVALID_USER_ID'); const idempotencyKey = input.idempotencyKey === null || input.idempotencyKey === undefined ? null : requiredString(input.idempotencyKey, 'INVALID_IDEMPOTENCY_KEY'); if (this.readings.has(readingId)) fail('DUPLICATE_READING_ID'); if (idempotencyKey && [...this.readings.values()].some((item) => item.userId === userId && item.idempotencyKey === idempotencyKey)) fail('DUPLICATE_READING_IDEMPOTENCY_KEY'); const item = immutableCopy({ readingId, userId, birthProfileId: input.birthProfileId === null || input.birthProfileId === undefined ? null : requiredString(input.birthProfileId, 'INVALID_BIRTH_PROFILE_ID'), status: status(input.status || 'active'), archivedAt: nullableUtc(input.archivedAt, 'INVALID_ARCHIVED_AT'), idempotencyKey, record }); this.readings.set(readingId, item); return copyResult(item); }
  getReadingRecord(readingId) { requiredString(readingId, 'INVALID_READING_ID'); const item = this.readings.get(readingId); if (!item) fail('READING_NOT_FOUND'); return copyResult(item); }
  getReadingRecordByIdempotencyKey(userId, idempotencyKey) { userId = requiredString(userId, 'INVALID_USER_ID'); idempotencyKey = requiredString(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY'); const item = [...this.readings.values()].find((value) => value.userId === userId && value.idempotencyKey === idempotencyKey); return item ? copyResult(item) : null; }
  listReadingRecordsForUser(userId) { requiredString(userId, 'INVALID_USER_ID'); return freeze([...this.readings.values()].filter((item) => item.userId === userId).sort((a, b) => Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt) || a.readingId.localeCompare(b.readingId)).map(copyResult)); }
  listReadingRecordsForBirthProfile(birthProfileId) { requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); return freeze([...this.readings.values()].filter((item) => item.birthProfileId === birthProfileId).sort((a, b) => Date.parse(b.record.createdAt) - Date.parse(a.record.createdAt) || a.readingId.localeCompare(b.readingId)).map(copyResult)); }
  archiveReadingRecord(readingId, archivedAt) { const prior = this.getReadingRecord(readingId); const item = immutableCopy({ ...prior, status: 'archived', archivedAt: canonicalTime(archivedAt, 'INVALID_ARCHIVED_AT') }); this.readings.set(readingId, item); return copyResult(item); }
}

class InMemoryEntitlementRepository {
  constructor() { this.entitlements = new Map(); }
  createEntitlement(input = {}) { const id = requiredString(input.id, 'INVALID_ENTITLEMENT_ID'); if (this.entitlements.has(id)) fail('DUPLICATE_ENTITLEMENT_ID'); const validFrom = canonicalTime(input.validFrom, 'INVALID_ENTITLEMENT_VALIDITY'); const validUntil = nullableUtc(input.validUntil, 'INVALID_ENTITLEMENT_VALIDITY'); if (validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) fail('INVALID_ENTITLEMENT_VALIDITY'); const item = immutableCopy({ id, userId: requiredString(input.userId, 'INVALID_USER_ID'), productKey: requiredString(input.productKey, 'INVALID_PRODUCT_KEY'), status: status(input.status || 'active'), quantity: nonNegativeInteger(input.quantity, 'INVALID_ENTITLEMENT_QUANTITY'), validFrom, validUntil, sourcePaymentTransactionId: input.sourcePaymentTransactionId === null || input.sourcePaymentTransactionId === undefined ? null : requiredString(input.sourcePaymentTransactionId, 'INVALID_PAYMENT_TRANSACTION_ID') }); this.entitlements.set(id, item); return copyResult(item); }
  getEntitlement(id) { requiredString(id, 'INVALID_ENTITLEMENT_ID'); const item = this.entitlements.get(id); if (!item) fail('ENTITLEMENT_NOT_FOUND'); return copyResult(item); }
  listActiveEntitlementsForUser(userId, evaluationTime) { const at = Date.parse(canonicalTime(evaluationTime, 'INVALID_EVALUATION_TIME')); requiredString(userId, 'INVALID_USER_ID'); return freeze([...this.entitlements.values()].filter((item) => item.userId === userId && item.status === 'active' && item.quantity > 0 && Date.parse(item.validFrom) <= at && (!item.validUntil || at < Date.parse(item.validUntil))).sort((a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom) || a.id.localeCompare(b.id)).map(copyResult)); }
  consumeEntitlement(id, evaluationTime) { const item = this.getEntitlement(id); const at = Date.parse(canonicalTime(evaluationTime, 'INVALID_EVALUATION_TIME')); if (item.status !== 'active') fail('ENTITLEMENT_INACTIVE'); if (Date.parse(item.validFrom) > at || (item.validUntil && at >= Date.parse(item.validUntil))) fail('ENTITLEMENT_EXPIRED'); if (item.quantity === 0) fail('ENTITLEMENT_EXHAUSTED'); const next = immutableCopy({ ...item, quantity: item.quantity - 1 }); this.entitlements.set(id, next); return copyResult(next); }
}

class InMemoryPaymentRepository {
  constructor() { this.payments = new Map(); this.byProviderTransaction = new Map(); }
  insertPaymentTransaction(input = {}) { const id = requiredString(input.id, 'INVALID_PAYMENT_TRANSACTION_ID'); const provider = requiredString(input.provider, 'INVALID_PAYMENT_PROVIDER'); const providerTransactionId = requiredString(input.providerTransactionId, 'INVALID_PROVIDER_TRANSACTION_ID'); const key = `${provider}\u0000${providerTransactionId}`; if (this.payments.has(id)) fail('DUPLICATE_PAYMENT_TRANSACTION_ID'); if (this.byProviderTransaction.has(key)) fail('DUPLICATE_PROVIDER_TRANSACTION'); if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0 || typeof input.currency !== 'string' || !/^[A-Z]{3}$/.test(input.currency)) fail('INVALID_PAYMENT_AMOUNT'); const item = immutableCopy({ id, userId: requiredString(input.userId, 'INVALID_USER_ID'), provider, providerTransactionId, status: status(input.status || 'created'), amountMinor: input.amountMinor, currency: input.currency, createdAt: canonicalTime(input.createdAt), updatedAt: canonicalTime(input.updatedAt || input.createdAt) }); this.payments.set(id, item); this.byProviderTransaction.set(key, id); return copyResult(item); }
  getPaymentTransaction(id) { requiredString(id, 'INVALID_PAYMENT_TRANSACTION_ID'); const item = this.payments.get(id); if (!item) fail('PAYMENT_TRANSACTION_NOT_FOUND'); return copyResult(item); }
  findByProviderTransactionId(provider, providerTransactionId) { const key = `${requiredString(provider, 'INVALID_PAYMENT_PROVIDER')}\u0000${requiredString(providerTransactionId, 'INVALID_PROVIDER_TRANSACTION_ID')}`; const id = this.byProviderTransaction.get(key); if (!id) return null; return copyResult(this.payments.get(id)); }
}

module.exports = { InMemoryUserRepository, InMemoryBirthProfileRepository, InMemoryReadingRepository, InMemoryEntitlementRepository, InMemoryPaymentRepository };
