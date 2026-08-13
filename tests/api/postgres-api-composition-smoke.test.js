'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createApiComposition } = require('../../src/api');
const { TestOnlyKms } = require('../security/crypto/test-only-kms');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const url = process.env.KUNDLINSIGHTS_API_P1D1_DATABASE_URL;
const principal = { provider: 'supabase', subject: 'sec-p1d1-user-a', isAnonymous: false };
const time = '2026-08-13T00:00:00.000Z';

test('API-P1D1 composition provisions SEC-P2 user transactionally then enters RLS context', { skip: !url }, async () => {
  const admin = new Pool({ connectionString: url });
  const pool = new Pool({ connectionString: url });
  let server;
  try {
    await admin.query('drop role if exists api_p1d1_server');
    await admin.query('create role api_p1d1_server login nosuperuser nobypassrls nocreatedb nocreaterole noinherit');
    await admin.query('grant app_runtime, app_worker, app_crypto to api_p1d1_server');
    await admin.query('truncate app.user_key_envelopes, app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    await pool.end();
    server = new Pool({ connectionString: url.replace('postgresql:///', 'postgresql://api_p1d1_server@/') });
    const composition = createApiComposition({
      db: server,
      authVerifier: createTestOnlyAuthVerifier({ a: principal }),
      kms: new TestOnlyKms(),
      astronomicalEngine: { calculate() {} },
      canonicalSiderealSunSampler: { sampleCanonicalSiderealSun() {} },
      idGenerator: (() => { let index = 0; return () => `opaque-user-${++index}`; })(),
      clock: () => time,
    });
    const role = await server.query("select rolsuper, rolbypassrls from pg_roles where rolname = session_user");
    assert.deepEqual(role.rows[0], { rolsuper: false, rolbypassrls: false });

    const first = await composition.services.userResolver(principal);
    const repeat = await composition.services.userResolver(principal);
    assert.equal(first.id, repeat.id);
    assert.notEqual(first.id, principal.subject);
    assert.equal((await admin.query('select count(*) from app.users where auth_subject = $1', [principal.subject])).rows[0].count, '1');

    const currentId = await composition.services.transactionExecutor.execute({
      principal,
      role: 'app_runtime',
      operation: ({ db }) => db.query('select security.current_app_user_id() as id'),
    });
    assert.equal(currentId.rows[0].id, first.id);
    const ownUser = await composition.services.transactionExecutor.execute({
      principal,
      role: 'app_runtime',
      operation: ({ db }) => db.query('select id from app.users'),
    });
    assert.deepEqual(ownUser.rows, [{ id: first.id }]);

    const absent = await server.connect();
    try {
      await absent.query('begin');
      await absent.query('set local role app_runtime');
      assert.equal((await absent.query('select id from app.users')).rows.length, 0);
      await absent.query('commit');
    } finally {
      absent.release();
    }
  } finally {
    await server?.end().catch(() => {});
    await pool.end().catch(() => {});
    await admin.query('drop role if exists api_p1d1_server').catch(() => {});
    await admin.end();
  }
});
