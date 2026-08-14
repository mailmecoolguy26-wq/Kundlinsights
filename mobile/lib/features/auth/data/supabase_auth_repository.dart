import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/auth_repository.dart';

class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(this._client) {
    _subscription = _client.auth.onAuthStateChange.listen((_) {
      _states.add(_snapshot());
    });
  }

  final SupabaseClient _client;
  final _states = StreamController<AuthSnapshot>.broadcast();
  late final StreamSubscription<AuthState> _subscription;

  @override
  Stream<AuthSnapshot> get states => _states.stream;

  AuthSnapshot _snapshot() {
    final session = _client.auth.currentSession;
    return AuthSnapshot(
      session == null ? AuthStatus.unauthenticated : AuthStatus.authenticated,
      subject: session?.user.id,
    );
  }

  @override
  Future<AuthSnapshot> restore() async => _snapshot();

  @override
  Future<void> signIn({required String email, required String password}) async {
    await _client.auth.signInWithPassword(email: email, password: password);
  }

  @override
  Future<bool> signUp({required String email, required String password}) async {
    final result = await _client.auth.signUp(email: email, password: password);
    return result.session != null;
  }

  @override
  Future<void> signOut() => _client.auth.signOut();

  @override
  Future<String?> accessToken() async =>
      _client.auth.currentSession?.accessToken;

  @override
  Future<String?> refreshAccessToken() async =>
      (await _client.auth.refreshSession()).session?.accessToken;

  void dispose() {
    _subscription.cancel();
    _states.close();
  }
}
