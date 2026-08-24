'use strict';

const { verifiedPrincipal } = require('../security/auth/verified-principal');
const { PostgresEntitlementRepository } = require('../persistence');
const { repositoryError } = require('../persistence/contracts');

const CAREER_PRODUCT_KEY = 'CAREER';

function fail(code) { throw repositoryError(code); }

class DevelopmentCareerEntitlementFixture {
  constructor({ authUserResolver, transactionExecutor, entitlementRepositoryFactory = ({ db }) => new PostgresEntitlementRepository({ db }), idGenerator, clock } = {}) {
    if (typeof authUserResolver !== 'function' || !transactionExecutor || typeof transactionExecutor.execute !== 'function' || typeof entitlementRepositoryFactory !== 'function' || typeof idGenerator !== 'function' || typeof clock !== 'function') fail('INVALID_DEVELOPMENT_ENTITLEMENT_FIXTURE');
    this.authUserResolver = authUserResolver;
    this.transactionExecutor = transactionExecutor;
    this.entitlementRepositoryFactory = entitlementRepositoryFactory;
    this.idGenerator = idGenerator;
    this.clock = clock;
    this.inFlight = new Map();
  }

  async ensureCareerEntitlementForAuthenticatedDevUser({ authenticatedPrincipal } = {}) {
    const principal = verifiedPrincipal(authenticatedPrincipal);
    if (principal.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED');
    const existing = this.inFlight.get(principal.subject);
    if (existing) return existing;
    const operation = this.#ensure(principal).finally(() => this.inFlight.delete(principal.subject));
    this.inFlight.set(principal.subject, operation);
    return operation;
  }

  async #ensure(principal) {
    const user = await this.authUserResolver(principal);
    if (!user || typeof user.id !== 'string' || user.status !== 'active') fail('APP_USER_DISABLED');
    return this.transactionExecutor.execute({ principal, role: 'app_worker', operation: async ({ db }) => {
      const entitlements = this.entitlementRepositoryFactory({ db });
      const now = this.clock();
      const active = await entitlements.listActiveEntitlementsForUser(user.id, now);
      const reusable = active.find((entitlement) => entitlement.productKey === CAREER_PRODUCT_KEY);
      if (reusable) return Object.freeze({ entitlement: reusable, created: false });
      const entitlement = await entitlements.createEntitlement({
        id: this.idGenerator(), userId: user.id, productKey: CAREER_PRODUCT_KEY, status: 'active', quantity: 1,
        validFrom: now, validUntil: null, sourcePaymentTransactionId: null, createdAt: now, updatedAt: now,
      });
      return Object.freeze({ entitlement, created: true });
    } });
  }
}

module.exports = { DevelopmentCareerEntitlementFixture, CAREER_PRODUCT_KEY };
