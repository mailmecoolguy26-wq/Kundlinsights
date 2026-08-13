'use strict';

// Opt-in only: the caller supplies a disposable local database already initialized with DB-P2.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { PostgresUserRepository } = require('../../src/persistence');
const { resolveOrProvisionAppUser } = require('../../src/security/auth');

const connectionString = process.env.KUNDLINSIGHTS_SEC_P2_DATABASE_URL;
const T0 = '2026-01-01T00:00:00.000Z';
function principal(subject, isAnonymous = false) { return { provider: 'supabase', subject, isAnonymous }; }
function dependencies(users, ids) { let index = 0; return { userRepository: users, idGenerator: () => ids[index++], now: () => T0 }; }

test('SEC-P2 provisions and race-recovers application users through the real unique auth_subject constraint', { skip: !connectionString }, async () => {
  const db = new Client({ connectionString }); await db.connect();
  try {
    await db.query('truncate app.user_key_envelopes, app.reading_records, app.entitlements, app.payment_transactions, app.birth_profiles, app.users');
    const users = new PostgresUserRepository({ db });
    const injected = dependencies(users, ['pg-user-a', 'pg-user-b', 'pg-race-a', 'pg-race-b']);
    const first = await resolveOrProvisionAppUser({ principal: principal('supabase-a'), ...injected });
    const existing = await resolveOrProvisionAppUser({ principal: principal('supabase-a'), ...injected });
    const different = await resolveOrProvisionAppUser({ principal: principal('supabase-b'), ...injected });
    assert.equal(first.id, existing.id); assert.notEqual(first.id, different.id);
    const raceInjected = dependencies(users, ['pg-race-a', 'pg-race-b']);
    const [left, right] = await Promise.all([resolveOrProvisionAppUser({ principal: principal('supabase-race'), ...raceInjected }), resolveOrProvisionAppUser({ principal: principal('supabase-race'), ...raceInjected })]);
    assert.equal(left.id, right.id);
    assert.equal((await users.getUserByAuthSubject('supabase-race')).id, left.id);
    await users.createUser({ id: 'pg-disabled', authSubject: 'supabase-disabled', status: 'disabled', createdAt: T0 });
    await assert.rejects(resolveOrProvisionAppUser({ principal: principal('supabase-disabled'), ...dependencies(users, ['unused']) }), (error) => error && error.code === 'APP_USER_DISABLED');
  } finally { await db.end(); }
});
