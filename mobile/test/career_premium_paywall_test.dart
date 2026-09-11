import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/payments/data/razorpay_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/razorpay_career_premium_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';
import 'package:kundlinsights_mobile/features/payments/presentation/career_premium_paywall.dart';

const _productId = 'com.kundlinsights.career.premium.annual';

void main() {
  testWidgets('shows StoreKit price and invokes only the subscribe callback', (
    tester,
  ) async {
    final controller = _controller(localizedPrice: r'$7.99');
    await controller.load();
    var subscribeCount = 0;

    await tester.pumpWidget(
      _app(
        CareerPremiumPaywall(
          productController: controller,
          hasAccess: false,
          entitlementMode: 'NONE',
          onSubscribePressed: () => subscribeCount++,
          onContinuePressed: () {},
        ),
      ),
    );

    expect(find.text('Annual subscription — \$7.99 / year'), findsOneWidget);
    expect(find.textContaining('₹499'), findsNothing);
    await tester.tap(find.text('Unlock Career Premium — \$7.99/year'));
    expect(subscribeCount, 1);
    controller.dispose();
  });

  testWidgets(
    'keeps subscription, credit, and canceled-valid access unlocked',
    (tester) async {
      final controller = _controller();
      var continueCount = 0;

      for (final mode in const ['SUBSCRIPTION', 'CREDIT', 'CANCELED_VALID']) {
        await tester.pumpWidget(
          _app(
            CareerPremiumPaywall(
              productController: controller,
              hasAccess: true,
              entitlementMode: mode,
              onSubscribePressed: () {},
              onContinuePressed: () => continueCount++,
            ),
          ),
        );

        expect(find.text('Career Premium Active'), findsOneWidget);
        expect(find.textContaining('Unlock Career Premium'), findsNothing);
        await tester.tap(find.text('View Career Reading'));
        expect(continueCount, greaterThan(0));
      }
      controller.dispose();
    },
  );

  testWidgets('shows a paywall for NONE and expired entitlement outcomes', (
    tester,
  ) async {
    final controller = _controller(localizedPrice: '€6.99');
    await controller.load();

    for (final mode in const ['NONE', 'EXPIRED']) {
      await tester.pumpWidget(
        _app(
          CareerPremiumPaywall(
            productController: controller,
            hasAccess: false,
            entitlementMode: mode,
            onSubscribePressed: () {},
            onContinuePressed: () {},
          ),
        ),
      );

      expect(find.text('Career Premium'), findsOneWidget);
      expect(find.text('Unlock Career Premium — €6.99/year'), findsOneWidget);
    }
    controller.dispose();
  });

  testWidgets(
    'renders loading, unavailable, error, and missing config safely',
    (tester) async {
      final waitingClient = _StoreClient(waitForQuery: true);
      final loading = _controller(client: waitingClient);
      unawaited(loading.load());
      await tester.pumpWidget(_app(_lockedPaywall(loading)));
      await tester.pump();
      expect(find.byType(LinearProgressIndicator), findsOneWidget);
      waitingClient.query.complete(
        const StoreProductQueryResult(products: [], notFoundIds: {_productId}),
      );
      await tester.pumpAndSettle();

      final unavailable = _controller(client: _StoreClient(available: false));
      await unavailable.load();
      await tester.pumpWidget(_app(_lockedPaywall(unavailable)));
      expect(
        find.text('Purchases are temporarily unavailable.'),
        findsOneWidget,
      );

      final error = _controller(client: _StoreClient(throwOnQuery: true));
      await error.load();
      await tester.pumpWidget(_app(_lockedPaywall(error)));
      expect(
        find.text('Unable to load subscription details. Please try again.'),
        findsOneWidget,
      );

      final missingConfiguration = CareerPremiumProductController(
        AppleStorePurchaseService(
          client: _StoreClient(),
          careerPremiumAnnualAppleProductId: null,
        ),
      );
      await missingConfiguration.load();
      await tester.pumpWidget(_app(_lockedPaywall(missingConfiguration)));
      expect(
        find.text('Purchases are temporarily unavailable.'),
        findsOneWidget,
      );

      loading.dispose();
      unavailable.dispose();
      error.dispose();
      missingConfiguration.dispose();
    },
  );

  testWidgets('shows and invokes Restore Purchases without subscribing', (
    tester,
  ) async {
    final h = await _PaywallHarness.create();
    var subscribe = 0;
    await tester.pumpWidget(_app(_paywall(h, () => subscribe++)));
    await tester.tap(find.text('Restore Purchases'));
    await tester.pump();
    expect(h.store.restoreCalls, 1);
    expect(subscribe, 0);
    h.store.restore.complete();
    await tester.pump(const Duration(milliseconds: 1));
    h.dispose();
  });

  testWidgets('renders restore progress and disables competing actions', (
    tester,
  ) async {
    final h = await _PaywallHarness.create();
    var subscribe = 0;
    final restore = h.purchase.restorePurchases();
    await tester.pumpWidget(_app(_paywall(h, () => subscribe++)));
    await tester.pump();
    expect(find.text('Checking your App Store purchases…'), findsOneWidget);
    expect(find.text('Unlock Career Premium — \$7.99/year'), findsNothing);
    expect(
      tester
          .widget<TextButton>(
            find.ancestor(
              of: find.text('Restore Purchases'),
              matching: find.byType(TextButton),
            ),
          )
          .onPressed,
      isNull,
    );
    expect(subscribe, 0);
    h.store.restore.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    await restore;
    h.dispose();
  });

  testWidgets('renders restore verification with both actions disabled', (
    tester,
  ) async {
    final h = await _PaywallHarness.create(restorePending: true);
    final restore = h.purchase.restorePurchases();
    await tester.pumpWidget(_app(_paywall(h, () {})));
    h.store.events.add(_restored('evidence'));
    await tester.pump();
    await tester.pump();
    h.store.restore.complete();
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.text('Restoring Career Premium…'), findsOneWidget);
    expect(find.textContaining('Unlock Career Premium'), findsNothing);
    expect(
      tester
          .widget<TextButton>(
            find.ancestor(
              of: find.text('Restore Purchases'),
              matching: find.byType(TextButton),
            ),
          )
          .onPressed,
      isNull,
    );
    h.api.restore.complete();
    await tester.pump(const Duration(milliseconds: 1));
    await restore;
    h.dispose();
  });

  testWidgets('renders unlocked post-restore subscription entitlement', (
    tester,
  ) async {
    final controller = _controller();
    await tester.pumpWidget(
      _app(
        CareerPremiumPaywall(
          productController: controller,
          hasAccess: true,
          entitlementMode: 'SUBSCRIPTION',
          onSubscribePressed: () {},
          onContinuePressed: () {},
        ),
      ),
    );
    expect(find.text('Career Premium Active'), findsOneWidget);
    expect(find.text('View Career Reading'), findsOneWidget);
    expect(find.textContaining('Unlock Career Premium'), findsNothing);
    controller.dispose();
  });

  testWidgets('renders restore not-found while remaining locked', (
    tester,
  ) async {
    final h = await _PaywallHarness.create();
    final restore = h.purchase.restorePurchases();
    await tester.pumpWidget(_app(_paywall(h, () {})));
    h.store.restore.complete();
    await tester.pump(const Duration(milliseconds: 1));
    await restore;
    await tester.pump();
    expect(
      find.text('No previous Career Premium purchase was found.'),
      findsOneWidget,
    );
    expect(find.text('Career Premium'), findsOneWidget);
    h.dispose();
  });

  testWidgets('renders safe restore error without raw failure text', (
    tester,
  ) async {
    final h = await _PaywallHarness.create(restoreFails: true);
    final restore = h.purchase.restorePurchases();
    await tester.pumpWidget(_app(_paywall(h, () {})));
    h.store.events.add(_restored('evidence'));
    await tester.pump();
    await tester.pump();
    h.store.restore.complete();
    await tester.pump(const Duration(milliseconds: 1));
    await restore;
    await tester.pump();
    expect(
      find.text('Unable to restore purchases. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('synthetic restore failure'), findsNothing);
    h.dispose();
  });

  testWidgets(
    'Razorpay idle renders its locked pricing rather than store price',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final product = _controller();
      final razorpay = _razorpayController();
      await tester.pumpWidget(
        _app(
          CareerPremiumPaywall(
            productController: product,
            razorpayController: razorpay,
            hasAccess: false,
            entitlementMode: 'NONE',
            onSubscribePressed: () {},
            onContinuePressed: () {},
          ),
        ),
      );

      expect(find.textContaining('₹499 / year'), findsOneWidget);
      expect(find.textContaining('+ GST @ 18%'), findsOneWidget);
      expect(find.textContaining('Total payable: ₹588.82'), findsOneWidget);
      expect(find.text('UNLOCK CAREER PREMIUM — ₹588.82 →'), findsOneWidget);
      expect(find.textContaining(r'$7.99'), findsNothing);
      expect(find.text('Restore Purchases'), findsNothing);
      expect(find.textContaining('Apple ID'), findsNothing);
      expect(find.textContaining('renews automatically'), findsNothing);
      razorpay.dispose();
      product.dispose();
    },
  );

  testWidgets('Razorpay unknown state has recovery but no retry action', (
    tester,
  ) async {
    final product = _controller();
    final razorpay = _razorpayController(verifyFails: true);
    await razorpay.start(birthProfileId: 'profile-a');
    await tester.pumpWidget(
      _app(
        CareerPremiumPaywall(
          productController: product,
          razorpayController: razorpay,
          razorpayState: RazorpayCareerPremiumState.paymentStatusUnknown,
          hasAccess: false,
          entitlementMode: 'NONE',
          onSubscribePressed: () {},
          onContinuePressed: () {},
        ),
      ),
    );

    expect(find.text('CHECK PAYMENT STATUS'), findsOneWidget);
    expect(find.text('Try Again'), findsNothing);
    expect(find.text('Unlock Career Premium — ₹588.82'), findsNothing);
    razorpay.dispose();
    product.dispose();
  });

  testWidgets('Razorpay retry-safe failure shows only Try Again', (
    tester,
  ) async {
    final product = _controller();
    final api = _RazorpayApi(false)..failCreate = true;
    final razorpay = RazorpayCareerPremiumController(
      api: api,
      checkout: _RazorpayCheckout(),
      entitlements: _RazorpayEntitlements(),
    );
    await razorpay.start(birthProfileId: 'profile-a');
    var starts = 0;

    await tester.pumpWidget(
      _app(
        CareerPremiumPaywall(
          productController: product,
          razorpayController: razorpay,
          razorpayProfileId: 'profile-a',
          razorpayState: RazorpayCareerPremiumState.definitiveFailure,
          hasAccess: false,
          entitlementMode: 'NONE',
          onSubscribePressed: () {},
          onContinuePressed: () {},
          onRazorpayStart: () => starts++,
        ),
      ),
    );

    expect(find.text('TRY AGAIN'), findsOneWidget);
    expect(find.text('CHECK PAYMENT STATUS'), findsNothing);
    await tester.tap(find.text('TRY AGAIN'));
    expect(starts, 1);
    expect(api.statusCalls, 0);
    razorpay.dispose();
    product.dispose();
  });

  testWidgets('known-order Razorpay failure only offers safe status recovery', (
    tester,
  ) async {
    final product = _controller();
    final api = _RazorpayApi(false);
    final entitlements = _RazorpayEntitlements();
    final razorpay = RazorpayCareerPremiumController(
      api: api,
      checkout: _RazorpayCheckout(cancelled: true),
      entitlements: entitlements,
    );
    await razorpay.start(birthProfileId: 'profile-a');
    expect(razorpay.canRetryFor('profile-a'), isFalse);

    await tester.pumpWidget(
      _app(
        CareerPremiumPaywall(
          productController: product,
          razorpayController: razorpay,
          razorpayProfileId: 'profile-a',
          razorpayState: RazorpayCareerPremiumState.definitiveFailure,
          hasAccess: false,
          entitlementMode: 'NONE',
          onSubscribePressed: () {},
          onContinuePressed: () {},
          onRazorpayRecover: () =>
              unawaited(razorpay.recover(birthProfileId: 'profile-a')),
        ),
      ),
    );

    expect(find.text('TRY AGAIN'), findsNothing);
    expect(find.text('CHECK PAYMENT STATUS'), findsOneWidget);
    expect(find.text('Choose Another Payment Method'), findsNothing);
    await tester.tap(find.text('CHECK PAYMENT STATUS'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    expect(api.statusCalls, 1);
    expect(api.createCalls, 1);
    expect(
      razorpay.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
    razorpay.dispose();
    product.dispose();
  });

  testWidgets('known-order recovery shows success without another order', (
    tester,
  ) async {
    final product = _controller();
    final api = _RazorpayApi(false);
    final entitlements = _RazorpayEntitlements();
    final razorpay = RazorpayCareerPremiumController(
      api: api,
      checkout: _RazorpayCheckout(cancelled: true),
      entitlements: entitlements,
    );
    await razorpay.start(birthProfileId: 'profile-a');
    entitlements.value = CareerEligibilityState.eligible;
    await razorpay.recover(birthProfileId: 'profile-a');

    await tester.pumpWidget(
      _app(
        CareerPremiumPaywall(
          productController: product,
          razorpayController: razorpay,
          razorpayProfileId: 'profile-a',
          dedicatedRazorpaySurface: true,
          hasAccess: false,
          entitlementMode: 'NONE',
          onSubscribePressed: () {},
          onContinuePressed: () {},
        ),
      ),
    );

    expect(find.text('Career Premium is now unlocked'), findsOneWidget);
    expect(find.text('View My Career Forecast'), findsOneWidget);
    expect(api.createCalls, 1);
    razorpay.dispose();
    product.dispose();
  });
}

Widget _app(Widget child) => MaterialApp(home: Scaffold(body: child));

CareerPremiumPaywall _lockedPaywall(
  CareerPremiumProductController controller,
) => CareerPremiumPaywall(
  productController: controller,
  hasAccess: false,
  entitlementMode: 'NONE',
  onSubscribePressed: () {},
  onContinuePressed: () {},
);

CareerPremiumProductController _controller({
  String localizedPrice = r'$7.99',
  _StoreClient? client,
}) => CareerPremiumProductController(
  AppleStorePurchaseService(
    client: client ?? _StoreClient(localizedPrice: localizedPrice),
    careerPremiumAnnualAppleProductId: _productId,
  ),
);

class _StoreClient implements StorePurchaseClient {
  _StoreClient({
    this.available = true,
    this.localizedPrice = r'$7.99',
    this.throwOnQuery = false,
    this.waitForQuery = false,
  });

  final bool available;
  final String localizedPrice;
  final bool throwOnQuery;
  final bool waitForQuery;
  final query = Completer<StoreProductQueryResult>();

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => const Stream.empty();

  @override
  Future<bool> buyNonConsumable(String productId) async => false;

  @override
  Future<void> restorePurchases() async {}

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {}

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<StoreProductQueryResult> queryProductDetails(Set<String> productIds) {
    if (throwOnQuery) throw StateError('store query failed');
    if (waitForQuery) return query.future;
    return Future.value(
      StoreProductQueryResult(
        products: [
          StoreProductDetails(
            id: _productId,
            title: 'Career Premium',
            description: 'Annual access',
            localizedPrice: localizedPrice,
            rawPrice: 7.99,
            currencyCode: 'USD',
          ),
        ],
        notFoundIds: const {},
      ),
    );
  }
}

CareerPremiumPaywall _paywall(_PaywallHarness h, VoidCallback subscribe) =>
    CareerPremiumPaywall(
      productController: h.product,
      purchaseController: h.purchase,
      hasAccess: false,
      entitlementMode: 'NONE',
      onSubscribePressed: subscribe,
      onContinuePressed: () {},
    );

StorePurchaseUpdate _restored(String evidence) => StorePurchaseUpdate(
  productId: _productId,
  status: StorePurchaseStatus.restored,
  serverVerificationData: evidence,
  pendingCompletePurchase: false,
);

class _PaywallHarness {
  _PaywallHarness._(this.store, this.product, this.purchase, this.api);
  final _PaywallStore store;
  final CareerPremiumProductController product;
  final CareerPremiumPurchaseController purchase;
  final _PaywallApi api;
  static Future<_PaywallHarness> create({
    bool restoreFails = false,
    bool restorePending = false,
  }) async {
    final store = _PaywallStore();
    final service = AppleStorePurchaseService(
      client: store,
      careerPremiumAnnualAppleProductId: _productId,
    );
    final product = CareerPremiumProductController(service);
    await product.load();
    final api = _PaywallApi(fails: restoreFails, pending: restorePending);
    return _PaywallHarness._(
      store,
      product,
      CareerPremiumPurchaseController(
        service: service,
        paymentApi: api,
        productController: product,
        entitlementRefresher: _PaywallEntitlement(),
        applePaymentEnvironment: 'SANDBOX',
      ),
      api,
    );
  }

  void dispose() {
    purchase.dispose();
    product.dispose();
    store.events.close();
  }
}

class _PaywallStore extends _StoreClient {
  final events = StreamController<StorePurchaseUpdate>.broadcast(sync: true);
  final restore = Completer<void>();
  int restoreCalls = 0;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;
  @override
  Future<void> restorePurchases() {
    restoreCalls++;
    return restore.future;
  }
}

RazorpayCareerPremiumController _razorpayController({
  bool verifyFails = false,
}) => RazorpayCareerPremiumController(
  api: _RazorpayApi(verifyFails),
  checkout: _RazorpayCheckout(),
  entitlements: _RazorpayEntitlements(),
);

class _RazorpayApi extends PaymentApiClient {
  _RazorpayApi(this.verifyFails);

  final bool verifyFails;
  bool failCreate = false;
  int createCalls = 0;
  int statusCalls = 0;

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

  @override
  Future<Map<String, dynamic>> createRazorpayOrder({
    required String logicalSku,
    String? birthProfileId,
  }) async {
    createCalls++;
    if (failCreate) throw StateError('synthetic order failure');
    return const {
      'orderId': 'order_1',
      'keyId': 'rzp_test_public',
      'amountMinor': 58882,
      'currency': 'INR',
    };
  }

  @override
  Future<void> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    if (verifyFails) throw StateError('synthetic verification failure');
  }

  @override
  Future<Map<String, dynamic>> getRazorpayOrderStatus(String orderId) async {
    statusCalls++;
    return const {'status': 'CREATED', 'finalized': false};
  }
}

class _RazorpayCheckout implements RazorpayCheckout {
  _RazorpayCheckout({this.cancelled = false});
  final bool cancelled;
  @override
  Future<RazorpayPaymentEvidence> open({
    required String keyId,
    required String orderId,
    required int amountMinor,
    required String currency,
  }) async {
    if (cancelled) throw const RazorpayCheckoutCancelled();
    return const RazorpayPaymentEvidence(
      orderId: 'order_1',
      paymentId: 'payment_1',
      signature: 'signature_1',
    );
  }

  @override
  void dispose() {}
}

class _RazorpayEntitlements implements CareerPremiumEntitlementRefresher {
  CareerEligibilityState value = CareerEligibilityState.ineligible;
  @override
  CareerEligibilityState get eligibilityState => value;

  @override
  Future<void> refreshEligibility() async {}
}

class _PaywallApi implements PaymentApiClient {
  _PaywallApi({required this.fails, required this.pending});
  final bool fails, pending;
  final restore = Completer<void>();
  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {
    return;
  }

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async {
    if (fails) throw StateError('synthetic restore failure');
    if (pending) await restore.future;
  }

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) async {}

  @override
  Future<Map<String, dynamic>> createRazorpayOrder({
    required String logicalSku,
    String? birthProfileId,
  }) async => const {};

  @override
  Future<void> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {}

  @override
  Future<Map<String, dynamic>> getRazorpayOrderStatus(String orderId) async =>
      const {};

  @override
  Future<Map<String, dynamic>> getLatestUnresolvedRazorpayOrder({
    required String birthProfileId,
  }) async => const {'order': null};
}

class _PaywallEntitlement implements CareerPremiumEntitlementRefresher {
  @override
  CareerEligibilityState get eligibilityState =>
      CareerEligibilityState.ineligible;
  @override
  Future<void> refreshEligibility() async {}
}
