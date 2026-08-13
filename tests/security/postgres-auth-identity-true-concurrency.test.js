'use strict';

// Opt-in only: a disposable local DB with DB-P2, SEC-P3, SEC-P5, and SEC-P3.1C applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { PostgresUserRepository } = require('../../src/persistence');
const { resolveOrProvisionAppUser } = require('../../src/security/auth');
const { runWithAuthenticatedDbContext } = require('../../src/security/database-context');

const connectionString = process.env.KUNDLINSIGHTS_SEC_P2_CONCURRENCY_DATABASE_URL;
const T0 = '2026-01-01T00:00:00.000Z';
const ROLE = 'sec_p21_concurrency_server';

function principal(subject) { return { provider: 'supabase', subject, isAnonymous: false }; }

test('SEC-P2 resolves a true two-connection first-login race without an aborted transaction', { skip: !connectionString }, async () => {
  const admin = new Pool({ connectionString });
  let server;
  let sequence = 0;
  const provision = async (subject) => runWithAuthenticatedDbContext({
    db: server,
    authSubject: subject,
    operation: async (db) => {
      await db.query('set local role app_runtime');
      const user = await resolveOrProvisionAppUser({
        principal: principal(subject),
        userRepository: new PostgresUserRepository({ db }),
        idGenerator: () => `opaque-${++sequence}`,
        now: () => T0,
      });
      assert.equal((await db.query('select 1 as healthy')).rows[0].healthy, 1);
      return user;
    },
  });
  const visibleIds = async (subject) => runWithAuthenticatedDbContext({
    db: server,
    authSubject: subject,
    operation: async (db) => {
      await db.query('set local role app_runtime');
      return (await db.query('select id from app.users order by id')).rows.map((row) => row.id);
    },
  });
  try {
    await admin.query(`drop role if exists ${ROLE}`);
    await admin.query(`create role ${ROLE} login nosuperuser nobypassrls nocreatedb nocreaterole noinherit`);
    await admin.query(`grant app_runtime to ${ROLE}`);
    await admin.query('truncate app.user_key_envelopes, app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    server = new Pool({ connectionString: connectionString.replace('postgresql:///', `postgresql://${ROLE}@/`), max: 2 });

    const results = await Promise.all([provision('subject-race'), provision('subject-race')]);
    assert.equal(results[0].id, results[1].id);
    assert.equal((await admin.query("select count(*) from app.users where auth_subject='subject-race' ")).rows[0].count, '1');
    assert.equal(new Set(results.map((user) => user.id)).size, 1);
    assert.equal((await provision('subject-race')).id, results[0].id);

    const userA = await provision('subject-a');
    const userB = await provision('subject-b');
    assert.notEqual(userA.id, userB.id);
    assert.deepEqual(await visibleIds('subject-a'), [userA.id]);
    assert.deepEqual(await visibleIds('subject-b'), [userB.id]);

    const absent = await server.connect();
    try {
      await absent.query('begin');
      await absent.query('set local role app_runtime');
      assert.equal((await absent.query('select id from app.users')).rows.length, 0);
      await absent.query('commit');
    } finally { absent.release(); }

    await admin.query("insert into app.users (id, auth_subject, status, created_at, updated_at) values ('opaque-disabled', 'subject-disabled', 'disabled', $1, $1)", [T0]);
    await assert.rejects(provision('subject-disabled'), (error) => error && error.code === 'APP_USER_DISABLED');
    assert.equal((await admin.query("select status from app.users where auth_subject='subject-disabled' ")).rows[0].status, 'disabled');
  } finally {
    await server?.end().catch(() => {});
    await admin.query(`drop role if exists ${ROLE}`).catch(() => {});
    await admin.end();
  }
});
