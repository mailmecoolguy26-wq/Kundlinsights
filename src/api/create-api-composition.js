'use strict';

const { PostgresApplicationTransactionExecutor, SecureReadingService, CareerReadingInterpreter, CalibratedCareerReadingGenerator, CareerReadingPromptBuilder, ProviderBackedCareerGenerator } = require('../application/readings');
const { OpenAICareerGenerationAdapter } = require('../infrastructure/ai/openai-career-generation-adapter');
const { OpenAICareerChatRenderer } = require('../infrastructure/ai/openai-career-chat-renderer');
const { SecureBirthProfileService } = require('../application/birth-profiles');
const { NatalSummaryService } = require('../application/natal-summary');
const { DivisionalChartService } = require('../application/divisional-charts');
const { VimshottariService, LatestCareerReadingInsightSource } = require('../application/vimshottari');
const { TransitSnapshotService, LatestCareerReadingTransitSource } = require('../application/transit-snapshot');
const { AshtakavargaService } = require('../application/ashtakavarga');
const { CareerEventService, CareerEventAstrologyService, CareerPatternComparisonService, CareerFutureRecurrenceService, CareerCalibrationAdapter, CareerReadingContextBuilder } = require('../application/career-events');
const { LifeEventService } = require('../application/life-events');
const { LifeEventCalibrationCoordinator } = require('../application/life-event-calibration');
const { PropertyAnswerService, PropertyCalibrationAdapter } = require('../application/property');
const { VehicleAnswerService, VehicleCalibrationAdapter } = require('../application/vehicle');
const { WealthAnswerService } = require('../application/wealth');
const { RelationshipAnswerService, RelationshipCalibrationAdapter } = require('../application/relationships');
const { FamilyExpansionAnswerService, FamilyExpansionCalibrationAdapter } = require('../application/family-expansion');
const { PostgresUserRepository, PostgresBirthProfileRepository, PostgresReadingRepository, PostgresEntitlementRepository, PostgresCareerEventRepository, PostgresCareerEventObservationRepository, PostgresLifeEventRepository, PostgresLifeEventObservationRepository, PostgresCareerDecisionRepository, PostgresPurchaseRepository, PostgresSubscriptionRepository, PostgresProfileEntitlementRepository, PostgresPaymentEventRepository, PostgresProviderPaymentOrderRepository, PostgresNotificationRepository } = require('../persistence');
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
const { createCareerPremiumRazorpayProductCatalog } = require('../payment/razorpay/razorpay-product-catalog');
const { PostgresUserKeyEnvelopeStore, UserDekProvider, BirthProfilePayloadCodec, ReadingPayloadCodec } = require('../security/crypto');
const { resolveOrProvisionAppUser } = require('../security/auth');
const { AnalyticsEventRecorder } = require('../analytics/analytics-event-recorder');

function req(value, name) {
  if (!value) throw new TypeError(`INVALID_${name}`);
  return value;
}

function createApiComposition({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, placeResolver = null, openai = null, careerChat = null, careerAnswerPolicy = null, apple = null, google = null, razorpay = null, analytics = null, idGenerator, clock, requiresEntitlement = () => true, corsAllowlist, isReady, logger, bodyLimit, transactionDiagnosticObserver } = {}) {
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
      careerEventObservations: new PostgresCareerEventObservationRepository({ db: client }),
      lifeEvents: new PostgresLifeEventRepository({ db: client }),
      lifeEventObservations: new PostgresLifeEventObservationRepository({ db: client }),
      careerDecisions: new PostgresCareerDecisionRepository({ db: client }),
      envelopes,
      deks,
    };
  };
  const userResolver = async (principal) => tx.execute({
    principal,
    role: 'app_runtime',
    operation: ({ db: client }) => resolveOrProvisionAppUser({ principal, userRepository: new PostgresUserRepository({ db: client }), idGenerator, now: clock }),
  });
  const notificationSelfService = {
    async register({ principal, body }) { const user = await userResolver(principal); return tx.execute({ principal, role: 'app_runtime', operation: ({ db: client }) => new PostgresNotificationRepository({ db: client }).upsertDevice({ userId: user.id, deviceId: body.deviceId, platform: body.platform, pushProvider: 'FCM', pushToken: body.pushToken, appVersion: body.appVersion || null, environment: body.environment || 'development', notificationsEnabled: body.notificationsEnabled !== false, now: clock() }) }); },
    async revoke({ principal, deviceId }) { const user = await userResolver(principal); return tx.execute({ principal, role: 'app_runtime', operation: ({ db: client }) => new PostgresNotificationRepository({ db: client }).revokeDevice({ userId: user.id, deviceId, now: clock() }) }); },
    async preferences({ principal, patch = null }) { const user = await userResolver(principal); return tx.execute({ principal, role: 'app_runtime', operation: async ({ db: client }) => { const repo = new PostgresNotificationRepository({ db: client }); if (!patch) return (await repo.getPreferences(user.id)) || { readingUpdates: true, careerReminders: true, offersAndUpdates: false }; const existing = (await repo.getPreferences(user.id)) || { readingUpdates: true, careerReminders: true, offersAndUpdates: false }; return repo.upsertPreferences({ userId: user.id, readingUpdates: patch.readingUpdates == null ? existing.readingUpdates : patch.readingUpdates, careerReminders: patch.careerReminders == null ? existing.careerReminders : patch.careerReminders, offersAndUpdates: patch.offersAndUpdates == null ? existing.offersAndUpdates : patch.offersAndUpdates, updatedAt: clock() }); } }); },
    async activity({ principal, kind, resourceId = null }) { const user = await userResolver(principal); return tx.execute({ principal, role: 'app_runtime', operation: async ({ db: client }) => { const repo = new PostgresNotificationRepository({ db: client }); if (kind === 'active') return repo.recordAppActivity({ userId: user.id, at: clock() }); if (kind === 'reading') return repo.recordReadingOpened({ userId: user.id, readingId: resourceId, at: clock() }); if (kind === 'paywall') return repo.recordCareerPaywallViewed({ userId: user.id, birthProfileId: resourceId, at: clock() }); throw new RangeError('INVALID_NOTIFICATION_ACTIVITY'); } }); },
  };
  const birthProfileService = new SecureBirthProfileService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, cryptoCoordinator, idGenerator, clock });
  const careerEventService = new CareerEventService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, birthProfileService, idGenerator, clock });
  const lifeEventService = new LifeEventService({ authUserResolver: userResolver, transactionExecutor: tx, repositories, birthProfileService, idGenerator, clock });
  const natalSummaryService = new NatalSummaryService({ birthProfileService, astronomicalEngine });
  const divisionalChartService = new DivisionalChartService({ birthProfileService, astronomicalEngine });
  const ashtakavargaService = new AshtakavargaService({ birthProfileService, astronomicalEngine });
  const careerEventAstrologyService = new CareerEventAstrologyService({ careerEventService, birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, divisionalChartService, ashtakavargaService });
  const careerPatternComparisonService = new CareerPatternComparisonService({ careerEventService, careerEventAstrologyService });
  const careerFutureRecurrenceService = new CareerFutureRecurrenceService({ careerPatternComparisonService, birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, ashtakavargaService, clock });
  const lifeEventCalibrationCoordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: ({ principal, birthProfileId }) => careerEventService.listForCalibration({ principal, birthProfileId }), clock });
  const careerCalibrationAdapter = new CareerCalibrationAdapter({ careerEventAstrologyService, birthProfileService });
  const careerReadingContextBuilder = new CareerReadingContextBuilder({ careerEventService, careerPatternComparisonService, careerFutureRecurrenceService, lifeEventCalibrationCoordinator, careerCalibrationAdapter });
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
  const { CareerAnswerService } = require('../application/career-answers');
  const { JobFavourabilityBetaEvaluator } = require('../application/career-answers/job-favourability-beta');
  const jobFavourabilityEvaluator = new JobFavourabilityBetaEvaluator({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, clock });
  const careerAnswerService = new CareerAnswerService({ secureReadingService, birthProfileService, jobFavourabilityResearchEnabled: Boolean(careerAnswerPolicy && careerAnswerPolicy.jobFavourabilityResearchEnabled === true), jobFavourabilityEvaluator });
  const { CareerDecisionService } = require('../application/career-decisions');
  const careerDecisionService = new CareerDecisionService({ careerAnswerService, authUserResolver: userResolver, birthProfileService, transactionExecutor: tx, repositories, idGenerator, clock });
  const { CareerChatOrchestrator } = require('../application/career-chat');
  const { TaraOrchestrator, TaraCareerCapability, TaraTransitCapability, TaraPropertyCapability, TaraVehicleCapability } = require('../application/tara');
  const transitSnapshotService = new TransitSnapshotService({ birthProfileService, astronomicalEngine, careerInsightSource: new LatestCareerReadingTransitSource({ secureReadingService }) });
  const careerChatRenderer = careerChat && careerChat.enabled === true ? new OpenAICareerChatRenderer({ apiKey: careerChat.apiKey, model: careerChat.model, timeoutMilliseconds: careerChat.timeoutMilliseconds }) : null;
  const careerChatOrchestrator = new CareerChatOrchestrator({ secureReadingService, languageModel: careerChatRenderer });
  const propertyLifeEventCalibrationCoordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: ({ principal, birthProfileId }) => lifeEventService.getRelevantLifeEvents({ principal, birthProfileId, categories: ['PROPERTY'] }), clock });
  const propertyCalibrationAdapter = new PropertyCalibrationAdapter({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler });
  const propertyAnswerService = new PropertyAnswerService({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService: secureReadingService, clock, lifeEventCalibrationCoordinator: propertyLifeEventCalibrationCoordinator, propertyCalibrationAdapter });
  const vehicleLifeEventCalibrationCoordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: ({ principal, birthProfileId }) => lifeEventService.getRelevantLifeEvents({ principal, birthProfileId, categories: ['VEHICLE'] }), clock });
  const vehicleCalibrationAdapter = new VehicleCalibrationAdapter({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler });
  const vehicleAnswerService = new VehicleAnswerService({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService: secureReadingService, clock, lifeEventCalibrationCoordinator: vehicleLifeEventCalibrationCoordinator, vehicleCalibrationAdapter });
  const wealthAnswerService = new WealthAnswerService({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService: secureReadingService, clock });
  const relationshipLifeEventCalibrationCoordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: ({ principal, birthProfileId }) => lifeEventService.getRelevantLifeEvents({ principal, birthProfileId, categories: ['RELATIONSHIPS_FAMILY'] }), clock });
  const relationshipCalibrationAdapter = new RelationshipCalibrationAdapter({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler });
  const relationshipAnswerService = new RelationshipAnswerService({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService: secureReadingService, clock, lifeEventCalibrationCoordinator: relationshipLifeEventCalibrationCoordinator, relationshipCalibrationAdapter });
  const familyExpansionLifeEventCalibrationCoordinator = new LifeEventCalibrationCoordinator({ canonicalEventLoader: ({ principal, birthProfileId }) => lifeEventService.getRelevantLifeEvents({ principal, birthProfileId, categories: ['RELATIONSHIPS_FAMILY'] }), clock });
  const familyExpansionCalibrationAdapter = new FamilyExpansionCalibrationAdapter({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler });
  const familyExpansionAnswerService = new FamilyExpansionAnswerService({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService: secureReadingService, clock, lifeEventCalibrationCoordinator: familyExpansionLifeEventCalibrationCoordinator, familyExpansionCalibrationAdapter });
  const taraOrchestrator = new TaraOrchestrator({ careerCapability: new TaraCareerCapability({ careerAnswerService }), transitCapability: new TaraTransitCapability({ transitSnapshotService, clock }), propertyCapability: new TaraPropertyCapability({ propertyAnswerService }), vehicleCapability: new TaraVehicleCapability({ vehicleAnswerService }) });
  const { TaraConversationService } = require('../application/tara-conversations/tara-conversation-service');
  const taraConversationService = new TaraConversationService({ authUserResolver: userResolver, birthProfileService, transactionExecutor: tx, taraOrchestrator, careerEntitlementResolver: secureReadingService, idGenerator, clock });
  const vimshottariService = new VimshottariService({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, careerInsightSource: new LatestCareerReadingInsightSource({ secureReadingService }), clock });
  const paymentUnitOfWork = new PostgresPaymentUnitOfWork({ pool: db, birthProfileRepositoryFactory: (client) => repositories({ db: client }).birthProfiles });
  const appleSignedDataVerifier = apple && typeof apple.bundleId === 'string' && apple.bundleId && (apple.careerPremium6MonthProductId || apple.careerPremium12MonthProductId || apple.careerPremiumAnnualProductId) && apple.rootCertificateProvider && typeof apple.rootCertificateProvider.load === 'function' && typeof apple.appAppleId === 'string' && apple.appAppleId
    ? new AppleSignedDataVerifier({ factory: new AppleSignedDataVerifierFactory({ rootCertificateProvider: apple.rootCertificateProvider, bundleId: apple.bundleId, appAppleId: apple.appAppleId, onlineChecks: apple.onlineChecks === true }) })
    : null;
  const appleProvider = appleSignedDataVerifier ? new ApplePurchaseVerifier({ signedDataVerifier: appleSignedDataVerifier, bundleId: apple.bundleId, appleProductId: apple.careerPremiumAnnualProductId, appleCareerPremium6MonthProductId: apple.careerPremium6MonthProductId, appleCareerPremium12MonthProductId: apple.careerPremium12MonthProductId, appleCareerPremiumAddOn6MonthProductId: apple.careerPremiumAddOn6MonthProductId, appleCareerPremiumAddOn12MonthProductId: apple.careerPremiumAddOn12MonthProductId, clock: () => Date.parse(clock()) }) : null;
  const applePlanForProductId = (productId) => productId === apple?.careerPremium6MonthProductId ? 'career_premium_6_month' : productId === apple?.careerPremium12MonthProductId ? 'career_premium_12_month' : productId === apple?.careerPremiumAddOn6MonthProductId ? 'career_premium_addon_6_month' : productId === apple?.careerPremiumAddOn12MonthProductId ? 'career_premium_addon_12_month' : productId === apple?.careerPremiumAnnualProductId ? 'career_premium_annual' : null;
  const appleNotificationService = appleSignedDataVerifier && (apple.careerPremium6MonthProductId || apple.careerPremium12MonthProductId || apple.careerPremiumAnnualProductId) ? new AppleNotificationService({ notificationVerifier: new AppleNotificationVerifier({ signedDataVerifier: appleSignedDataVerifier, bundleId: apple.bundleId, appleProductIds: [apple.careerPremium6MonthProductId, apple.careerPremium12MonthProductId, apple.careerPremiumAnnualProductId].filter(Boolean), productMapper: applePlanForProductId }), paymentEvents: new PostgresPaymentEventRepository({ db }), lifecycleReconciler: new AppleSubscriptionLifecycleReconciler({ repositories, unitOfWork: paymentUnitOfWork, idGenerator, clock, productMapper: applePlanForProductId }), idGenerator, clock }) : null;
  const googleProvider = google && typeof google.packageName === 'string' && google.packageName && (google.careerPremium6MonthProductId || google.careerPremium12MonthProductId || google.careerPremiumAnnualProductId) && google.apiClient
    ? new GooglePurchaseVerifier({ apiClient: google.apiClient, packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId, googlePremium6MonthProductId: google.careerPremium6MonthProductId, googlePremium12MonthProductId: google.careerPremium12MonthProductId, googlePremiumAddOn6MonthProductId: google.careerPremiumAddOn6MonthProductId, googlePremiumAddOn12MonthProductId: google.careerPremiumAddOn12MonthProductId, clock: () => Date.parse(clock()) })
    : google && typeof google.packageName === 'string' && google.packageName && (google.careerPremium6MonthProductId || google.careerPremium12MonthProductId || google.careerPremiumAnnualProductId) && google.serviceAccount
      ? new GooglePurchaseVerifier({ apiClient: new GooglePlayApiClient({ serviceAccount: google.serviceAccount }), packageName: google.packageName, googleProductId: google.careerPremiumAnnualProductId, googlePremium6MonthProductId: google.careerPremium6MonthProductId, googlePremium12MonthProductId: google.careerPremium12MonthProductId, googlePremiumAddOn6MonthProductId: google.careerPremiumAddOn6MonthProductId, googlePremiumAddOn12MonthProductId: google.careerPremiumAddOn12MonthProductId, clock: () => Date.parse(clock()) })
      : null;
  const googleApiClient = googleProvider && google && google.apiClient ? google.apiClient : googleProvider && google && google.serviceAccount ? new GooglePlayApiClient({ serviceAccount: google.serviceAccount }) : null;
  const googlePlanForProductId = (productId) => productId === google?.careerPremium6MonthProductId ? 'career_premium_6_month' : productId === google?.careerPremium12MonthProductId ? 'career_premium_12_month' : productId === google?.careerPremiumAnnualProductId ? 'career_premium_annual' : null;
  const googleSubscriptionProductIds = google ? [google.careerPremium6MonthProductId, google.careerPremium12MonthProductId, google.careerPremiumAnnualProductId].filter(Boolean) : [];
  const googleRtdnService = googleApiClient && google && googleSubscriptionProductIds.length && google.rtdn && typeof google.rtdn.audience === 'string' && typeof google.rtdn.allowedServiceAccountEmail === 'string'
    ? new GoogleRtdnService({
      pubsubAuthVerifier: google.rtdn.authVerifier || createGooglePubSubAuthVerifier({ audience: google.rtdn.audience, allowedServiceAccountEmail: google.rtdn.allowedServiceAccountEmail }),
      decoder: decodeGoogleRtdn,
      apiClient: googleApiClient,
      packageName: google.packageName,
      googleProductId: googleSubscriptionProductIds[0],
      paymentEvents: new PostgresPaymentEventRepository({ db }),
      lifecycleReconciler: Object.assign(new GoogleSubscriptionLifecycleReconciler({ repositories, unitOfWork: paymentUnitOfWork, idGenerator, clock }), { normalize: (input) => normalizeGoogleSubscription({ ...input, packageName: google.packageName, googleProductIds: googleSubscriptionProductIds, productMapper: googlePlanForProductId }) }),
      idGenerator,
      clock,
    })
    : null;
  const purchaseProviderRegistry = new PurchaseProviderRegistry({ ...(appleProvider ? { APPLE: appleProvider } : {}), ...(googleProvider ? { GOOGLE: googleProvider } : {}) });
  const profileUnlockAssignmentService = new ProfileUnlockAssignmentService({ unitOfWork: paymentUnitOfWork, idGenerator, clock });
  const purchaseService = new PurchaseVerificationService({ authUserResolver: userResolver, repositories, unitOfWork: paymentUnitOfWork, registry: purchaseProviderRegistry, careerAccessResolver: new CareerAccessResolver(), profileUnlockAssignmentService, idGenerator, clock, analytics: new AnalyticsEventRecorder({ provider: analytics }) });
  const razorpayPaymentService = razorpay ? new RazorpayPaymentService({ authUserResolver: userResolver, birthProfileRepository: repositories().birthProfiles, providerOrders: repositories().providerPaymentOrders, razorpayClient: razorpay.apiClient || new RazorpayApiClient({ keyId: razorpay.keyId, keySecret: razorpay.keySecret }), productCatalog: createCareerPremiumRazorpayProductCatalog(razorpay.products), purchaseService, unitOfWork: paymentUnitOfWork, idGenerator, clock, keyId: razorpay.keyId, keySecret: razorpay.keySecret, webhookSecret: razorpay.webhookSecret, environment: razorpay.environment }) : null;
  const { PlaceResolutionService } = require('./place-resolution-service');
  const placeResolutionService = placeResolver ? new PlaceResolutionService({ birthPlaceResolver: placeResolver }) : null;
  const api = createApi({ authVerifier, userResolver: { resolve: userResolver }, birthProfileService, careerEventService, lifeEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, ashtakavargaService, secureReadingService, careerAnswerService, careerDecisionService, propertyAnswerService, vehicleAnswerService, wealthAnswerService, relationshipAnswerService, familyExpansionAnswerService, careerChatOrchestrator, taraConversationService, purchaseService, razorpayPaymentService, appleNotificationService, googleRtdnService, notificationSelfService, placeResolutionService, requestIdGenerator: idGenerator, corsAllowlist, isReady, logger, bodyLimit });
  api.apiRuntime = { astronomicalEngine, canonicalSiderealSunSampler };
  return Object.freeze({ api, services: Object.freeze({ birthProfileService, careerEventService, lifeEventService, careerEventAstrologyService, natalSummaryService, divisionalChartService, vimshottariService, transitSnapshotService, secureReadingService, careerAnswerService, careerDecisionService, propertyAnswerService, vehicleAnswerService, wealthAnswerService, relationshipAnswerService, familyExpansionAnswerService, userResolver, transactionExecutor: tx }) });
}

module.exports = { createApiComposition };
