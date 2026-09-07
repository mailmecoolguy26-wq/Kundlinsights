import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

abstract class PaymentApiClient {
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  });
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  });
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  });
  Future<Map<String, dynamic>> createRazorpayOrder({
    required String logicalSku,
    String? birthProfileId,
  }) => Future.error(
    StateError('Razorpay payment configuration is unavailable.'),
  );
  Future<void> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) => Future.error(
    StateError('Razorpay payment configuration is unavailable.'),
  );
  Future<Map<String, dynamic>> getRazorpayOrderStatus(String orderId) =>
      Future.error(
        StateError('Razorpay payment configuration is unavailable.'),
      );
  Future<Map<String, dynamic>> getLatestUnresolvedRazorpayOrder({
    required String birthProfileId,
  }) => Future.error(
    StateError('Razorpay payment configuration is unavailable.'),
  );
}

class AuthenticatedPaymentApiClient implements PaymentApiClient {
  const AuthenticatedPaymentApiClient(this._client);
  final ApiClient _client;

  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {
    await _client.post<Map<String, dynamic>>(
      '/v1/purchases/verify',
      data: {
        'provider': 'APPLE',
        'environment': environment,
        'productId': productId,
        'evidence': evidence,
      },
    );
  }

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async {
    await _client.post<Map<String, dynamic>>(
      '/v1/purchases/restore',
      data: {
        'provider': 'APPLE',
        'environment': environment,
        'evidence': {'signedTransactions': signedTransactions},
      },
    );
  }

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) async {
    await _client.post<Map<String, dynamic>>(
      '/v1/purchases/verify',
      data: {
        'provider': 'GOOGLE',
        'environment': 'PRODUCTION',
        'productId': productId,
        if (birthProfileId != null && birthProfileId.isNotEmpty)
          'birthProfileId': birthProfileId,
        'evidence': {'purchaseToken': purchaseToken},
      },
    );
  }

  @override
  Future<Map<String, dynamic>> createRazorpayOrder({
    required String logicalSku,
    String? birthProfileId,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/payments/razorpay/orders',
      data: {
        'logicalSku': logicalSku,
        if (birthProfileId?.isNotEmpty ?? false)
          'birthProfileId': birthProfileId,
      },
    );
    return response.data ?? const {};
  }

  @override
  Future<void> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    await _client.post<Map<String, dynamic>>(
      '/v1/payments/razorpay/verify',
      data: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      },
    );
  }

  @override
  Future<Map<String, dynamic>> getRazorpayOrderStatus(String orderId) async =>
      (await _client.get<Map<String, dynamic>>(
        '/v1/payments/razorpay/orders/$orderId',
      )).data ??
      const {};

  @override
  Future<Map<String, dynamic>> getLatestUnresolvedRazorpayOrder({
    required String birthProfileId,
  }) async =>
      (await _client.get<Map<String, dynamic>>(
        '/v1/payments/razorpay/unresolved-order',
        queryParameters: {'birthProfileId': birthProfileId},
      )).data ??
      const {};
}

class UnavailablePaymentApiClient implements PaymentApiClient {
  const UnavailablePaymentApiClient();

  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) => Future.error(StateError('Payment configuration is unavailable.'));

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) => Future.error(StateError('Payment configuration is unavailable.'));

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) => Future.error(StateError('Payment configuration is unavailable.'));
  @override
  Future<Map<String, dynamic>> createRazorpayOrder({
    required String logicalSku,
    String? birthProfileId,
  }) => Future.error(StateError('Payment configuration is unavailable.'));
  @override
  Future<void> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) => Future.error(StateError('Payment configuration is unavailable.'));
  @override
  Future<Map<String, dynamic>> getRazorpayOrderStatus(String orderId) =>
      Future.error(StateError('Payment configuration is unavailable.'));
  @override
  Future<Map<String, dynamic>> getLatestUnresolvedRazorpayOrder({
    required String birthProfileId,
  }) => Future.error(StateError('Payment configuration is unavailable.'));
}

final paymentApiClientProvider = Provider<PaymentApiClient>(
  (ref) => const UnavailablePaymentApiClient(),
);
