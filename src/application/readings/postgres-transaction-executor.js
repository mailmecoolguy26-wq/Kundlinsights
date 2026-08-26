'use strict';

const { runWithAuthenticatedDbContext } = require('../../security/database-context');
const { repositoryError } = require('../../persistence/contracts');

function fail(code) { throw repositoryError(code); }
class PostgresApplicationTransactionExecutor {
  constructor({ db, diagnosticObserver } = {}) { if (!db || typeof db.connect !== 'function') fail('INVALID_APPLICATION_TRANSACTION_EXECUTOR'); if (diagnosticObserver !== undefined && typeof diagnosticObserver !== 'function') fail('INVALID_APPLICATION_TRANSACTION_EXECUTOR'); this.db = db; this.diagnosticObserver = diagnosticObserver; }
  async execute({ principal, role, operation } = {}) {
    if (!principal || typeof principal.subject !== 'string' || typeof role !== 'string' || typeof operation !== 'function') fail('INVALID_APPLICATION_TRANSACTION');
    return runWithAuthenticatedDbContext({ db: this.db, authSubject: principal.subject, diagnosticObserver: this.diagnosticObserver, operation: async (client, transaction) => {
      const setRole = async (nextRole) => { if (nextRole !== 'app_runtime' && nextRole !== 'app_worker' && nextRole !== 'app_crypto') fail('INVALID_APPLICATION_ROLE'); transaction.setStage('ROLE_SWITCH_FAILED'); await client.query(`set local role ${nextRole}`); transaction.setStage('REPOSITORY_OPERATION_FAILED'); };
      await setRole(role); return operation({ db: client, setRole });
    } });
  }
}
module.exports = { PostgresApplicationTransactionExecutor };
