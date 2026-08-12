'use strict';

// Opt-in only: caller supplies a disposable local PostgreSQL 16 database with DB-P2 and SEC-P3 applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, Pool } = require('pg');
const { runWithAuthenticatedDbContext } = require('../../src/security/database-context');
const { PostgresBirthProfileRepository, PostgresReadingRepository } = require('../../src/persistence');
const { UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../../src/security/crypto');
const { TestOnlyKms, TestOnlyKeyEnvelopeStore } = require('./crypto/test-only-kms');
const { BirthCareerReadingOrchestrator } = require('../../src/orchestration');
const { createResolvedBirthPlace } = require('../../src/place');
const { deepFreeze } = require('../../src/astronomy');
const { createReadingRecord, replayPersistedReading } = require('../../src/readings');

const connectionString = process.env.KUNDLINSIGHTS_SEC_P4_DATABASE_URL;
const T0 = '2026-08-12T00:00:00.000Z';
const BIRTH = '1990-11-26T08:10:00.000Z'; const SAVANA = 'vimshottari-longitude-proportional-savana-360-v1'; const SOLAR = 'vimshottari-longitude-proportional-solar-return-v1';
const LONGITUDES = Object.freeze({ Sun: 220.07412509999472, Moon: 319.51986976098, Mars: 180.3, Mercury: 210.4, Jupiter: 275.5, Venus: 300.6, Saturn: 225.7, Rahu: 90.8, Ketu: 270.8, Ascendant: 330.9 });
function astronomyEngine() { const bodies = deepFreeze(Object.fromEntries(Object.entries(LONGITUDES).map(([body, siderealLongitudeDegrees]) => [body, deepFreeze({ body, siderealLongitudeDegrees, tropicalLongitudeDegrees: null, longitudeSpeedDegreesPerDay: body === 'Ascendant' ? null : 1, motion: body === 'Ascendant' ? null : 'direct', siderealMetadata: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI', calculationStatus: 'TEST_ONLY' }), provenance: deepFreeze({ coordinateProvenance: 'provider-native' }) })]))); return { calculate() { return deepFreeze({ bodies, instant: deepFreeze({ utc: BIRTH, unixMilliseconds: Date.parse(BIRTH) }), sidereal: deepFreeze({ siderealMode: 'SE_SIDM_LAHIRI' }), provider: deepFreeze({ providerId: 'synthetic-sec-p4-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', nodeModel: 'MEAN_NODE', productionLicenseGate: false }) }); } }; }
function sunSampler() { return deepFreeze({ sampleCanonicalSiderealSun({ instantUtc }) { return deepFreeze({ canonicalSiderealLongitudeDegrees: ((LONGITUDES.Sun + (Date.parse(instantUtc) - Date.parse(BIRTH)) * 360 / (365 * 86400000)) % 360 + 360) % 360, provenance: deepFreeze({ providerId: 'synthetic-sec-p4-test', calculationStatus: 'TEST_ONLY', siderealMode: 'SE_SIDM_LAHIRI', coordinateProvenance: 'provider-native', productionAuthority: false }) }); } }); }
function actualReadingRecord(ruleset) { const place = deepFreeze(createResolvedBirthPlace({ provider: 'test', providerPlaceId: 'sec-p4-place', latitude: 17.385, longitude: 78.4867, timezone: 'Asia/Kolkata', timezoneResolver: { provider: 'timezone-boundary-builder', datasetVersion: '2026c', datasetChecksum: 'test' } })); const result = new BirthCareerReadingOrchestrator({ astronomicalEngine: astronomyEngine(), dashaRulesetId: ruleset, ...(ruleset === SOLAR ? { canonicalSiderealSunSampler: sunSampler() } : {}) }).generate({ birth: { date: '1990-11-26', time: '13:40:00', place }, readingInstant: T0, locale: 'en-IN' }); return createReadingRecord({ readingId: ruleset === SAVANA ? 'reading-savana' : 'reading-solar', createdAt: T0, input: { birth: { localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: BIRTH, latitude: 17.385, longitude: 78.4867, placeResolution: { resolutionVersion: place.resolutionVersion, timezoneResolver: place.timezoneResolver }, display: { label: 'Synthetic Hyderabad' } }, readingInstant: T0, transitScanRange: null, locale: 'en-IN' }, result }); }
async function asRuntime(pool, subject, operation) { return runWithAuthenticatedDbContext({ db: pool, authSubject: subject, operation: async (client) => { await client.query('set local role app_runtime'); return operation(client); } }); }

test('SEC-P4 encrypted DB-P4 payloads round-trip under SEC-P3 RLS without plaintext storage', { skip: !connectionString }, async () => {
  const admin = new Client({ connectionString }); const pool = new Pool({ connectionString, max: 1 }); await admin.connect();
  const kms = new TestOnlyKms(); const envelopeStore = new TestOnlyKeyEnvelopeStore(); const deks = new UserDekProvider({ kms, envelopeStore }); deks.provisionCurrent('user-a'); deks.provisionCurrent('user-b');
  const birthCodec = new BirthProfilePayloadCodec({ userDekProvider: deks }); const readingCodec = new ReadingPayloadCodec({ userDekProvider: deks });
  try {
    await admin.query('truncate app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    await admin.query("insert into app.users (id,auth_subject,status,created_at,updated_at) values ('user-a','subject-a','active',$1,$1),('user-b','subject-b','active',$1,$1)", [T0]);
    await asRuntime(pool, 'subject-a', async (db) => {
      const profiles = new PostgresBirthProfileRepository({ db, birthProfilePayloadCodec: birthCodec }); const readings = new PostgresReadingRepository({ db, readingPayloadCodec: readingCodec });
      const birthData = { localDate: '1990-11-26', localTime: '13:40:00', timezone: 'Asia/Kolkata', utc: '1990-11-26T08:10:00.000Z', latitude: 17.385, longitude: 78.4867 };
      assert.deepEqual((await profiles.createBirthProfile({ id: 'profile-a', userId: 'user-a', birthData, createdAt: T0 })).birthData, birthData);
      const savana = actualReadingRecord(SAVANA); const solar = actualReadingRecord(SOLAR);
      assert.deepEqual((await readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: savana })).record, savana);
      assert.deepEqual((await readings.insertReadingRecord({ userId: 'user-a', birthProfileId: 'profile-a', record: solar })).record, solar);
      const retrievedSavana = await readings.getReadingRecord('reading-savana'); const retrievedSolar = await readings.getReadingRecord('reading-solar');
      assert.equal(replayPersistedReading({ record: retrievedSavana.record, astronomicalRuntime: { astronomicalEngine: astronomyEngine() } }).result.provenance.dashaRulesetId, SAVANA);
      assert.equal(replayPersistedReading({ record: retrievedSolar.record, astronomicalRuntime: { astronomicalEngine: astronomyEngine(), canonicalSiderealSunSampler: sunSampler() } }).result.provenance.dashaRulesetId, SOLAR);
      assert.equal(retrievedSolar.record.input.birth.timezone, 'Asia/Kolkata');
    });
    const stored = await admin.query("select birth_payload_ciphertext, input_snapshot_ciphertext, structured_reading_ciphertext from app.birth_profiles cross join app.reading_records where app.birth_profiles.id='profile-a' and app.reading_records.id='reading-solar'");
    const row = stored.rows[0]; assert.equal(Buffer.isBuffer(row.birth_payload_ciphertext), true); assert.equal(row.birth_payload_ciphertext.includes(Buffer.from('1990-11-26')), false); assert.equal(row.input_snapshot_ciphertext.includes(Buffer.from('Asia/Kolkata')), false); assert.equal(row.structured_reading_ciphertext.includes(Buffer.from('Solar')), false);
    await asRuntime(pool, 'subject-b', async (db) => assert.equal((await db.query("select id from app.reading_records where id='reading-solar'")).rows.length, 0));
  } finally { await pool.end(); await admin.end(); }
});
