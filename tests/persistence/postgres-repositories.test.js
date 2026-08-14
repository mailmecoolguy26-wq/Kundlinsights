'use strict';

// This integration suite is intentionally opt-in. It never discovers credentials or opens a cloud connection.
// Set KUNDLINSIGHTS_DB_P4_DATABASE_URL to a disposable local database which has the committed DB-P2 migration applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { BirthCareerReadingOrchestrator } = require('../../src/orchestration');
const { createResolvedBirthPlace } = require('../../src/place');
const { deepFreeze } = require('../../src/astronomy');
const { createReadingRecord, replayPersistedReading } = require('../../src/readings');
const {
  PostgresUserRepository, PostgresBirthProfileRepository, PostgresReadingRepository,
  PostgresEntitlementRepository, PostgresPaymentRepository, profileFingerprint,
} = require('../../src/persistence');

const connectionString = process.env.KUNDLINSIGHTS_DB_P4_DATABASE_URL;
const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-02T00:00:00.000Z';
const T2 = '2026-01-03T00:00:00.000Z';
const BIRTH = '1990-11-26T08:10:00.000Z';
const READING = '2026-08-12T00:00:00.000Z';
const DAY = 86400000;
const SAVANA = 'vimshottari-longitude-proportional-savana-360-v1';
const SOLAR = 'vimshottari-longitude-proportional-solar-return-v1';
const LONGITUDES = Object.freeze({ Sun: 220.07412509999472, Moon: 319.51986976098, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });

// TEST_ONLY_CODEC: deterministic serialization boundary; it is not encryption and is never selected by runtime code.
const TEST_ONLY_CODEC = Object.freeze({
  encodeBirthData({ birthData }) { return { ciphertext: Buffer.from(JSON.stringify(birthData)), encryptionVersion: 1, keyVersion: 'test-v1', algorithm: 'TEST_ONLY_CODEC', nonce: Buffer.from('birth-nonce') }; },
  decodeBirthData(value) { return JSON.parse(value.ciphertext.toString('utf8')); },
  encodeRecord({ record: value }) { const body = Buffer.from(JSON.stringify(value)); return { inputSnapshotCiphertext: body, provenanceCiphertext: Buffer.from('provenance'), structuredReadingCiphertext: Buffer.from('structured'), renderedReadingCiphertext: value.renderedReading ? Buffer.from('rendered') : null, payloadEncryptionVersion: 1, payloadKeyVersion: 'test-v1', payloadAlgorithm: 'TEST_ONLY_CODEC', inputSnapshotNonce: Buffer.from('input-nonce'), provenanceNonce: Buffer.from('provenance-nonce'), structuredReadingNonce: Buffer.from('structured-nonce'), renderedReadingNonce: value.renderedReading ? Buffer.from('rendered-nonce') : null, integrityMetadata: { codec: 'TEST_ONLY_CODEC' } }; },
  decodeRecord(value) { return JSON.parse(value.inputSnapshotCiphertext.toString('utf8')); },
});

function birthData() { return { localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', utc: T0, latitude: 0, longitude: 0, timezoneProvenance: { provider: 'synthetic', datasetVersion: 'test', datasetChecksum: 'test' } }; }
function record(id, profile = 'kundlinsights-vedic-engine-profile-v2', createdAt = T0) { return { schemaVersion: 'kundlinsights-reading-record-v1', readingId: id, domain: 'CAREER', createdAt, engineProfileId: profile, input: { synthetic: true }, provenance: { timezone: { datasetVersion: 'test' } }, reading: { structured: { id } }, renderedReading: { text: id }, integrity: { calculation: { algorithm: 'sha256', digest: 'a'.repeat(64) }, output: { algorithm: 'sha256', digest: `${id === 'reading-solar' ? 'b' : 'c'}`.repeat(64).slice(0, 64) }, rendered: { algorithm: 'sha256', digest: 'd'.repeat(64) } } }; }
function throwsCode(promise, code) { return assert.rejects(promise, (error) => error && error.code === code); }
function astronomyEngine() {
  const bodies = deepFreeze(Object.fromEntries(Object.entries(LONGITUDES).map(([body, siderealLongitudeDegrees]) => [body, deepFreeze({ body, siderealLongitudeDegrees, tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : 1, motion: body === 'Ascendant' ? null : 'direct', siderealMetadata: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'TEST_ONLY' }), provenance: deepFreeze({ coordinateProvenance: 'provider-native' }) })])));
  return { calculate() { return deepFreeze({ bodies, instant: deepFreeze({ utc: BIRTH, unixMilliseconds: Date.parse(BIRTH) }), sidereal: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: deepFreeze({ providerId: 'synthetic-postgres-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) }); } };
}
function sunSampler() { return deepFreeze({ sampleCanonicalSiderealSun({ instantUtc }) { return deepFreeze({ canonicalSiderealLongitudeDegrees: ((LONGITUDES.Sun + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * DAY)) % 360 + 360) % 360, provenance: deepFreeze({ providerId: 'synthetic-postgres-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', coordinateProvenance: 'provider-native', productionAuthority: false }) }); } }); }
function actualReadingRecord(ruleset) {
  const place = deepFreeze(createResolvedBirthPlace({ provider: 'test', providerPlaceId: 'test-place', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'test' } }));
  const result = new BirthCareerReadingOrchestrator({ astronomicalEngine: astronomyEngine(), dashaRulesetId: ruleset, ...(ruleset === SOLAR ? { canonicalSiderealSunSampler: sunSampler() } : {}) }).generate({ birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: READING, locale: 'en-IN' });
  return createReadingRecord({ readingId: ruleset === SAVANA ? 'replay-savana-001' : 'replay-solar-001', createdAt: READING, input: { birth: { localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: BIRTH, latitude: 17.385, longitude: 78.4867, placeResolution: { resolutionVersion: place.resolutionVersion, timezoneResolver: place.timezoneResolver }, display: { label: 'Synthetic Hyderabad' } }, readingInstant: READING, transitScanRange: null, locale: 'en-IN' }, result });
}

test('Postgres repositories preserve DB-P1 contracts against a disposable local PostgreSQL database', { skip: !connectionString }, async () => {
  const db = new Client({ connectionString }); await db.connect();
  try {
    await db.query('truncate app.user_key_envelopes, app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    const users = new PostgresUserRepository({ db });
    const profiles = new PostgresBirthProfileRepository({ db, birthProfilePayloadCodec: TEST_ONLY_CODEC });
    const readings = new PostgresReadingRepository({ db, readingPayloadCodec: TEST_ONLY_CODEC });
    const entitlements = new PostgresEntitlementRepository({ db });
    const payments = new PostgresPaymentRepository({ db });

    assert.equal((await users.createUser({ id: 'user-a', authSubject: 'auth-a', createdAt: T0 })).id, 'user-a');
    await throwsCode(users.createUser({ id: 'user-a', authSubject: 'auth-b', createdAt: T0 }), 'DUPLICATE_USER_ID');
    const durableAuthSubjectWinner = await users.createUser({ id: 'user-b', authSubject: 'auth-a', createdAt: T0 });
    assert.equal(durableAuthSubjectWinner.id, 'user-a');
    assert.equal(durableAuthSubjectWinner.authSubject, 'auth-a');
    assert.equal((await db.query("select count(*) from app.users where auth_subject='auth-a'")).rows[0].count, '1');
    assert.equal((await db.query("select count(*) from app.users where id='user-b'")).rows[0].count, '0');
    assert.equal((await users.updateUserStatus('user-a', 'suspended', T1)).status, 'suspended');
    await users.updateUserStatus('user-a', 'active', T1);
    assert.equal((await users.getUser('user-a')).authSubject, 'auth-a');

    const profile = await profiles.createBirthProfile({ id: 'profile-a', userId: 'user-a', displayLabel: 'Synthetic', birthData: birthData(), createdAt: T0 });
    assert.deepEqual(profile.birthData, birthData());
    assert.deepEqual((await profiles.listBirthProfilesForUser('user-a')).map((item) => item.id), ['profile-a']);
    assert.equal((await profiles.updateBirthProfile('profile-a', { displayLabel: 'Updated', updatedAt: T1 })).displayLabel, 'Updated');
    assert.equal((await profiles.archiveBirthProfile('profile-a', T2)).status, 'archived');
    await db.query("update app.birth_profiles set status='active', archived_at=null where id='profile-a'");

    const payment = await payments.insertPaymentTransaction({ id: 'pay-a', userId: 'user-a', provider: 'test-provider', providerTransactionId: 'transaction-1', status: 'paid', amountMinor: 59900, currency: 'INR', createdAt: T0 });
    assert.equal(payment.amountMinor, 59900);
    assert.equal((await payments.getPaymentTransaction('pay-a')).amountMinor, 59900);
    assert.equal((await payments.findByProviderTransactionId('test-provider', 'transaction-1')).id, 'pay-a');
    await throwsCode(payments.insertPaymentTransaction({ id: 'pay-b', userId: 'user-a', provider: 'test-provider', providerTransactionId: 'transaction-1', status: 'paid', amountMinor: 1, currency: 'INR', createdAt: T0 }), 'DUPLICATE_PROVIDER_TRANSACTION');

    const entitlement = await entitlements.createEntitlement({ id: 'ent-a', userId: 'user-a', productKey: 'career', status: 'active', quantity: 1, validFrom: T0, sourcePaymentTransactionId: 'pay-a', createdAt: T0 });
    assert.equal(entitlement.quantity, 1);
    await entitlements.createEntitlement({ id: 'ent-expired', userId: 'user-a', productKey: 'career', status: 'active', quantity: 1, validFrom: T0, validUntil: T1, createdAt: T0 });
    await entitlements.createEntitlement({ id: 'ent-inactive', userId: 'user-a', productKey: 'career', status: 'revoked', quantity: 1, validFrom: T0, createdAt: T0 });
    assert.deepEqual((await entitlements.listActiveEntitlementsForUser('user-a', T1)).map((item) => item.id), ['ent-a']);
    assert.equal((await entitlements.consumeEntitlement('ent-a', T1)).quantity, 0);
    await throwsCode(entitlements.consumeEntitlement('ent-a', T1), 'ENTITLEMENT_EXHAUSTED');
    await throwsCode(entitlements.consumeEntitlement('ent-expired', T1), 'ENTITLEMENT_EXPIRED');
    await throwsCode(entitlements.consumeEntitlement('ent-inactive', T1), 'ENTITLEMENT_INACTIVE');

    const savana = record('reading-savana', 'kundlinsights-vedic-engine-profile-v1', T0);
    const solar = record('reading-solar', 'kundlinsights-vedic-engine-profile-v2', T1);
    assert.equal((await readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: savana, idempotencyKey: 'savana-key' })).record.engineProfileId, savana.engineProfileId);
    assert.equal((await readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: solar, idempotencyKey: 'solar-key' })).record.engineProfileId, solar.engineProfileId);
    assert.equal((await db.query("select engine_profile_fingerprint from app.reading_records where id='reading-solar' ")).rows[0].engine_profile_fingerprint, profileFingerprint(solar.engineProfileId));
    assert.equal((await readings.getReadingRecord('reading-solar')).record.provenance.timezone.datasetVersion, 'test');
    assert.deepEqual((await readings.listReadingRecordsForUser('user-a')).map((item) => item.readingId), ['reading-solar', 'reading-savana']);
    await throwsCode(readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: record('reading-copy', 'kundlinsights-vedic-engine-profile-v2', T2), idempotencyKey: 'solar-key' }), 'DUPLICATE_READING_IDEMPOTENCY_KEY');
    assert.equal((await readings.archiveReadingRecord('reading-solar', T2)).status, 'archived');
    await assert.rejects(db.query("update app.reading_records set domain='OTHER' where id='reading-solar'"), /READING_RECORD_SEMANTIC_IMMUTABLE/);

    const replaySavana = actualReadingRecord(SAVANA);
    const replaySolar = actualReadingRecord(SOLAR);
    await readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: replaySavana, idempotencyKey: 'replay-savana' });
    await readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: replaySolar, idempotencyKey: 'replay-solar' });
    const retrievedSavana = await readings.getReadingRecord(replaySavana.readingId);
    const retrievedSolar = await readings.getReadingRecord(replaySolar.readingId);
    assert.equal(replayPersistedReading({ record: retrievedSavana.record, astronomicalRuntime: { astronomicalEngine: astronomyEngine() } }).result.provenance.dashaRulesetId, SAVANA);
    assert.equal(replayPersistedReading({ record: retrievedSolar.record, astronomicalRuntime: { astronomicalEngine: astronomyEngine(), canonicalSiderealSunSampler: sunSampler() } }).result.provenance.dashaRulesetId, SOLAR);
    assert.equal(retrievedSolar.record.input.birth.placeResolution.timezoneResolver.datasetVersion, '2026c');
  } finally { await db.end(); }
});

test('Postgres repositories require explicit query and codec injection', () => {
  assert.throws(() => new PostgresUserRepository(), (error) => error && error.code === 'INVALID_POSTGRES_DB');
  assert.throws(() => new PostgresBirthProfileRepository({ db: { query() {} } }), (error) => error && error.code === 'INVALID_PERSISTENCE_CODEC');
  assert.throws(() => new PostgresReadingRepository({ db: { query() {} } }), (error) => error && error.code === 'INVALID_PERSISTENCE_CODEC');
});
