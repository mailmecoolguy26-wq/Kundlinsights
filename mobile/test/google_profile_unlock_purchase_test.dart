import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/career_premium_product_loader.dart';
import 'package:kundlinsights_mobile/features/payments/data/google_play_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'career.profile.unlock.google';
const _product = StoreProductDetails(
  id: _productId,
  title: 'Career Premium',
  description: 'Unlock this profile permanently',
  localizedPrice: '₹499.00',
  rawPrice: 499,
  currencyCode: 'INR',
);

void main() {
  test(
    'loads localized Google product metadata and starts it as a consumable',
    () async {
      final store = _Store();
      final service = GooglePlayPurchaseService(
        client: store,
        careerPremiumAnnualGoogleProductId: 'legacy.annual',
        careerProfileUnlockGoogleProductId: _productId,
      );
      final result = await service.loadCareerPremiumProduct();
      expect(result.product?.logicalSku, careerProfileUnlockLogicalSku);
      expect(result.product?.localizedPrice, '₹499.00');
      expect(await service.startCareerPremiumPurchase(result.product!), isTrue);
      expect(store.consumableStarts, [_productId]);
      expect(store.nonConsumableStarts, isEmpty);
      await store.dispose();
    },
  );

  test('captures the initiating profile, verifies before consumption, and does not retarget after a profile switch', () async {
    final harness = await _Harness.create();
    await harness.controller.startPurchase();
    harness.currentProfile = 'profile-b';
    harness.store.events.add(
      const StorePurchaseUpdate(
        productId: _productId,
        status: StorePurchaseStatus.purchased,
        serverVerificationData: 'token-a',
        pendingCompletePurchase: true,
      ),
    );
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(harness.api.birthProfileIds, ['profile-a']);
    expect(harness.store.consumed, ['token-a']);
    expect(harness.store.completed, isEmpty);
    expect(harness.controller.state, CareerPremiumPurchaseState.success);
    await harness.dispose();
  });

  test('backend failure leaves the consumable purchase unconsumed and a completed redelivery is idempotent', () async {
    final harness = await _Harness.create(failVerify: true);
    await harness.controller.startPurchase();
    harness.store.events.add(
      const StorePurchaseUpdate(
        productId: _productId,
        status: StorePurchaseStatus.purchased,
        serverVerificationData: 'retry-token',
        pendingCompletePurchase: true,
      ),
    );
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
    expect(harness.store.consumed, isEmpty);
    expect(harness.controller.state, CareerPremiumPurchaseState.error);
    harness.api.failVerify = false;
    await harness.controller.retryVerification();
    expect(harness.store.consumed, ['retry-token']);
    harness.store.events.add(
      const StorePurchaseUpdate(
        productId: _productId,
        status: StorePurchaseStatus.purchased,
        serverVerificationData: 'retry-token',
        pendingCompletePurchase: true,
      ),
    );
    await Future<void>.delayed(Duration.zero);
    expect(harness.store.consumed, ['retry-token']);
    await harness.dispose();
  });
}

class _Harness {
  _Harness._(this.store, this.api, this.controller);
  final _Store store;
  final _Api api;
  final CareerPremiumPurchaseController controller;
  String currentProfile = 'profile-a';

  static Future<_Harness> create({bool failVerify = false}) async {
    final store = _Store();
    final google = GooglePlayPurchaseService(
      client: store,
      careerPremiumAnnualGoogleProductId: 'legacy.annual',
      careerProfileUnlockGoogleProductId: _productId,
    );
    final productController = CareerPremiumProductController(google);
    await productController.load();
    final api = _Api(failVerify: failVerify);
    late final _Harness harness;
    final controller = CareerPremiumPurchaseController(
      service: AppleStorePurchaseService(
        client: store,
        careerPremiumAnnualAppleProductId: 'apple',
      ),
      googlePurchaseService: google,
      platform: CareerPremiumStorePlatform.googlePlay,
      paymentApi: api,
      productController: productController,
      entitlementRefresher: _Entitlement(),
      applePaymentEnvironment: 'SANDBOX',
      activeBirthProfileId: () => harness.currentProfile,
    );
    harness = _Harness._(store, api, controller);
    return harness;
  }

  Future<void> dispose() async {
    controller.dispose();
    await store.dispose();
  }
}

class _Store implements StorePurchaseClient {
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  final consumableStarts = <String>[];
  final nonConsumableStarts = <String>[];
  final consumed = <String>[];
  final completed = <String>[];
  @override
  Future<bool> isAvailable() async => true;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;
  @override
  Future<StoreProductQueryResult> queryProductDetails(Set<String> ids) async =>
      const StoreProductQueryResult(products: [_product], notFoundIds: {});
  @override
  Future<bool> buyNonConsumable(String productId) async {
    nonConsumableStarts.add(productId);
    return true;
  }

  Future<bool> buyConsumable(String productId) async {
    consumableStarts.add(productId);
    return true;
  }

  Future<void> consumePurchase(StorePurchaseUpdate purchase) async {
    consumed.add(purchase.serverVerificationData);
  }

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed.add(purchase.serverVerificationData);
  }

  @override
  Future<void> restorePurchases() async {}
  Future<void> dispose() => events.close();
}

class _Api extends PaymentApiClient {
  _Api({required this.failVerify});
  bool failVerify;
  final birthProfileIds = <String>[];
  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) async {
    if (failVerify) throw StateError('temporary backend failure');
    birthProfileIds.add(birthProfileId!);
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
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  CareerEligibilityState _state = CareerEligibilityState.ineligible;
  @override
  CareerEligibilityState get eligibilityState => _state;
  @override
  Future<void> refreshEligibility() async {
    _state = CareerEligibilityState.eligible;
  }
}
