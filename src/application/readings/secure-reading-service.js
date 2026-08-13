'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy, requiredString } = require('../../persistence/contracts');

function fail(code) { throw repositoryError(code); }
function requiredFunction(value, code) { if (typeof value !== 'function') fail(code); return value; }
function principal(value) { try { return verifiedPrincipal(value); } catch (error) { if (error && error.code) throw error; fail('INVALID_AUTH_PRINCIPAL'); } }
function safeError(error, fallback) {
  const allowed = new Set(['INVALID_AUTH_PRINCIPAL', 'UNSUPPORTED_AUTH_PROVIDER', 'ANONYMOUS_AUTH_NOT_ALLOWED', 'APP_USER_DISABLED', 'NOT_FOUND_OR_FORBIDDEN', 'ENTITLEMENT_REQUIRED', 'ENTITLEMENT_EXHAUSTED', 'IDEMPOTENCY_CONFLICT']);
  if (error && allowed.has(error.code)) throw error;
  fail(fallback);
}
function publicReading(item) { return immutableCopy({ readingId: item.readingId, domain: item.record.domain, engineProfileId: item.record.engineProfileId, createdAt: item.record.createdAt, status: item.status }); }

class SecureReadingService {
  constructor({ authUserResolver, transactionExecutor, repositories, readingGenerator, readingRecordFactory, replayReading, requiresEntitlement, idGenerator, clock } = {}) {
    this.authUserResolver = requiredFunction(authUserResolver, 'INVALID_AUTH_USER_RESOLVER');
    this.transactions = transactionExecutor && typeof transactionExecutor.execute === 'function' ? transactionExecutor : fail('INVALID_APPLICATION_TRANSACTION_EXECUTOR');
    this.repositories = requiredFunction(repositories, 'INVALID_APPLICATION_REPOSITORIES');
    this.readingGenerator = readingGenerator && typeof readingGenerator.generate === 'function' ? readingGenerator : fail('INVALID_READING_GENERATOR');
    this.readingRecordFactory = requiredFunction(readingRecordFactory, 'INVALID_READING_RECORD_FACTORY');
    this.replayReading = requiredFunction(replayReading, 'INVALID_REPLAY_READING');
    this.requiresEntitlement = requiredFunction(requiresEntitlement, 'INVALID_ENTITLEMENT_POLICY');
    this.idGenerator = requiredFunction(idGenerator, 'INVALID_READING_ID');
    this.clock = requiredFunction(clock, 'INVALID_APPLICATION_CLOCK');
  }

  async resolve(principalInput) {
    const verified = principal(principalInput); if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED');
    try {
      const user = await this.authUserResolver(verified);
      if (!user || typeof user.id !== 'string' || user.status !== 'active') fail('INVALID_AUTH_PRINCIPAL');
      return { verified, user: immutableCopy({ id: user.id, status: user.status }) };
    } catch (error) { safeError(error, 'INVALID_AUTH_PRINCIPAL'); }
  }
  async execute(verified, role, operation) { return this.transactions.execute({ principal: verified, role, operation }); }
  repo(context) {
    const value = this.repositories(context);
    if (!value || !value.birthProfiles || !value.readings || !value.entitlements) fail('INVALID_APPLICATION_REPOSITORIES');
    return value;
  }
  async existing({ verified, user, idempotencyKey }) {
    return this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getReadingRecordByIdempotencyKey(user.id, idempotencyKey));
  }
  async generateSecureReading({ principal: principalInput, birthProfileId, domain, idempotencyKey, readingInstant, locale } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    const profileId = requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); const key = requiredString(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY'); const readingDomain = requiredString(domain, 'INVALID_READING_DOMAIN');
    const prior = await this.existing({ verified, user, idempotencyKey: key }); if (prior) return publicReading(prior);
    let profile;
    try {
      profile = await this.execute(verified, 'app_runtime', async (context) => this.repo(context).birthProfiles.getBirthProfile(profileId));
      if (!profile || profile.userId !== user.id || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
    let generated;
    try { generated = await this.readingGenerator.generate({ birthProfile: profile, domain: readingDomain, readingInstant, locale }); if (!generated || !generated.input || !generated.result) fail('READING_GENERATION_FAILED'); } catch (error) { safeError(error, 'READING_GENERATION_FAILED'); }
    let record;
    try { record = this.readingRecordFactory({ readingId: this.idGenerator(), createdAt: this.clock(), input: generated.input, result: generated.result }); } catch (error) { safeError(error, 'READING_GENERATION_FAILED'); }
    try {
      const persisted = await this.execute(verified, 'app_runtime', async (context) => {
        const repos = this.repo(context); const duplicate = await repos.readings.getReadingRecordByIdempotencyKey(user.id, key); if (duplicate) return duplicate;
        let entitlement = null;
        if (this.requiresEntitlement({ domain: readingDomain })) {
          const active = await repos.entitlements.listActiveEntitlementsForUser(user.id, this.clock()); entitlement = active.find((item) => item.productKey === readingDomain) || null;
          if (!entitlement) fail('ENTITLEMENT_EXHAUSTED');
        }
        const inserted = await repos.readings.insertReadingRecord({ userId: user.id, birthProfileId: profile.id, record, idempotencyKey: key });
        if (entitlement) {
          if (typeof context.setRole === 'function') await context.setRole('app_worker');
          await repos.entitlements.consumeEntitlement(entitlement.id, this.clock());
        }
        return inserted;
      });
      return publicReading(persisted);
    } catch (error) {
      if (error && error.code === 'DUPLICATE_READING_IDEMPOTENCY_KEY') { const winner = await this.existing({ verified, user, idempotencyKey: key }); if (winner) return publicReading(winner); fail('IDEMPOTENCY_CONFLICT'); }
      safeError(error, 'READING_PERSISTENCE_FAILED');
    }
  }
  async getSecureReading({ principal: principalInput, readingId } = {}) {
    const { verified, user } = await this.resolve(principalInput); const id = requiredString(readingId, 'INVALID_READING_ID');
    try { const item = await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getReadingRecord(id)); if (!item || item.userId !== user.id) fail('NOT_FOUND_OR_FORBIDDEN'); return immutableCopy({ readingId: item.readingId, record: item.record }); } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
  }
  async replaySecureReading({ principal: principalInput, readingId, astronomicalRuntime } = {}) {
    const secure = await this.getSecureReading({ principal: principalInput, readingId });
    try { return immutableCopy({ readingId: secure.readingId, replay: await this.replayReading({ record: secure.record, astronomicalRuntime }) }); } catch (error) { safeError(error, 'READING_INTEGRITY_FAILED'); }
  }
}

module.exports = { SecureReadingService };
