'use strict';

const { PostgresApplicationTransactionExecutor, SecureReadingService, CareerReadingInterpreter, CalibratedCareerReadingGenerator, CareerReadingPromptBuilder, ProviderBackedCareerGenerator } = require('../application/readings');
const { OpenAICareerGenerationAdapter } = require('../infrastructure/ai/openai-career-generation-adapter');
const { SecureBirthProfileService } = require('../application/birth-profiles');
const { NatalSummaryService } = require('../application/natal-summary');
const { DivisionalChartService } = require('../application/divisional-charts');
const { VimshottariService } = require('../application/vimshottari');
const { TransitSnapshotService } = require('../application/transit-snapshot');
const { AshtakavargaService } = require('../application/ashtakavarga');
const { CareerEventService, CareerEventAstrologyService, CareerPatternComparisonService, CareerFutureRecurrenceService, CareerReadingContextBuilder } = require('../application/career-events');
const { PostgresUserRepository, PostgresBirthProfileRepository, PostgresReadingRepository, PostgresEntitlementRepository, PostgresCareerEventRepository, PostgresPurchaseRepository, PostgresSubscriptionRepository, PostgresPaymentEventRepository } = require('../persistence');
const { PostgresPaymentUnitOfWork } = require('../payment/unit-of-work');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../payment/purchase-services');
const { CareerAccessResolver } = require('../application/readings');
const { AppleSignedDataVerifierFactory, AppleSignedDataVerifier } = require('../payment/apple/apple-signed-data-verifier');
const { ApplePurchaseVerifier } = require('../payment/apple/apple-purchase-verifier');
const { AppleNotificationVerifier } = require('../payment/apple/apple-notification-verifier');
const { AppleNotificationService } = require('../payment/apple/apple-notification-service');
const { AppleSubscriptionLifecycleReconciler } = require('../payment/apple/apple-subscription-lifecycle-reconciler');
const { GooglePurchaseVerifier } = require('../payment/google/google-purchase-verifier');
const { GooglePlayApiClient } = require('../payment/google/google-play-api-client');
const { PostgresUserKeyEnvelopeStore, UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../security/crypto');
const { resolveOrProvisionAppUser } = require('../security/auth');

function req(value, name) {
  if (!value) throw new TypeError(`INVALID_${name}`);
  return value;
}

function createApiComposition({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, placeResolver = null, openai = null, apple = null, google = null, idGenerator, clock, requiresEntitlement = () => true, corsAllowlist, isReady, logger, bodyLimit, transactionDiagnosticObserver } = {}) {
  const { createApi } = require('./index');
  req(db, 'DB'); req(authVerifier, 'AUTH_VERIFIER'); req(kms, 'KMS');
  req(astronomicalEngine, 'ASTRONOMICAL_ENGINE'); req(canonicalSiderealSunSampler, 'SUN_SAMPLER');
  req(idGenerator, 'ID_GENERATOR'); req(clock, 'CLOCK');

  const tx = new PostgresApplicationTransactionExecutor({ db, diagnosticObserver: transactionDiagnosticObserver });
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
  const repositories = ({ db: client } = { db }) => {
    const envelopes = new PostgresUserKeyEnvelopeStore({ db: client });
    const deks = new UserDekProvider({ kms, envelopeStore: envelopes, idGenerator, now: clock });
    const birthCodec = new BirthProfilePayloadCodec({ userDekProvider: deks });
    const readingCodec = new ReadingPayloadCodec({ userDekProvider: deks });
    return {
      users: new PostgresUserRepository({ db: client }),
      birthProfiles: new PostgresBirthProfileRepository({ db: client, birthProfilePayloadCodec: birthCodec }),
      readings: new PostgresReadingRepository({ db: client, readingPayloadCodec: readingCodec }),
      entitlements: new PostgresEntitlementRepository({ db: client }),
      purchases: new PostgresPurchaseRepository({ db: client }),
      subscriptions: new PostgresSubscriptionRepository({ db: client }),
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
  const calibrationGenerator = openai ? new ProviderBackedCareerGenerator({ promptBuilder: new CareerReadingPromptBuilder(), providerAdapter: new OpenAICareerGenerationAdapter({ apiKey: openai.apiKey, model: openai.careerModel, timeoutMilliseconds: openai.timeoutMilliseconds }), locale: 'en-IN' }) : { generate: async ({ interpretationInput }) => ({ schemaVersion: interpretationInput.schemaVersion, calibrationSummary: { calibrationLevel: interpretationInput.calibrationLevel, narrative: interpretationInput.calibrationLevel === 'CALIBRATED' && interpretationInput.historicalEvidence.length === 0 ? 'No recurring evidence is available.' : 'This context deserves attention.', eventCount: interpretationInput.eventCount }, recurringHistoricalEvidence: [], upcomingRecurrenceWindows: [], decisionConsiderations: [], disclosure: { hasProvisionalEvidence: interpretationInput.hasProvisionalEvidence } }) };
  const careerReadingInterpreter = new CareerReadingInterpreter({ careerReadingContextBuilder, generator: calibrationGenerator });
  const readingGenerator = new CalibratedCareerReadingGenerator({ baseGenerator: baseReadingGenerator, careerReadingContextBuilder, careerReadingInterpreter });
  const { createReadingRecord, replayPersistedReading } = require('../readings');
  const secureReadingService = new SecureReadingService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, secureBirthProfileLoader: birthProfileService, readingCryptoCoordinator: cryptoCoordinator, readingGenerator, readingRecordFactory: createReadingRecord, replayReading: replayPersistedReading, requiresEntitlement, idGenerator, clock });
  const paymentUnitOfWork = new PostgresPaymentUnitOfWork({ pool: db });
  const appleSignedDataVerifier = apple && typeof apple.bundleId === 'string' && apple.bundleId && typeof apple.careerPremiumAnnualProductId === 'string' && apple.careerPremiumAnnualProductId && apple.rootCertificateProvider && typeof apple.rootCertificateProvider.load === 'function' && typeof apple.appAppleId === 'string' && apple.appAppleId
    ? new AppleSignedDataVerifier({ factory: new AppleSignedDataVerifierFactory({ rootCertificateProvider: apple.rootCertificateProvider, bundleId: apple.bundleId, appAppleId: apple.appAppleId, onlineChecks: apple.onlineChecks === true }) })
    : null;
  const appleProvider = appleSignedDataVerifier ? new ApplePurchaseVerifier({ signedDataVerifier: appleSignedDataVerifier, bundleId: apple.bundleId, appleProductId: apple.careerPremiumAnnualProductId, clock: () => Date.parse(clock()) }) : null;
  const appleNotificationService = appleSignedDataVerifier ? new AppleNotificationService({ notificationVerifier: new AppleNotificationVerifier({ signedDataVerifier: appleSignedDataVerifier, bundleId: apple.bundleId, appleProductId: apple.careerPremiumAnnualProductId }), paymentEvents: new PostgresPaymentEventRepository({ db }), lifecycleReconciler: new AppleSubscriptionLifecycleReconciler({ repositories, unitOfWork: paymentUnitOfWork, idGenerator, clock }), idGenerator, clock }) : null;
  const googleProvider = google && typeof google.packageName === 'string' && google.packageName && typeof google.careerPremiumAnnualProductId === 'string' && google.careerPremiumAnnualProductId && google.apiClient
    ? new GooglePurchaseVerifier({ apiClient: google.apiClient, packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId, clock: () => Date.parse(clock()) })
    : google && typeof google.packageName === 'string' && google.packageName && typeof google.careerPremiumAnnualProductId === 'string' && google.careerPremiumAnnualProductId && google.serviceAccount
      ? new GooglePurchaseVerifier({ apiClient: new GooglePlayApiClient({ serviceAccount: google.serviceAccount }), packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId, clock: () => Date.parse(clock()) })
      : null;
  const purchaseProviderRegistry = new PurchaseProviderRegistry({ ...(appleProvider ? { APPLE: appleProvider } : {}), ...(googleProvider ? { GOOGLE: googleProvider } : {}) });
  const purchaseService = new PurchaseVerificationService({ authUserResolver: userResolver, repositories, unitOfWork: paymentUnitOfWork, registry: purchaseProviderRegistry, careerAccessResolver: new CareerAccessResolver(), idGenerator, clock });
  const { PlaceResolutionService } = require('./place-resolution-service');
  const placeResolutionService = placeResolver ? new PlaceResolutionService({ birthPlaceResolver: placeResolver }) : null;
  const api = createApi({ authVerifier, userResolver: { resolve: userResolver }, birthProfileService, careerEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, ashtakavargaService, secureReadingService, purchaseService, appleNotificationService, placeResolutionService, requestIdGenerator: idGenerator, corsAllowlist, isReady, logger, bodyLimit });
  api.apiRuntime = { astronomicalEngine, canonicalSiderealSunSampler };
  return Object.freeze({ api, services: Object.freeze({ birthProfileService, careerEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, secureReadingService, userResolver, transactionExecutor: tx }) });
}

module.exports = { createApiComposition };
