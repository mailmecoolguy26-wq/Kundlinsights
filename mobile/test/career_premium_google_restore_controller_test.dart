import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/career_premium_product_loader.dart';
import 'package:kundlinsights_mobile/features/payments/data/google_play_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'career_premium_annual_google';

void main() {
  test('Android restore verifies owned Career evidence then unlocks', () async {
    final harness = await _Harness.create(restored: [_restored()]);

    await harness.controller.restorePurchases();

    expect(harness.google.restoreCalls, 1);
    expect(harness.apple.restoreCalls, 0);
    expect(harness.google.buys, 0);
    expect(harness.api.tokens, ['opaque-google-token']);
    expect(harness.entitlement.refreshes, 1);
    expect(harness.google.completed, 1);
    expect(harness.controller.restoreState, CareerPremiumRestoreState.success);
    harness.dispose();
  });

  test(
    'restore respects eligible subscription, credit, canceled-valid, and grace',
    () async {
      for (final mode in [
        'SUBSCRIPTION',
        'CREDIT',
        'CANCELED_VALID',
        'GRACE',
      ]) {
        final harness = await _Harness.create(
          restored: [_restored()],
          mode: mode,
        );

        await harness.controller.restorePurchases();

        expect(
          harness.controller.restoreState,
          CareerPremiumRestoreState.success,
        );
        expect(harness.entitlement.mode, mode);
        harness.dispose();
      }
    },
  );

  test('expired NONE and no owned Career subscription stay locked', () async {
    final expired = await _Harness.create(
      restored: [_restored()],
      eligibility: CareerEligibilityState.ineligible,
    );
    await expired.controller.restorePurchases();
    expect(expired.controller.restoreState, CareerPremiumRestoreState.notFound);
    expect(expired.google.completed, 0);
    expired.dispose();

    final empty = await _Harness.create();
    await empty.controller.restorePurchases();
    expect(empty.controller.restoreState, CareerPremiumRestoreState.notFound);
    expect(empty.api.tokens, isEmpty);
    empty.dispose();
  });

  test(
    'unrelated, duplicate, and multiple owned entries are handled safely',
    () async {
      final harness = await _Harness.create(
        restored: [
          _restored(),
          _restored(),
          _restored(token: 'second-token'),
          const StorePurchaseUpdate(
            productId: 'unrelated.product',
            status: StorePurchaseStatus.restored,
            serverVerificationData: 'unrelated-token',
            pendingCompletePurchase: true,
          ),
        ],
      );

      await harness.controller.restorePurchases();

      expect(harness.api.tokens, ['opaque-google-token', 'second-token']);
      expect(harness.google.completed, 2);
      expect(
        harness.controller.restoreState,
        CareerPremiumRestoreState.success,
      );
      harness.dispose();
    },
  );

  test(
    'backend failures and ownership conflicts do not unlock or complete',
    () async {
      final failure = await _Harness.create(
        restored: [_restored()],
        verifyFailures: 1,
      );
      await failure.controller.restorePurchases();
      expect(failure.controller.restoreState, CareerPremiumRestoreState.error);
      expect(failure.google.completed, 0);
      failure.dispose();

      final conflict = await _Harness.create(
        restored: [_restored()],
        verifyFailures: 1,
      );
      await conflict.controller.restorePurchases();
      expect(conflict.controller.restoreState, CareerPremiumRestoreState.error);
      expect(conflict.google.completed, 0);
      conflict.dispose();
    },
  );

  test('restore and purchase remain mutually exclusive', () async {
    final gate = Completer<void>();
    final restoring = await _Harness.create(
      restored: [_restored()],
      restoreGate: gate,
    );
    final restore = restoring.controller.restorePurchases();
    await _tick();
    await restoring.controller.restorePurchases();
    await restoring.controller.startPurchase();
    expect(restoring.google.restoreCalls, 1);
    expect(restoring.google.buys, 0);
    gate.complete();
    await restore;
    restoring.dispose();

    final purchasing = await _Harness.create(
      eligibility: CareerEligibilityState.ineligible,
    );
    await purchasing.controller.startPurchase();
    await purchasing.controller.restorePurchases();
    expect(purchasing.google.buys, 1);
    expect(purchasing.google.restoreCalls, 0);
    purchasing.dispose();
  });
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _restored({String token = 'opaque-google-token'}) =>
    StorePurchaseUpdate(
      productId: _productId,
      status: StorePurchaseStatus.restored,
      serverVerificationData: token,
      pendingCompletePurchase: true,
    );

class _Harness {
  _Harness._({
    required this.apple,
    required this.google,
    required this.product,
    required this.entitlement,
    required this.api,
    required this.controller,
  });

  final _Store apple;
  final _Store google;
  final CareerPremiumProductController product;
  final _Entitlement entitlement;
  final _Api api;
  final CareerPremiumPurchaseController controller;

  static Future<_Harness> create({
    List<StorePurchaseUpdate> restored = const [],
    CareerEligibilityState eligibility = CareerEligibilityState.eligible,
    String mode = 'SUBSCRIPTION',
    int verifyFailures = 0,
    Completer<void>? restoreGate,
  }) async {
    final apple = _Store();
    final google = _Store(
      products: const [_googleProduct],
      restored: restored,
      restoreGate: restoreGate,
    );
    final googleService = GooglePlayPurchaseService(
      client: google,
      careerPremiumAnnualGoogleProductId: _productId,
    );
    final product = CareerPremiumProductController(googleService);
    await product.load();
    final entitlement = _Entitlement(eligibility, mode);
    final api = _Api(verifyFailures);
    final controller = CareerPremiumPurchaseController(
      service: AppleStorePurchaseService(
        client: apple,
        careerPremiumAnnualAppleProductId: 'apple.product',
      ),
      googlePurchaseService: googleService,
      platform: CareerPremiumStorePlatform.googlePlay,
      paymentApi: api,
      productController: product,
      entitlementRefresher: entitlement,
      applePaymentEnvironment: null,
    );
    return _Harness._(
      apple: apple,
      google: google,
      product: product,
      entitlement: entitlement,
      api: api,
      controller: controller,
    );
  }

  void dispose() {
    controller.dispose();
    product.dispose();
    apple.dispose();
    google.dispose();
  }
}

const _googleProduct = StoreProductDetails(
  id: _productId,
  title: 'Career Premium',
  description: 'Annual subscription',
  localizedPrice: r'$7.99',
  rawPrice: 7.99,
  currencyCode: 'USD',
);

class _Store implements StorePurchaseClient {
  _Store({
    this.products = const [],
    this.restored = const [],
    this.restoreGate,
  });

  final List<StoreProductDetails> products;
  final List<StorePurchaseUpdate> restored;
  final Completer<void>? restoreGate;
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  int buys = 0;
  int completed = 0;
  int restoreCalls = 0;

  @override
  Future<bool> buyNonConsumable(String productId) async {
    buys++;
    return true;
  }

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed++;
  }

  void dispose() => events.close();

  @override
  Future<bool> isAvailable() async => true;

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;

  @override
  Future<StoreProductQueryResult> queryProductDetails(
    Set<String> productIds,
  ) async => StoreProductQueryResult(products: products, notFoundIds: const {});

  @override
  Future<void> restorePurchases() async {
    restoreCalls++;
    for (final purchase in restored) {
      events.add(purchase);
    }
    await restoreGate?.future;
  }
}

class _Api implements PaymentApiClient {
  _Api(this.verifyFailures);

  int verifyFailures;
  final tokens = <String>[];

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
  }) async {}

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
  }) async {
    tokens.add(purchaseToken);
    if (verifyFailures > 0) {
      verifyFailures--;
      throw StateError('synthetic ownership conflict');
    }
  }
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement(this._state, this.mode);

  final CareerEligibilityState _state;
  final String mode;
  int refreshes = 0;

  @override
  CareerEligibilityState get eligibilityState => _state;

  @override
  Future<void> refreshEligibility() async {
    refreshes++;
  }
}
