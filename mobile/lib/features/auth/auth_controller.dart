import 'dart:async';

import 'package:flutter/foundation.dart';

import 'domain/auth_repository.dart';

class AuthController extends ChangeNotifier {
  AuthController(this.repo)
    : _state = const AuthSnapshot(AuthStatus.initializing) {
    _sub = repo.states.listen((next) {
      _state = next;
      notifyListeners();
    });
  }

  final AuthRepository repo;
  AuthSnapshot _state;
  AuthSnapshot get state => _state;
  late final StreamSubscription<AuthSnapshot> _sub;

  Future<void> restore() async {
    _state = await repo.restore();
    notifyListeners();
  }

  Future<void> login(String email, String password) =>
      _run(() => repo.signIn(email: email, password: password));
  Future<void> signup(String email, String password) =>
      _run(() => repo.signUp(email: email, password: password));
  Future<void> logout() => _run(repo.signOut);

  Future<void> _run(Future<Object?> Function() action) async {
    _state = const AuthSnapshot(AuthStatus.loading);
    notifyListeners();
    try {
      await action();
      _state = await repo.restore();
    } catch (_) {
      _state = const AuthSnapshot(
        AuthStatus.error,
        message: 'Unable to complete that request. Please try again.',
      );
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
