import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
import 'app.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();
  final AuthRepository repository;
  final BirthProfileRepository profileRepository;
  final NatalSummaryRepository natalSummaryRepository;
  final DivisionalChartRepository divisionalChartRepository;
  if (config == null) {
    repository = _UnavailableAuthRepository();
    profileRepository = const UnavailableBirthProfileRepository();
    natalSummaryRepository = const UnavailableNatalSummaryRepository();
    divisionalChartRepository = const UnavailableDivisionalChartRepository();
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
      ],
      child: KundlInsightsApp(authController: controller),
    ),
  );
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
