import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Storage boundary for future app-owned sensitive state.
///
/// Supabase owns its session lifecycle and native secure session persistence.
/// This store intentionally does not duplicate access or refresh tokens.
class SecureStateStore {
  const SecureStateStore({this.storage = const FlutterSecureStorage()});

  final FlutterSecureStorage storage;

  Future<void> clearAppOwnedState() => storage.deleteAll();
}
