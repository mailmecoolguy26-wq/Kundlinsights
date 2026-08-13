'use strict';

const { runWithAuthenticatedDbContext } = require('../../security/database-context');
const { repositoryError } = require('../../persistence/contracts');

function fail(code) { throw repositoryError(code); }
class PostgresApplicationTransactionExecutor {
  constructor({ db } = {}) { if (!db || typeof db.connect !== 'function') fail('INVALID_APPLICATION_TRANSACTION_EXECUTOR'); this.db = db; }
  async execute({ principal, role, operation } = {}) {
    if (!principal || typeof principal.subject !== 'string' || typeof role !== 'string' || typeof operation !== 'function') fail('INVALID_APPLICATION_TRANSACTION');
    return runWithAuthenticatedDbContext({ db: this.db, authSubject: principal.subject, operation: async (client) => {
      const setRole = async (nextRole) => { if (nextRole !== 'app_runtime' && nextRole !== 'app_worker' && nextRole !== 'app_crypto') fail('INVALID_APPLICATION_ROLE'); await client.query(`set local role ${nextRole}`); };
      await setRole(role); return operation({ db: client, setRole });
    } });
  }
}
module.exports = { PostgresApplicationTransactionExecutor };
