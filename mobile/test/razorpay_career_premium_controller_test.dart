import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/razorpay_career_premium_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/payments/data/razorpay_purchase_service.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

class _Api implements PaymentApiClient {
  bool failCreate = false;
  int createCalls = 0;
  bool failVerify = false;
  bool finalized = false;
  String? orderStatus;
  bool failOrderStatus = false;
  int verifies = 0;
  int unresolvedLookups = 0;
  final List<String> statusOrderIds = [];
  bool failUnresolvedLookup = false;
  final Map<String, Map<String, dynamic>?> unresolvedOrders = {};
  @override
  Future<Map<String, dynamic>> createRazorpayOrder({
    required String logicalSku,
    String? birthProfileId,
  }) async {
    createCalls++;
    if (failCreate) throw StateError('cancel');
    return {
      'orderId': 'o',
      'keyId': 'k',
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
    verifies++;
    if (failVerify) throw TimeoutException('x');
  }

  @override
  Future<Map<String, dynamic>> getRazorpayOrderStatus(String orderId) async {
    statusOrderIds.add(orderId);
    if (failOrderStatus) throw StateError('unavailable');
    return {
      'finalized': finalized,
      if (orderStatus != null) 'status': orderStatus,
    };
  }

  @override
  Future<Map<String, dynamic>> getLatestUnresolvedRazorpayOrder({
    required String birthProfileId,
  }) async {
    unresolvedLookups++;
    if (failUnresolvedLookup) throw StateError('unavailable');
    return {'order': unresolvedOrders[birthProfileId]};
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

class _Checkout implements RazorpayCheckout {
  _Checkout(this.result);
  Future<RazorpayPaymentEvidence> result;
  int disposed = 0;
  @override
  Future<RazorpayPaymentEvidence> open({
    required String keyId,
    required String orderId,
    required int amountMinor,
    required String currency,
  }) => result;
  @override
  void dispose() => disposed++;
}

class _Entitlements implements CareerPremiumEntitlementRefresher {
  CareerEligibilityState value = CareerEligibilityState.ineligible;
  int refreshes = 0;
  bool failRefresh = false;
  final Set<int> failOnRefresh = {};
  final List<CareerEligibilityState> statesOnRefresh = [];
  @override
  CareerEligibilityState get eligibilityState => value;
  @override
  Future<void> refreshEligibility() async {
    refreshes++;
    if (failRefresh || failOnRefresh.contains(refreshes)) {
      throw StateError('unavailable');
    }
    if (statesOnRefresh.length >= refreshes) {
      value = statesOnRefresh[refreshes - 1];
    }
  }
}

void main() {
  test(
    'success evidence verifies then requires entitlement for success',
    () async {
      final a = _Api(),
          e = _Entitlements()..value = CareerEligibilityState.eligible;
      final c = RazorpayCareerPremiumController(
        api: a,
        checkout: _Checkout(
          Future.value(
            const RazorpayPaymentEvidence(
              orderId: 'o',
              paymentId: 'p',
              signature: 's',
            ),
          ),
        ),
        entitlements: e,
      );
      await c.start(birthProfileId: 'profile-a');
      expect(c.stateFor('profile-a'), RazorpayCareerPremiumState.success);
      expect(a.verifies, 1);
    },
  );
  test(
    'verify failure with known order stays unknown and cannot retry',
    () async {
      final a = _Api()..failVerify = true;
      final c = RazorpayCareerPremiumController(
        api: a,
        checkout: _Checkout(
          Future.value(
            const RazorpayPaymentEvidence(
              orderId: 'o',
              paymentId: 'p',
              signature: 's',
            ),
          ),
        ),
        entitlements: _Entitlements(),
      );
      await c.start(birthProfileId: 'profile-a');
      expect(
        c.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
      expect(c.canRetryFor('profile-a'), false);
    },
  );
  test('definitive failure resets only from failure', () async {
    final api = _Api()..failCreate = true;
    final c = RazorpayCareerPremiumController(
      api: api,
      checkout: _Checkout(
        Future.value(
          const RazorpayPaymentEvidence(
            orderId: 'o',
            paymentId: 'p',
            signature: 's',
          ),
        ),
      ),
      entitlements: _Entitlements(),
    );
    await c.start(birthProfileId: 'profile-a');
    expect(
      c.stateFor('profile-a'),
      RazorpayCareerPremiumState.definitiveFailure,
    );
    c.returnToPaywall(birthProfileId: 'profile-a');
    expect(c.stateFor('profile-a'), RazorpayCareerPremiumState.idle);
  });

  test(
    'checkout cancellation preserves its known order and blocks retry',
    () async {
      final cancellation = Completer<RazorpayPaymentEvidence>();
      final api = _Api();
      final c = RazorpayCareerPremiumController(
        api: api,
        checkout: _Checkout(cancellation.future),
        entitlements: _Entitlements(),
      );

      final start = c.start(birthProfileId: 'profile-a');
      await Future<void>.delayed(Duration.zero);
      cancellation.completeError(const RazorpayCheckoutCancelled());
      await start;

      expect(
        c.stateFor('profile-a'),
        RazorpayCareerPremiumState.definitiveFailure,
      );
      expect(c.canRetryFor('profile-a'), isFalse);
      c.returnToPaywall(birthProfileId: 'profile-a');
      expect(
        c.stateFor('profile-a'),
        RazorpayCareerPremiumState.definitiveFailure,
      );
      await c.start(birthProfileId: 'profile-a');
      expect(
        c.stateFor('profile-a'),
        RazorpayCareerPremiumState.definitiveFailure,
      );
      expect(api.createCalls, 1);
    },
  );

  test('recovery confirms entitlement before reporting success', () async {
    final entitlements = _Entitlements();
    final api = _Api()..finalized = true;
    final c = RazorpayCareerPremiumController(
      api: api,
      checkout: _Checkout(
        Future.value(
          const RazorpayPaymentEvidence(
            orderId: 'o',
            paymentId: 'p',
            signature: 's',
          ),
        ),
      ),
      entitlements: entitlements,
    );
    await c.start(birthProfileId: 'profile-a');
    expect(
      c.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );

    entitlements.value = CareerEligibilityState.eligible;
    await c.recover(birthProfileId: 'profile-a');

    expect(c.stateFor('profile-a'), RazorpayCareerPremiumState.success);
  });

  test(
    'unresolved recovery remains unknown and cannot reset to retry',
    () async {
      final c = RazorpayCareerPremiumController(
        api: _Api(),
        checkout: _Checkout(
          Future.value(
            const RazorpayPaymentEvidence(
              orderId: 'o',
              paymentId: 'p',
              signature: 's',
            ),
          ),
        ),
        entitlements: _Entitlements(),
      );
      await c.start(birthProfileId: 'profile-a');
      c.returnToPaywall(birthProfileId: 'profile-a');
      await c.recover(birthProfileId: 'profile-a');

      expect(
        c.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
      expect(c.canRetryFor('profile-a'), isFalse);
    },
  );

  test(
    'recover still reconciles when the initial entitlement refresh fails',
    () async {
      final api = _Api()..failVerify = true;
      final entitlements = _Entitlements()..failRefresh = true;
      final controller = _controller(api: api, entitlements: entitlements);
      await controller.start(birthProfileId: 'profile-a');
      api.failVerify = false;

      await controller.recover(birthProfileId: 'profile-a');

      expect(api.statusOrderIds, ['o']);
      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
    },
  );

  test('backend failed order becomes retryable definitive failure', () async {
    final api = _Api()
      ..failVerify = true
      ..orderStatus = 'FAILED';
    final controller = _controller(api: api);
    await controller.start(birthProfileId: 'profile-a');
    api.failVerify = false;

    await controller.recover(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.definitiveFailure,
    );
    expect(controller.canRetryFor('profile-a'), isTrue);
  });

  test('authoritative failure can reset and begin a fresh order', () async {
    final api = _Api()
      ..failVerify = true
      ..orderStatus = 'FAILED';
    final controller = _controller(api: api);
    await controller.start(birthProfileId: 'profile-a');
    api.failVerify = false;
    await controller.recover(birthProfileId: 'profile-a');

    controller.returnToPaywall(birthProfileId: 'profile-a');
    expect(controller.stateFor('profile-a'), RazorpayCareerPremiumState.idle);
    await controller.start(birthProfileId: 'profile-a');
    expect(api.createCalls, 2);
  });

  test(
    'backend failed order adopts another unresolved order for that profile',
    () async {
      final api = _Api()
        ..failVerify = true
        ..orderStatus = 'FAILED'
        ..unresolvedOrders['profile-a'] = const {
          'providerOrderId': 'order-next',
        };
      final controller = _controller(api: api);
      await controller.start(birthProfileId: 'profile-a');
      api.failVerify = false;

      await controller.recover(birthProfileId: 'profile-a');

      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
      expect(controller.canRetryFor('profile-a'), isFalse);

      api.orderStatus = 'CREATED';
      await controller.recover(birthProfileId: 'profile-a');
      expect(api.statusOrderIds, ['o', 'order-next']);
    },
  );

  test('failed-order discovery failure keeps retry blocked', () async {
    final api = _Api()
      ..failVerify = true
      ..orderStatus = 'FAILED'
      ..failUnresolvedLookup = true;
    final controller = _controller(api: api);
    await controller.start(birthProfileId: 'profile-a');
    api.failVerify = false;

    await controller.recover(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
    expect(controller.canRetryFor('profile-a'), isFalse);
  });

  test(
    'created and paid provider orders remain payment-status-unknown',
    () async {
      for (final status in ['CREATED', 'PAID']) {
        final api = _Api()
          ..failVerify = true
          ..orderStatus = status;
        final controller = _controller(api: api);
        await controller.start(birthProfileId: 'profile-a');
        api.failVerify = false;

        await controller.recover(birthProfileId: 'profile-a');

        expect(
          controller.stateFor('profile-a'),
          RazorpayCareerPremiumState.paymentStatusUnknown,
        );
      }
    },
  );

  test(
    'finalized order succeeds only after its entitlement refresh succeeds',
    () async {
      final api = _Api()
        ..failVerify = true
        ..finalized = true;
      final entitlements = _Entitlements()
        ..statesOnRefresh.addAll([
          CareerEligibilityState.ineligible,
          CareerEligibilityState.eligible,
        ]);
      final controller = _controller(api: api, entitlements: entitlements);
      await controller.start(birthProfileId: 'profile-a');
      api.failVerify = false;

      await controller.recover(birthProfileId: 'profile-a');

      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.success,
      );
    },
  );

  test(
    'finalized order stays unknown when the confirmation refresh fails',
    () async {
      final api = _Api()
        ..failVerify = true
        ..finalized = true;
      final entitlements = _Entitlements()..failOnRefresh.add(2);
      final controller = _controller(api: api, entitlements: entitlements);
      await controller.start(birthProfileId: 'profile-a');
      api.failVerify = false;

      await controller.recover(birthProfileId: 'profile-a');

      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
    },
  );

  test('order-status failure remains payment-status-unknown', () async {
    final api = _Api()
      ..failVerify = true
      ..failOrderStatus = true;
    final controller = _controller(api: api);
    await controller.start(birthProfileId: 'profile-a');
    api.failVerify = false;

    await controller.recover(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
  });

  test('recover without a known order is a definitive failure', () async {
    final controller = _controller(api: _Api());

    await controller.recover(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.definitiveFailure,
    );
  });

  test(
    'duplicate start while checkout is active does not verify twice',
    () async {
      final evidence = Completer<RazorpayPaymentEvidence>();
      final api = _Api();
      final c = RazorpayCareerPremiumController(
        api: api,
        checkout: _Checkout(evidence.future),
        entitlements: _Entitlements()..value = CareerEligibilityState.eligible,
      );

      final first = c.start(birthProfileId: 'profile-a');
      await Future<void>.delayed(Duration.zero);
      final second = c.start(birthProfileId: 'profile-a');
      evidence.complete(
        const RazorpayPaymentEvidence(
          orderId: 'o',
          paymentId: 'p',
          signature: 's',
        ),
      );
      await Future.wait([first, second]);

      expect(api.verifies, 1);
    },
  );

  test('controller and checkout dispose once across repeated disposal', () {
    final checkout = _Checkout(
      Future.value(
        const RazorpayPaymentEvidence(
          orderId: 'o',
          paymentId: 'p',
          signature: 's',
        ),
      ),
    );
    final c = RazorpayCareerPremiumController(
      api: _Api(),
      checkout: checkout,
      entitlements: _Entitlements(),
    );

    c.dispose();
    c.dispose();

    expect(checkout.disposed, 1);
  });

  test(
    'hydrate marks an entitled profile successful without order lookup',
    () async {
      final api = _Api();
      final entitlements = _Entitlements()
        ..value = CareerEligibilityState.eligible;
      final controller = _controller(api: api, entitlements: entitlements);

      await controller.hydrate(birthProfileId: 'profile-a');

      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.success,
      );
      expect(api.unresolvedLookups, 0);
      expect(entitlements.refreshes, 1);
    },
  );

  test('hydrate restores only the matching profile unresolved order', () async {
    final api = _Api()
      ..unresolvedOrders['profile-a'] = const {
        'providerOrderId': 'order-a',
        'status': 'CREATED',
      };
    final controller = _controller(api: api);

    await controller.hydrate(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
    expect(controller.stateFor('profile-b'), RazorpayCareerPremiumState.idle);
    await controller.recover(birthProfileId: 'profile-a');
    expect(api.statusOrderIds, ['order-a']);
  });

  test(
    'hydrate leaves a profile idle when no unresolved order exists',
    () async {
      final controller = _controller(api: _Api());

      await controller.hydrate(birthProfileId: 'profile-a');

      expect(controller.stateFor('profile-a'), RazorpayCareerPremiumState.idle);
    },
  );

  test(
    'hydrated unresolved payment blocks another start for that profile',
    () async {
      final api = _Api()
        ..unresolvedOrders['profile-a'] = const {'providerOrderId': 'order-a'};
      final controller = _controller(api: api);

      await controller.hydrate(birthProfileId: 'profile-a');
      await controller.start(birthProfileId: 'profile-a');

      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
      expect(api.verifies, 0);
    },
  );

  test('unresolved lookup failure remains payment-status-unknown', () async {
    final api = _Api()..failUnresolvedLookup = true;
    final controller = _controller(api: api);

    await controller.hydrate(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
    expect(controller.canRetryFor('profile-a'), isFalse);
  });

  test('entitlement refresh failure remains payment-status-unknown', () async {
    final api = _Api();
    final controller = _controller(
      api: api,
      entitlements: _Entitlements()..failRefresh = true,
    );

    await controller.hydrate(birthProfileId: 'profile-a');

    expect(
      controller.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
    expect(api.unresolvedLookups, 0);
  });

  test('empty profile hydration makes no entitlement or API calls', () async {
    final api = _Api();
    final entitlements = _Entitlements();
    final controller = _controller(api: api, entitlements: entitlements);

    await controller.hydrate(birthProfileId: '  ');

    expect(api.unresolvedLookups, 0);
    expect(entitlements.refreshes, 0);
  });

  test(
    'hydrate does not overwrite an in-flight or unresolved local session',
    () async {
      final checkout = Completer<RazorpayPaymentEvidence>();
      final api = _Api()
        ..unresolvedOrders['profile-a'] = const {'providerOrderId': 'other'};
      final controller = RazorpayCareerPremiumController(
        api: api,
        checkout: _Checkout(checkout.future),
        entitlements: _Entitlements(),
      );

      final start = controller.start(birthProfileId: 'profile-a');
      await Future<void>.delayed(Duration.zero);
      await controller.hydrate(birthProfileId: 'profile-a');
      expect(
        controller.stateFor('profile-a'),
        RazorpayCareerPremiumState.checkoutOpen,
      );
      expect(api.unresolvedLookups, 0);

      checkout.completeError(const RazorpayCheckoutCancelled());
      await start;
    },
  );

  test(
    'new controller hydration restores a persisted profile-specific order',
    () async {
      final api = _Api()
        ..unresolvedOrders['profile-a'] = const {'providerOrderId': 'order-a'};
      final recreated = _controller(api: api);

      await recreated.hydrate(birthProfileId: 'profile-a');

      expect(
        recreated.stateFor('profile-a'),
        RazorpayCareerPremiumState.paymentStatusUnknown,
      );
    },
  );
}

RazorpayCareerPremiumController _controller({
  required _Api api,
  _Entitlements? entitlements,
}) => RazorpayCareerPremiumController(
  api: api,
  checkout: _Checkout(
    Future.value(
      const RazorpayPaymentEvidence(
        orderId: 'o',
        paymentId: 'p',
        signature: 's',
      ),
    ),
  ),
  entitlements: entitlements ?? _Entitlements(),
);
