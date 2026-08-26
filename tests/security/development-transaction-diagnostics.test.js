'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runWithAuthenticatedDbContext } = require('../../src/security/database-context');
const { PostgresApplicationTransactionExecutor } = require('../../src/application/readings');

function postgresFailure(code = '42501') {
  return Object.assign(new Error('password=not-safe subject=verified-subject jwt=not-safe database=not-safe'), {
    code, severity: 'ERROR', routine: 'aclcheck_error', schema: 'app', table: 'users',
  });
}
function failingPool({ failAt, error = postgresFailure() }) {
  return {
    async connect() {
      return {
        async query(sql) {
          if ((failAt === 'BEGIN_FAILED' && sql === 'begin') ||
              (failAt === 'AUTH_SUBJECT_CONTEXT_FAILED' && sql.startsWith('select set_config')) ||
              (failAt === 'ROLE_SWITCH_FAILED' && sql.startsWith('set local role'))) throw error;
          return { rows: [] };
        },
        release() {},
      };
    },
  };
}
async function expectControlled(operation) {
  await assert.rejects(operation, (error) => error && error.code === 'AUTHENTICATED_DB_OPERATION_FAILED');
}

test('classifies a begin failure with sanitized PostgreSQL metadata', async () => {
  const diagnostics = [];
  await expectControlled(() => runWithAuthenticatedDbContext({ db: failingPool({ failAt: 'BEGIN_FAILED' }), authSubject: 'verified-subject', diagnosticObserver: (value) => diagnostics.push(value), operation: async () => null }));
  assert.deepEqual(diagnostics, [{ stage: 'BEGIN_FAILED', safeErrorClass: 'POSTGRES_42501', postgres: { code: '42501', severity: 'ERROR', routine: 'aclcheck_error', schema: 'app', table: 'users' } }]);
});

test('classifies a transaction-local authenticated-subject configuration failure', async () => {
  const diagnostics = [];
  await expectControlled(() => runWithAuthenticatedDbContext({ db: failingPool({ failAt: 'AUTH_SUBJECT_CONTEXT_FAILED' }), authSubject: 'verified-subject', diagnosticObserver: (value) => diagnostics.push(value), operation: async () => null }));
  assert.equal(diagnostics[0].stage, 'AUTH_SUBJECT_CONTEXT_FAILED');
  assert.equal(diagnostics[0].safeErrorClass, 'POSTGRES_42501');
});

test('classifies an application role-switch failure', async () => {
  const diagnostics = [];
  const executor = new PostgresApplicationTransactionExecutor({ db: failingPool({ failAt: 'ROLE_SWITCH_FAILED' }), diagnosticObserver: (value) => diagnostics.push(value) });
  await expectControlled(() => executor.execute({ principal: { subject: 'verified-subject' }, role: 'app_runtime', operation: async () => null }));
  assert.equal(diagnostics[0].stage, 'ROLE_SWITCH_FAILED');
  assert.equal(diagnostics[0].safeErrorClass, 'POSTGRES_42501');
});

test('classifies a repository callback failure without retaining error messages or sensitive values', async () => {
  const diagnostics = [];
  await expectControlled(() => runWithAuthenticatedDbContext({ db: failingPool({}), authSubject: 'verified-subject', diagnosticObserver: (value) => diagnostics.push(value), operation: async () => { throw postgresFailure(); } }));
  assert.equal(diagnostics[0].stage, 'REPOSITORY_OPERATION_FAILED');
  assert.equal(diagnostics[0].safeErrorClass, 'POSTGRES_42501');
  const serialized = JSON.stringify(diagnostics[0]);
  for (const secret of ['password=', 'verified-subject', 'jwt=', 'database=', 'not-safe']) assert.equal(serialized.includes(secret), false);
});
