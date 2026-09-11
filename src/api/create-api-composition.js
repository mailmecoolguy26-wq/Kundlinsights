'use strict';

const { PostgresApplicationTransactionExecutor, SecureReadingService, CareerReadingInterpreter, CalibratedCareerReadingGenerator, CareerReadingPromptBuilder, ProviderBackedCareerGenerator } = require('../application/readings');
const { OpenAICareerGenerationAdapter } = require('../infrastructure/ai/openai-career-generation-adapter');
const { SecureBirthProfileService } = require('../application/birth-profiles');
const { NatalSummaryService } = require('../application/natal-summary');
const { DivisionalChartService } = require('../application/divisional-charts');
const { VimshottariService, LatestCareerReadingInsightSource } = require('../application/vimshottari');
const { TransitSnapshotService, LatestCareerReadingTransitSource } = require('../application/transit-snapshot');
const { AshtakavargaService } = require('../application/ashtakavarga');
const { CareerEventService, CareerEventAstrologyService, CareerPatternComparisonService, CareerFutureRecurrenceService, CareerReadingContextBuilder } = require('../application/career-events');
const { PostgresUserRepository, PostgresBirthProfileRepository, PostgresReadingRepository, PostgresEntitlementRepository, PostgresCareerEventRepository, PostgresPurchaseRepository, PostgresSubscriptionRepository, PostgresProfileEntitlementRepository, PostgresPaymentEventRepository, PostgresProviderPaymentOrderRepository } = require('../persistence');
const { PostgresPaymentUnitOfWork } = require('../payment/unit-of-work');
const { PurchaseProviderRegistry, PurchaseVerificationService } = require('../payment/purchase-services');
const { ProfileUnlockAssignmentService } = require('../payment/profile-unlock-assignment-service');
const { CareerAccessResolver } = require('../application/readings');
const { AppleSignedDataVerifierFactory, AppleSignedDataVerifier } = require('../payment/apple/apple-signed-data-verifier');
const { ApplePurchaseVerifier } = require('../payment/apple/apple-purchase-verifier');
const { AppleNotificationVerifier } = require('../payment/apple/apple-notification-verifier');
const { AppleNotificationService } = require('../payment/apple/apple-notification-service');
const { AppleSubscriptionLifecycleReconciler } = require('../payment/apple/apple-subscription-lifecycle-reconciler');
const { GooglePurchaseVerifier } = require('../payment/google/google-purchase-verifier');
const { GooglePlayApiClient } = require('../payment/google/google-play-api-client');
const { createGooglePubSubAuthVerifier } = require('../payment/google/google-pubsub-auth-verifier');
const { decodeGoogleRtdn } = require('../payment/google/google-rtdn-decoder');
const { GoogleRtdnService } = require('../payment/google/google-rtdn-service');
const { GoogleSubscriptionLifecycleReconciler, normalizeGoogleSubscription } = require('../payment/google/google-subscription-lifecycle-reconciler');
const { RazorpayPaymentService } = require('../payment/razorpay/razorpay-payment-service');
const { RazorpayApiClient } = require('../payment/razorpay/razorpay-api-client');
const { createRazorpayProductCatalog } = require('../payment/razorpay/razorpay-product-catalog');
const { PostgresUserKeyEnvelopeStore, UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../security/crypto');
const { resolveOrProvisionAppUser } = require('../security/auth');

function req(value, name) {
  if (!value) throw new TypeError(`INVALID_${name}`);
  return value;
}

function createApiComposition({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, placeResolver = null, openai = null, apple = null, google = null, razorpay = null, idGenerator, clock, requiresEntitlement = () => true, corsAllowlist, isReady, logger, bodyLimit, transactionDiagnosticObserver } = {}) {
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
  const repositories = ({ db: client, principal } = { db }) => {
    const envelopes = new PostgresUserKeyEnvelopeStore({ db: client });
    const deks = principal ? { current: (userId) => cryptoCoordinator.current(principal, userId), forVersion: ({ userId, keyVersion }) => cryptoCoordinator.forVersion(principal, userId, keyVersion) } : new UserDekProvider({ kms, envelopeStore: envelopes, idGenerator, now: clock });
    const birthCodec = new BirthProfilePayloadCodec({ userDekProvider: deks });
    const readingCodec = new ReadingPayloadCodec({ userDekProvider: deks });
    return {
      users: new PostgresUserRepository({ db: client }),
      birthProfiles: new PostgresBirthProfileRepository({ db: client, birthProfilePayloadCodec: birthCodec }),
      readings: new PostgresReadingRepository({ db: client, readingPayloadCodec: readingCodec }),
      entitlements: new PostgresEntitlementRepository({ db: client }),
      purchases: new PostgresPurchaseRepository({ db: client }),
      subscriptions: new PostgresSubscriptionRepository({ db: client }),
      profileEntitlements: new PostgresProfileEntitlementRepository({ db: client }),
      providerPaymentOrders: new PostgresProviderPaymentOrderRepository({ db: client }),
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
  const { CareerChatOrchestrator } = require('../application/career-chat');
  const careerChatOrchestrator = new CareerChatOrchestrator({ secureReadingService });
  const transitSnapshotService = new TransitSnapshotService({ birthProfileService, astronomicalEngine, careerInsightSource: new LatestCareerReadingTransitSource({ secureReadingService }) });
  const vimshottariService = new VimshottariService({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, careerInsightSource: new LatestCareerReadingInsightSource({ secureReadingService }), clock });
  const paymentUnitOfWork = new PostgresPaymentUnitOfWork({ pool: db, birthProfileRepositoryFactory: (client) => repositories({ db: client }).birthProfiles });
  const appleSignedDataVerifier = apple && typeof apple.bundleId === 'string' && apple.bundleId && typeof apple.careerPremiumAnnualProductId === 'string' && apple.careerPremiumAnnualProductId && apple.rootCertificateProvider && typeof apple.rootCertificateProvider.load === 'function' && typeof apple.appAppleId === 'string' && apple.appAppleId
    ? new AppleSignedDataVerifier({ factory: new AppleSignedDataVerifierFactory({ rootCertificateProvider: apple.rootCertificateProvider, bundleId: apple.bundleId, appAppleId: apple.appAppleId, onlineChecks: apple.onlineChecks === true }) })
    : null;
  const appleProvider = appleSignedDataVerifier ? new ApplePurchaseVerifier({ signedDataVerifier: appleSignedDataVerifier, bundleId: apple.bundleId, appleProductId: apple.careerPremiumAnnualProductId, clock: () => Date.parse(clock()) }) : null;
  const appleNotificationService = appleSignedDataVerifier ? new AppleNotificationService({ notificationVerifier: new AppleNotificationVerifier({ signedDataVerifier: appleSignedDataVerifier, bundleId: apple.bundleId, appleProductId: apple.careerPremiumAnnualProductId }), paymentEvents: new PostgresPaymentEventRepository({ db }), lifecycleReconciler: new AppleSubscriptionLifecycleReconciler({ repositories, unitOfWork: paymentUnitOfWork, idGenerator, clock }), idGenerator, clock }) : null;
  const googleProvider = google && typeof google.packageName === 'string' && google.packageName && (google.careerPremiumAnnualProductId || google.careerProfileUnlockProductId) && google.apiClient
    ? new GooglePurchaseVerifier({ apiClient: google.apiClient, packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId, googleProfileUnlockProductId: google.careerProfileUnlockProductId, clock: () => Date.parse(clock()) })
    : google && typeof google.packageName === 'string' && google.packageName && (google.careerPremiumAnnualProductId || google.careerProfileUnlockProductId) && google.serviceAccount
      ? new GooglePurchaseVerifier({ apiClient: new GooglePlayApiClient({ serviceAccount: google.serviceAccount }), packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId, googleProfileUnlockProductId: google.careerProfileUnlockProductId, clock: () => Date.parse(clock()) })
      : null;
  const googleApiClient = googleProvider && google && google.apiClient ? google.apiClient : googleProvider && google && google.serviceAccount ? new GooglePlayApiClient({ serviceAccount: google.serviceAccount }) : null;
  const googleRtdnService = googleApiClient && google && google.careerPremiumAnnualProductId && google.rtdn && typeof google.rtdn.audience === 'string' && typeof google.rtdn.allowedServiceAccountEmail === 'string'
    ? new GoogleRtdnService({
      pubsubAuthVerifier: google.rtdn.authVerifier || createGooglePubSubAuthVerifier({ audience: google.rtdn.audience, allowedServiceAccountEmail: google.rtdn.allowedServiceAccountEmail }),
      decoder: decodeGoogleRtdn,
      apiClient: googleApiClient,
      packageName: google.packageName,
      googleProductId: google.careerPremiumAnnualProductId,
      paymentEvents: new PostgresPaymentEventRepository({ db }),
      lifecycleReconciler: Object.assign(new GoogleSubscriptionLifecycleReconciler({ repositories, unitOfWork: paymentUnitOfWork, idGenerator, clock }), { normalize: (input) => normalizeGoogleSubscription({ ...input, packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId }) }),
      idGenerator,
      clock,
    })
    : null;
  const purchaseProviderRegistry = new PurchaseProviderRegistry({ ...(appleProvider ? { APPLE: appleProvider } : {}), ...(googleProvider ? { GOOGLE: googleProvider } : {}) });
  const profileUnlockAssignmentService = new ProfileUnlockAssignmentService({ unitOfWork: paymentUnitOfWork, idGenerator, clock });
  const purchaseService = new PurchaseVerificationService({ authUserResolver: userResolver, repositories, unitOfWork: paymentUnitOfWork, registry: purchaseProviderRegistry, careerAccessResolver: new CareerAccessResolver(), profileUnlockAssignmentService, idGenerator, clock });
  const razorpayPaymentService = razorpay ? new RazorpayPaymentService({ authUserResolver: userResolver, birthProfileRepository: repositories().birthProfiles, providerOrders: repositories().providerPaymentOrders, razorpayClient: razorpay.apiClient || new RazorpayApiClient({ keyId: razorpay.keyId, keySecret: razorpay.keySecret }), productCatalog: createRazorpayProductCatalog(razorpay.products), purchaseService, unitOfWork: paymentUnitOfWork, idGenerator, clock, keyId: razorpay.keyId, keySecret: razorpay.keySecret, webhookSecret: razorpay.webhookSecret }) : null;
  const { PlaceResolutionService } = require('./place-resolution-service');
  const placeResolutionService = placeResolver ? new PlaceResolutionService({ birthPlaceResolver: placeResolver }) : null;
  const api = createApi({ authVerifier, userResolver: { resolve: userResolver }, birthProfileService, careerEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, ashtakavargaService, secureReadingService, careerChatOrchestrator, purchaseService, razorpayPaymentService, appleNotificationService, googleRtdnService, placeResolutionService, requestIdGenerator: idGenerator, corsAllowlist, isReady, logger, bodyLimit });
  api.apiRuntime = { astronomicalEngine, canonicalSiderealSunSampler };
  return Object.freeze({ api, services: Object.freeze({ birthProfileService, careerEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, secureReadingService, userResolver, transactionExecutor: tx }) });
}

module.exports = { createApiComposition };
