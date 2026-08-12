'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runWithAuthenticatedDbContext } = require('../../src/security/database-context');

function pool(events) { return { async connect() { return { async query(sql, values) { events.push([sql, values]); if (sql === 'commit') return {}; return { rows: [] }; }, release() { events.push(['release']); } }; } }; }

test('sets a parameterized transaction-local authenticated subject and releases the injected pool client', async () => {
  const events = []; const value = await runWithAuthenticatedDbContext({ db: pool(events), authSubject: 'verified-subject', operation: async (client) => { await client.query('select 1'); return 'ok'; } });
  assert.equal(value, 'ok');
  assert.deepEqual(events, [['begin', undefined], ["select set_config('app.auth_subject', $1, true)", ['verified-subject']], ['select 1', undefined], ['commit', undefined], ['release']]);
});

test('rejects invalid subject context and rolls back without leaking raw database errors', async () => {
  await assert.rejects(runWithAuthenticatedDbContext({ db: pool([]), authSubject: ' bad', operation: async () => null }), (error) => error && error.code === 'INVALID_AUTH_SUBJECT_CONTEXT');
  const events = []; await assert.rejects(runWithAuthenticatedDbContext({ db: pool(events), authSubject: 'verified', operation: async () => { throw new Error('postgres host secret'); } }), (error) => error && error.code === 'AUTHENTICATED_DB_OPERATION_FAILED');
  assert.deepEqual(events.slice(-2), [['rollback', undefined], ['release']]);
});
