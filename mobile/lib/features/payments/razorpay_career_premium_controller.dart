import 'package:flutter/foundation.dart';

import '../../core/analytics/analytics.dart';
import '../readings/career_reading_generation_controller.dart';
import 'data/payment_api_client.dart';
import 'data/razorpay_purchase_service.dart';
import 'career_premium_purchase_controller.dart';

enum RazorpayCareerPremiumState {
  idle,
  creatingOrder,
  checkoutOpen,
  verifying,
  success,
  definitiveFailure,
  paymentStatusUnknown,
}

/// Keeps Razorpay evidence separate from entitlement. Native checkout success
/// never changes access; only a completed backend verify plus refresh does.
class RazorpayCareerPremiumController extends ChangeNotifier {
  RazorpayCareerPremiumController({
    required this.api,
    required this.checkout,
    required this.entitlements,
    Analytics? analytics,
  }) : _analytics = analytics ?? Analytics(const NoopAnalyticsProvider());
  final PaymentApiClient api;
  final RazorpayCheckout checkout;
  final CareerPremiumEntitlementRefresher entitlements;
  final Analytics _analytics;
  final Map<String, _RazorpayProfileSession> _sessions = {};
  bool _disposed = false;
  // Temporary presentation compatibility; PASS 2 must use stateFor(profile).
  RazorpayCareerPremiumState get state => RazorpayCareerPremiumState.idle;
  bool get canRetry => false;
  _RazorpayProfileSession _session(String id) =>
      _sessions.putIfAbsent(id, _RazorpayProfileSession.new);
  String _safeOrderId(String? value) {
    if (value == null || value.isEmpty) return 'none';
    return value.substring(0, value.length > 8 ? 8 : value.length);
  }

  String _safeProfileId(String value) =>
      value.hashCode.toUnsigned(32).toRadixString(16);

  RazorpayCareerPremiumState stateFor(String birthProfileId) =>
      _session(birthProfileId).state;
  bool canRetryFor(String birthProfileId) {
    final session = _session(birthProfileId);
    return session.state == RazorpayCareerPremiumState.definitiveFailure &&
        session.orderId == null;
  }

  String? logicalSkuFor(String birthProfileId) =>
      _session(birthProfileId).logicalSku;
  int? amountMinorFor(String birthProfileId) =>
      _session(birthProfileId).amountMinor;
  String? currencyFor(String birthProfileId) =>
      _session(birthProfileId).currency;

  /// Reconciles one profile's persisted Razorpay order state after controller
  /// recreation. The backend remains the source of truth; no order state is
  /// written to device storage.
  Future<void> hydrate({required String birthProfileId}) async {
    if (birthProfileId.trim().isEmpty) return;

    final session = _session(birthProfileId);
    try {
      await entitlements.refreshEligibility();
    } catch (_) {
      // Without an authoritative entitlement result, a prior payment cannot
      // safely be ruled out for this profile.
      return _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
    }
    if (entitlements.eligibilityState == CareerEligibilityState.eligible) {
      return _set(session, RazorpayCareerPremiumState.success);
    }

    if (session.state == RazorpayCareerPremiumState.creatingOrder ||
        session.state == RazorpayCareerPremiumState.checkoutOpen ||
        session.state == RazorpayCareerPremiumState.verifying ||
        session.state == RazorpayCareerPremiumState.paymentStatusUnknown) {
      return;
    }

    try {
      final result = await api.getLatestUnresolvedRazorpayOrder(
        birthProfileId: birthProfileId,
        logicalSku: session.logicalSku,
      );
      final order = result['order'];
      if (order is! Map) {
        session.orderId = null;
        return _set(session, RazorpayCareerPremiumState.idle);
      }
      final orderId = order['providerOrderId'];
      if (orderId is String && orderId.trim().isNotEmpty) {
        session.orderId = orderId;
      }
      session.logicalSku = order['logicalSku'] as String? ?? session.logicalSku;
      session.amountMinor = order['amountMinor'] as int? ?? session.amountMinor;
      session.currency = order['currency'] as String? ?? session.currency;
      // A malformed response must not open a new-payment CTA when the
      // authoritative lookup indicated an order may still exist.
      return _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
    } catch (_) {
      // A failed authoritative lookup cannot prove that no prior order exists.
      // Keep the profile blocked from another charge until recovery succeeds.
      _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
    }
  }

  void returnToPaywall({String? birthProfileId}) {
    if (birthProfileId == null || birthProfileId.trim().isEmpty) return;
    final session = _session(birthProfileId);
    if (session.state != RazorpayCareerPremiumState.definitiveFailure) return;
    if (session.orderId != null) return;
    _set(session, RazorpayCareerPremiumState.idle);
  }

  Future<void> start({
    required String birthProfileId,
    String logicalSku = 'career_premium_annual',
  }) async {
    if (birthProfileId.trim().isEmpty) return;
    final session = _session(birthProfileId);
    if (session.state != RazorpayCareerPremiumState.idle &&
        !canRetryFor(birthProfileId)) {
      return;
    }
    _set(session, RazorpayCareerPremiumState.creatingOrder);
    session.purchaseAttemptActive = true;
    session.logicalSku = logicalSku;
    if (kDebugMode) {
      debugPrint(
        'RAZORPAY_ORDER_CREATE_START profile=${_safeProfileId(birthProfileId)} '
        'plan=$logicalSku',
      );
    }
    _analytics.track(AnalyticsEvent.purchaseStarted, {
      'sku': logicalSku,
      'payment_provider': 'razorpay',
      'product_type': 'career_premium',
    });
    var stage = 'create_order';
    try {
      final result = await api.createRazorpayOrder(
        logicalSku: logicalSku,
        birthProfileId: birthProfileId,
      );
      final order = result['order'];
      final details = order is Map ? order : result;
      session.orderId = details['orderId'] as String?;
      session.logicalSku = details['logicalSku'] as String? ?? logicalSku;
      session.amountMinor = details['amountMinor'] as int?;
      session.currency = details['currency'] as String?;
      if (kDebugMode) {
        debugPrint(
          'RAZORPAY_ORDER_CREATE_RESULT success=true '
          'orderId=${_safeOrderId(session.orderId)} '
          'amountPaise=${session.amountMinor} currency=${session.currency}',
        );
      }
      if (session.orderId == null) {
        throw StateError('Missing Razorpay order.');
      }
      _set(session, RazorpayCareerPremiumState.checkoutOpen);
      stage = 'checkout';
      final evidence = await checkout.open(
        keyId: details['keyId'] as String,
        orderId: session.orderId!,
        amountMinor: session.amountMinor!,
        currency: session.currency!,
      );
      _set(session, RazorpayCareerPremiumState.verifying);
      stage = 'verify';
      await api.verifyRazorpayPayment(
        razorpayOrderId: evidence.orderId,
        razorpayPaymentId: evidence.paymentId,
        razorpaySignature: evidence.signature,
      );
      await _refresh(session);
    } on RazorpayCheckoutCancelled {
      // The checkout exited before any payment evidence was delivered.
      _set(session, RazorpayCareerPremiumState.definitiveFailure);
      _trackFailure(session, 'cancelled');
    } catch (error) {
      if (kDebugMode) {
        if (stage == 'create_order') {
          debugPrint(
            'RAZORPAY_ORDER_CREATE_RESULT success=false '
            'exceptionType=${error.runtimeType} message=$error',
          );
        } else if (stage == 'checkout') {
          debugPrint(
            'RAZORPAY_CHECKOUT_EXCEPTION exceptionType=${error.runtimeType} '
            'message=$error',
          );
        }
      }
      // A checkout may have completed when delivery/verification fails. Never
      // offer a new charge until authoritative recovery says it is safe.
      _set(
        session,
        session.orderId == null
            ? RazorpayCareerPremiumState.definitiveFailure
            : RazorpayCareerPremiumState.paymentStatusUnknown,
      );
      _trackFailure(session, 'verification_failed');
    }
  }

  Future<void> recover({String? birthProfileId}) async {
    if (birthProfileId == null || birthProfileId.trim().isEmpty) return;
    final session = _session(birthProfileId);
    try {
      await entitlements.refreshEligibility();
    } catch (_) {
      // Reconciliation remains authoritative when entitlement refresh is
      // temporarily unavailable, so continue to the known provider order.
    }
    if (entitlements.eligibilityState == CareerEligibilityState.eligible) {
      return _set(session, RazorpayCareerPremiumState.success);
    }
    final order = session.orderId;
    if (order == null) {
      return _set(session, RazorpayCareerPremiumState.definitiveFailure);
    }
    try {
      final result = await api.getRazorpayOrderStatus(order);
      final value = result['order'];
      final data = value is Map ? value : result;
      if (data['finalized'] == true) {
        await _refresh(session);
      } else if (data['status'] == 'FAILED') {
        await _reconcileFailedOrder(session, birthProfileId);
      } else {
        _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
      }
    } catch (_) {
      _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
    }
  }

  Future<void> _reconcileFailedOrder(
    _RazorpayProfileSession session,
    String birthProfileId,
  ) async {
    try {
      final result = await api.getLatestUnresolvedRazorpayOrder(
        birthProfileId: birthProfileId,
        logicalSku: session.logicalSku,
      );
      final order = result['order'];
      if (order is! Map) {
        session.orderId = null;
        return _set(session, RazorpayCareerPremiumState.definitiveFailure);
      }
      final orderId = order['providerOrderId'];
      if (orderId is String && orderId.trim().isNotEmpty) {
        session.orderId = orderId;
      }
      session.logicalSku = order['logicalSku'] as String? ?? session.logicalSku;
      session.amountMinor = order['amountMinor'] as int? ?? session.amountMinor;
      session.currency = order['currency'] as String? ?? session.currency;
      if (kDebugMode) {
        debugPrint(
          'RAZORPAY_CAREER_ORDER_RESOLVED source=unresolved_order orderId=${_safeOrderId(session.orderId)} plan=${session.logicalSku} amountPaise=${session.amountMinor}',
        );
      }
      // A malformed discovery response cannot prove that a retry is safe.
      _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
    } catch (_) {
      // A failed discovery request cannot prove there is no older unresolved
      // order for this profile, so retain the payment safety block.
      _set(session, RazorpayCareerPremiumState.paymentStatusUnknown);
    }
  }

  Future<void> _refresh(_RazorpayProfileSession session) async {
    await entitlements.refreshEligibility();
    _set(
      session,
      entitlements.eligibilityState == CareerEligibilityState.eligible
          ? RazorpayCareerPremiumState.success
          : RazorpayCareerPremiumState.paymentStatusUnknown,
    );
  }

  void _set(_RazorpayProfileSession session, RazorpayCareerPremiumState value) {
    session.state = value;
    notifyListeners();
  }

  void _trackFailure(_RazorpayProfileSession session, String category) {
    if (!session.purchaseAttemptActive) return;
    session.purchaseAttemptActive = false;
    _analytics.track(AnalyticsEvent.purchaseFailed, {
      'failure_category': category,
      'payment_provider': 'razorpay',
      'product_type': 'career_premium',
    });
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    checkout.dispose();
    super.dispose();
  }
}

class _RazorpayProfileSession {
  RazorpayCareerPremiumState state = RazorpayCareerPremiumState.idle;
  String? orderId;
  String? logicalSku;
  int? amountMinor;
  String? currency;
  bool purchaseAttemptActive = false;
}
