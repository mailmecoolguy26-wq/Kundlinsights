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

test('emits only bounded application error codes in diagnostics', async () => {
  const diagnostics = [];
  await assert.rejects(runWithAuthenticatedDbContext({ db: pool([]), authSubject: 'verified', diagnosticObserver: (value) => diagnostics.push(value), operation: async () => { const error = new Error('token=secret'); error.code = 'LIST_ENTITLEMENTS_FAILED'; throw error; } }));
  assert.equal(diagnostics[0].applicationErrorCode, 'LIST_ENTITLEMENTS_FAILED');
  assert.equal(JSON.stringify(diagnostics[0]).includes('token=secret'), false);
  const unsafe = [];
  await assert.rejects(runWithAuthenticatedDbContext({ db: pool([]), authSubject: 'verified', diagnosticObserver: (value) => unsafe.push(value), operation: async () => { const error = new Error('secret'); error.code = 'unsafe code?'; throw error; } }));
  assert.equal('applicationErrorCode' in unsafe[0], false);
});
