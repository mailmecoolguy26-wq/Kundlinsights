import 'dart:async';

import 'package:flutter/foundation.dart';
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
  Future<void> requestPhoneOtp({required String phoneNumber});
  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  });
  Future<void> signOut();
  Future<String?> accessToken();
  Future<String?> refreshAccessToken();
}

class SupabaseAuthRepository implements AuthRepository, PhoneOtpAuthRepository {
  SupabaseAuthRepository(SupabaseClient client)
    : this.withSource(_SupabaseAuthSource(client));

  SupabaseAuthRepository.withSource(this._source) {
    _subscription = _source.events.listen((event) {
      _handleEvent(event);
    }, onError: _handleStreamError);
  }

  final SupabaseAuthSource _source;
  final _states = StreamController<AuthSnapshot>.broadcast();
  late final StreamSubscription<SupabaseAuthEvent> _subscription;
  bool _recoveringStoredSession = false;
  bool _hasPublishedAuthenticatedSession = false;

  @override
  Stream<AuthSnapshot> get states => _states.stream;

  @override
  Future<AuthSnapshot> restore() async {
    final bootstrap = _source.bootstrapSnapshot;
    _recoveringStoredSession =
        bootstrap.snapshot.status == AuthStatus.authenticated &&
        bootstrap.requiresRecovery;
    final result = _recoveringStoredSession
        ? const AuthSnapshot(AuthStatus.initializing)
        : bootstrap.snapshot;
    if (result.status == AuthStatus.authenticated) {
      _hasPublishedAuthenticatedSession = true;
    }
    _debug('AUTH_SESSION_RECEIVED', snapshot: result);
    return result;
  }

  void _handleEvent(SupabaseAuthEvent event) {
    _debug('AUTH_STATE_CHANGED', snapshot: event.snapshot, event: event.type);
    if (!_recoveringStoredSession) {
      // Supabase's initial event is a bootstrap snapshot, not a destructive
      // lifecycle event. Never let a late, stale empty snapshot replace a
      // session that was just established by OTP verification.
      if (event.type == SupabaseAuthEventType.initialSession &&
          event.snapshot.status == AuthStatus.unauthenticated &&
          _hasPublishedAuthenticatedSession) {
        return;
      }
      if (event.snapshot.status == AuthStatus.authenticated) {
        _hasPublishedAuthenticatedSession = true;
      } else if (event.type == SupabaseAuthEventType.signedOut) {
        _hasPublishedAuthenticatedSession = false;
      }
      _states.add(event.snapshot);
      return;
    }
    switch (event.type) {
      case SupabaseAuthEventType.tokenRefreshed:
      case SupabaseAuthEventType.signedIn:
        if (event.snapshot.status == AuthStatus.authenticated) {
          _recoveringStoredSession = false;
          _hasPublishedAuthenticatedSession = true;
          _states.add(event.snapshot);
        }
        return;
      case SupabaseAuthEventType.signedOut:
        _recoveringStoredSession = false;
        _hasPublishedAuthenticatedSession = false;
        _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
        return;
      case SupabaseAuthEventType.initialSession:
      case SupabaseAuthEventType.other:
        return;
    }
  }

  void _handleStreamError(Object error, StackTrace stackTrace) {
    _debug(
      'AUTH_STATE_CHANGED',
      snapshot: const AuthSnapshot(AuthStatus.initializing),
      error: error,
    );
    if (!_recoveringStoredSession) return;
    _recoveringStoredSession = false;
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }

  @override
  Future<void> signIn({required String email, required String password}) async {
    await _source.signIn(email: email, password: password);
  }

  @override
  Future<bool> signUp({required String email, required String password}) =>
      _source.signUp(email: email, password: password);

  @override
  Future<void> requestPhoneOtp({required String phoneNumber}) async {
    await _source.requestPhoneOtp(phoneNumber: phoneNumber);
  }

  @override
  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  }) => _source.verifyPhoneOtp(phoneNumber: phoneNumber, otp: otp);

  @override
  Future<void> signOut() => _source.signOut();

  @override
  Future<String?> accessToken() => _source.accessToken();

  @override
  Future<String?> refreshAccessToken() => _source.refreshAccessToken();

  void _debug(
    String label, {
    required AuthSnapshot snapshot,
    SupabaseAuthEventType? event,
    Object? error,
  }) {
    if (!kDebugMode) return;
    debugPrint(
      '$label '
      'authEvent=${event?.name ?? 'repository'} '
      'sessionPresent=${snapshot.status == AuthStatus.authenticated} '
      'userPresent=${snapshot.subject != null} '
      'accessTokenPresent=unknown '
      'refreshTokenPresent=unknown '
      'errorClass=${error?.runtimeType} '
      'errorCode=null',
    );
  }

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
  Stream<SupabaseAuthEvent> get events =>
      _client.auth.onAuthStateChange.map((state) {
        final event = _eventType(state.event);
        final snapshot = _snapshot();
        _debug(
          'AUTH_STATE_CHANGED',
          event: event,
          session: _client.auth.currentSession,
        );
        return SupabaseAuthEvent(event, snapshot);
      });

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
  Future<void> requestPhoneOtp({required String phoneNumber}) async {
    _debug('AUTH_OTP_REQUEST_START');
    try {
      await _client.auth.signInWithOtp(phone: phoneNumber);
      _debug('AUTH_OTP_REQUEST_SUCCESS');
    } catch (error) {
      _debug('AUTH_OTP_REQUEST_FAILURE', error: error);
      rethrow;
    }
  }

  @override
  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    _debug('AUTH_OTP_VERIFY_START');
    try {
      final result = await _client.auth.verifyOTP(
        phone: phoneNumber,
        token: otp,
        type: OtpType.sms,
      );
      _debug('AUTH_OTP_VERIFY_SUCCESS', session: result.session);
      _debug('AUTH_SESSION_PERSISTED', session: _client.auth.currentSession);
    } catch (error) {
      _debug('AUTH_OTP_VERIFY_FAILURE', error: error);
      rethrow;
    }
  }

  @override
  Future<void> signOut() async {
    _debug('AUTH_LOCAL_SIGNOUT');
    await _client.auth.signOut();
  }

  @override
  Future<String?> accessToken() async =>
      _client.auth.currentSession?.accessToken;

  @override
  Future<String?> refreshAccessToken() async {
    _debug('AUTH_REFRESH_START');
    try {
      final session = (await _client.auth.refreshSession()).session;
      _debug('AUTH_REFRESH_SUCCESS', session: session);
      return session?.accessToken;
    } catch (error) {
      _debug('AUTH_REFRESH_FAILURE', error: error);
      return null;
    }
  }

  void _debug(
    String label, {
    SupabaseAuthEventType? event,
    Session? session,
    Object? error,
  }) {
    if (!kDebugMode) return;
    final value = session ?? _client.auth.currentSession;
    debugPrint(
      '$label '
      'authEvent=${event?.name ?? 'source'} '
      'sessionPresent=${value != null} '
      'userPresent=${value?.user != null} '
      'accessTokenPresent=${value?.accessToken.isNotEmpty == true} '
      'refreshTokenPresent=${value?.refreshToken?.isNotEmpty == true} '
      'errorClass=${error?.runtimeType} '
      'errorCode=null',
    );
  }
}
