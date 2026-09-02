import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'com.kundlinsights.career.premium.annual';

void main() {
  test(
    'redelivered purchase after controller recreation verifies without buying',
    () async {
      final h = await _Harness.create();
      final first = await h.createController();
      h.store.events.add(_purchase(StorePurchaseStatus.pending, 'redelivery'));
      await _tick();
      expect(first.state, CareerPremiumPurchaseState.pending);
      first.dispose();

      final recreated = await h.createController();
      expect(h.store.activeListeners, 1);
      h.store.events.add(
        _purchase(StorePurchaseStatus.purchased, 'redelivery'),
      );
      await _tick();

      expect(h.api.verifyCalls, ['redelivery']);
      expect(h.store.buyCalls, 0);
      expect(h.store.completed, 1);
      expect(recreated.state, CareerPremiumPurchaseState.success);
      recreated.dispose();
      h.dispose();
    },
  );

  test(
    'pending purchase remains locked until a purchased event arrives',
    () async {
      final h = await _Harness.create();
      final controller = await h.createController();
      h.store.events.add(_purchase(StorePurchaseStatus.pending, 'pending'));
      await _tick();
      expect(controller.state, CareerPremiumPurchaseState.pending);
      expect(h.api.verifyCalls, isEmpty);
      expect(h.store.completed, 0);

      h.store.events.add(_purchase(StorePurchaseStatus.purchased, 'pending'));
      await _tick();
      expect(controller.state, CareerPremiumPurchaseState.success);
      expect(h.store.completed, 1);
      controller.dispose();
      h.dispose();
    },
  );

  test(
    'verification retry reuses evidence and never starts a new purchase',
    () async {
      final h = await _Harness.create(verifyFailures: 1);
      final controller = await h.createController();
      h.store.events.add(_purchase(StorePurchaseStatus.purchased, 'retry'));
      await _tick();
      expect(controller.state, CareerPremiumPurchaseState.error);
      expect(controller.canRetryVerification, isTrue);
      expect(h.store.completed, 0);

      await controller.retryVerification();
      expect(h.api.verifyCalls, ['retry', 'retry']);
      expect(h.store.buyCalls, 0);
      expect(h.store.completed, 1);
      expect(controller.state, CareerPremiumPurchaseState.success);
      controller.dispose();
      h.dispose();
    },
  );

  test(
    'entitlement refresh retry does not resend evidence or repurchase',
    () async {
      final h = await _Harness.create(refreshFailures: 1);
      final controller = await h.createController();
      h.store.events.add(_purchase(StorePurchaseStatus.purchased, 'refresh'));
      await _tick();
      expect(controller.state, CareerPremiumPurchaseState.refreshFailed);
      expect(h.api.verifyCalls, ['refresh']);
      expect(h.store.completed, 0);

      await controller.retryEntitlementRefresh();
      expect(h.api.verifyCalls, ['refresh']);
      expect(h.store.buyCalls, 0);
      expect(h.store.completed, 1);
      expect(controller.state, CareerPremiumPurchaseState.success);
      controller.dispose();
      h.dispose();
    },
  );

  test(
    'duplicate stream delivery is not processed or completed twice',
    () async {
      final h = await _Harness.create(verifyPending: true);
      final controller = await h.createController();
      h.store.events.add(_purchase(StorePurchaseStatus.purchased, 'duplicate'));
      h.store.events.add(_purchase(StorePurchaseStatus.purchased, 'duplicate'));
      await _tick();
      expect(h.api.verifyCalls, ['duplicate']);
      h.api.finishVerify();
      await _tick();
      h.store.events.add(_purchase(StorePurchaseStatus.purchased, 'duplicate'));
      await _tick();
      expect(h.api.verifyCalls, ['duplicate']);
      expect(h.store.completed, 1);
      controller.dispose();
      h.dispose();
    },
  );

  test(
    'auth-unavailable redelivery remains uncompleted and recoverable',
    () async {
      final h = await _Harness.create(verifyFailures: 1);
      final controller = await h.createController();
      h.store.events.add(
        _purchase(StorePurchaseStatus.purchased, 'auth-later'),
      );
      await _tick();
      expect(controller.state, CareerPremiumPurchaseState.error);
      expect(h.store.completed, 0);
      expect(controller.canRetryVerification, isTrue);

      await controller.retryVerification();
      expect(controller.state, CareerPremiumPurchaseState.success);
      expect(h.store.completed, 1);
      controller.dispose();
      h.dispose();
    },
  );

  test(
    'restored redelivery outside restore reconciles through verify safely',
    () async {
      final h = await _Harness.create();
      final controller = await h.createController();
      h.store.events.add(_purchase(StorePurchaseStatus.restored, 'restored'));
      await _tick();
      expect(h.api.verifyCalls, ['restored']);
      expect(h.api.restoreCalls, isEmpty);
      expect(controller.state, CareerPremiumPurchaseState.success);
      expect(h.store.completed, 1);
      controller.dispose();
      h.dispose();
    },
  );
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _purchase(StorePurchaseStatus status, String evidence) =>
    StorePurchaseUpdate(
      productId: _productId,
      status: status,
      serverVerificationData: evidence,
      pendingCompletePurchase: true,
    );

class _Harness {
  _Harness._(this.store, this.service, this.api, this.entitlement);

  final _Store store;
  final AppleStorePurchaseService service;
  final _Api api;
  final _Entitlement entitlement;
  final products = <CareerPremiumProductController>[];

  static Future<_Harness> create({
    int verifyFailures = 0,
    int refreshFailures = 0,
    bool verifyPending = false,
  }) async {
    final store = _Store();
    return _Harness._(
      store,
      AppleStorePurchaseService(
        client: store,
        careerPremiumAnnualAppleProductId: _productId,
      ),
      _Api(failures: verifyFailures, pending: verifyPending),
      _Entitlement(failures: refreshFailures),
    );
  }

  Future<CareerPremiumPurchaseController> createController() async {
    final product = CareerPremiumProductController(service);
    products.add(product);
    await product.load();
    return CareerPremiumPurchaseController(
      service: service,
      paymentApi: api,
      productController: product,
      entitlementRefresher: entitlement,
      applePaymentEnvironment: 'SANDBOX',
    );
  }

  void dispose() {
    for (final product in products) {
      product.dispose();
    }
    store.events.close();
  }
}

class _Store implements StorePurchaseClient {
  _Store() {
    events = StreamController<StorePurchaseUpdate>.broadcast(
      sync: true,
      onListen: () => activeListeners++,
      onCancel: () => activeListeners--,
    );
  }

  late final StreamController<StorePurchaseUpdate> events;
  int activeListeners = 0;
  int buyCalls = 0;
  int completed = 0;

  @override
  Future<bool> isAvailable() async => true;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;
  @override
  Future<bool> buyNonConsumable(String productId) async {
    buyCalls++;
    return true;
  }

  @override
  Future<void> restorePurchases() async {}
  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed++;
  }

  @override
  Future<StoreProductQueryResult> queryProductDetails(
    Set<String> productIds,
  ) async => const StoreProductQueryResult(
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
  _Api({required this.failures, required this.pending});
  int failures;
  final bool pending;
  final verifyCalls = <String>[];
  final restoreCalls = <List<String>>[];
  final _verify = Completer<void>();

  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {
    verifyCalls.add(evidence);
    if (failures > 0) {
      failures--;
      throw StateError('unavailable');
    }
    if (pending) await _verify.future;
  }

  void finishVerify() => _verify.complete();

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async => restoreCalls.add(signedTransactions);

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
  }) async {}
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement({required this.failures});
  int failures;

  @override
  CareerEligibilityState get eligibilityState => failures > 0
      ? CareerEligibilityState.error
      : CareerEligibilityState.eligible;

  @override
  Future<void> refreshEligibility() async {
    if (failures > 0) {
      failures--;
      throw StateError('refresh unavailable');
    }
  }
}
