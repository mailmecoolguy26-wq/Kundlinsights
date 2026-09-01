'use strict';
const { PostgresPurchaseRepository, PostgresSubscriptionRepository } = require('../persistence');
class PostgresPaymentUnitOfWork {
  constructor({ pool } = {}) { if (!pool || typeof pool.connect !== 'function') throw new TypeError('INVALID_PAYMENT_POOL'); this.pool = pool; }
  async run(callback) { const client = await this.pool.connect(); let begun = false; try { await client.query('BEGIN'); begun = true; const value = await callback({ purchases: new PostgresPurchaseRepository({ db: client }), subscriptions: new PostgresSubscriptionRepository({ db: client }) }); await client.query('COMMIT'); return value; } catch (error) { if (begun) try { await client.query('ROLLBACK'); } catch {} throw error; } finally { client.release(); } }
}
class InMemoryPaymentUnitOfWork {
  constructor({ repositories } = {}) { this.repositories = repositories; }
  async run(callback) { const source = this.repositories(); const clone = (value) => Object.assign(Object.create(Object.getPrototypeOf(value)), value); const purchases = clone(source.purchases); purchases.records = new Map(source.purchases.records); purchases.byProviderTransaction = new Map(source.purchases.byProviderTransaction); const subscriptions = clone(source.subscriptions); subscriptions.records = new Map(source.subscriptions.records); subscriptions.byIdentity = new Map(source.subscriptions.byIdentity); const value = await callback({ purchases, subscriptions }); source.purchases.records = purchases.records; source.purchases.byProviderTransaction = purchases.byProviderTransaction; source.subscriptions.records = subscriptions.records; source.subscriptions.byIdentity = subscriptions.byIdentity; return value; }
}
module.exports = { PostgresPaymentUnitOfWork, InMemoryPaymentUnitOfWork };
