'use strict';

// Opt-in only: a disposable local DB with DB-P2, SEC-P3, SEC-P5, and SEC-P3.1C applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createApiComposition } = require('../../src/api');
const { PostgresUserKeyEnvelopeStore, UserDekProvider } = require('../../src/security/crypto');
const { TestOnlyKms } = require('../security/crypto/test-only-kms');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const connectionString = process.env.KUNDLINSIGHTS_API_P1D2_DATABASE_URL;
const T0 = '2026-08-13T00:00:00.000Z';
const ROLE = 'api_p1d2_server';
const birthData = Object.freeze({ localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', utc: '2000-01-01T00:00:00.000Z', latitude: 0, longitude: 0, timezoneProvenance: Object.freeze({ provider: 'test' }) });

function principal(subject, isAnonymous = false) { return { provider: 'supabase', subject, isAnonymous }; }

test('API-P1D2 real composition isolates users, profiles, envelopes, and pooled transaction identity', { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  let server;
  let sequence = 0;
  const idGenerator = () => `opaque-p1d2-${++sequence}`;
  const a = principal('subject-a');
  const b = principal('subject-b');
  const unknown = principal('subject-unknown');
  try {
    await admin.query(`drop role if exists ${ROLE}`);
    await admin.query(`create role ${ROLE} login nosuperuser nobypassrls nocreatedb nocreaterole noinherit`);
    await admin.query(`grant app_runtime, app_worker, app_crypto to ${ROLE}`);
    await admin.query('truncate app.user_key_envelopes, app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    server = new Pool({ connectionString: connectionString.replace('postgresql:///', `postgresql://${ROLE}@/`), max: 1 });
    const kms = new TestOnlyKms();
    const composition = createApiComposition({
      db: server,
      authVerifier: createTestOnlyAuthVerifier({ a, b }),
      kms,
      astronomicalEngine: { calculate() {} },
      canonicalSiderealSunSampler: { sampleCanonicalSiderealSun() {} },
      idGenerator,
      clock: () => T0,
    });
    const role = await server.query("select rolsuper, rolbypassrls, rolcanlogin from pg_roles where rolname = session_user");
    assert.deepEqual(role.rows[0], { rolsuper: false, rolbypassrls: false, rolcanlogin: true });
    assert.deepEqual(Object.keys(composition.api.apiRuntime).sort(), ['astronomicalEngine', 'canonicalSiderealSunSampler']);

    const userA = await composition.services.userResolver(a);
    const userB = await composition.services.userResolver(b);
    assert.equal((await composition.services.userResolver(a)).id, userA.id);
    assert.equal((await composition.services.userResolver(b)).id, userB.id);
    assert.notEqual(userA.id, a.subject); assert.notEqual(userB.id, b.subject); assert.notEqual(userA.id, userB.id);

    const runtime = async (p, operation) => composition.services.transactionExecutor.execute({ principal: p, role: 'app_runtime', operation });
    const visibleUsers = async (p) => runtime(p, async ({ db }) => (await db.query('select id from app.users order by id')).rows.map((row) => row.id));
    const currentId = async (p) => runtime(p, async ({ db }) => (await db.query('select security.current_app_user_id() as id')).rows[0].id);
    assert.deepEqual(await visibleUsers(a), [userA.id]);
    assert.deepEqual(await visibleUsers(b), [userB.id]);
    assert.deepEqual(await visibleUsers(unknown), []);
    assert.equal(await currentId(a), userA.id); assert.equal(await currentId(b), userB.id); assert.equal(await currentId(unknown), null);

    const absent = await server.connect();
    try {
      await absent.query('begin'); await absent.query('set local role app_runtime');
      assert.equal((await absent.query('select id from app.users')).rows.length, 0);
      assert.equal((await absent.query('select security.current_app_user_id() as id')).rows[0].id, null);
      assert.ok([null, ''].includes((await absent.query("select current_setting('app.auth_subject', true) as subject")).rows[0].subject));
      await absent.query('commit');
    } finally { absent.release(); }
    assert.deepEqual(await visibleUsers(b), [userB.id]);
    assert.deepEqual(await visibleUsers(a), [userA.id]);

    const crypto = async (p, operation) => composition.services.transactionExecutor.execute({ principal: p, role: 'app_crypto', operation });
    const provisionEnvelope = async (p, userId) => crypto(p, async ({ db }) => new UserDekProvider({ kms, envelopeStore: new PostgresUserKeyEnvelopeStore({ db }), idGenerator, now: () => T0 }).provisionUserDek(userId));
    const activeEnvelope = async (p, userId) => crypto(p, async ({ db }) => new PostgresUserKeyEnvelopeStore({ db }).getActiveEnvelope({ userId }));
    await provisionEnvelope(a, userA.id); await provisionEnvelope(b, userB.id);
    assert.equal((await activeEnvelope(a, userA.id)).userId, userA.id);
    assert.equal(await activeEnvelope(a, userB.id), null);
    assert.equal((await activeEnvelope(b, userB.id)).userId, userB.id);
    assert.equal(await activeEnvelope(b, userA.id), null);
    assert.equal(await activeEnvelope(unknown, userA.id), null);
    await assert.rejects(runtime(a, async ({ db }) => db.query('select 1 from app.user_key_envelopes')), (error) => error && error.code === 'AUTHENTICATED_DB_OPERATION_FAILED');

    const profileA = await composition.services.birthProfileService.create({ principal: a, birthData, displayLabel: 'A', userId: userB.id });
    const profileB = await composition.services.birthProfileService.create({ principal: b, birthData, displayLabel: 'B', userId: userA.id });
    assert.deepEqual((await composition.services.birthProfileService.list({ principal: a })).map((profile) => profile.id), [profileA.id]);
    assert.deepEqual((await composition.services.birthProfileService.list({ principal: b })).map((profile) => profile.id), [profileB.id]);
    await assert.rejects(composition.services.birthProfileService.get({ principal: a, birthProfileId: profileB.id }), (error) => error && error.code === 'NOT_FOUND_OR_FORBIDDEN');
    await assert.rejects(composition.services.birthProfileService.get({ principal: b, birthProfileId: profileA.id }), (error) => error && error.code === 'NOT_FOUND_OR_FORBIDDEN');
    const stored = await admin.query('select user_id, birth_payload_ciphertext from app.birth_profiles order by id');
    assert.deepEqual(stored.rows.map((row) => row.user_id).sort(), [userA.id, userB.id].sort());
    assert.equal(stored.rows.some((row) => row.birth_payload_ciphertext.toString('utf8').includes('2000-01-01')), false);
    const profileAV1 = await admin.query('select birth_payload_key_version,birth_payload_ciphertext from app.birth_profiles where id=$1', [profileA.id]);
    kms.setCurrentKeyVersion('test-kek-v2');
    await crypto(a, async ({ db }) => new UserDekProvider({ kms, envelopeStore: new PostgresUserKeyEnvelopeStore({ db }), idGenerator, now: () => T0 }).rotateUserDek(userA.id));
    assert.equal((await composition.services.birthProfileService.get({ principal: a, birthProfileId: profileA.id })).id, profileA.id);
    const profileAV2 = await composition.services.birthProfileService.create({ principal: a, birthData: { ...birthData, latitude: 1 }, displayLabel: 'A-v2' });
    const rotated = await admin.query('select id,birth_payload_key_version,birth_payload_ciphertext from app.birth_profiles where id in ($1,$2) order by id', [profileA.id, profileAV2.id]);
    assert.equal(rotated.rows.find((row) => row.id === profileA.id).birth_payload_key_version, 'test-kek-v1');
    assert.equal(rotated.rows.find((row) => row.id === profileAV2.id).birth_payload_key_version, 'test-kek-v2');
    assert.deepEqual(rotated.rows.find((row) => row.id === profileA.id).birth_payload_ciphertext, profileAV1.rows[0].birth_payload_ciphertext);

    await assert.rejects(composition.services.userResolver(principal('anonymous', true)), (error) => error && error.code === 'ANONYMOUS_AUTH_NOT_ALLOWED');
    await admin.query("insert into app.users (id, auth_subject, status, created_at, updated_at) values ('opaque-disabled', 'subject-disabled', 'disabled', $1, $1)", [T0]);
    await assert.rejects(composition.services.userResolver(principal('subject-disabled')), (error) => error && error.code === 'APP_USER_DISABLED');
  } finally {
    await server?.end().catch(() => {});
    await admin.query(`drop role if exists ${ROLE}`).catch(() => {});
    await admin.end();
  }
});
