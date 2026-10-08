'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy } = require('../../persistence/contracts');
const { BirthProfilePayloadCodec } = require('../../security/crypto');

function fail(code) { throw repositoryError(code); }
function dto(profile) { return immutableCopy({ id: profile.id, displayLabel: profile.displayLabel, birthData: profile.birthData, status: profile.status, createdAt: profile.createdAt, updatedAt: profile.updatedAt }); }
function scopedKeyProvider(key) { return Object.freeze({ current: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }), forVersion: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }) }); }
function encryptedPayload(value) { return Object.freeze({ ciphertext: value.ciphertext, nonce: value.nonce, algorithm: value.algorithm, encryptionVersion: value.encryptionVersion, keyVersion: value.keyVersion }); }
function safeErrorCode(error) { return error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,127}$/.test(error.code) ? error.code : 'UNKNOWN_ERROR'; }

class SecureBirthProfileService {
  constructor({ authUserResolver, transactionExecutor, repositories, cryptoCoordinator, idGenerator, clock, listDiagnosticObserver } = {}) {
    this.auth = authUserResolver; this.tx = transactionExecutor; this.repos = repositories; this.crypto = cryptoCoordinator || null; this.ids = idGenerator; this.clock = clock; this.listDiagnosticObserver = listDiagnosticObserver || null;
    if (!this.auth || !this.tx || !this.repos || !this.ids || !this.clock) fail('INVALID_BIRTH_PROFILE_SERVICE');
    if (this.crypto && (typeof this.crypto.current !== 'function' || typeof this.crypto.forVersion !== 'function')) fail('INVALID_BIRTH_PROFILE_SERVICE');
    if (this.listDiagnosticObserver && typeof this.listDiagnosticObserver !== 'function') fail('INVALID_BIRTH_PROFILE_SERVICE');
  }
  listDiagnostic({ requestId, stage, outcome, error } = {}) { if (!this.listDiagnosticObserver || typeof requestId !== 'string' || typeof stage !== 'string' || typeof outcome !== 'string') return; try { this.listDiagnosticObserver(Object.freeze({ requestId, stage, outcome, ...(error ? { safeErrorCode: safeErrorCode(error) } : {}) })); } catch {} }
  async user(principal) { const verified = verifiedPrincipal(principal); if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED'); const user = await this.auth(verified); if (!user || user.status !== 'active') fail('APP_USER_DISABLED'); return [verified, user]; }
  async runRuntime(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation: async (context) => operation(this.repos(context)) }); }
  async withKey(key, operation) { try { return await operation(new BirthProfilePayloadCodec({ userDekProvider: scopedKeyProvider(key) })); } finally { if (key && Buffer.isBuffer(key.dek)) key.dek.fill(0); } }
  profile(row, birthData) { return { id: row.id, userId: row.userId, displayLabel: row.displayLabel, birthData, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt }; }
  async decrypt(principal, row) { const key = await this.crypto.forVersion(principal, row.userId, row.keyVersion); const birthData = await this.withKey(key, (codec) => codec.decodeBirthData({ userId: row.userId, profileId: row.id, ciphertext: row.ciphertext, nonce: row.nonce, algorithm: row.algorithm, encryptionVersion: row.encryptionVersion, keyVersion: row.keyVersion })); return this.profile(row, birthData); }
  async create({ principal, birthData, displayLabel }) {
    const [verified, user] = await this.user(principal);
    if (!this.crypto) { try { return dto(await this.runRuntime(verified, (repos) => repos.birthProfiles.createBirthProfile({ id: this.ids(), userId: user.id, birthData, displayLabel: displayLabel === undefined ? null : displayLabel, createdAt: this.clock() }))); } catch { fail('BIRTH_PROFILE_CREATE_FAILED'); } }
    const id = this.ids(); let payload;
    try { const key = await this.crypto.current(verified, user.id); payload = await this.withKey(key, (codec) => codec.encodeBirthData({ userId: user.id, profileId: id, birthData })); } catch { fail('BIRTH_PROFILE_CREATE_FAILED'); }
    try { const row = await this.runRuntime(verified, (repos) => repos.birthProfiles.createEncryptedBirthProfile({ id, userId: user.id, displayLabel: displayLabel === undefined ? null : displayLabel, encryptedPayload: encryptedPayload(payload), createdAt: this.clock() })); return dto(this.profile(row, birthData)); } catch { fail('BIRTH_PROFILE_CREATE_FAILED'); }
  }
  async list({ principal, requestId } = {}) {
    this.listDiagnostic({ requestId, stage: 'APP_USER_RESOLUTION', outcome: 'START' });
    let verified; let user;
    try { [verified, user] = await this.user(principal); this.listDiagnostic({ requestId, stage: 'APP_USER_RESOLUTION', outcome: 'SUCCESS' }); }
    catch (error) { this.listDiagnostic({ requestId, stage: 'APP_USER_RESOLUTION', outcome: 'FAILURE', error }); throw error; }

    let stage = 'PROFILE_REPOSITORY_LIST';
    try {
      if (!this.crypto) {
        this.listDiagnostic({ requestId, stage: 'PROFILE_REPOSITORY_LIST', outcome: 'START' });
        const profiles = (
          await this.runRuntime(
            verified,
            (repos) => repos.birthProfiles.listBirthProfilesForUser(user.id),
          )
        ).map(dto);
        this.listDiagnostic({ requestId, stage: 'PROFILE_REPOSITORY_LIST', outcome: 'SUCCESS' });
        return profiles;
      }

      this.listDiagnostic({ requestId, stage: 'PROFILE_REPOSITORY_LIST', outcome: 'START' });
      const rows = await this.runRuntime(
        verified,
        (repos) => repos.birthProfiles.listEncryptedBirthProfilesForUser(user.id),
      );
      this.listDiagnostic({ requestId, stage: 'PROFILE_REPOSITORY_LIST', outcome: 'SUCCESS' });

      stage = 'PROFILE_DECRYPTION';
      this.listDiagnostic({ requestId, stage, outcome: 'START' });
      const profiles = (await Promise.all(
        rows.map((row) => this.decrypt(verified, row)),
      )).map(dto);
      this.listDiagnostic({ requestId, stage, outcome: 'SUCCESS' });
      return profiles;
    } catch (error) {
      this.listDiagnostic({ requestId, stage, outcome: 'FAILURE', error });
      fail('NOT_FOUND_OR_FORBIDDEN');
    }
  }
  async get({ principal, birthProfileId }) { const [verified, user] = await this.user(principal); try { const item = this.crypto ? await this.decrypt(verified, await this.runRuntime(verified, (repos) => repos.birthProfiles.getEncryptedBirthProfile(birthProfileId))) : await this.runRuntime(verified, (repos) => repos.birthProfiles.getBirthProfile(birthProfileId)); if (item.userId !== user.id) fail('NOT_FOUND_OR_FORBIDDEN'); return dto(item); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
}

module.exports = { SecureBirthProfileService };
