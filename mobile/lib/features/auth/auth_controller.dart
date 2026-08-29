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
  String? _signOutError;
  bool _isSigningOut = false;
  String? get signOutError => _signOutError;
  bool get isSigningOut => _isSigningOut;
  late final StreamSubscription<AuthSnapshot> _sub;

  Future<void> restore() async {
    _state = await repo.restore();
    notifyListeners();
  }

  Future<void> login(String email, String password) =>
      _run(() => repo.signIn(email: email, password: password));
  Future<void> signup(String email, String password) =>
      _run(() => repo.signUp(email: email, password: password));
  Future<void> logout() async {
    if (_isSigningOut) return;
    _isSigningOut = true;
    _signOutError = null;
    notifyListeners();
    try {
      await repo.signOut();
      _state = await repo.restore();
    } catch (error) {
      _signOutError = _safeMessage(error);
      _state = await repo.restore();
    } finally {
      _isSigningOut = false;
      notifyListeners();
    }
  }

  Future<void> _run(Future<Object?> Function() action) async {
    _state = const AuthSnapshot(AuthStatus.loading);
    notifyListeners();
    try {
      await action();
      _state = await repo.restore();
    } catch (error) {
      _state = AuthSnapshot(AuthStatus.error, message: _safeMessage(error));
    }
    notifyListeners();
  }

  String _safeMessage(Object error) {
    final value = error.toString().toLowerCase();
    if (value.contains('invalid login') ||
        value.contains('invalid credentials')) {
      return 'Email or password is incorrect.';
    }
    if (value.contains('already registered') ||
        value.contains('already exists')) {
      return 'An account already exists with this email.';
    }
    if (value.contains('weak password') || value.contains('invalid password')) {
      return 'Use a password with at least 8 characters.';
    }
    if (value.contains('timeout')) {
      return 'The request timed out. Please try again.';
    }
    if (value.contains('socket') ||
        value.contains('network') ||
        value.contains('connection')) {
      return 'Unable to connect. Check your internet connection and try again.';
    }
    if (value.contains('service') || value.contains('server')) {
      return 'Authentication is unavailable right now. Please try again.';
    }
    return 'Something went wrong. Please try again.';
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}
