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
    'acknowledges only after backend verification and eligible refresh',
    () async {
      final events = <String>[];
      final harness = await _Harness.create(events: events);

      harness.google.events.add(_purchase());
      await _tick();

      expect(events, ['verify', 'refresh', 'complete']);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      expect(harness.google.completed, 1);
      expect(harness.google.buys, 0);
      harness.dispose();
    },
  );

  test('rejected and ineligible purchases are not acknowledged', () async {
    final rejected = await _Harness.create(verifyFailures: 1);
    rejected.google.events.add(_purchase());
    await _tick();
    expect(rejected.controller.state, CareerPremiumPurchaseState.error);
    expect(rejected.google.completed, 0);
    rejected.dispose();

    final ineligible = await _Harness.create(
      eligibility: CareerEligibilityState.ineligible,
    );
    ineligible.google.events.add(_purchase());
    await _tick();
    expect(ineligible.controller.state, CareerPremiumPurchaseState.error);
    expect(ineligible.google.completed, 0);
    ineligible.dispose();
  });

  test(
    'verification retry reuses the purchase token without repurchasing',
    () async {
      final harness = await _Harness.create(verifyFailures: 1);

      harness.google.events.add(_purchase());
      await _tick();
      expect(harness.controller.state, CareerPremiumPurchaseState.error);
      expect(harness.google.completed, 0);

      await harness.controller.retryVerification();

      expect(harness.api.tokens, [
        'opaque-google-token',
        'opaque-google-token',
      ]);
      expect(harness.google.buys, 0);
      expect(harness.google.completed, 1);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      harness.dispose();
    },
  );

  test(
    'refresh retry does not reverify or repurchase before acknowledgement',
    () async {
      final harness = await _Harness.create(refreshFailures: 1);

      harness.google.events.add(_purchase());
      await _tick();
      expect(
        harness.controller.state,
        CareerPremiumPurchaseState.refreshFailed,
      );
      expect(harness.api.tokens, ['opaque-google-token']);
      expect(harness.google.completed, 0);

      await harness.controller.retryEntitlementRefresh();

      expect(harness.api.tokens, ['opaque-google-token']);
      expect(harness.google.buys, 0);
      expect(harness.google.completed, 1);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      harness.dispose();
    },
  );

  test('pending and canceled events never verify or acknowledge', () async {
    final harness = await _Harness.create();

    harness.google.events.add(_purchase(status: StorePurchaseStatus.pending));
    await _tick();
    expect(harness.controller.state, CareerPremiumPurchaseState.pending);
    harness.google.events.add(_purchase(status: StorePurchaseStatus.canceled));
    await _tick();

    expect(harness.controller.state, CareerPremiumPurchaseState.canceled);
    expect(harness.api.tokens, isEmpty);
    expect(harness.google.completed, 0);
    harness.dispose();
  });

  test(
    'duplicate redelivery verifies once in flight and completes once',
    () async {
      final verifyGate = Completer<void>();
      final harness = await _Harness.create(verifyGate: verifyGate);

      harness.google.events.add(_purchase());
      harness.google.events.add(_purchase());
      await _tick();
      expect(harness.api.tokens, ['opaque-google-token']);

      verifyGate.complete();
      await _tick();
      harness.google.events.add(_purchase());
      await _tick();

      expect(harness.api.tokens, ['opaque-google-token']);
      expect(harness.google.completed, 1);
      expect(harness.google.buys, 0);
      harness.dispose();
    },
  );

  test(
    'redelivery after controller recreation is safe without repurchase',
    () async {
      final harness = await _Harness.create();
      harness.google.events.add(_purchase());
      await _tick();
      harness.controller.dispose();

      final recreated = harness.createController();
      harness.google.events.add(_purchase());
      await _tick();

      expect(harness.api.tokens, ['opaque-google-token']);
      expect(harness.google.completed, 1);
      expect(harness.google.buys, 0);
      recreated.dispose();
      harness.disposeProductAndStores();
    },
  );

  test(
    'auth-unavailable verification failure does not unlock or acknowledge',
    () async {
      final harness = await _Harness.create(verifyFailures: 1);

      harness.google.events.add(_purchase());
      await _tick();

      expect(harness.controller.state, CareerPremiumPurchaseState.error);
      expect(harness.google.completed, 0);
      expect(harness.google.buys, 0);
      harness.dispose();
    },
  );
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _purchase({
  StorePurchaseStatus status = StorePurchaseStatus.purchased,
}) => StorePurchaseUpdate(
  productId: _productId,
  status: status,
  serverVerificationData: 'opaque-google-token',
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
    required this.events,
    required this.googleService,
  });

  final _Store apple;
  final _Store google;
  final CareerPremiumProductController product;
  final _Entitlement entitlement;
  final _Api api;
  final CareerPremiumPurchaseController controller;
  final List<String> events;
  final GooglePlayPurchaseService googleService;

  static Future<_Harness> create({
    CareerEligibilityState eligibility = CareerEligibilityState.eligible,
    int verifyFailures = 0,
    int refreshFailures = 0,
    Completer<void>? verifyGate,
    List<String>? events,
  }) async {
    final eventLog = events ?? <String>[];
    final apple = _Store();
    final google = _Store(products: const [_googleProduct], trace: eventLog);
    final googleService = GooglePlayPurchaseService(
      client: google,
      careerPremiumAnnualGoogleProductId: _productId,
    );
    final product = CareerPremiumProductController(googleService);
    await product.load();
    final entitlement = _Entitlement(
      state: eligibility,
      failures: refreshFailures,
      events: eventLog,
    );
    final api = _Api(
      failures: verifyFailures,
      gate: verifyGate,
      events: eventLog,
    );
    return _Harness._(
      apple: apple,
      google: google,
      product: product,
      entitlement: entitlement,
      api: api,
      controller: _controller(
        apple: apple,
        google: googleService,
        product: product,
        entitlement: entitlement,
        api: api,
      ),
      events: eventLog,
      googleService: googleService,
    );
  }

  CareerPremiumPurchaseController createController() => _controller(
    apple: apple,
    google: googleService,
    product: product,
    entitlement: entitlement,
    api: api,
  );

  void dispose() {
    controller.dispose();
    disposeProductAndStores();
  }

  void disposeProductAndStores() {
    product.dispose();
    apple.dispose();
    google.dispose();
  }
}

CareerPremiumPurchaseController _controller({
  required _Store apple,
  required GooglePlayPurchaseService google,
  required CareerPremiumProductController product,
  required _Entitlement entitlement,
  required _Api api,
}) => CareerPremiumPurchaseController(
  service: AppleStorePurchaseService(
    client: apple,
    careerPremiumAnnualAppleProductId: 'apple.product',
  ),
  googlePurchaseService: google,
  platform: CareerPremiumStorePlatform.googlePlay,
  paymentApi: api,
  productController: product,
  entitlementRefresher: entitlement,
  applePaymentEnvironment: null,
);

const _googleProduct = StoreProductDetails(
  id: _productId,
  title: 'Career Premium',
  description: 'Annual subscription',
  localizedPrice: r'$7.99',
  rawPrice: 7.99,
  currencyCode: 'USD',
);

class _Store implements StorePurchaseClient {
  _Store({this.products = const [], List<String>? trace})
    : trace = trace ?? <String>[];

  final List<StoreProductDetails> products;
  final List<String> trace;
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  int buys = 0;
  int completed = 0;

  @override
  Future<bool> buyNonConsumable(String productId) async {
    buys++;
    return true;
  }

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    trace.add('complete');
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
  _Api({required this.failures, required this.gate, required this.events});

  int failures;
  final Completer<void>? gate;
  final List<String> events;
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
    events.add('verify');
    tokens.add(purchaseToken);
    if (failures > 0) {
      failures--;
      throw StateError('unavailable');
    }
    await gate?.future;
  }
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement({
    required this.state,
    required this.failures,
    required this.events,
  });

  final CareerEligibilityState state;
  int failures;
  final List<String> events;

  @override
  CareerEligibilityState get eligibilityState => state;

  @override
  Future<void> refreshEligibility() async {
    events.add('refresh');
    if (failures > 0) {
      failures--;
      throw StateError('unavailable');
    }
  }
}
