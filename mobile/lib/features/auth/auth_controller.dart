import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../core/analytics/analytics.dart';
import 'domain/auth_repository.dart';

enum PhoneOtpState { phoneEntry, requesting, sent, verifying }

class AuthController extends ChangeNotifier {
  AuthController(
    this.repo, {
    Analytics? analytics,
    Future<void> Function()? beforeLogout,
  }) : _analytics = analytics ?? Analytics(const NoopAnalyticsProvider()),
       _state = const AuthSnapshot(AuthStatus.initializing) {
    _beforeLogout = beforeLogout;
    _sub = repo.states.listen((next) {
      _state = next;
      notifyListeners();
    });
  }

  final AuthRepository repo;
  final Analytics _analytics;
  late final Future<void> Function()? _beforeLogout;
  AuthSnapshot _state;
  AuthSnapshot get state => _state;
  PhoneOtpState _phoneOtpState = PhoneOtpState.phoneEntry;
  PhoneOtpState get phoneOtpState => _phoneOtpState;
  bool get isRequestingPhoneOtp => _phoneOtpState == PhoneOtpState.requesting;
  bool get isVerifyingPhoneOtp => _phoneOtpState == PhoneOtpState.verifying;
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
  Future<void> signup(String email, String password) async {
    _state = const AuthSnapshot(AuthStatus.loading);
    notifyListeners();
    try {
      final completed = await repo.signUp(email: email, password: password);
      _state = await repo.restore();
      if (completed) {
        unawaited(_analytics.track(AnalyticsEvent.signupCompleted));
      }
    } catch (error) {
      _state = AuthSnapshot(AuthStatus.error, message: _safeMessage(error));
    }
    notifyListeners();
  }

  Future<void> requestPhoneOtp(String phoneNumber) async {
    if (isRequestingPhoneOtp || isVerifyingPhoneOtp) return;
    _phoneOtpState = PhoneOtpState.requesting;
    _state = const AuthSnapshot(AuthStatus.loading);
    notifyListeners();

    try {
      final phoneOtpRepository = _phoneOtpRepository();
      await phoneOtpRepository.requestPhoneOtp(phoneNumber: phoneNumber);
      _phoneOtpState = PhoneOtpState.sent;
      _state = const AuthSnapshot(AuthStatus.unauthenticated);
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('PHONE_OTP_REQUEST_ERROR: $error');
        debugPrintStack(
          label: 'PHONE_OTP_REQUEST_STACK',
          stackTrace: stackTrace,
        );
      }

      _phoneOtpState = PhoneOtpState.phoneEntry;
      _state = AuthSnapshot(AuthStatus.error, message: _safeMessage(error));
    }

    notifyListeners();
  }

  Future<void> verifyPhoneOtp({
    required String phoneNumber,
    required String otp,
  }) async {
    if (isRequestingPhoneOtp || isVerifyingPhoneOtp) return;
    _phoneOtpState = PhoneOtpState.verifying;
    _state = const AuthSnapshot(AuthStatus.loading);
    notifyListeners();

    try {
      final phoneOtpRepository = _phoneOtpRepository();
      await phoneOtpRepository.verifyPhoneOtp(
        phoneNumber: phoneNumber,
        otp: otp,
      );
      _state = await repo.restore();
      _phoneOtpState = PhoneOtpState.phoneEntry;
    } catch (error, stackTrace) {
      if (kDebugMode) {
        debugPrint('PHONE_OTP_VERIFY_ERROR: $error');
        debugPrintStack(
          label: 'PHONE_OTP_VERIFY_STACK',
          stackTrace: stackTrace,
        );
      }

      _phoneOtpState = PhoneOtpState.sent;
      _state = AuthSnapshot(AuthStatus.error, message: _safeMessage(error));
    }

    notifyListeners();
  }

  PhoneOtpAuthRepository _phoneOtpRepository() {
    if (repo case final PhoneOtpAuthRepository phoneOtpRepository) {
      return phoneOtpRepository;
    }
    throw StateError('Phone OTP authentication is unavailable.');
  }

  Future<void> logout() async {
    if (_isSigningOut) return;
    _isSigningOut = true;
    _signOutError = null;
    notifyListeners();
    try {
      try {
        await _beforeLogout?.call();
      } catch (_) {}
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
    if (value.contains('rate') || value.contains('too many')) {
      return 'Please wait a moment before requesting another OTP.';
    }
    if (value.contains('otp') ||
        value.contains('token') ||
        value.contains('expired')) {
      return 'That OTP is invalid or has expired. Please try again.';
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
