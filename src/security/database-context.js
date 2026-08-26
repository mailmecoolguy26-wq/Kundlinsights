'use strict';

const { repositoryError } = require('../persistence/contracts');

function fail(code) { throw repositoryError(code); }
function validSubject(subject) { if (typeof subject !== 'string' || !subject || subject.trim() !== subject) fail('INVALID_AUTH_SUBJECT_CONTEXT'); return subject; }
function diagnostic(observer, stage, error) {
  if (typeof observer !== 'function') return;
  const postgres = error && typeof error === 'object' ? {
    ...(typeof error.code === 'string' && /^[0-9A-Z]{1,12}$/.test(error.code) ? { code: error.code } : {}),
    ...(typeof error.severity === 'string' && error.severity.length <= 64 ? { severity: error.severity } : {}),
    ...(typeof error.routine === 'string' && error.routine.length <= 128 ? { routine: error.routine } : {}),
    ...(typeof error.constraint === 'string' && error.constraint.length <= 128 ? { constraint: error.constraint } : {}),
    ...(typeof error.schema === 'string' && error.schema.length <= 128 ? { schema: error.schema } : {}),
    ...(typeof error.table === 'string' && error.table.length <= 128 ? { table: error.table } : {}),
  } : {};
  try { observer(Object.freeze({ stage, safeErrorClass: postgres.code ? `POSTGRES_${postgres.code}` : 'NON_POSTGRES_DATABASE_ERROR', ...(Object.keys(postgres).length ? { postgres: Object.freeze(postgres) } : {}) })); } catch {}
}
function safeError(error) {
  if (error && error.code && /^[A-Z_]+$/.test(error.code)) throw error;
  fail('AUTHENTICATED_DB_OPERATION_FAILED');
}

async function runWithAuthenticatedDbContext({ db, authSubject, operation, diagnosticObserver } = {}) {
  if (!db || typeof db.connect !== 'function') fail('INVALID_AUTHENTICATED_DB');
  if (typeof operation !== 'function') fail('INVALID_AUTHENTICATED_DB_OPERATION');
  const subject = validSubject(authSubject);
  let client;
  let began = false; let stage = 'BEGIN_FAILED';
  const transaction = Object.freeze({ setStage(next) { if (['AUTH_SUBJECT_CONTEXT_FAILED', 'ROLE_SWITCH_FAILED', 'REPOSITORY_OPERATION_FAILED', 'COMMIT_FAILED'].includes(next)) stage = next; } });
  try {
    client = await db.connect();
    if (!client || typeof client.query !== 'function' || typeof client.release !== 'function') fail('INVALID_AUTHENTICATED_DB');
    await client.query('begin'); began = true;
    stage = 'AUTH_SUBJECT_CONTEXT_FAILED'; await client.query("select set_config('app.auth_subject', $1, true)", [subject]);
    stage = 'REPOSITORY_OPERATION_FAILED'; const result = await operation(client, transaction);
    stage = 'COMMIT_FAILED'; await client.query('commit'); began = false;
    return result;
  } catch (error) {
    diagnostic(diagnosticObserver, stage, error);
    if (client && began) { try { await client.query('rollback'); } catch (rollbackError) { diagnostic(diagnosticObserver, 'ROLLBACK_FAILED', rollbackError); } }
    safeError(error);
  } finally { if (client) client.release(); }
}

module.exports = { runWithAuthenticatedDbContext };
