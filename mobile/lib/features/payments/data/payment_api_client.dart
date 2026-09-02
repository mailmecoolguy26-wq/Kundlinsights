import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';

abstract interface class PaymentApiClient {
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
  });
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
  }) async {
    await _client.post<Map<String, dynamic>>(
      '/v1/purchases/verify',
      data: {
        'provider': 'GOOGLE',
        'environment': 'PRODUCTION',
        'productId': productId,
        'evidence': {'purchaseToken': purchaseToken},
      },
    );
  }
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
  }) => Future.error(StateError('Payment configuration is unavailable.'));
}

final paymentApiClientProvider = Provider<PaymentApiClient>(
  (ref) => const UnavailablePaymentApiClient(),
);
