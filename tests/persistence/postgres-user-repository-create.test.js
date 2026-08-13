'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresUserRepository } = require('../../src/persistence');

const T0 = '2026-01-01T00:00:00.000Z';
const row = Object.freeze({ id: 'user-a', auth_subject: 'auth-a', status: 'active', created_at: T0, updated_at: T0, deleted_at: null });

function input(overrides = {}) { return { id: 'user-a', authSubject: 'auth-a', createdAt: T0, ...overrides }; }
function throwsCode(promise, code) { return assert.rejects(promise, (error) => error && error.code === code); }

test('PostgresUserRepository conflict-scoped user creation avoids RETURNING and returns its trusted-subject lookup', async () => {
  const calls = [];
  const users = new PostgresUserRepository({ db: { async query(sql, values) {
    calls.push({ sql, values });
    return calls.length === 1 ? { rows: [] } : { rows: [row] };
  } } });

  const saved = await users.createUser(input());

  assert.deepEqual(saved, { id: 'user-a', authSubject: 'auth-a', status: 'active', createdAt: T0, updatedAt: T0, deletedAt: null });
  assert.equal(Object.isFrozen(saved), true);
  assert.match(calls[0].sql, /insert into app\.users/i);
  assert.match(calls[0].sql, /on conflict \(auth_subject\) do nothing/i);
  assert.doesNotMatch(calls[0].sql, /returning/i);
  assert.deepEqual(calls[0].values, ['user-a', 'auth-a', 'active', T0, T0, null]);
  assert.match(calls[1].sql, /select .* from app\.users where auth_subject = \$1/i);
  assert.deepEqual(calls[1].values, ['auth-a']);
});

test('PostgresUserRepository returns the durable auth-subject winner after a no-op conflict insert', async () => {
  const users = new PostgresUserRepository({ db: { async query(_sql, _values) { return { rows: this.called ? [row] : (this.called = true, []) }; } } });
  assert.equal((await users.createUser(input({ id: 'proposed-loser' }))).id, 'user-a');
});

test('PostgresUserRepository preserves primary-key conflict mapping and fails closed on missing post-insert user', async () => {
  const duplicateId = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'users_pkey' });
  await throwsCode(new PostgresUserRepository({ db: { async query() { throw duplicateId; } } }).createUser(input()), 'DUPLICATE_USER_ID');
  await throwsCode(new PostgresUserRepository({ db: { async query() { return { rows: [] }; } } }).createUser(input()), 'USER_NOT_FOUND');
});
