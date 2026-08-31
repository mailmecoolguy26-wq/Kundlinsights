import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/auth_repository.dart';

enum SupabaseAuthEventType {
  initialSession,
  signedIn,
  tokenRefreshed,
  signedOut,
  other,
}

class SupabaseAuthBootstrapSnapshot {
  const SupabaseAuthBootstrapSnapshot(
    this.snapshot, {
    required this.requiresRecovery,
  });

  final AuthSnapshot snapshot;
  final bool requiresRecovery;
}

class SupabaseAuthEvent {
  const SupabaseAuthEvent(this.type, this.snapshot);

  final SupabaseAuthEventType type;
  final AuthSnapshot snapshot;
}

abstract interface class SupabaseAuthSource {
  SupabaseAuthBootstrapSnapshot get bootstrapSnapshot;
  Stream<SupabaseAuthEvent> get events;
  Future<void> signIn({required String email, required String password});
  Future<bool> signUp({required String email, required String password});
  Future<void> signOut();
  Future<String?> accessToken();
  Future<String?> refreshAccessToken();
}

class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository(SupabaseClient client)
    : this.withSource(_SupabaseAuthSource(client));

  SupabaseAuthRepository.withSource(this._source) {
    _subscription = _source.events.listen((event) {
      _handleEvent(event);
    });
  }

  final SupabaseAuthSource _source;
  final _states = StreamController<AuthSnapshot>.broadcast();
  late final StreamSubscription<SupabaseAuthEvent> _subscription;
  bool _recoveringStoredSession = false;

  @override
  Stream<AuthSnapshot> get states => _states.stream;

  @override
  Future<AuthSnapshot> restore() async {
    final bootstrap = _source.bootstrapSnapshot;
    _recoveringStoredSession =
        bootstrap.snapshot.status == AuthStatus.authenticated &&
        bootstrap.requiresRecovery;
    return _recoveringStoredSession
        ? const AuthSnapshot(AuthStatus.initializing)
        : bootstrap.snapshot;
  }

  void _handleEvent(SupabaseAuthEvent event) {
    if (!_recoveringStoredSession) {
      _states.add(event.snapshot);
      return;
    }
    switch (event.type) {
      case SupabaseAuthEventType.tokenRefreshed:
      case SupabaseAuthEventType.signedIn:
        if (event.snapshot.status == AuthStatus.authenticated) {
          _recoveringStoredSession = false;
          _states.add(event.snapshot);
        }
        return;
      case SupabaseAuthEventType.signedOut:
        _recoveringStoredSession = false;
        _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
        return;
      case SupabaseAuthEventType.initialSession:
      case SupabaseAuthEventType.other:
        return;
    }
  }

  @override
  Future<void> signIn({required String email, required String password}) async {
    await _source.signIn(email: email, password: password);
  }

  @override
  Future<bool> signUp({required String email, required String password}) =>
      _source.signUp(email: email, password: password);

  @override
  Future<void> signOut() => _source.signOut();

  @override
  Future<String?> accessToken() => _source.accessToken();

  @override
  Future<String?> refreshAccessToken() => _source.refreshAccessToken();

  void dispose() {
    _subscription.cancel();
    _states.close();
  }
}

class _SupabaseAuthSource implements SupabaseAuthSource {
  _SupabaseAuthSource(this._client);

  final SupabaseClient _client;

  @override
  SupabaseAuthBootstrapSnapshot get bootstrapSnapshot {
    final session = _client.auth.currentSession;
    return SupabaseAuthBootstrapSnapshot(
      _snapshot(),
      requiresRecovery: session?.isExpired ?? false,
    );
  }

  @override
  Stream<SupabaseAuthEvent> get events => _client.auth.onAuthStateChange.map(
    (state) => SupabaseAuthEvent(_eventType(state.event), _snapshot()),
  );

  AuthSnapshot _snapshot() {
    final session = _client.auth.currentSession;
    return AuthSnapshot(
      session == null ? AuthStatus.unauthenticated : AuthStatus.authenticated,
      subject: session?.user.id,
    );
  }

  SupabaseAuthEventType _eventType(AuthChangeEvent event) => switch (event) {
    AuthChangeEvent.initialSession => SupabaseAuthEventType.initialSession,
    AuthChangeEvent.signedIn => SupabaseAuthEventType.signedIn,
    AuthChangeEvent.tokenRefreshed => SupabaseAuthEventType.tokenRefreshed,
    AuthChangeEvent.signedOut => SupabaseAuthEventType.signedOut,
    _ => SupabaseAuthEventType.other,
  };

  @override
  Future<void> signIn({required String email, required String password}) =>
      _client.auth.signInWithPassword(email: email, password: password);

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
}
