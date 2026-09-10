import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Storage boundary for future app-owned sensitive state.
///
/// Supabase owns its session lifecycle and native secure session persistence.
/// This store intentionally does not duplicate access or refresh tokens.
class SecureStateStore {
  const SecureStateStore({this.storage = const FlutterSecureStorage()});

  final FlutterSecureStorage storage;

  Future<String?> read(String key) => storage.read(key: key);

  Future<void> write({required String key, required String value}) =>
      storage.write(key: key, value: value);

  Future<void> clearAppOwnedState() => storage.deleteAll();
}

final secureStateStoreProvider = Provider<SecureStateStore>((ref) {
  throw UnimplementedError(
    'The bootstrap ProviderScope must override this provider.',
  );
});
