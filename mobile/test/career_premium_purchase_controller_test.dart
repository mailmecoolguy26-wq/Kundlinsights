import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'com.kundlinsights.career.premium.annual';

void main() {
  test('starts only one validated non-consumable purchase', () async {
    final harness = await _Harness.create(eligible: false);
    await harness.controller.startPurchase();
    await harness.controller.startPurchase();
    expect(harness.store.started, [_productId]);
    expect(harness.controller.state, CareerPremiumPurchaseState.purchasing);
    harness.dispose();
  });

  test(
    'pending and canceled StoreKit events never call backend verify',
    () async {
      final harness = await _Harness.create();
      harness.store.events.add(_purchase(StorePurchaseStatus.pending));
      await _tick();
      expect(harness.controller.state, CareerPremiumPurchaseState.pending);
      harness.store.events.add(_purchase(StorePurchaseStatus.canceled));
      await _tick();
      expect(harness.controller.state, CareerPremiumPurchaseState.canceled);
      expect(harness.api.calls, isEmpty);
      harness.dispose();
    },
  );

  test(
    'verified opaque evidence refreshes entitlement then completes purchase',
    () async {
      final harness = await _Harness.create();
      harness.store.events.add(_purchase(StorePurchaseStatus.purchased));
      await _tick();
      expect(harness.api.calls, ['opaque-server-evidence']);
      expect(harness.entitlement.refreshes, 1);
      expect(harness.store.completed, 1);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      harness.dispose();
    },
  );

  test(
    'verify failure, ineligible refresh, and duplicate event do not unlock',
    () async {
      final failed = await _Harness.create(apiFails: true);
      failed.store.events.add(_purchase(StorePurchaseStatus.purchased));
      await _tick();
      expect(failed.controller.state, CareerPremiumPurchaseState.error);
      expect(failed.store.completed, 0);
      failed.dispose();

      final ineligible = await _Harness.create(eligible: false);
      ineligible.store.events.add(_purchase(StorePurchaseStatus.purchased));
      await _tick();
      expect(ineligible.controller.state, CareerPremiumPurchaseState.error);
      expect(ineligible.store.completed, 0);
      ineligible.dispose();
    },
  );
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _purchase(StorePurchaseStatus status) =>
    StorePurchaseUpdate(
      productId: _productId,
      status: status,
      serverVerificationData: 'opaque-server-evidence',
      pendingCompletePurchase: true,
    );

class _Harness {
  _Harness._(
    this.store,
    this.product,
    this.entitlement,
    this.api,
    this.controller,
  );
  final _Store store;
  final CareerPremiumProductController product;
  final _Entitlement entitlement;
  final _Api api;
  final CareerPremiumPurchaseController controller;

  static Future<_Harness> create({
    bool eligible = true,
    bool apiFails = false,
  }) async {
    final store = _Store();
    final product = CareerPremiumProductController(
      AppleStorePurchaseService(
        client: store,
        careerPremiumAnnualAppleProductId: _productId,
      ),
    );
    await product.load();
    final entitlement = _Entitlement(eligible: eligible);
    final api = _Api(fails: apiFails);
    return _Harness._(
      store,
      product,
      entitlement,
      api,
      CareerPremiumPurchaseController(
        service: AppleStorePurchaseService(
          client: store,
          careerPremiumAnnualAppleProductId: _productId,
        ),
        paymentApi: api,
        productController: product,
        entitlementRefresher: entitlement,
        applePaymentEnvironment: 'SANDBOX',
      ),
    );
  }

  void dispose() {
    controller.dispose();
    product.dispose();
    store.events.close();
  }
}

class _Store implements StorePurchaseClient {
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  final started = <String>[];
  int completed = 0;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;
  @override
  Future<bool> buyNonConsumable(String productId) async {
    started.add(productId);
    return true;
  }

  @override
  Future<void> restorePurchases() async {}

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed++;
  }

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
}

class _Api implements PaymentApiClient {
  _Api({this.fails = false});
  final bool fails;
  final calls = <String>[];
  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {
    calls.add(evidence);
    if (fails) throw StateError('failed');
  }

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async {}
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement({required bool eligible})
    : _state = eligible
          ? CareerEligibilityState.eligible
          : CareerEligibilityState.ineligible;
  final CareerEligibilityState _state;
  int refreshes = 0;
  @override
  CareerEligibilityState get eligibilityState => _state;
  @override
  Future<void> refreshEligibility() async {
    refreshes++;
  }
}
