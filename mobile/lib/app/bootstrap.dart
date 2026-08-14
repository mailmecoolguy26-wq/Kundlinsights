import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_config.dart';
import '../core/storage/secure_state_store.dart';
import '../features/auth/auth_controller.dart';
import '../features/auth/data/supabase_auth_repository.dart';
import '../features/auth/domain/auth_repository.dart';
import 'app.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment();
  final AuthRepository repository;
  if (config == null) {
    repository = _UnavailableAuthRepository();
  } else {
    await Supabase.initialize(
      url: config.supabaseUrl,
      publishableKey: config.supabaseAnonKey,
    );
    repository = SupabaseAuthRepository(Supabase.instance.client);
  }
  final controller = AuthController(repository);
  await controller.restore();
  runApp(
    ProviderScope(
      overrides: [
        secureStateStoreProvider.overrideWithValue(const SecureStateStore()),
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
