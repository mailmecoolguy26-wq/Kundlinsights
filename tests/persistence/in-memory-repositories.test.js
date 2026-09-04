'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REPOSITORY_CONTRACTS, InMemoryUserRepository, InMemoryBirthProfileRepository, InMemoryReadingRepository,
  InMemoryEntitlementRepository, InMemoryPaymentRepository,
} = require('../../src/persistence');

const T0 = '2026-01-01T00:00:00.000Z'; const T1 = '2026-01-02T00:00:00.000Z'; const T2 = '2026-01-03T00:00:00.000Z';
function birthData(localTime = '13:40:00') { return { localDate: '1990-11-26', localTime, timezone: 'Asia/Kolkata', utc: '1990-11-26T08:10:00.000Z', latitude: 17.385, longitude: 78.4867, timezoneProvenance: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'abc' } }; }
function record(readingId, createdAt = T0, profile = 'kundlinsights-vedic-engine-profile-v2') { return { schemaVersion: 'kundlinsights-reading-record-v1', readingId, domain: 'CAREER', createdAt, engineProfileId: profile, input: { birth: birthData(), readingInstant: T1, transitScanRange: null, locale: 'en-IN' }, provenance: { timezone: { datasetVersion: '2026c' }, dasha: { dashaRulesetId: profile.endsWith('v1') ? 'vimshottari-longitude-proportional-savana-360-v1' : 'vimshottari-longitude-proportional-solar-return-v1' } }, reading: { structured: { key: readingId } }, renderedReading: { text: readingId }, integrity: { calculation: { algorithm: 'sha256', digest: 'same-calculation-digest' }, output: { algorithm: 'sha256', digest: `output-${readingId}` }, rendered: { algorithm: 'sha256', digest: `render-${readingId}` } } }; }
function throwsCode(fn, code) { assert.throws(fn, (error) => error && error.code === code); }

test('declares the narrow storage-agnostic repository contracts', () => {
  assert.deepEqual(Object.keys(REPOSITORY_CONTRACTS), ['UserRepository', 'BirthProfileRepository', 'ReadingRepository', 'EntitlementRepository', 'PaymentRepository', 'PurchaseRepository', 'SubscriptionRepository', 'ProfileEntitlementRepository', 'PaymentEventRepository']);
  assert.equal(REPOSITORY_CONTRACTS.UserRepository.includes('getUserByAuthSubject'), true);
  assert.equal(REPOSITORY_CONTRACTS.ReadingRepository.includes('updateReadingRecord'), false);
  assert.equal(REPOSITORY_CONTRACTS.PurchaseRepository.includes('findByProviderTransaction'), true);
  assert.equal(REPOSITORY_CONTRACTS.SubscriptionRepository.includes('upsertVerifiedState'), true);
  assert.equal(REPOSITORY_CONTRACTS.PaymentEventRepository.includes('markProcessed'), true);
  assert.equal(Object.isFrozen(REPOSITORY_CONTRACTS), true);
});

test('users reject duplicate identity, update status, and return deep immutable defensive copies', () => {
  const users = new InMemoryUserRepository();
  const saved = users.createUser({ id: 'user-001', authSubject: 'auth-001', status: 'active', createdAt: T0 });
  assert.equal(saved.status, 'active'); assert.equal(Object.isFrozen(saved), true);
  throwsCode(() => users.createUser({ id: 'user-001', authSubject: 'auth-002', createdAt: T0 }), 'DUPLICATE_USER_ID');
  throwsCode(() => users.createUser({ id: 'user-002', authSubject: 'auth-001', createdAt: T0 }), 'DUPLICATE_AUTH_SUBJECT');
  assert.equal(users.updateUserStatus('user-001', 'suspended', T1).status, 'suspended');
  assert.equal(users.getUser('user-001').authSubject, 'auth-001');
  assert.equal(users.getUserByAuthSubject('auth-001').id, 'user-001');
  assert.equal(users.getUserByAuthSubject('missing'), null);
  throwsCode(() => users.getUser('unknown'), 'USER_NOT_FOUND');
});

test('birth profiles are mutable application data with explicit ordering and immutable returned birth data', () => {
  const profiles = new InMemoryBirthProfileRepository();
  profiles.createBirthProfile({ id: 'profile-b', userId: 'user-001', displayLabel: 'Later', birthData: birthData(), createdAt: T1 });
  const first = profiles.createBirthProfile({ id: 'profile-a', userId: 'user-001', displayLabel: 'Original', birthData: birthData(), createdAt: T0 });
  assert.deepEqual(profiles.listBirthProfilesForUser('user-001').map((item) => item.id), ['profile-a', 'profile-b']);
  assert.equal(Object.isFrozen(first.birthData.timezoneProvenance), true);
  const updated = profiles.updateBirthProfile('profile-a', { birthData: birthData('13:41:00'), displayLabel: 'Changed', updatedAt: T2 });
  assert.equal(updated.birthData.localTime, '13:41:00');
  assert.equal(profiles.archiveBirthProfile('profile-a', T2).status, 'archived');
  throwsCode(() => profiles.createBirthProfile({ id: 'profile-a', userId: 'user-001', birthData: birthData(), createdAt: T0 }), 'DUPLICATE_BIRTH_PROFILE_ID');
});

test('reading records are immutable snapshots: duplicate IDs fail, same calculation digest is permitted, and archive is operational metadata only', () => {
  const readings = new InMemoryReadingRepository(); const profiles = new InMemoryBirthProfileRepository();
  profiles.createBirthProfile({ id: 'profile-001', userId: 'user-001', birthData: birthData(), createdAt: T0 });
  const one = readings.insertReadingRecord({ userId: 'user-001', birthProfileId: 'profile-001', record: record('reading-001', T0) });
  readings.insertReadingRecord({ userId: 'user-001', birthProfileId: 'profile-001', record: record('reading-002', T1) });
  assert.deepEqual(readings.listReadingRecordsForUser('user-001').map((item) => item.readingId), ['reading-002', 'reading-001']);
  assert.equal(one.record.integrity.calculation.digest, 'same-calculation-digest');
  throwsCode(() => readings.insertReadingRecord({ userId: 'user-001', record: record('reading-001') }), 'DUPLICATE_READING_ID');
  const before = JSON.stringify(readings.getReadingRecord('reading-001').record);
  assert.throws(() => { one.record.input.birth.localTime = '00:00:00'; }, TypeError);
  assert.throws(() => { one.record.provenance.timezone.datasetVersion = 'changed'; }, TypeError);
  assert.throws(() => { one.record.reading.structured.key = 'changed'; }, TypeError);
  assert.throws(() => { one.record.integrity.calculation.digest = 'changed'; }, TypeError);
  profiles.updateBirthProfile('profile-001', { birthData: birthData('14:00:00'), updatedAt: T2 });
  const after = readings.getReadingRecord('reading-001');
  assert.equal(JSON.stringify(after.record), before); assert.equal(after.record.input.birth.localTime, '13:40:00');
  assert.equal(after.record.engineProfileId, 'kundlinsights-vedic-engine-profile-v2'); assert.equal(Object.isFrozen(after.record.provenance), true);
  assert.equal(readings.archiveReadingRecord('reading-001', T2).status, 'archived');
  assert.equal(readings.getReadingRecord('reading-001').record.integrity.output.digest, 'output-reading-001');
});

test('entitlements use an injected evaluation instant and fail closed for inactive, expired, and exhausted records', () => {
  const entitlements = new InMemoryEntitlementRepository();
  entitlements.createEntitlement({ id: 'ent-active', userId: 'user-001', productKey: 'career-reading', status: 'active', quantity: 1, validFrom: T0, validUntil: '2026-02-01T00:00:00.000Z' });
  entitlements.createEntitlement({ id: 'ent-expired', userId: 'user-001', productKey: 'career-reading', status: 'active', quantity: 1, validFrom: T0, validUntil: T1 });
  entitlements.createEntitlement({ id: 'ent-inactive', userId: 'user-001', productKey: 'career-reading', status: 'revoked', quantity: 1, validFrom: T0 });
  assert.deepEqual(entitlements.listActiveEntitlementsForUser('user-001', T1).map((item) => item.id), ['ent-active']);
  assert.equal(entitlements.consumeEntitlement('ent-active', T1).quantity, 0);
  throwsCode(() => entitlements.consumeEntitlement('ent-active', T1), 'ENTITLEMENT_EXHAUSTED');
  throwsCode(() => entitlements.consumeEntitlement('ent-expired', T1), 'ENTITLEMENT_EXPIRED');
  throwsCode(() => entitlements.consumeEntitlement('ent-inactive', T1), 'ENTITLEMENT_INACTIVE');
  throwsCode(() => entitlements.consumeEntitlement('none', T1), 'ENTITLEMENT_NOT_FOUND');
});

test('payments are deterministic and provider-scoped transaction identity is idempotent', () => {
  const payments = new InMemoryPaymentRepository();
  const payment = payments.insertPaymentTransaction({ id: 'payment-001', userId: 'user-001', provider: 'example-pay', providerTransactionId: 'txn-001', status: 'paid', amountMinor: 59900, currency: 'INR', createdAt: T0 });
  assert.equal(payments.getPaymentTransaction('payment-001').id, payment.id);
  assert.equal(payments.getPaymentTransaction('payment-001').amountMinor, 59900);
  assert.equal(payments.findByProviderTransactionId('example-pay', 'txn-001').id, payment.id);
  assert.equal(payments.findByProviderTransactionId('other-pay', 'txn-001'), null);
  throwsCode(() => payments.insertPaymentTransaction({ id: 'payment-002', userId: 'user-001', provider: 'example-pay', providerTransactionId: 'txn-001', amountMinor: 100, currency: 'INR', createdAt: T0 }), 'DUPLICATE_PROVIDER_TRANSACTION');
});

test('payments accept only caller-supplied nonnegative safe integer minor units and reject the legacy amount alias', () => {
  const payments = new InMemoryPaymentRepository();
  assert.equal(payments.insertPaymentTransaction({ id: 'payment-zero', userId: 'user-001', provider: 'example-pay', providerTransactionId: 'txn-zero', amountMinor: 0, currency: 'INR', createdAt: T0 }).amountMinor, 0);
  assert.equal(payments.insertPaymentTransaction({ id: 'payment-one', userId: 'user-001', provider: 'example-pay', providerTransactionId: 'txn-one', amountMinor: 1, currency: 'USD', createdAt: T0 }).amountMinor, 1);
  for (const [id, amountMinor, extra] of [
    ['fractional', 1.5], ['negative', -1], ['nan', NaN], ['infinite', Infinity], ['string', '59900'], ['null', null], ['unsafe', Number.MAX_SAFE_INTEGER + 1], ['legacy', undefined, { amount: 599 }],
  ]) throwsCode(() => payments.insertPaymentTransaction({ id: `payment-${id}`, userId: 'user-001', provider: 'example-pay', providerTransactionId: `txn-${id}`, amountMinor, currency: 'INR', createdAt: T0, ...extra }), 'INVALID_PAYMENT_AMOUNT');
});
