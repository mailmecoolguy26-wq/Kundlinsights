'use strict';

// Opt-in only: caller supplies a disposable local DB with DB-P2 then SEC-P3 migrations applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, Pool } = require('pg');
const { runWithAuthenticatedDbContext } = require('../../src/security/database-context');

const connectionString = process.env.KUNDLINSIGHTS_SEC_P3_DATABASE_URL;
const T0 = '2026-01-01T00:00:00.000Z';
const DIGEST_A = 'a'.repeat(64); const DIGEST_B = 'b'.repeat(64); const DIGEST_C = 'c'.repeat(64);
async function dbError(db, operation) { await db.query('savepoint expected_rls_failure'); try { await operation(); assert.fail('expected PostgreSQL RLS/privilege denial'); } catch (error) { assert.equal(error.code, '42501'); } finally { await db.query('rollback to savepoint expected_rls_failure'); } }
async function asRuntime(pool, subject, operation) { return runWithAuthenticatedDbContext({ db: pool, authSubject: subject, operation: async (client) => { await client.query('set local role app_runtime'); return operation(client); } }); }
async function asWorker(pool, operation) { const client = await pool.connect(); try { await client.query('begin'); await client.query('set local role app_worker'); const result = await operation(client); await client.query('commit'); return result; } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); } }
function profileValues(id, userId) { return [id, userId, Buffer.from('synthetic'), 1, 'test-v1', 'TEST_ONLY', Buffer.from('nonce'), 'active', T0, T0]; }
function readingValues(id, userId, profileId) { return [id, userId, profileId, 'CAREER', 'profile-v2', DIGEST_A, 'kundlinsights-reading-record-v1', Buffer.from('input'), Buffer.from('prov'), Buffer.from('reading'), null, 1, 'test-v1', 'TEST_ONLY', Buffer.from('input-nonce'), Buffer.from('prov-nonce'), Buffer.from('reading-nonce'), null, { synthetic: true }, DIGEST_B, DIGEST_C, null, T0, null, null, null]; }

test('SEC-P3 RLS enforces transaction-local verified-subject ownership through the actual app_runtime role', { skip: !connectionString }, async () => {
  const admin = new Client({ connectionString }); const pool = new Pool({ connectionString, max: 1 }); await admin.connect();
  try {
    await admin.query('truncate app.user_key_envelopes, app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    await admin.query("insert into app.users (id,auth_subject,status,created_at,updated_at) values ('user-a','subject-a','active',$1,$1),('user-b','subject-b','active',$1,$1)", [T0]);
    await admin.query('insert into app.birth_profiles (id,user_id,birth_payload_ciphertext,birth_payload_encryption_version,birth_payload_key_version,birth_payload_algorithm,birth_payload_nonce,status,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10),($11,$12,$13,$14,$15,$16,$17,$18,$19,$20)', [...profileValues('profile-a', 'user-a'), ...profileValues('profile-b', 'user-b')]);
    await admin.query('insert into app.reading_records (id,user_id,birth_profile_id,domain,engine_profile_id,engine_profile_fingerprint,record_schema_version,input_snapshot_ciphertext,provenance_ciphertext,structured_reading_ciphertext,rendered_reading_ciphertext,payload_encryption_version,payload_key_version,payload_algorithm,input_snapshot_nonce,provenance_nonce,structured_reading_nonce,rendered_reading_nonce,integrity_metadata,calculation_digest,output_digest,rendered_output_digest,created_at,archived_at,deleted_at,idempotency_key) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26),($27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52)', [...readingValues('reading-a', 'user-a', 'profile-a'), ...readingValues('reading-b', 'user-b', 'profile-b')]);
    await admin.query("insert into app.entitlements (id,user_id,product_key,status,quantity,valid_from,created_at,updated_at) values ('ent-a','user-a','career','active',1,$1,$1,$1),('ent-b','user-b','career','active',1,$1,$1,$1)", [T0]);
    await admin.query("insert into app.payment_transactions (id,user_id,provider,provider_transaction_id,status,amount_minor,currency,created_at,updated_at) values ('pay-a','user-a','test','txn-a','paid',59900,'INR',$1,$1),('pay-b','user-b','test','txn-b','paid',59900,'INR',$1,$1)", [T0]);

    await asRuntime(pool, 'subject-a', async (db) => {
      assert.equal((await db.query("select id from app.users where id='user-a'")).rows.length, 1);
      assert.equal((await db.query("select id from app.users where id='user-b'")).rows.length, 0);
      assert.equal((await db.query("select id from app.birth_profiles where id='profile-b'")).rows.length, 0);
      assert.equal((await db.query("update app.birth_profiles set display_label='blocked' where id='profile-b' returning id")).rows.length, 0);
      assert.equal((await db.query("update app.birth_profiles set display_label='allowed' where id='profile-a' returning id")).rows.length, 1);
      assert.equal((await db.query("select id from app.reading_records where id='reading-b'")).rows.length, 0);
      assert.equal((await db.query("update app.reading_records set archived_at=$1 where id='reading-b' returning id", [T0])).rows.length, 0);
      assert.equal((await db.query("update app.reading_records set archived_at=$1 where id='reading-a' returning id", [T0])).rows.length, 1);
      assert.equal((await db.query("select id from app.entitlements where id='ent-b'")).rows.length, 0);
      assert.equal((await db.query("select id from app.payment_transactions where id='pay-b'")).rows.length, 0);
      await dbError(db, () => db.query('insert into app.birth_profiles (id,user_id,birth_payload_ciphertext,birth_payload_encryption_version,birth_payload_key_version,birth_payload_algorithm,birth_payload_nonce,status,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', profileValues('spoof-profile', 'user-b')));
      assert.equal((await db.query('insert into app.birth_profiles (id,user_id,birth_payload_ciphertext,birth_payload_encryption_version,birth_payload_key_version,birth_payload_algorithm,birth_payload_nonce,status,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id', profileValues('own-profile', 'user-a'))).rows[0].id, 'own-profile');
      await dbError(db, () => db.query('insert into app.reading_records (id,user_id,birth_profile_id,domain,engine_profile_id,engine_profile_fingerprint,record_schema_version,input_snapshot_ciphertext,provenance_ciphertext,structured_reading_ciphertext,rendered_reading_ciphertext,payload_encryption_version,payload_key_version,payload_algorithm,input_snapshot_nonce,provenance_nonce,structured_reading_nonce,rendered_reading_nonce,integrity_metadata,calculation_digest,output_digest,rendered_output_digest,created_at,archived_at,deleted_at,idempotency_key) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)', readingValues('spoof-reading-user', 'user-b', 'profile-a')));
      await dbError(db, () => db.query('insert into app.reading_records (id,user_id,birth_profile_id,domain,engine_profile_id,engine_profile_fingerprint,record_schema_version,input_snapshot_ciphertext,provenance_ciphertext,structured_reading_ciphertext,rendered_reading_ciphertext,payload_encryption_version,payload_key_version,payload_algorithm,input_snapshot_nonce,provenance_nonce,structured_reading_nonce,rendered_reading_nonce,integrity_metadata,calculation_digest,output_digest,rendered_output_digest,created_at,archived_at,deleted_at,idempotency_key) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)', readingValues('spoof-reading-profile', 'user-a', 'profile-b')));
      assert.equal((await db.query('insert into app.reading_records (id,user_id,birth_profile_id,domain,engine_profile_id,engine_profile_fingerprint,record_schema_version,input_snapshot_ciphertext,provenance_ciphertext,structured_reading_ciphertext,rendered_reading_ciphertext,payload_encryption_version,payload_key_version,payload_algorithm,input_snapshot_nonce,provenance_nonce,structured_reading_nonce,rendered_reading_nonce,integrity_metadata,calculation_digest,output_digest,rendered_output_digest,created_at,archived_at,deleted_at,idempotency_key) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) returning id', readingValues('own-reading', 'user-a', 'profile-a'))).rows[0].id, 'own-reading');
      await dbError(db, () => db.query("insert into app.entitlements (id,user_id,product_key,status,quantity,valid_from,created_at,updated_at) values ('forged-entitlement','user-a','career','active',1,$1,$1,$1)", [T0]));
      await dbError(db, () => db.query("update app.entitlements set quantity=99 where id='ent-a'"));
      await dbError(db, () => db.query("insert into app.payment_transactions (id,user_id,provider,provider_transaction_id,status,amount_minor,currency,created_at,updated_at) values ('forged-payment','user-a','test','forged','paid',1,'INR',$1,$1)", [T0]));
      await dbError(db, () => db.query("update app.payment_transactions set amount_minor=1 where id='pay-a'"));
    });

    const absentClient = await pool.connect(); try { await absentClient.query('begin'); await absentClient.query('set local role app_runtime'); assert.equal((await absentClient.query('select id from app.users')).rows.length, 0); assert.equal((await absentClient.query('select security.current_auth_subject() as subject')).rows[0].subject, null); await absentClient.query('commit'); } finally { absentClient.release(); }
    await asRuntime(pool, 'unknown-subject', async (db) => assert.equal((await db.query('select id from app.users')).rows.length, 0));
    await asRuntime(pool, 'subject-b', async (db) => assert.equal((await db.query("select id from app.birth_profiles where id='profile-b'")).rows.length, 1));
    await asWorker(pool, async (db) => {
      assert.equal((await db.query("insert into app.entitlements (id,user_id,product_key,status,quantity,valid_from,created_at,updated_at) values ('worker-entitlement','user-a','career','active',1,$1,$1,$1) returning id", [T0])).rows[0].id, 'worker-entitlement');
      assert.equal((await db.query("insert into app.payment_transactions (id,user_id,provider,provider_transaction_id,status,amount_minor,currency,created_at,updated_at) values ('worker-payment','user-a','worker','worker-txn','paid',1,'INR',$1,$1) returning id", [T0])).rows[0].id, 'worker-payment');
    });
    const roles = await admin.query("select rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolcanlogin from pg_roles where rolname in ('app_runtime','app_worker') order by rolname");
    assert.deepEqual(roles.rows.map((row) => [row.rolname, row.rolsuper, row.rolbypassrls, row.rolcreatedb, row.rolcreaterole, row.rolcanlogin]), [['app_runtime', false, false, false, false, false], ['app_worker', false, false, false, false, false]]);
    const tables = await admin.query("select relname, relforcerowsecurity, relowner::regrole::text as owner from pg_class where relnamespace='app'::regnamespace and relname in ('users','birth_profiles','reading_records','entitlements','payment_transactions') order by relname");
    assert.equal(tables.rows.every((row) => row.relforcerowsecurity && row.owner !== 'app_runtime'), true);
  } finally { await pool.end(); await admin.end(); }
});
