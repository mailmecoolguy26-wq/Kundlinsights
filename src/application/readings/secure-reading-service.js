'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy, requiredString } = require('../../persistence/contracts');
const { ReadingPayloadCodec } = require('../../security/crypto');
const { CareerAccessResolver } = require('./career-access-resolver');

function fail(code) { throw repositoryError(code); }
function requiredFunction(value, code) { if (typeof value !== 'function') fail(code); return value; }
function principal(value) { try { return verifiedPrincipal(value); } catch (error) { if (error && error.code) throw error; fail('INVALID_AUTH_PRINCIPAL'); } }
function safeError(error, fallback) {
  const allowed = new Set(['INVALID_AUTH_PRINCIPAL', 'UNSUPPORTED_AUTH_PROVIDER', 'ANONYMOUS_AUTH_NOT_ALLOWED', 'APP_USER_DISABLED', 'NOT_FOUND_OR_FORBIDDEN', 'ENTITLEMENT_REQUIRED', 'ENTITLEMENT_EXHAUSTED', 'IDEMPOTENCY_CONFLICT']);
  if (error && allowed.has(error.code)) throw error;
  fail(fallback);
}
function publicReading(item) { return immutableCopy({ readingId: item.readingId, domain: item.record.domain, engineProfileId: item.record.engineProfileId, createdAt: item.record.createdAt, status: item.status }); }
function publicReadingSummary(item) {
  return immutableCopy({
    readingId: item.readingId,
    birthProfileId: item.birthProfileId,
    domain: item.record.domain,
    status: item.status,
    createdAt: item.record.createdAt,
    readingInstant: item.record.input.readingInstant,
    locale: item.record.input.locale,
  });
}
function calibratedContent(record) {
  const interpretation = record && record.reading && record.reading.calibrationInterpretation;
  if (!interpretation || typeof interpretation !== 'object') return null;
  const sections = []; const add = (section, headline, items) => { if (items.length) sections.push({ section, headline, items }); };
  const summary = interpretation.calibrationSummary;
  if (summary && typeof summary.narrative === 'string') add('calibration', 'Calibration', [{ headline: 'Career calibration', sentence: summary.narrative }]);
  add('historical-patterns', 'Historical patterns', (interpretation.recurringHistoricalEvidence || []).filter((item) => item && typeof item.text === 'string').map((item) => ({ headline: 'Recurring pattern', sentence: item.text })));
  add('upcoming-periods', 'Upcoming periods', (interpretation.upcomingRecurrenceWindows || []).filter((item) => item && typeof item.text === 'string').map((item) => ({ headline: 'Upcoming period', sentence: item.text })));
  add('decision-considerations', 'Decision considerations', (interpretation.decisionConsiderations || []).filter((item) => typeof item === 'string').map((sentence) => ({ headline: 'Consideration', sentence })));
  if (interpretation.disclosure && interpretation.disclosure.hasProvisionalEvidence === true) add('calculation-note', 'Calculation note', [{ headline: 'Calculation basis', sentence: 'Some calculations use a provisional calculation basis.' }]);
  return { domain: record.domain, locale: record.input.locale, sections };
}
function publicReadingDetail(item) { const calibrated = calibratedContent(item.record); return immutableCopy({ ...publicReadingSummary(item), content: item.record.renderedReading, ...(calibrated ? { calibratedContent: calibrated } : {}) }); }
function scopedKeyProvider(key) { return Object.freeze({ current: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }), forVersion: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }) }); }
function rawRecord(raw, record) { return { readingId: raw.readingId, userId: raw.userId, birthProfileId: raw.birthProfileId, status: raw.status, archivedAt: raw.archivedAt, idempotencyKey: raw.idempotencyKey, record }; }

class SecureReadingService {
  constructor({ authUserResolver, transactionExecutor, repositories, secureBirthProfileLoader, readingCryptoCoordinator, readingGenerator, readingRecordFactory, replayReading, requiresEntitlement, careerAccessResolver = new CareerAccessResolver(), idGenerator, clock } = {}) {
    this.authUserResolver = requiredFunction(authUserResolver, 'INVALID_AUTH_USER_RESOLVER');
    this.transactions = transactionExecutor && typeof transactionExecutor.execute === 'function' ? transactionExecutor : fail('INVALID_APPLICATION_TRANSACTION_EXECUTOR');
    this.repositories = requiredFunction(repositories, 'INVALID_APPLICATION_REPOSITORIES');
    this.secureBirthProfileLoader = secureBirthProfileLoader || null;
    if (this.secureBirthProfileLoader && typeof this.secureBirthProfileLoader.get !== 'function') fail('INVALID_SECURE_BIRTH_PROFILE_LOADER');
    this.readingCrypto = readingCryptoCoordinator || null;
    if (this.readingCrypto && (typeof this.readingCrypto.current !== 'function' || typeof this.readingCrypto.forVersion !== 'function')) fail('INVALID_READING_CRYPTO_COORDINATOR');
    this.readingGenerator = readingGenerator && typeof readingGenerator.generate === 'function' ? readingGenerator : fail('INVALID_READING_GENERATOR');
    this.readingRecordFactory = requiredFunction(readingRecordFactory, 'INVALID_READING_RECORD_FACTORY');
    this.replayReading = requiredFunction(replayReading, 'INVALID_REPLAY_READING');
    this.requiresEntitlement = requiredFunction(requiresEntitlement, 'INVALID_ENTITLEMENT_POLICY');
    this.careerAccessResolver = careerAccessResolver && typeof careerAccessResolver.resolve === 'function' && typeof careerAccessResolver.resolveForProfile === 'function' ? careerAccessResolver : fail('INVALID_CAREER_ACCESS_RESOLVER');
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
  async withKey(key, operation) { try { return await operation(new ReadingPayloadCodec({ userDekProvider: scopedKeyProvider(key) })); } finally { if (key && Buffer.isBuffer(key.dek)) key.dek.fill(0); } }
  async decryptReading(verified, raw) { const key = await this.readingCrypto.forVersion(verified, raw.userId, raw.payloadKeyVersion); const record = await this.withKey(key, (codec) => codec.decodeRecord({ userId: raw.userId, inputSnapshotCiphertext: raw.inputSnapshotCiphertext, provenanceCiphertext: raw.provenanceCiphertext, structuredReadingCiphertext: raw.structuredReadingCiphertext, renderedReadingCiphertext: raw.renderedReadingCiphertext, payloadEncryptionVersion: raw.payloadEncryptionVersion, payloadKeyVersion: raw.payloadKeyVersion, payloadAlgorithm: raw.payloadAlgorithm, inputSnapshotNonce: raw.inputSnapshotNonce, provenanceNonce: raw.provenanceNonce, structuredReadingNonce: raw.structuredReadingNonce, renderedReadingNonce: raw.renderedReadingNonce, integrityMetadata: raw.integrityMetadata, recordMetadata: raw.recordMetadata })); return rawRecord(raw, record); }
  async existing({ verified, user, idempotencyKey }) {
    if (!this.readingCrypto) return this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getReadingRecordByIdempotencyKey(user.id, idempotencyKey));
    const raw = await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getEncryptedReadingRecordByIdempotencyKey(user.id, idempotencyKey));
    return raw ? this.decryptReading(verified, raw) : null;
  }
  async generateSecureReading({ principal: principalInput, birthProfileId, domain, idempotencyKey, readingInstant, locale } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    const profileId = requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); const key = requiredString(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY'); const readingDomain = requiredString(domain, 'INVALID_READING_DOMAIN');
    const prior = await this.existing({ verified, user, idempotencyKey: key }); if (prior) return publicReading(prior);
    let profile;
    try {
      profile = this.secureBirthProfileLoader
        ? await this.secureBirthProfileLoader.get({ principal: verified, birthProfileId: profileId })
        : await this.execute(verified, 'app_runtime', async (context) => this.repo(context).birthProfiles.getBirthProfile(profileId));
      if (!profile || (!this.secureBirthProfileLoader && profile.userId !== user.id) || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
    if (this.requiresEntitlement({ domain: readingDomain })) {
      try {
        const access = await this.execute(verified, 'app_runtime', async (context) => this.careerAccessResolver.resolveForProfile({ repositories: this.repo(context), userId: user.id, birthProfileId: profileId, at: this.clock() }));
        if (!access.eligible) fail('ENTITLEMENT_EXHAUSTED');
      } catch (error) { safeError(error, 'ENTITLEMENT_EXHAUSTED'); }
    }
    let generated;
    try { generated = await this.readingGenerator.generate({ principal: verified, birthProfile: profile, domain: readingDomain, readingInstant, locale }); if (!generated || !generated.input || !generated.result) fail('READING_GENERATION_FAILED'); } catch (error) { safeError(error, 'READING_GENERATION_FAILED'); }
    let record;
    try { record = this.readingRecordFactory({ readingId: this.idGenerator(), createdAt: this.clock(), input: generated.input, result: generated.result }); } catch (error) { safeError(error, 'READING_GENERATION_FAILED'); }
    let encrypted;
    if (this.readingCrypto) {
      try { const operationKey = await this.readingCrypto.current(verified, user.id); encrypted = await this.withKey(operationKey, (codec) => codec.encodeRecord({ userId: user.id, record })); }
      catch (error) { safeError(error, 'READING_PERSISTENCE_FAILED'); }
    }
    try {
      const persisted = await this.execute(verified, 'app_runtime', async (context) => {
        const repos = this.repo(context);
        const winner = this.readingCrypto
          ? await repos.readings.getEncryptedReadingRecordByIdempotencyKey(user.id, key)
          : await repos.readings.getReadingRecordByIdempotencyKey(user.id, key);
        if (winner) return { kind: 'existing', value: winner };
        let access = null;
        if (this.requiresEntitlement({ domain: readingDomain })) {
          access = await this.careerAccessResolver.resolveForProfile({ repositories: repos, userId: user.id, birthProfileId: profile.id, at: this.clock() });
          if (!access.eligible) fail('ENTITLEMENT_EXHAUSTED');
        }
        if (access && access.consuming) {
          if (typeof context.setRole === 'function') await context.setRole('app_worker');
          await repos.entitlements.consumeEntitlement(access.sourceId, this.clock());
          if (typeof context.setRole === 'function') await context.setRole('app_runtime');
        }
        let inserted;
        if (this.readingCrypto) {
          inserted = await repos.readings.insertEncryptedReadingRecord({ userId: user.id, birthProfileId: profile.id, record, encryptedPayload: encrypted, idempotencyKey: key });
          inserted = rawRecord(inserted, record);
        } else inserted = await repos.readings.insertReadingRecord({ userId: user.id, birthProfileId: profile.id, record, idempotencyKey: key });
        return { kind: 'created', value: inserted };
      });
      const item = persisted.kind === 'existing' && this.readingCrypto ? await this.decryptReading(verified, persisted.value) : persisted.value;
      return publicReading(item);
    } catch (error) {
      if (error && error.code === 'DUPLICATE_READING_IDEMPOTENCY_KEY') { const winner = await this.existing({ verified, user, idempotencyKey: key }); if (winner) return publicReading(winner); fail('IDEMPOTENCY_CONFLICT'); }
      safeError(error, 'READING_PERSISTENCE_FAILED');
    }
  }
  async getReadingEntitlementStatus({ principal: principalInput, birthProfileId } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID');
    const domain = 'CAREER';
    if (!this.requiresEntitlement({ domain })) return immutableCopy({ career: { eligible: true } });
    try {
      const access = await this.execute(verified, 'app_runtime', async (context) => this.careerAccessResolver.resolveForProfile({ repositories: this.repo(context), userId: user.id, birthProfileId, at: this.clock() }));
      return immutableCopy({ career: { eligible: access.eligible, mode: access.mode, consuming: access.consuming } });
    } catch (error) { safeError(error, 'ENTITLEMENT_STATUS_FAILED'); }
  }
  async getSecureReading({ principal: principalInput, readingId } = {}) {
    const { verified, user } = await this.resolve(principalInput); const id = requiredString(readingId, 'INVALID_READING_ID');
    try { const item = this.readingCrypto ? await this.decryptReading(verified, await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getEncryptedReadingRecord(id))) : await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getReadingRecord(id)); if (!item || item.userId !== user.id) fail('NOT_FOUND_OR_FORBIDDEN'); return immutableCopy({ readingId: item.readingId, birthProfileId: item.birthProfileId, status: item.status, record: item.record }); } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
  }
  async listSecureReadings({ principal: principalInput, birthProfileId } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    const profileId = birthProfileId === undefined ? null : requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID');
    if (profileId !== null) {
      try {
        const profile = this.secureBirthProfileLoader
          ? await this.secureBirthProfileLoader.get({ principal: verified, birthProfileId: profileId })
          : await this.execute(verified, 'app_runtime', async (context) => this.repo(context).birthProfiles.getBirthProfile(profileId));
        if (!profile || (!this.secureBirthProfileLoader && profile.userId !== user.id)) fail('NOT_FOUND_OR_FORBIDDEN');
      } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
    }
    try {
      const raw = await this.execute(verified, 'app_runtime', async (context) => {
        const readings = this.repo(context).readings;
        if (this.readingCrypto) {
          const method = profileId === null ? readings.listEncryptedReadingRecordsForUser : readings.listEncryptedReadingRecordsForBirthProfile;
          if (typeof method !== 'function') fail('INVALID_APPLICATION_REPOSITORIES');
          return method.call(readings, profileId === null ? user.id : profileId, 50);
        }
        const method = profileId === null ? readings.listReadingRecordsForUser : readings.listReadingRecordsForBirthProfile;
        return method.call(readings, profileId === null ? user.id : profileId).slice(0, 50);
      });
      const records = this.readingCrypto ? await Promise.all(raw.map((item) => this.decryptReading(verified, item))) : raw;
      return immutableCopy(records.filter((item) => item.userId === user.id).map(publicReadingSummary));
    } catch (error) { safeError(error, 'READING_LIST_FAILED'); }
  }
  async getSecureReadingDetail(input = {}) { return publicReadingDetail(await this.getSecureReading(input)); }
  async replaySecureReading({ principal: principalInput, readingId, astronomicalRuntime } = {}) {
    const secure = await this.getSecureReading({ principal: principalInput, readingId });
    try { return immutableCopy({ readingId: secure.readingId, replay: await this.replayReading({ record: secure.record, astronomicalRuntime }) }); } catch (error) { safeError(error, 'READING_INTEGRITY_FAILED'); }
  }
}

module.exports = { SecureReadingService };
