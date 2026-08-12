'use strict';

const { repositoryError } = require('../persistence/contracts');

function fail(code) { throw repositoryError(code); }
function validSubject(subject) { if (typeof subject !== 'string' || !subject || subject.trim() !== subject) fail('INVALID_AUTH_SUBJECT_CONTEXT'); return subject; }
function safeError(error) {
  if (error && error.code && /^[A-Z_]+$/.test(error.code)) throw error;
  fail('AUTHENTICATED_DB_OPERATION_FAILED');
}

async function runWithAuthenticatedDbContext({ db, authSubject, operation } = {}) {
  if (!db || typeof db.connect !== 'function') fail('INVALID_AUTHENTICATED_DB');
  if (typeof operation !== 'function') fail('INVALID_AUTHENTICATED_DB_OPERATION');
  const subject = validSubject(authSubject);
  let client;
  let began = false;
  try {
    client = await db.connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('INVALID_AUTHENTICATED_DB');
    await client.query('begin'); began = true;
    await client.query("select set_config('app.auth_subject', $1, true)", [subject]);
    const result = await operation(client);
    await client.query('commit'); began = false;
    return result;
  } catch (error) {
    if (client && began) { try { await client.query('rollback'); } catch {} }
    safeError(error);
  } finally { if (client) client.release(); }
}

module.exports = { runWithAuthenticatedDbContext };
