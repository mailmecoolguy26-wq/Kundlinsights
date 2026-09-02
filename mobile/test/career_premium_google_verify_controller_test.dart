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
  test(
    'purchased Google token is forwarded opaquely and unlocks after refresh',
    () async {
      final harness = await _Harness.create(
        eligibility: CareerEligibilityState.eligible,
      );

      harness.google.events.add(_purchase(StorePurchaseStatus.purchased));
      await _tick();

      expect(harness.api.googleCalls, [(_productId, 'opaque-google-token')]);
      expect(harness.api.appleCalls, 0);
      expect(harness.entitlement.refreshes, 1);
      expect(harness.entitlement.mode, 'SUBSCRIPTION');
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      expect(harness.apple.completed, 0);
      harness.dispose();
    },
  );

  test(
    'eligible CREDIT access is accepted after authoritative refresh',
    () async {
      final harness = await _Harness.create(
        eligibility: CareerEligibilityState.eligible,
        mode: 'CREDIT',
      );

      harness.google.events.add(_purchase(StorePurchaseStatus.purchased));
      await _tick();

      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      expect(harness.entitlement.mode, 'CREDIT');
      harness.dispose();
    },
  );

  test(
    'pending, canceled, error, restored, and unrelated events do not verify',
    () async {
      final harness = await _Harness.create();

      harness.google.events.add(_purchase(StorePurchaseStatus.pending));
      await _tick();
      expect(harness.controller.state, CareerPremiumPurchaseState.pending);
      harness.google.events.add(_purchase(StorePurchaseStatus.canceled));
      await _tick();
      expect(harness.controller.state, CareerPremiumPurchaseState.canceled);
      harness.google.events.add(_purchase(StorePurchaseStatus.error));
      await _tick();
      expect(harness.controller.state, CareerPremiumPurchaseState.error);
      harness.google.events.add(_purchase(StorePurchaseStatus.restored));
      harness.google.events.add(
        const StorePurchaseUpdate(
          productId: 'unrelated.product',
          status: StorePurchaseStatus.purchased,
          serverVerificationData: 'other-token',
          pendingCompletePurchase: true,
        ),
      );
      await _tick();

      expect(harness.api.googleCalls, isEmpty);
      expect(harness.entitlement.refreshes, 0);
      expect(harness.apple.completed, 0);
      harness.dispose();
    },
  );

  test('ineligible entitlement after verify does not unlock', () async {
    final harness = await _Harness.create(
      eligibility: CareerEligibilityState.ineligible,
    );

    harness.google.events.add(_purchase(StorePurchaseStatus.purchased));
    await _tick();

    expect(harness.api.googleCalls, [(_productId, 'opaque-google-token')]);
    expect(harness.controller.state, CareerPremiumPurchaseState.error);
    expect(harness.apple.completed, 0);
    harness.dispose();
  });

  test('verify failures including ownership conflict do not unlock', () async {
    final verifyFailure = await _Harness.create(apiFailure: true);
    verifyFailure.google.events.add(_purchase(StorePurchaseStatus.purchased));
    await _tick();
    expect(verifyFailure.controller.state, CareerPremiumPurchaseState.error);
    expect(verifyFailure.apple.completed, 0);
    verifyFailure.dispose();

    final ownershipConflict = await _Harness.create(apiFailure: true);
    ownershipConflict.google.events.add(
      _purchase(StorePurchaseStatus.purchased, token: 'ownership-conflict'),
    );
    await _tick();
    expect(
      ownershipConflict.controller.state,
      CareerPremiumPurchaseState.error,
    );
    expect(ownershipConflict.apple.completed, 0);
    ownershipConflict.dispose();
  });

  test('duplicate purchased events do not verify concurrently', () async {
    final gate = Completer<void>();
    final harness = await _Harness.create(verifyGate: gate);

    harness.google.events.add(_purchase(StorePurchaseStatus.purchased));
    harness.google.events.add(_purchase(StorePurchaseStatus.purchased));
    await _tick();

    expect(harness.api.googleCalls, [(_productId, 'opaque-google-token')]);
    expect(harness.controller.state, CareerPremiumPurchaseState.verifying);
    gate.complete();
    await _tick();
    expect(harness.controller.state, CareerPremiumPurchaseState.success);
    harness.dispose();
  });
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _purchase(
  StorePurchaseStatus status, {
  String token = 'opaque-google-token',
}) => StorePurchaseUpdate(
  productId: _productId,
  status: status,
  serverVerificationData: token,
  pendingCompletePurchase: true,
);

class _Harness {
  _Harness._({
    required this.apple,
    required this.google,
    required this.entitlement,
    required this.api,
    required this.product,
    required this.controller,
  });

  final _Store apple;
  final _Store google;
  final _Entitlement entitlement;
  final _Api api;
  final CareerPremiumProductController product;
  final CareerPremiumPurchaseController controller;

  static Future<_Harness> create({
    CareerEligibilityState eligibility = CareerEligibilityState.eligible,
    String mode = 'SUBSCRIPTION',
    bool apiFailure = false,
    Completer<void>? verifyGate,
  }) async {
    final apple = _Store();
    final google = _Store(products: const [_googleProduct]);
    final googleService = GooglePlayPurchaseService(
      client: google,
      careerPremiumAnnualGoogleProductId: _productId,
    );
    final product = CareerPremiumProductController(googleService);
    await product.load();
    final entitlement = _Entitlement(eligibility, mode);
    final api = _Api(fails: apiFailure, gate: verifyGate);
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
      entitlement: entitlement,
      api: api,
      product: product,
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
  _Store({this.products = const []});

  final List<StoreProductDetails> products;
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  int completed = 0;

  @override
  Future<bool> buyNonConsumable(String productId) async => true;

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
  Future<void> restorePurchases() async {}
}

class _Api implements PaymentApiClient {
  _Api({required this.fails, required this.gate});

  final bool fails;
  final Completer<void>? gate;
  final googleCalls = <(String, String)>[];
  int appleCalls = 0;

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
    appleCalls++;
  }

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
  }) async {
    googleCalls.add((productId, purchaseToken));
    if (fails) throw StateError('synthetic ownership conflict');
    await gate?.future;
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
