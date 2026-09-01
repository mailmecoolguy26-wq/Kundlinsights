import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../core/api/api_client.dart';
import '../core/storage/secure_state_store.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/data/auth_api_token_source.dart';
import '../features/auth/data/supabase_auth_repository.dart';
import '../features/auth/domain/auth_repository.dart';
import '../features/profiles/data/birth_profile_api_repository.dart';
import '../features/profiles/domain/birth_profile_repository.dart';
import '../features/profiles/profile_controller.dart';
import '../features/natal/data/natal_summary_api_repository.dart';
import '../features/natal/domain/natal_summary_repository.dart';
import '../features/natal/natal_summary_controller.dart';
import '../features/divisional/data/divisional_chart_api_repository.dart';
import '../features/divisional/domain/divisional_chart_repository.dart';
import '../features/divisional/divisional_chart_controller.dart';
import '../features/vimshottari/data/vimshottari_api_repository.dart';
import '../features/vimshottari/domain/vimshottari_repository.dart';
import '../features/vimshottari/vimshottari_controller.dart';
import '../features/transits/data/transit_snapshot_api_repository.dart';
import '../features/transits/domain/transit_snapshot_repository.dart';
import '../features/transits/transit_snapshot_controller.dart';
import '../features/ashtakavarga/data/ashtakavarga_repository.dart';
import '../features/ashtakavarga/domain/ashtakavarga.dart';
import '../features/ashtakavarga/domain/ashtakavarga_repository.dart';
import '../features/ashtakavarga/ashtakavarga_controller.dart';
import '../features/readings/data/reading_api_repository.dart';
import '../features/readings/domain/reading_repository.dart';
import '../features/readings/reading_controller.dart';
import '../features/readings/data/career_reading_generation_api_repository.dart';
import '../features/readings/domain/career_reading_generation.dart';
import '../features/readings/career_reading_generation_controller.dart';
import '../features/career_events/data/career_event_api_repository.dart';
import '../features/career_events/domain/career_event_repository.dart';
import '../features/career_events/career_event_controller.dart';
import '../features/payments/data/apple_store_purchase_service.dart';
import '../features/payments/data/payment_api_client.dart';
import 'app.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();
  final AuthRepository repository;
  final BirthProfileRepository profileRepository;
  final NatalSummaryRepository natalSummaryRepository;
  final DivisionalChartRepository divisionalChartRepository;
  final VimshottariRepository vimshottariRepository;
  final TransitSnapshotRepository transitSnapshotRepository;
  final AshtakavargaRepository ashtakavargaRepository;
  final ReadingRepository readingRepository;
  final CareerReadingGenerationRepository generationRepository;
  final CareerEventRepository careerEventRepository;
  final PaymentApiClient paymentApi;
  final storePurchaseService = AppleStorePurchaseService(
    client: InAppPurchaseStorePurchaseClient(InAppPurchase.instance),
    careerPremiumAnnualAppleProductId:
        config?.careerPremiumAnnualAppleProductId,
  );
  if (config == null) {
    repository = _UnavailableAuthRepository();
    profileRepository = const UnavailableBirthProfileRepository();
    natalSummaryRepository = const UnavailableNatalSummaryRepository();
    divisionalChartRepository = const UnavailableDivisionalChartRepository();
    vimshottariRepository = const UnavailableVimshottariRepository();
    transitSnapshotRepository = const UnavailableTransitSnapshotRepository();
    ashtakavargaRepository = const _UnavailableAshtakavargaRepository();
    readingRepository = const UnavailableReadingRepository();
    generationRepository = _UnavailableGenerationRepository();
    careerEventRepository = const UnavailableCareerEventRepository();
    paymentApi = const UnavailablePaymentApiClient();
  } else {
    await Supabase.initialize(
      url: config.supabaseUrl,
      publishableKey: config.supabaseAnonKey,
    );
    repository = SupabaseAuthRepository(Supabase.instance.client);
    final apiClient = ApiClient(
      config: config,
      tokens: AuthApiTokenSource(repository),
    );
    profileRepository = BirthProfileApiRepository(apiClient);
    natalSummaryRepository = NatalSummaryApiRepository(apiClient);
    divisionalChartRepository = DivisionalChartApiRepository(apiClient);
    vimshottariRepository = VimshottariApiRepository(apiClient);
    transitSnapshotRepository = TransitSnapshotApiRepository(apiClient);
    ashtakavargaRepository = AshtakavargaApiRepository(apiClient);
    readingRepository = ReadingApiRepository(apiClient);
    generationRepository = CareerReadingGenerationApiRepository(apiClient);
    careerEventRepository = CareerEventApiRepository(apiClient);
    paymentApi = AuthenticatedPaymentApiClient(apiClient);
  }
  final controller = AuthController(repository);
  await controller.restore();
  runApp(
    ProviderScope(
      overrides: [
        secureStateStoreProvider.overrideWithValue(const SecureStateStore()),
        birthProfileRepositoryProvider.overrideWithValue(profileRepository),
        natalSummaryRepositoryProvider.overrideWithValue(
          natalSummaryRepository,
        ),
        divisionalChartRepositoryProvider.overrideWithValue(
          divisionalChartRepository,
        ),
        vimshottariRepositoryProvider.overrideWithValue(vimshottariRepository),
        transitSnapshotRepositoryProvider.overrideWithValue(
          transitSnapshotRepository,
        ),
        ashtakavargaRepositoryProvider.overrideWithValue(
          ashtakavargaRepository,
        ),
        readingRepositoryProvider.overrideWithValue(readingRepository),
        careerReadingGenerationRepositoryProvider.overrideWithValue(
          generationRepository,
        ),
        careerEventRepositoryProvider.overrideWithValue(careerEventRepository),
        appleStorePurchaseServiceProvider.overrideWithValue(
          storePurchaseService,
        ),
        paymentApiClientProvider.overrideWithValue(paymentApi),
      ],
      child: KundlInsightsApp(authController: controller),
    ),
  );
}

class _UnavailableGenerationRepository
    implements CareerReadingGenerationRepository {
  @override
  Future<CareerEligibility> getCareerEligibility() =>
      Future.error(StateError('Configuration is required.'));
  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) => Future.error(StateError('Configuration is required.'));
}

class _UnavailableAshtakavargaRepository implements AshtakavargaRepository {
  const _UnavailableAshtakavargaRepository();

  @override
  Future<Ashtakavarga> getAshtakavarga({required String birthProfileId}) =>
      Future<Ashtakavarga>.error(StateError('Configuration is required.'));
}

final secureStateStoreProvider = Provider<SecureStateStore>((ref) {
  throw UnimplementedError(
    'The bootstrap ProviderScope must override this provider.',
  );
});

class _UnavailableAuthRepository implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => null;
  @override
  Future<String?> refreshAccessToken() async => null;
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.unauthenticated);
  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async => throw StateError('Configuration is required.');
  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => throw StateError('Configuration is required.');
  @override
  Future<void> signOut() async {}
}
