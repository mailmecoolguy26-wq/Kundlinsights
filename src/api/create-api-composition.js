'use strict';

const { PostgresApplicationTransactionExecutor, SecureReadingService } = require('../application/readings');
const { SecureBirthProfileService } = require('../application/birth-profiles');
const { PostgresUserRepository, PostgresBirthProfileRepository, PostgresReadingRepository, PostgresEntitlementRepository } = require('../persistence');
const { PostgresUserKeyEnvelopeStore, UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../security/crypto');
const { resolveOrProvisionAppUser } = require('../security/auth');

function req(value, name) {
  if (!value) throw new TypeError(`INVALID_${name}`);
  return value;
}

function createApiComposition({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, idGenerator, clock, requiresEntitlement = () => true } = {}) {
  const { createApi } = require('./index');
  req(db, 'DB'); req(authVerifier, 'AUTH_VERIFIER'); req(kms, 'KMS');
  req(astronomicalEngine, 'ASTRONOMICAL_ENGINE'); req(canonicalSiderealSunSampler, 'SUN_SAMPLER');
  req(idGenerator, 'ID_GENERATOR'); req(clock, 'CLOCK');

  const tx = new PostgresApplicationTransactionExecutor({ db });
  const cryptoCoordinator = Object.freeze({
    current: async (principal, userId) => tx.execute({
      principal, role: 'app_crypto', operation: async ({ db: client }) => {
        const deks = new UserDekProvider({ kms, envelopeStore: new PostgresUserKeyEnvelopeStore({ db: client }), idGenerator, now: clock });
        try { return await deks.current(userId); }
        catch (error) {
          if (!error || error.code !== 'DEK_NOT_AVAILABLE') throw error;
          try { await deks.provisionUserDek(userId); }
          catch (provisionError) { if (!provisionError || provisionError.code !== 'ACTIVE_KEY_ENVELOPE_EXISTS') throw provisionError; }
          return deks.current(userId);
        }
      },
    }),
    forVersion: async (principal, userId, keyVersion) => tx.execute({
      principal, role: 'app_crypto', operation: async ({ db: client }) => new UserDekProvider({ kms, envelopeStore: new PostgresUserKeyEnvelopeStore({ db: client }), idGenerator, now: clock }).forVersion({ userId, keyVersion }),
    }),
  });
  const repositories = ({ db: client }) => {
    const envelopes = new PostgresUserKeyEnvelopeStore({ db: client });
    const deks = new UserDekProvider({ kms, envelopeStore: envelopes, idGenerator, now: clock });
    const birthCodec = new BirthProfilePayloadCodec({ userDekProvider: deks });
    const readingCodec = new ReadingPayloadCodec({ userDekProvider: deks });
    return {
      users: new PostgresUserRepository({ db: client }),
      birthProfiles: new PostgresBirthProfileRepository({ db: client, birthProfilePayloadCodec: birthCodec }),
      readings: new PostgresReadingRepository({ db: client, readingPayloadCodec: readingCodec }),
      entitlements: new PostgresEntitlementRepository({ db: client }),
      envelopes,
      deks,
    };
  };
  const userResolver = async (principal) => tx.execute({
    principal,
    role: 'app_runtime',
    operation: ({ db: client }) => resolveOrProvisionAppUser({ principal, userRepository: new PostgresUserRepository({ db: client }), idGenerator, now: clock }),
  });
  const birthProfileService = new SecureBirthProfileService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, cryptoCoordinator, idGenerator, clock });
  const readingGenerator = {
    generate: async ({ birthProfile }) => {
      const { BirthCareerReadingOrchestrator } = require('../orchestration');
      const { createResolvedBirthPlace } = require('../place');
      const orchestrator = new BirthCareerReadingOrchestrator({ astronomicalEngine, dashaRulesetId: 'vimshottari-longitude-proportional-solar-return-v1', canonicalSiderealSunSampler });
      const birth = birthProfile.birthData;
      const place = createResolvedBirthPlace({ provider: 'persisted', providerPlaceId: birthProfile.id, latitude: birth.latitude, longitude: birth.longitude, timezone: birth.timezone, timezoneResolver: birth.timezoneProvenance });
      const result = orchestrator.generate({ birth: { date: birth.localDate, time: birth.localTime, place }, readingInstant: clock(), locale: 'en-IN' });
      return { input: { birth: { ...birth, placeResolution: { resolutionVersion: place.resolutionVersion, timezoneResolver: birth.timezoneProvenance }, display: null }, readingInstant: clock(), transitScanRange: null, locale: 'en-IN' }, result };
    },
  };
  const { createReadingRecord, replayPersistedReading } = require('../readings');
  const secureReadingService = new SecureReadingService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, secureBirthProfileLoader: birthProfileService, readingCryptoCoordinator: cryptoCoordinator, readingGenerator, readingRecordFactory: createReadingRecord, replayReading: replayPersistedReading, requiresEntitlement, idGenerator, clock });
  const api = createApi({ authVerifier, userResolver: { resolve: userResolver }, birthProfileService, secureReadingService, requestIdGenerator: idGenerator });
  api.apiRuntime = { astronomicalEngine, canonicalSiderealSunSampler };
  return Object.freeze({ api, services: Object.freeze({ birthProfileService, secureReadingService, userResolver, transactionExecutor: tx }) });
}

module.exports = { createApiComposition };
