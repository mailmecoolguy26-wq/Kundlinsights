import 'dart:async';

import 'package:razorpay_flutter/razorpay_flutter.dart';

/// Checkout success is evidence only. Access is shown only after backend verify.
abstract interface class RazorpayCheckout {
  Future<RazorpayPaymentEvidence> open({
    required String keyId,
    required String orderId,
    required int amountMinor,
    required String currency,
  });
  void dispose();
}

/// The SDK reported an exit before it delivered payment evidence. A caller may
/// safely offer another attempt; once evidence exists, recovery must be used.
class RazorpayCheckoutCancelled implements Exception {
  const RazorpayCheckoutCancelled();
}

class RazorpayPurchaseService implements RazorpayCheckout {
  RazorpayPurchaseService({Razorpay? razorpay})
    : _razorpay = razorpay ?? Razorpay() {
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onError);
  }
  final Razorpay _razorpay;
  Completer<RazorpayPaymentEvidence>? _pending;
  @override
  Future<RazorpayPaymentEvidence> open({
    required String keyId,
    required String orderId,
    required int amountMinor,
    required String currency,
  }) {
    if (_pending != null) {
      return Future.error(StateError('A Razorpay checkout is already active.'));
    }
    final pending = _pending = Completer<RazorpayPaymentEvidence>();
    _razorpay.open({
      'key': keyId,
      'order_id': orderId,
      'amount': amountMinor,
      'currency': currency,
    });
    return pending.future.whenComplete(() {
      if (identical(_pending, pending)) {
        _pending = null;
      }
    });
  }

  void _onSuccess(PaymentSuccessResponse value) {
    final pending = _pending;
    if (pending != null &&
        !pending.isCompleted &&
        value.orderId != null &&
        value.paymentId != null &&
        value.signature != null) {
      pending.complete(
        RazorpayPaymentEvidence(
          orderId: value.orderId!,
          paymentId: value.paymentId!,
          signature: value.signature!,
        ),
      );
    }
  }

  void _onError(PaymentFailureResponse value) {
    final pending = _pending;
    if (pending != null && !pending.isCompleted) {
      pending.completeError(const RazorpayCheckoutCancelled());
    }
  }

  @override
  void dispose() => _razorpay.clear();
}

class RazorpayPaymentEvidence {
  const RazorpayPaymentEvidence({
    required this.orderId,
    required this.paymentId,
    required this.signature,
  });
  final String orderId;
  final String paymentId;
  final String signature;
}
