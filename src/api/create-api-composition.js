'use strict';

const { PostgresApplicationTransactionExecutor, SecureReadingService, CareerReadingInterpreter, CalibratedCareerReadingGenerator } = require('../application/readings');
const { SecureBirthProfileService } = require('../application/birth-profiles');
const { NatalSummaryService } = require('../application/natal-summary');
const { DivisionalChartService } = require('../application/divisional-charts');
const { VimshottariService } = require('../application/vimshottari');
const { TransitSnapshotService } = require('../application/transit-snapshot');
const { AshtakavargaService } = require('../application/ashtakavarga');
const { CareerEventService, CareerEventAstrologyService, CareerPatternComparisonService, CareerFutureRecurrenceService, CareerReadingContextBuilder } = require('../application/career-events');
const { PostgresUserRepository, PostgresBirthProfileRepository, PostgresReadingRepository, PostgresEntitlementRepository, PostgresCareerEventRepository } = require('../persistence');
const { PostgresUserKeyEnvelopeStore, UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../security/crypto');
const { resolveOrProvisionAppUser } = require('../security/auth');

function req(value, name) {
  if (!value) throw new TypeError(`INVALID_${name}`);
  return value;
}

function createApiComposition({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, placeResolver = null, idGenerator, clock, requiresEntitlement = () => true, corsAllowlist, isReady, logger, bodyLimit } = {}) {
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
      careerEvents: new PostgresCareerEventRepository({ db: client }),
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
  const careerEventService = new CareerEventService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, birthProfileService, idGenerator, clock });
  const natalSummaryService = new NatalSummaryService({ birthProfileService, astronomicalEngine });
  const divisionalChartService = new DivisionalChartService({ birthProfileService, astronomicalEngine });
  const vimshottariService = new VimshottariService({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler });
  const transitSnapshotService = new TransitSnapshotService({ birthProfileService, astronomicalEngine });
  const ashtakavargaService = new AshtakavargaService({ birthProfileService, astronomicalEngine });
  const careerEventAstrologyService = new CareerEventAstrologyService({ careerEventService, birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, divisionalChartService, ashtakavargaService });
  const careerPatternComparisonService = new CareerPatternComparisonService({ careerEventService, careerEventAstrologyService });
  const careerFutureRecurrenceService = new CareerFutureRecurrenceService({ careerPatternComparisonService, birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, ashtakavargaService, clock });
  const careerReadingContextBuilder = new CareerReadingContextBuilder({ careerEventService, careerPatternComparisonService, careerFutureRecurrenceService });
  const baseReadingGenerator = {
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
  const calibrationGenerator = { generate: async ({ interpretationInput }) => ({ schemaVersion: interpretationInput.schemaVersion, calibrationSummary: { calibrationLevel: interpretationInput.calibrationLevel, narrative: interpretationInput.calibrationLevel === 'CALIBRATED' && interpretationInput.historicalEvidence.length === 0 ? 'No recurring evidence is available.' : 'This context deserves attention.', eventCount: interpretationInput.eventCount }, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: [], disclosure: { hasProvisionalEvidence: interpretationInput.hasProvisionalEvidence } }) };
  const careerReadingInterpreter = new CareerReadingInterpreter({ careerReadingContextBuilder, generator: calibrationGenerator });
  const readingGenerator = new CalibratedCareerReadingGenerator({ baseGenerator: baseReadingGenerator, careerReadingContextBuilder, careerReadingInterpreter });
  const { createReadingRecord, replayPersistedReading } = require('../readings');
  const secureReadingService = new SecureReadingService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, secureBirthProfileLoader: birthProfileService, readingCryptoCoordinator: cryptoCoordinator, readingGenerator, readingRecordFactory: createReadingRecord, replayReading: replayPersistedReading, requiresEntitlement, idGenerator, clock });
  const { PlaceResolutionService } = require('./place-resolution-service');
  const placeResolutionService = placeResolver ? new PlaceResolutionService({ birthPlaceResolver: placeResolver }) : null;
  const api = createApi({ authVerifier, userResolver: { resolve: userResolver }, birthProfileService, careerEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, ashtakavargaService, secureReadingService, placeResolutionService, requestIdGenerator: idGenerator, corsAllowlist, isReady, logger, bodyLimit });
  api.apiRuntime = { astronomicalEngine, canonicalSiderealSunSampler };
  return Object.freeze({ api, services: Object.freeze({ birthProfileService, careerEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, secureReadingService, userResolver, transactionExecutor: tx }) });
}

module.exports = { createApiComposition };
