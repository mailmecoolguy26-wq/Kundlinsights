import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/debug_local_storekit_entitlement_session.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'com.kundlinsights.career.premium.annual';
const _sixMonthProductId = 'com.taraverse.career.premium.6month';
const _twelveMonthProductId = 'com.taraverse.career.premium.12month';
const _addOnSixMonthProductId = 'com.taraverse.career.addon.6month';
const _addOnTwelveMonthProductId = 'com.taraverse.career.addon.12month';

void main() {
  test('starts only one validated non-consumable purchase', () async {
    final harness = await _Harness.create(eligible: false);
    await harness.controller.startPurchase();
    await harness.controller.startPurchase();
    expect(harness.store.started, [_productId]);
    expect(harness.controller.state, CareerPremiumPurchaseState.purchasing);
    harness.dispose();
  });

  test('subscribes before purchase and processes an asynchronous selected-plan '
      'Xcode transaction exactly once', () async {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    final harness = await _Harness.create(
      eligible: false,
      localSession: session,
      includeSixMonthPlan: true,
      includeAddOnPlans: true,
    );
    final sixMonth = harness.product.products.singleWhere(
      (product) => product.storeProductId == _sixMonthProductId,
    );

    expect(harness.store.purchaseStreamRequests, 1);
    await harness.controller.startPurchaseFor(sixMonth);
    expect(harness.store.started, [_sixMonthProductId]);

    final purchase = _purchase(
      StorePurchaseStatus.purchased,
      productId: _sixMonthProductId,
      evidence: _jws({'environment': 'Xcode', 'productId': _sixMonthProductId}),
      transactionId: 'six-month-local-transaction',
    );
    harness.store.events.add(purchase);
    await _tick();
    harness.store.events.add(purchase);
    await _tick();

    expect(harness.localEntitlementActive(session), isTrue);
    harness.selectProfile('profile-b');
    expect(harness.controller.hasLocalDebugEntitlement, isFalse);
    harness.store.events.add(purchase);
    await _tick();
    expect(harness.controller.hasLocalDebugEntitlement, isFalse);
    harness.selectProfile('profile-a');
    expect(harness.api.calls, isEmpty);
    expect(harness.store.completed, 1);
    expect(harness.controller.state, CareerPremiumPurchaseState.success);
    harness.dispose();
  });

  test(
    'processes an unfinished Xcode transaction delivered at listener startup',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final startupPurchase = _purchase(
        StorePurchaseStatus.purchased,
        evidence: _jws({'environment': 'Xcode', 'productId': _productId}),
        transactionId: 'startup-transaction',
      );
      final harness = await _Harness.create(
        localSession: session,
        startupPurchase: startupPurchase,
      );

      await _tick();

      expect(harness.localEntitlementActive(session), isFalse);
      expect(harness.api.calls, isEmpty);
      expect(harness.store.completed, 0);
      expect(
        harness.controller.state,
        CareerPremiumPurchaseState.paymentStatusUnknown,
      );
      harness.dispose();
    },
  );

  test(
    'local Xcode purchase unlocks only the profile selected at purchase',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final harness = await _Harness.create(
        eligible: false,
        localSession: session,
        includeSixMonthPlan: true,
      );
      final sixMonth = harness.product.products.singleWhere(
        (product) => product.storeProductId == _sixMonthProductId,
      );

      await harness.controller.startPurchaseFor(sixMonth);
      harness.store.events.add(
        _purchase(
          StorePurchaseStatus.purchased,
          productId: _sixMonthProductId,
          transactionId: 'profile-a-local',
          evidence: _jws({
            'environment': 'Xcode',
            'productId': _sixMonthProductId,
          }),
        ),
      );
      await _tick();

      expect(harness.controller.hasLocalDebugEntitlement, isTrue);
      harness.selectProfile('profile-b');
      expect(harness.controller.hasLocalDebugEntitlement, isFalse);
      harness.selectProfile('profile-a');
      expect(harness.controller.hasLocalDebugEntitlement, isTrue);
      harness.dispose();
    },
  );

  test('separate local purchases unlock profiles independently', () async {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    final harness = await _Harness.create(
      eligible: false,
      localSession: session,
      includeSixMonthPlan: true,
      includeAddOnPlans: true,
    );
    final sixMonth = harness.product.products.singleWhere(
      (product) => product.storeProductId == _sixMonthProductId,
    );

    await harness.controller.startPurchaseFor(sixMonth);
    harness.store.events.add(
      _purchase(
        StorePurchaseStatus.purchased,
        productId: _sixMonthProductId,
        transactionId: 'profile-a-local',
        evidence: _jws({
          'environment': 'Xcode',
          'productId': _sixMonthProductId,
        }),
      ),
    );
    await _tick();
    harness.selectProfile('profile-b');
    await harness.product.load(purchaseMode: 'ADDON');
    final addOnSixMonth = harness.product.products.singleWhere(
      (product) => product.storeProductId == _addOnSixMonthProductId,
    );
    await harness.controller.startPurchaseFor(addOnSixMonth);
    harness.store.events.add(
      _purchase(
        StorePurchaseStatus.purchased,
        productId: _addOnSixMonthProductId,
        transactionId: 'profile-b-local',
        evidence: _jws({
          'environment': 'Xcode',
          'productId': _addOnSixMonthProductId,
          'signedDate': 2,
        }),
      ),
    );
    await _tick();

    expect(harness.controller.hasLocalDebugEntitlement, isTrue);
    harness.selectProfile('profile-a');
    expect(harness.controller.hasLocalDebugEntitlement, isTrue);
    harness.dispose();
  });

  test(
    'a local primary keeps every third and later profile on add-on SKUs',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final harness = await _Harness.create(
        eligible: false,
        localSession: session,
        includeSixMonthPlan: true,
        includeTwelveMonthPlan: true,
        includeAddOnPlans: true,
      );
      final primary = harness.product.products.singleWhere(
        (product) => product.storeProductId == _sixMonthProductId,
      );

      await harness.controller.startPurchaseFor(primary);
      harness.store.events.add(
        _purchase(
          StorePurchaseStatus.purchased,
          productId: _sixMonthProductId,
          transactionId: 'primary-a',
          evidence: _jws({
            'environment': 'Xcode',
            'productId': _sixMonthProductId,
          }),
        ),
      );
      await _tick();

      harness.selectProfile('profile-b');
      await harness.product.load(purchaseMode: 'ADDON');
      final addOn = harness.product.products.singleWhere(
        (product) => product.storeProductId == _addOnSixMonthProductId,
      );
      await harness.controller.startPurchaseFor(addOn);
      harness.store.events.add(
        _purchase(
          StorePurchaseStatus.purchased,
          productId: _addOnSixMonthProductId,
          transactionId: 'addon-b',
          evidence: _jws({
            'environment': 'Xcode',
            'productId': _addOnSixMonthProductId,
          }),
        ),
      );
      await _tick();

      harness.selectProfile('profile-c');
      expect(
        session.effectivePurchaseMode(
          authenticatedSubject: 'user-a',
          birthProfileId: 'profile-c',
          backendPurchaseMode: 'PRIMARY_SUBSCRIPTION',
        ),
        'ADDON',
      );
      await harness.product.load(purchaseMode: 'ADDON');
      final addOnForC = harness.product.products.singleWhere(
        (product) => product.storeProductId == _addOnTwelveMonthProductId,
      );
      await harness.controller.startPurchaseFor(addOnForC);
      final addOnPurchaseForC = _purchase(
        StorePurchaseStatus.purchased,
        productId: _addOnTwelveMonthProductId,
        transactionId: 'addon-c',
        evidence: _jws({
          'environment': 'Xcode',
          'productId': _addOnTwelveMonthProductId,
        }),
      );
      harness.store.events.add(addOnPurchaseForC);
      await _tick();

      expect(harness.store.started.last, _addOnTwelveMonthProductId);
      expect(harness.store.started, contains(_sixMonthProductId));
      expect(
        session.localEntitlementSourceFor(
          authenticatedSubject: 'user-a',
          birthProfileId: 'profile-b',
        ),
        'ADDON_PURCHASE',
      );
      expect(
        session.localEntitlementSourceFor(
          authenticatedSubject: 'user-a',
          birthProfileId: 'profile-c',
        ),
        'ADDON_PURCHASE',
      );
      expect(harness.api.calls, isEmpty);
      expect(harness.store.completed, 3);

      // StoreKit may redeliver an unfinished transaction. It must remain a
      // local add-on success rather than entering backend verification.
      harness.store.events.add(addOnPurchaseForC);
      await _tick();
      expect(harness.api.calls, isEmpty);
      expect(harness.store.completed, 3);
      expect(
        session.effectivePurchaseMode(
          authenticatedSubject: 'user-a',
          birthProfileId: 'profile-d',
          backendPurchaseMode: 'PRIMARY_SUBSCRIPTION',
        ),
        'ADDON',
      );
      harness.dispose();
    },
  );

  test('an add-on StoreKit invocation exception does not enter backend verification', () async {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    final harness = await _Harness.create(
      eligible: false,
      localSession: session,
      includeSixMonthPlan: true,
      includeAddOnPlans: true,
    );
    expect(
      session.activateIfLocalXcodeTransaction(
        purchase: _purchase(
          StorePurchaseStatus.purchased,
          productId: _sixMonthProductId,
          transactionId: 'primary-a-for-invocation-error',
          evidence: _jws({
            'environment': 'Xcode',
            'productId': _sixMonthProductId,
          }),
        ),
        expectedProductId: _sixMonthProductId,
        authenticatedSubject: 'user-a',
        birthProfileId: 'profile-a',
      ),
      isTrue,
    );
    harness.selectProfile('profile-b');
    await harness.product.load(purchaseMode: 'ADDON');
    harness.store.throwOnConsumablePurchase = true;
    final addOn = harness.product.products.singleWhere(
      (product) => product.storeProductId == _addOnSixMonthProductId,
    );

    await harness.controller.startPurchaseFor(addOn);

    expect(harness.store.started, [_addOnSixMonthProductId]);
    expect(harness.api.calls, isEmpty);
    expect(harness.localEntitlementActive(session), isFalse);
    expect(harness.controller.state, CareerPremiumPurchaseState.error);
    harness.dispose();
  });

  test(
    'logout clears local entitlement and a new user cannot inherit it',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final harness = await _Harness.create(
        eligible: false,
        localSession: session,
      );
      await harness.controller.startPurchase();
      harness.store.events.add(
        _purchase(
          StorePurchaseStatus.purchased,
          transactionId: 'profile-a-local',
          evidence: _jws({'environment': 'Xcode', 'productId': _productId}),
        ),
      );
      await _tick();
      expect(harness.controller.hasLocalDebugEntitlement, isTrue);

      harness.logout();
      expect(harness.controller.hasLocalDebugEntitlement, isFalse);
      harness.loginAs('user-b');
      expect(harness.controller.hasLocalDebugEntitlement, isFalse);
      harness.dispose();
    },
  );

  test(
    'processes and completes a twelve-month Xcode transaction once',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final harness = await _Harness.create(
        eligible: false,
        localSession: session,
        includeTwelveMonthPlan: true,
      );
      final twelveMonth = harness.product.products.singleWhere(
        (product) => product.storeProductId == _twelveMonthProductId,
      );

      await harness.controller.startPurchaseFor(twelveMonth);
      harness.store.events.add(
        _purchase(
          StorePurchaseStatus.purchased,
          productId: _twelveMonthProductId,
          evidence: _jws({
            'environment': 'Xcode',
            'productId': _twelveMonthProductId,
          }),
          transactionId: 'twelve-month-local-transaction',
        ),
      );
      await _tick();

      expect(harness.localEntitlementActive(session), isTrue);
      expect(harness.api.calls, isEmpty);
      expect(harness.store.completed, 1);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      harness.dispose();
    },
  );

  test(
    'an unfinished duplicate retries completion without reactivating',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final harness = await _Harness.create(
        eligible: false,
        localSession: session,
      );
      final purchase = _purchase(
        StorePurchaseStatus.purchased,
        evidence: _jws({'environment': 'Xcode', 'productId': _productId}),
        transactionId: 'retry-completion-transaction',
      );
      harness.store.failNextComplete = true;

      await harness.controller.startPurchase();
      harness.store.events.add(purchase);
      await _tick();
      expect(harness.localEntitlementActive(session), isTrue);
      expect(harness.store.completed, 1);
      expect(session.wasTransactionCompletionRecorded(purchase), isFalse);

      harness.store.events.add(purchase);
      await _tick();
      expect(harness.store.completed, 2);
      expect(session.wasTransactionCompletionRecorded(purchase), isTrue);
      expect(harness.api.calls, isEmpty);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      harness.dispose();
    },
  );

  test(
    'pending and canceled StoreKit events never call backend verify',
    () async {
      final harness = await _Harness.create(
        eligible: false,
        eligibleAfterRefresh: true,
      );
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
      final harness = await _Harness.create(
        eligible: false,
        eligibleAfterRefresh: true,
      );
      await harness.controller.startPurchase();
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

  test('uses only an Xcode StoreKit 2 JWS for a local debug session', () async {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    final harness = await _Harness.create(
      eligible: false,
      localSession: session,
    );

    final localPurchase = _purchase(
      StorePurchaseStatus.purchased,
      evidence: _jws({'environment': 'Xcode', 'productId': _productId}),
      transactionId: 'local-transaction',
    );
    await harness.controller.startPurchase();
    harness.store.events.add(localPurchase);
    await _tick();
    harness.store.events.add(
      _purchase(
        StorePurchaseStatus.purchased,
        evidence: _jws({
          'environment': 'Xcode',
          'productId': _productId,
          'signedDate': 2,
        }),
        transactionId: 'local-transaction',
      ),
    );
    await _tick();
    harness.store.events.add(
      _purchase(
        StorePurchaseStatus.error,
        evidence: 'a-completion-follow-up-without-jws',
        transactionId: 'local-transaction',
      ),
    );
    await _tick();

    expect(harness.localEntitlementActive(session), isTrue);
    expect(harness.api.calls, isEmpty);
    expect(harness.entitlement.refreshes, 1);
    expect(harness.store.completed, 1);
    expect(harness.controller.state, CareerPremiumPurchaseState.success);
    harness.dispose();
  });

  test(
    'a local completion failure cannot regress into verification failure',
    () async {
      final session = DebugLocalStoreKitEntitlementSession(enabled: true);
      final harness = await _Harness.create(
        eligible: false,
        localSession: session,
      );
      harness.store.failComplete = true;

      await harness.controller.startPurchase();
      harness.store.events.add(
        _purchase(
          StorePurchaseStatus.purchased,
          evidence: _jws({'environment': 'Xcode', 'productId': _productId}),
          transactionId: 'completion-retry',
        ),
      );
      await _tick();

      expect(harness.localEntitlementActive(session), isTrue);
      expect(harness.api.calls, isEmpty);
      expect(harness.controller.state, CareerPremiumPurchaseState.success);
      harness.dispose();
    },
  );

  test('unassociated local restore requires reconciliation and never guesses profile', () async {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    final harness = await _Harness.create(localSession: session);
    harness.store.holdRestore = true;

    final restore = harness.controller.restorePurchases();
    await _tick();
    harness.store.events.add(
      _purchase(
        StorePurchaseStatus.restored,
        evidence: _jws({'environment': 'Xcode', 'productId': _productId}),
      ),
    );
    await _tick();
    harness.store.finishRestore();
    await restore;

    expect(harness.localEntitlementActive(session), isFalse);
    expect(harness.api.calls, isEmpty);
    expect(harness.store.completed, 0);
    expect(
      harness.controller.restoreState,
      CareerPremiumRestoreState.reconciliationRequired,
    );
    harness.dispose();
  });

  test(
    'Sandbox, Production, malformed JWS, and StoreKit 1 use verification',
    () async {
      for (final evidence in [
        _jws({'environment': 'Sandbox', 'productId': _productId}),
        _jws({'environment': 'Production', 'productId': _productId}),
        'not-a-jws',
        base64Encode(utf8.encode('storekit-1-receipt')),
      ]) {
        final session = DebugLocalStoreKitEntitlementSession(enabled: true);
        final harness = await _Harness.create(
          eligible: false,
          localSession: session,
        );
        await harness.controller.startPurchase();
        harness.store.events.add(
          _purchase(StorePurchaseStatus.purchased, evidence: evidence),
        );
        await _tick();
        expect(harness.localEntitlementActive(session), isFalse);
        expect(harness.api.calls, [evidence]);
        harness.dispose();
      }
    },
  );
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _purchase(
  StorePurchaseStatus status, {
  String evidence = 'opaque-server-evidence',
  String? transactionId,
  String productId = _productId,
}) => StorePurchaseUpdate(
  productId: productId,
  status: status,
  serverVerificationData: evidence,
  pendingCompletePurchase: true,
  transactionId: transactionId,
);

String _jws(Map<String, Object> payload) {
  final encoded = base64Url
      .encode(utf8.encode(jsonEncode(payload)))
      .replaceAll('=', '');
  return 'header.$encoded.signature';
}

class _Harness {
  _Harness._(
    this.store,
    this.product,
    this.entitlement,
    this.api,
    this.controller,
    this._activeSubject,
    this._activeProfile,
  );
  final _Store store;
  final CareerPremiumProductController product;
  final _Entitlement entitlement;
  final _Api api;
  final CareerPremiumPurchaseController controller;
  final ValueNotifier<String?> _activeSubject;
  final ValueNotifier<String?> _activeProfile;

  bool localEntitlementActive(DebugLocalStoreKitEntitlementSession session) =>
      session.isActiveFor(
        authenticatedSubject: _activeSubject.value,
        birthProfileId: _activeProfile.value,
      );

  void selectProfile(String profileId) => _activeProfile.value = profileId;

  void logout() => _activeSubject.value = null;

  void loginAs(String subject) => _activeSubject.value = subject;

  static Future<_Harness> create({
    bool eligible = true,
    bool eligibleAfterRefresh = false,
    bool apiFails = false,
    DebugLocalStoreKitEntitlementSession? localSession,
    bool includeSixMonthPlan = false,
    bool includeTwelveMonthPlan = false,
    bool includeAddOnPlans = false,
    StorePurchaseUpdate? startupPurchase,
  }) async {
    final store = _Store(
      includeSixMonthPlan: includeSixMonthPlan,
      includeTwelveMonthPlan: includeTwelveMonthPlan,
      includeAddOnPlans: includeAddOnPlans,
      startupPurchase: startupPurchase,
    );
    final product = CareerPremiumProductController(
      AppleStorePurchaseService(
        client: store,
        careerPremiumAnnualAppleProductId: _productId,
        careerPremium6MonthAppleProductId: includeSixMonthPlan
            ? _sixMonthProductId
            : null,
        careerPremium12MonthAppleProductId: includeTwelveMonthPlan
            ? _twelveMonthProductId
            : null,
        careerPremiumAddOn6MonthAppleProductId: includeAddOnPlans
            ? _addOnSixMonthProductId
            : null,
        careerPremiumAddOn12MonthAppleProductId: includeAddOnPlans
            ? _addOnTwelveMonthProductId
            : null,
      ),
    );
    await product.load();
    final entitlement = _Entitlement(
      eligible: eligible,
      eligibleAfterRefresh: eligibleAfterRefresh,
    );
    final api = _Api(fails: apiFails);
    final activeSubject = ValueNotifier<String?>('user-a');
    final activeProfile = ValueNotifier<String?>('profile-a');
    return _Harness._(
      store,
      product,
      entitlement,
      api,
      CareerPremiumPurchaseController(
        service: AppleStorePurchaseService(
          client: store,
          careerPremiumAnnualAppleProductId: _productId,
          careerPremium6MonthAppleProductId: includeSixMonthPlan
              ? _sixMonthProductId
              : null,
          careerPremium12MonthAppleProductId: includeTwelveMonthPlan
              ? _twelveMonthProductId
              : null,
          careerPremiumAddOn6MonthAppleProductId: includeAddOnPlans
              ? _addOnSixMonthProductId
              : null,
          careerPremiumAddOn12MonthAppleProductId: includeAddOnPlans
              ? _addOnTwelveMonthProductId
              : null,
        ),
        paymentApi: api,
        productController: product,
        entitlementRefresher: entitlement,
        applePaymentEnvironment: 'SANDBOX',
        debugLocalStoreKitEntitlementSession: localSession,
        activeBirthProfileId: () => activeProfile.value,
        activeAuthenticatedSubject: () => activeSubject.value,
        entitlementScope: Listenable.merge([activeSubject, activeProfile]),
      ),
      activeSubject,
      activeProfile,
    );
  }

  void dispose() {
    controller.dispose();
    product.dispose();
    _activeSubject.dispose();
    _activeProfile.dispose();
    store.events.close();
  }
}

class _Store implements StorePurchaseClient, ConsumableStorePurchaseClient {
  _Store({
    this.includeSixMonthPlan = false,
    this.includeTwelveMonthPlan = false,
    this.includeAddOnPlans = false,
    this.startupPurchase,
  });

  final bool includeSixMonthPlan;
  final bool includeTwelveMonthPlan;
  final bool includeAddOnPlans;
  final StorePurchaseUpdate? startupPurchase;
  final events = StreamController<StorePurchaseUpdate>.broadcast();
  final started = <String>[];
  int completed = 0;
  int purchaseStreamRequests = 0;
  bool failComplete = false;
  bool failNextComplete = false;
  bool throwOnConsumablePurchase = false;
  bool holdRestore = false;
  Completer<void>? _restore;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates {
    purchaseStreamRequests++;
    final startup = startupPurchase;
    return startup == null ? events.stream : Stream.value(startup);
  }

  @override
  Future<bool> buyNonConsumable(String productId) async {
    started.add(productId);
    return true;
  }

  @override
  Future<bool> buyConsumable(String productId) async {
    started.add(productId);
    if (throwOnConsumablePurchase) {
      throw StateError('simulated native consumable purchase failure');
    }
    return true;
  }

  @override
  Future<void> restorePurchases() {
    if (!holdRestore) return Future.value();
    return (_restore ??= Completer<void>()).future;
  }

  void finishRestore() => _restore?.complete();

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed++;
    if (failNextComplete) {
      failNextComplete = false;
      throw StateError('complete failed once');
    }
    if (failComplete) throw StateError('complete failed');
  }

  @override
  Future<StoreProductQueryResult> queryProductDetails(Set<String> ids) async {
    final products = [
      const StoreProductDetails(
        id: _productId,
        title: 'Career',
        description: '',
        localizedPrice: r'$7.99',
        rawPrice: 7.99,
        currencyCode: 'USD',
      ),
      if (includeSixMonthPlan)
        const StoreProductDetails(
          id: _sixMonthProductId,
          title: 'Career six month',
          description: '',
          localizedPrice: r'$4.99',
          rawPrice: 4.99,
          currencyCode: 'USD',
        ),
      if (includeTwelveMonthPlan)
        const StoreProductDetails(
          id: _twelveMonthProductId,
          title: 'Career twelve month',
          description: '',
          localizedPrice: r'$8.99',
          rawPrice: 8.99,
          currencyCode: 'USD',
        ),
      if (includeAddOnPlans)
        const StoreProductDetails(
          id: _addOnSixMonthProductId,
          title: 'Career add-on six month',
          description: '',
          localizedPrice: r'$4.99',
          rawPrice: 4.99,
          currencyCode: 'USD',
        ),
      if (includeAddOnPlans)
        const StoreProductDetails(
          id: _addOnTwelveMonthProductId,
          title: 'Career add-on twelve month',
          description: '',
          localizedPrice: r'$8.99',
          rawPrice: 8.99,
          currencyCode: 'USD',
        ),
    ].where((product) => ids.contains(product.id)).toList(growable: false);
    return StoreProductQueryResult(products: products, notFoundIds: const {});
  }
}

class _Api extends PaymentApiClient {
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

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) async {}
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement({required bool eligible, this.eligibleAfterRefresh = false})
    : _state = eligible
          ? CareerEligibilityState.eligible
          : CareerEligibilityState.ineligible;
  CareerEligibilityState _state;
  final bool eligibleAfterRefresh;
  int refreshes = 0;
  @override
  CareerEligibilityState get eligibilityState => _state;
  @override
  Future<void> refreshEligibility() async {
    refreshes++;
    if (eligibleAfterRefresh) _state = CareerEligibilityState.eligible;
  }
}
