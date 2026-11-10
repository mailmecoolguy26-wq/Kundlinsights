'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy } = require('../../persistence/contracts');
const { BirthProfilePayloadCodec } = require('../../security/crypto');

function fail(code) { throw repositoryError(code); }
function dto(profile) { return immutableCopy({ id: profile.id, displayLabel: profile.displayLabel, birthData: profile.birthData, status: profile.status, createdAt: profile.createdAt, updatedAt: profile.updatedAt }); }
function scopedKeyProvider(key) { return Object.freeze({ current: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }), forVersion: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }) }); }
function encryptedPayload(value) { return Object.freeze({ ciphertext: value.ciphertext, nonce: value.nonce, algorithm: value.algorithm, encryptionVersion: value.encryptionVersion, keyVersion: value.keyVersion }); }

class SecureBirthProfileService {
  constructor({ authUserResolver, transactionExecutor, repositories, cryptoCoordinator, reverseGeocodingProvider = null, idGenerator, clock, recoveryRetryMilliseconds = 300000 } = {}) {
    this.auth = authUserResolver; this.tx = transactionExecutor; this.repos = repositories; this.crypto = cryptoCoordinator || null; this.ids = idGenerator; this.clock = clock;
    this.reverseGeocoder = reverseGeocodingProvider && typeof reverseGeocodingProvider.reverseGeocode === 'function' ? reverseGeocodingProvider : null;
    this.recoveryRetryMilliseconds = recoveryRetryMilliseconds;
    this.recoveryRetryAfter = new Map();
    if (!this.auth || !this.tx || !this.repos || !this.ids || !this.clock) fail('INVALID_BIRTH_PROFILE_SERVICE');
    if (this.crypto && (typeof this.crypto.current !== 'function' || typeof this.crypto.forVersion !== 'function')) fail('INVALID_BIRTH_PROFILE_SERVICE');
    if (!Number.isInteger(this.recoveryRetryMilliseconds) || this.recoveryRetryMilliseconds < 0) fail('INVALID_BIRTH_PROFILE_SERVICE');
  }
  async user(principal) { const verified = verifiedPrincipal(principal); if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED'); const user = await this.auth(verified); if (!user || user.status !== 'active') fail('APP_USER_DISABLED'); return [verified, user]; }
  async runRuntime(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation: async (context) => operation(this.repos(context)) }); }
  async withKey(key, operation) { try { return await operation(new BirthProfilePayloadCodec({ userDekProvider: scopedKeyProvider(key) })); } finally { if (key && Buffer.isBuffer(key.dek)) key.dek.fill(0); } }
  profile(row, birthData) { return { id: row.id, userId: row.userId, displayLabel: row.displayLabel, birthData, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt, archivedAt: row.archivedAt }; }
  async decrypt(principal, row) { const key = await this.crypto.forVersion(principal, row.userId, row.keyVersion); const birthData = await this.withKey(key, (codec) => codec.decodeBirthData({ userId: row.userId, profileId: row.id, ciphertext: row.ciphertext, nonce: row.nonce, algorithm: row.algorithm, encryptionVersion: row.encryptionVersion, keyVersion: row.keyVersion })); return this.profile(row, birthData); }
  diagnostic(log, profileId, recoveryStatus, reasonCode = null) { if (typeof log !== 'function') return; try { log(Object.freeze({ event: 'LEGACY_BIRTH_LOCATION_RECOVERY', profileId, recoveryStatus, provider: this.reverseGeocoder ? 'google-geocoding' : null, reasonCode })); } catch {} }
  usableLocation(value) { return typeof value === 'string' && value.trim().length > 0; }
  validCoordinates(birthData) { return birthData && Number.isFinite(birthData.latitude) && birthData.latitude >= -90 && birthData.latitude <= 90 && Number.isFinite(birthData.longitude) && birthData.longitude >= -180 && birthData.longitude <= 180; }
  async encodeRecovery(principal, profile, displayLocation) { const key = await this.crypto.current(principal, profile.userId); return this.withKey(key, (codec) => codec.encodeBirthData({ userId: profile.userId, profileId: profile.id, birthData: { ...profile.birthData, displayLocation } })); }
  async recoverLegacyLocation({ principal, user, row, profile, diagnosticLog }) {
    if (this.usableLocation(profile.birthData.displayLocation)) { this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_ALREADY_PRESENT'); return profile; }
    if (!this.validCoordinates(profile.birthData)) { this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_INVALID_COORDINATES', 'INVALID_COORDINATES'); return profile; }
    if (!this.reverseGeocoder) { this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_NOT_REQUIRED', 'PROVIDER_UNAVAILABLE'); return profile; }
    const retryAfter = this.recoveryRetryAfter.get(profile.id) || 0;
    if (Date.now() < retryAfter) { this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_RECOVERY_FAILED', 'RETRY_DEFERRED'); return profile; }
    this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_RECOVERY_STARTED');
    try {
      const resolved = await this.reverseGeocoder.reverseGeocode({ latitude: profile.birthData.latitude, longitude: profile.birthData.longitude });
      if (!resolved || !this.usableLocation(resolved.displayName)) throw Object.assign(new Error('Location unavailable.'), { code: 'PLACE_NOT_FOUND' });
      const displayLocation = resolved.displayName.trim();
      const payload = await this.encodeRecovery(principal, profile, displayLocation);
      const saved = await this.runRuntime(principal, (repos) => repos.birthProfiles.recoverEncryptedBirthProfileLocation({ id: profile.id, userId: user.id, expectedUpdatedAt: row.updatedAt, encryptedPayload: encryptedPayload(payload), updatedAt: this.clock() }));
      if (saved) {
        this.recoveryRetryAfter.delete(profile.id);
        this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_RECOVERY_SUCCEEDED');
        return this.profile(saved, { ...profile.birthData, displayLocation });
      }
      const latestRow = await this.runRuntime(principal, (repos) => repos.birthProfiles.getEncryptedBirthProfile(profile.id));
      const latest = await this.decrypt(principal, latestRow);
      this.diagnostic(diagnosticLog, profile.id, this.usableLocation(latest.birthData.displayLocation) ? 'LEGACY_LOCATION_ALREADY_PRESENT' : 'LEGACY_LOCATION_RECOVERY_FAILED', 'CONCURRENT_UPDATE');
      return latest;
    } catch (error) {
      this.recoveryRetryAfter.set(profile.id, Date.now() + this.recoveryRetryMilliseconds);
      const reason = error && typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'RECOVERY_UNAVAILABLE';
      this.diagnostic(diagnosticLog, profile.id, 'LEGACY_LOCATION_RECOVERY_FAILED', reason);
      return profile;
    }
  }
  async create({ principal, birthData, displayLabel }) {
    const [verified, user] = await this.user(principal);
    if (!this.crypto) { try { return dto(await this.runRuntime(verified, (repos) => repos.birthProfiles.createBirthProfile({ id: this.ids(), userId: user.id, birthData, displayLabel: displayLabel === undefined ? null : displayLabel, createdAt: this.clock() }))); } catch { fail('BIRTH_PROFILE_CREATE_FAILED'); } }
    const id = this.ids(); let payload;
    try { const key = await this.crypto.current(verified, user.id); payload = await this.withKey(key, (codec) => codec.encodeBirthData({ userId: user.id, profileId: id, birthData })); } catch { fail('BIRTH_PROFILE_CREATE_FAILED'); }
    try { const row = await this.runRuntime(verified, (repos) => repos.birthProfiles.createEncryptedBirthProfile({ id, userId: user.id, displayLabel: displayLabel === undefined ? null : displayLabel, encryptedPayload: encryptedPayload(payload), createdAt: this.clock() })); return dto(this.profile(row, birthData)); } catch { fail('BIRTH_PROFILE_CREATE_FAILED'); }
  }
  async list({ principal, diagnosticLog } = {}) {
    const [verified, user] = await this.user(principal);
    try {
      if (!this.crypto) {
        const profiles = (
          await this.runRuntime(
            verified,
            (repos) => repos.birthProfiles.listBirthProfilesForUser(user.id),
          )
        ).map(dto);
        return profiles;
      }

      const rows = await this.runRuntime(
        verified,
        (repos) => repos.birthProfiles.listEncryptedBirthProfilesForUser(user.id),
      );
      const decrypted = await Promise.all(rows.map((row) => this.decrypt(verified, row)));
      const profiles = (await Promise.all(decrypted.map((profile, index) => this.recoverLegacyLocation({ principal: verified, user, row: rows[index], profile, diagnosticLog })))).map(dto);
      return profiles;
    } catch {
      fail('NOT_FOUND_OR_FORBIDDEN');
    }
  }
  async get({ principal, birthProfileId }) { const [verified, user] = await this.user(principal); try { const item = this.crypto ? await this.decrypt(verified, await this.runRuntime(verified, (repos) => repos.birthProfiles.getEncryptedBirthProfile(birthProfileId))) : await this.runRuntime(verified, (repos) => repos.birthProfiles.getBirthProfile(birthProfileId)); if (item.userId !== user.id) fail('NOT_FOUND_OR_FORBIDDEN'); return dto(item); } catch { fail('NOT_FOUND_OR_FORBIDDEN'); } }
}

module.exports = { SecureBirthProfileService };
