import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/data/supabase_auth_repository.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';

void main() {
  test(
    'a stored session followed by token refresh remains authenticated',
    () async {
      final source = _Source(authenticated: true, requiresRecovery: true);
      final repository = SupabaseAuthRepository.withSource(source);
      final controller = AuthController(repository);
      final states = <AuthStatus>[];
      controller.addListener(() => states.add(controller.state.status));

      await controller.restore();
      source.emit(SupabaseAuthEventType.initialSession, authenticated: true);
      source.emit(SupabaseAuthEventType.tokenRefreshed, authenticated: true);
      await _flushEvents();

      expect(states, [AuthStatus.initializing, AuthStatus.authenticated]);
      controller.dispose();
      await source.dispose();
      repository.dispose();
    },
  );

  test('no stored session resolves unauthenticated', () async {
    final source = _Source(authenticated: false);
    final repository = SupabaseAuthRepository.withSource(source);
    final controller = AuthController(repository);

    await controller.restore();
    expect(controller.state.status, AuthStatus.unauthenticated);

    controller.dispose();
    await source.dispose();
    repository.dispose();
  });

  test(
    'stale session must not publish authenticated before signed out',
    () async {
      final source = _Source(authenticated: true, requiresRecovery: true);
      final repository = SupabaseAuthRepository.withSource(source);
      final controller = AuthController(repository);
      final states = <AuthStatus>[];
      controller.addListener(() => states.add(controller.state.status));

      await controller.restore();
      source.emit(SupabaseAuthEventType.initialSession, authenticated: true);
      source.emit(SupabaseAuthEventType.signedOut, authenticated: false);
      await _flushEvents();

      expect(states, [AuthStatus.initializing, AuthStatus.unauthenticated]);
      controller.dispose();
      await source.dispose();
      repository.dispose();
    },
  );

  test('stored session can recover through signed in', () async {
    final source = _Source(authenticated: true, requiresRecovery: true);
    final repository = SupabaseAuthRepository.withSource(source);
    final controller = AuthController(repository);
    final states = <AuthStatus>[];
    controller.addListener(() => states.add(controller.state.status));

    await controller.restore();
    source.emit(SupabaseAuthEventType.initialSession, authenticated: true);
    source.emit(SupabaseAuthEventType.signedIn, authenticated: true);
    await _flushEvents();

    expect(states, [AuthStatus.initializing, AuthStatus.authenticated]);
    controller.dispose();
    await source.dispose();
    repository.dispose();
  });
}

Future<void> _flushEvents() => Future<void>.delayed(Duration.zero);

class _Source implements SupabaseAuthSource {
  _Source({required this.authenticated, this.requiresRecovery = false});

  final _events = StreamController<SupabaseAuthEvent>.broadcast(sync: true);
  bool authenticated;
  final bool requiresRecovery;

  @override
  SupabaseAuthBootstrapSnapshot get bootstrapSnapshot =>
      SupabaseAuthBootstrapSnapshot(
        _snapshot(),
        requiresRecovery: requiresRecovery,
      );

  @override
  Stream<SupabaseAuthEvent> get events => _events.stream;

  void emit(SupabaseAuthEventType type, {required bool authenticated}) {
    this.authenticated = authenticated;
    _events.add(SupabaseAuthEvent(type, _snapshot()));
  }

  AuthSnapshot _snapshot() => AuthSnapshot(
    authenticated ? AuthStatus.authenticated : AuthStatus.unauthenticated,
    subject: authenticated ? 'stored-user' : null,
  );

  @override
  Future<String?> accessToken() async => authenticated ? 'token' : null;

  @override
  Future<String?> refreshAccessToken() async => authenticated ? 'token' : null;

  @override
  Future<void> signIn({required String email, required String password}) async {
    authenticated = true;
  }

  @override
  Future<void> signOut() async {
    authenticated = false;
  }

  @override
  Future<bool> signUp({required String email, required String password}) async {
    authenticated = true;
    return true;
  }

  Future<void> dispose() => _events.close();
}
