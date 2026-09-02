import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/career_premium_product_loader.dart';
import 'package:kundlinsights_mobile/features/payments/data/google_play_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/payments/domain/career_premium_product.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _googleProductId = 'career_premium_annual_google';
const _appleProductId = 'career_premium_annual_apple';

void main() {
  test(
    'Android starts only the configured Google Play purchase once',
    () async {
      final harness = await _Harness.create(
        platform: CareerPremiumStorePlatform.googlePlay,
      );

      await harness.controller.startPurchase();
      await harness.controller.startPurchase();

      expect(harness.googleStore.started, [_googleProductId]);
      expect(harness.appleStore.started, isEmpty);
      expect(harness.api.verifyCalls, 0);
      expect(harness.appleStore.completed, 0);
      expect(harness.appleStore.restoreCalls, 0);
      expect(harness.controller.state, CareerPremiumPurchaseState.purchasing);
      harness.dispose();
    },
  );

  test(
    'Google Play rejects an unconfigured or mismatched product ID',
    () async {
      final store = _Store(products: const [_googleProduct]);
      final service = GooglePlayPurchaseService(
        client: store,
        careerPremiumAnnualGoogleProductId: _googleProductId,
      );

      expect(
        await service.startCareerPremiumPurchase(
          const CareerPremiumProduct(
            logicalSku: careerPremiumAnnualLogicalSku,
            storeProductId: 'wrong.product',
            title: 'Wrong',
            description: '',
            localizedPrice: r'$1',
            rawPrice: 1,
            currencyCode: 'USD',
          ),
        ),
        isFalse,
      );
      expect(store.started, isEmpty);
    },
  );

  test('Android initiation is blocked when entitled or unavailable', () async {
    final entitled = await _Harness.create(
      platform: CareerPremiumStorePlatform.googlePlay,
      eligible: true,
    );
    await entitled.controller.startPurchase();
    expect(entitled.googleStore.started, isEmpty);
    entitled.dispose();

    final unavailable = await _Harness.create(
      platform: CareerPremiumStorePlatform.googlePlay,
      googleAvailable: false,
    );
    await unavailable.controller.startPurchase();
    expect(unavailable.googleStore.started, isEmpty);
    unavailable.dispose();
  });

  test('Android initiation is blocked while restore is active', () async {
    final restore = Completer<void>();
    final harness = await _Harness.create(
      platform: CareerPremiumStorePlatform.googlePlay,
      restoreCompleter: restore,
    );

    final restoring = harness.controller.restorePurchases();
    await Future<void>.delayed(Duration.zero);
    await harness.controller.startPurchase();

    expect(harness.googleStore.started, isEmpty);
    expect(harness.googleStore.restoreCalls, 1);
    expect(harness.appleStore.restoreCalls, 0);
    restore.complete();
    await restoring;
    harness.dispose();
  });

  test('iOS initiation continues to route only to Apple', () async {
    final harness = await _Harness.create(
      platform: CareerPremiumStorePlatform.apple,
    );

    await harness.controller.startPurchase();

    expect(harness.appleStore.started, [_appleProductId]);
    expect(harness.googleStore.started, isEmpty);
    expect(harness.api.verifyCalls, 0);
    expect(harness.appleStore.completed, 0);
    harness.dispose();
  });
}

class _Harness {
  _Harness._({
    required this.appleStore,
    required this.googleStore,
    required this.productController,
    required this.controller,
    required this.api,
  });

  final _Store appleStore;
  final _Store googleStore;
  final CareerPremiumProductController productController;
  final CareerPremiumPurchaseController controller;
  final _Api api;

  static Future<_Harness> create({
    required CareerPremiumStorePlatform platform,
    bool eligible = false,
    bool googleAvailable = true,
    Completer<void>? restoreCompleter,
  }) async {
    final appleStore = _Store(
      products: const [_appleProduct],
      restoreCompleter: restoreCompleter,
    );
    final googleStore = _Store(
      available: googleAvailable,
      products: const [_googleProduct],
      restoreCompleter: restoreCompleter,
    );
    final productController = CareerPremiumProductController(
      platform == CareerPremiumStorePlatform.googlePlay
          ? GooglePlayPurchaseService(
              client: googleStore,
              careerPremiumAnnualGoogleProductId: _googleProductId,
            )
          : AppleStorePurchaseService(
              client: appleStore,
              careerPremiumAnnualAppleProductId: _appleProductId,
            ),
    );
    await productController.load();
    final api = _Api();
    final controller = CareerPremiumPurchaseController(
      service: AppleStorePurchaseService(
        client: appleStore,
        careerPremiumAnnualAppleProductId: _appleProductId,
      ),
      googlePurchaseService: GooglePlayPurchaseService(
        client: googleStore,
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ),
      platform: platform,
      paymentApi: api,
      productController: productController,
      entitlementRefresher: _Entitlement(eligible: eligible),
      applePaymentEnvironment: 'SANDBOX',
    );
    return _Harness._(
      appleStore: appleStore,
      googleStore: googleStore,
      productController: productController,
      controller: controller,
      api: api,
    );
  }

  void dispose() {
    controller.dispose();
    productController.dispose();
    appleStore.dispose();
    googleStore.dispose();
  }
}

const _googleProduct = StoreProductDetails(
  id: _googleProductId,
  title: 'Career Premium',
  description: 'Annual subscription',
  localizedPrice: r'$7.99',
  rawPrice: 7.99,
  currencyCode: 'USD',
);

const _appleProduct = StoreProductDetails(
  id: _appleProductId,
  title: 'Career Premium',
  description: 'Annual subscription',
  localizedPrice: r'$7.99',
  rawPrice: 7.99,
  currencyCode: 'USD',
);

class _Store implements StorePurchaseClient {
  _Store({
    this.available = true,
    this.products = const [],
    this.restoreCompleter,
  });

  final bool available;
  final List<StoreProductDetails> products;
  final Completer<void>? restoreCompleter;
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  final started = <String>[];
  int completed = 0;
  int restoreCalls = 0;

  @override
  Future<bool> buyNonConsumable(String productId) async {
    started.add(productId);
    return true;
  }

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed++;
  }

  void dispose() => events.close();

  @override
  Future<bool> isAvailable() async => available;

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;

  @override
  Future<StoreProductQueryResult> queryProductDetails(Set<String> ids) async =>
      StoreProductQueryResult(products: products, notFoundIds: const {});

  @override
  Future<void> restorePurchases() async {
    restoreCalls++;
    await restoreCompleter?.future;
  }
}

class _Api implements PaymentApiClient {
  int verifyCalls = 0;

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async {}

  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {
    verifyCalls++;
  }

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
  }) async {
    verifyCalls++;
  }
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement({required bool eligible})
    : _state = eligible
          ? CareerEligibilityState.eligible
          : CareerEligibilityState.ineligible;

  final CareerEligibilityState _state;

  @override
  CareerEligibilityState get eligibilityState => _state;

  @override
  Future<void> refreshEligibility() async {}
}
