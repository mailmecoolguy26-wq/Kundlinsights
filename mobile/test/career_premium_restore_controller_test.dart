import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';

const _productId = 'com.kundlinsights.career.premium.annual';

void main() {
  test('restore start, duplicate tap, and purchase mutual exclusion', () async {
    final h = await _Harness.create();
    final restore = h.controller.restorePurchases();
    await _tick();
    expect(h.store.restoreCalls, 1);
    expect(h.store.buyCalls, 0);
    await h.controller.restorePurchases();
    await h.controller.startPurchase();
    expect(h.store.restoreCalls, 1);
    expect(h.store.buyCalls, 0);
    h.store.finishRestore();
    await restore;
    h.dispose();

    final purchase = await _Harness.create(eligible: false);
    await purchase.controller.startPurchase();
    final blocked = purchase.controller.restorePurchases();
    await _tick();
    expect(purchase.store.restoreCalls, 0);
    await blocked;
    purchase.dispose();
  });

  test('batches unique Career evidence and ignores other products', () async {
    final h = await _Harness.create();
    final restore = h.controller.restorePurchases();
    await _tick();
    h.store.events.add(_event('one'));
    h.store.events.add(_event('one'));
    h.store.events.add(_event('two'));
    h.store.events.add(_event('other', productId: 'other.product'));
    await _tick();
    h.store.finishRestore();
    await restore;
    expect(h.api.restoreEvidence, ['one', 'two']);
    expect(h.store.completed, 2);
    expect(h.controller.restoreState, CareerPremiumRestoreState.success);
    h.dispose();
  });

  test(
    'subscription and credit access succeed but NONE remains locked',
    () async {
      for (final eligible in [true, false]) {
        final h = await _Harness.create(eligible: eligible);
        final restore = h.controller.restorePurchases();
        await _tick();
        h.store.events.add(_event('access-$eligible'));
        await _tick();
        h.store.finishRestore();
        await restore;
        expect(
          h.controller.restoreState,
          eligible
              ? CareerPremiumRestoreState.success
              : CareerPremiumRestoreState.notFound,
        );
        h.dispose();
      }
    },
  );

  test(
    'empty, rejected, and failed restore never complete transactions',
    () async {
      final empty = await _Harness.create();
      final emptyRestore = empty.controller.restorePurchases();
      await _tick();
      empty.store.finishRestore();
      await emptyRestore;
      expect(empty.api.restoreEvidence, isEmpty);
      expect(empty.controller.restoreState, CareerPremiumRestoreState.notFound);
      empty.dispose();

      final rejected = await _Harness.create(apiFails: true);
      final rejectedRestore = rejected.controller.restorePurchases();
      await _tick();
      rejected.store.events.add(_event('rejected'));
      await _tick();
      rejected.store.finishRestore();
      await rejectedRestore;
      expect(rejected.store.completed, 0);
      expect(rejected.controller.restoreState, CareerPremiumRestoreState.error);
      rejected.dispose();
    },
  );

  test(
    'a terminal session clears old evidence before the next restore',
    () async {
      final h = await _Harness.create();
      final first = h.controller.restorePurchases();
      await _tick();
      h.store.events.add(_event('old'));
      await _tick();
      h.store.finishRestore();
      await first;
      final second = h.controller.restorePurchases();
      await _tick();
      h.store.events.add(_event('new'));
      await _tick();
      h.store.finishRestore();
      await second;
      expect(h.api.calls, [
        ['old'],
        ['new'],
      ]);
      h.dispose();
    },
  );
}

Future<void> _tick() => Future<void>.delayed(Duration.zero);

StorePurchaseUpdate _event(String evidence, {String productId = _productId}) =>
    StorePurchaseUpdate(
      productId: productId,
      status: StorePurchaseStatus.restored,
      serverVerificationData: evidence,
      pendingCompletePurchase: true,
    );

class _Harness {
  _Harness._(this.store, this.api, this.controller, this.product);
  final _Store store;
  final _Api api;
  final CareerPremiumPurchaseController controller;
  final CareerPremiumProductController product;
  static Future<_Harness> create({
    bool eligible = true,
    bool apiFails = false,
  }) async {
    final store = _Store();
    final service = AppleStorePurchaseService(
      client: store,
      careerPremiumAnnualAppleProductId: _productId,
    );
    final product = CareerPremiumProductController(service);
    await product.load();
    final api = _Api(apiFails);
    return _Harness._(
      store,
      api,
      CareerPremiumPurchaseController(
        service: service,
        paymentApi: api,
        productController: product,
        entitlementRefresher: _Entitlement(eligible),
        applePaymentEnvironment: 'SANDBOX',
      ),
      product,
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
  Completer<void>? _restore;
  int restoreCalls = 0, buyCalls = 0, completed = 0;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => events.stream;
  @override
  Future<bool> buyNonConsumable(String id) async {
    buyCalls++;
    return true;
  }

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {
    completed++;
  }

  @override
  Future<void> restorePurchases() {
    restoreCalls++;
    return (_restore ??= Completer<void>()).future;
  }

  void finishRestore() {
    _restore?.complete();
    _restore = null;
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
  _Api(this.fails);
  final bool fails;
  final calls = <List<String>>[];
  List<String> get restoreEvidence => calls.expand((value) => value).toList();
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
  }) async {
    if (fails) throw StateError('rejected');
    calls.add(signedTransactions);
  }
}

class _Entitlement implements CareerPremiumEntitlementRefresher {
  _Entitlement(this.eligible);
  final bool eligible;
  @override
  CareerEligibilityState get eligibilityState => eligible
      ? CareerEligibilityState.eligible
      : CareerEligibilityState.ineligible;
  @override
  Future<void> refreshEligibility() async {}
}
