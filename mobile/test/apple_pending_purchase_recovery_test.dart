import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/payments/data/pending_apple_purchase_store.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'com.taraverse.career.profile.unlock';

void main() {
  test('pending record rejects malformed and unsupported data safely', () {
    expect(PendingApplePurchase.tryParse('not json'), isNull);
    expect(
      PendingApplePurchase.tryParse(
        '{"version":99,"provider":"APPLE","logicalSku":"career_profile_unlock"}',
      ),
      isNull,
    );
  });

  test('pending record persists only recovery fields', () async {
    final store = InMemoryPendingApplePurchaseStore();
    final pending = _pending();
    await store.save(pending);
    expect((await store.load())?.birthProfileId, 'profile-a');
    expect((await store.load())?.transactionId, 'T1');
    expect((await store.load())?.evidence, 'opaque-evidence');
    await store.clear();
    expect(await store.load(), isNull);
  });

  test(
    'timeout persists Profile A and restart never remaps it to Profile B',
    () async {
      final store = InMemoryPendingApplePurchaseStore();
      final first = await _Harness.create(
        store: store,
        activeProfile: () => 'profile-a',
        timeout: true,
      );
      await first.ready();
      await first.controller.startPurchase();
      first.client.events.add(_purchase());
      await _tick();
      expect(
        first.controller.state,
        CareerPremiumPurchaseState.paymentStatusUnknown,
      );
      expect((await store.load())?.birthProfileId, 'profile-a');
      expect(first.client.completed, 0);
      first.dispose();

      final restarted = await _Harness.create(
        store: store,
        activeProfile: () => 'profile-b',
      );
      await restarted.ready();
      expect(
        restarted.controller.state,
        CareerPremiumPurchaseState.paymentStatusUnknown,
      );
      expect(restarted.controller.canStart, isFalse);
      await restarted.controller.retryPendingAppleVerification();
      expect(restarted.api.profileTargets, ['profile-a']);
      expect(restarted.controller.canStart, isFalse);

      restarted.client.events.add(_purchase());
      await _tick();
      expect(restarted.api.profileTargets.last, 'profile-a');
      expect(restarted.client.completed, 1);
      expect(await store.load(), isNull);
      expect(restarted.controller.state, CareerPremiumPurchaseState.success);
      restarted.dispose();
    },
  );

  test(
    'unmapped StoreKit redelivery never attaches to active profile',
    () async {
      final h = await _Harness.create(
        store: InMemoryPendingApplePurchaseStore(),
        activeProfile: () => 'profile-b',
      );
      await h.ready();
      h.client.events.add(_purchase());
      await _tick();
      expect(h.api.profileTargets, isEmpty);
      expect(h.controller.state, CareerPremiumPurchaseState.error);
      h.dispose();
    },
  );
}

PendingApplePurchase _pending() => PendingApplePurchase(
  transactionId: 'T1',
  birthProfileId: 'profile-a',
  productId: _productId,
  evidence: 'opaque-evidence',
  environment: 'SANDBOX',
  updatedAt: DateTime.utc(2026),
);

StorePurchaseUpdate _purchase() => const StorePurchaseUpdate(
  productId: _productId,
  status: StorePurchaseStatus.purchased,
  serverVerificationData: 'opaque-evidence',
  pendingCompletePurchase: true,
  transactionId: 'T1',
);

Future<void> _tick() => Future<void>.delayed(Duration.zero);

class _Harness {
  _Harness._(
    this.client,
    this.product,
    this.entitlement,
    this.api,
    this.controller,
  );
  final _Client client;
  final CareerPremiumProductController product;
  final _Entitlement entitlement;
  final _Api api;
  final CareerPremiumPurchaseController controller;

  static Future<_Harness> create({
    required PendingApplePurchaseStore store,
    required String? Function() activeProfile,
    bool timeout = false,
  }) async {
    final client = _Client();
    final service = AppleStorePurchaseService(
      client: client,
      careerPremiumAnnualAppleProductId: null,
      careerProfileUnlockAppleProductId: _productId,
    );
    final product = CareerPremiumProductController(service);
    await product.load();
    final entitlement = _Entitlement();
    final api = _Api(timeout: timeout);
    return _Harness._(
      client,
      product,
      entitlement,
      api,
      CareerPremiumPurchaseController(
        service: service,
        paymentApi: api,
        productController: product,
        entitlementRefresher: entitlement,
        applePaymentEnvironment: 'SANDBOX',
        pendingApplePurchaseStore: store,
        activeBirthProfileId: activeProfile,
      ),
    );
  }

  Future<void> ready() async {
    for (
      var attempt = 0;
      attempt < 3 && !controller.recoveryInitialized;
      attempt++
    ) {
      await _tick();
    }
    expect(controller.recoveryInitialized, isTrue);
  }

  void dispose() {
    controller.dispose();
    product.dispose();
    client.events.close();
  }
}

class _Client implements StorePurchaseClient, ConsumableStorePurchaseClient {
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  int completed = 0;
  int starts = 0;
  @override
  Future<bool> buyConsumable(String productId) async {
    starts++;
    return true;
  }

  @override
  Future<bool> buyNonConsumable(String productId) async => false;
  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async =>
      completed++;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;
  @override
  Future<StoreProductQueryResult> queryProductDetails(Set<String> ids) async =>
      const StoreProductQueryResult(
        products: [
          StoreProductDetails(
            id: _productId,
            title: 'Career',
            description: '',
            localizedPrice: r'$7.99',
            rawPrice: 7.99,
            currencyCode: 'USD',
          ),
        ],
        notFoundIds: {},
      );
  @override
  Future<void> restorePurchases() async {}
}

class _Api extends PaymentApiClient
    implements AppleProfileUnlockPaymentApiClient {
  _Api({this.timeout = false});
  final bool timeout;
  final profileTargets = <String>[];
  @override
  Future<void> verifyAppleProfileUnlockPurchase({
    required String environment,
    required String productId,
    required String evidence,
    required String birthProfileId,
  }) async {
    profileTargets.add(birthProfileId);
    if (timeout) {
      throw DioException(
        requestOptions: RequestOptions(path: '/v1/purchases/verify'),
        type: DioExceptionType.connectionTimeout,
      );
    }
  }

  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {}
  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async {}
  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) async {}
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  CareerEligibilityState _state = CareerEligibilityState.ineligible;
  @override
  CareerEligibilityState get eligibilityState => _state;
  @override
  Future<void> refreshEligibility() async =>
      _state = CareerEligibilityState.eligible;
}
