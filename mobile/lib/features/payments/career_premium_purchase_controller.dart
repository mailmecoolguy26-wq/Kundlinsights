import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../readings/career_reading_generation_controller.dart';
import 'career_premium_product_controller.dart';
import 'data/apple_store_purchase_service.dart';
import 'data/career_premium_product_loader.dart';
import 'data/google_play_purchase_service.dart';
import 'data/payment_api_client.dart';
import 'domain/career_premium_product.dart';

enum CareerPremiumPurchaseState {
  idle,
  purchasing,
  pending,
  verifying,
  refreshFailed,
  success,
  canceled,
  error,
}

enum CareerPremiumRestoreState {
  idle,
  restoring,
  verifying,
  success,
  notFound,
  error,
}

abstract interface class CareerPremiumEntitlementRefresher {
  CareerEligibilityState get eligibilityState;
  Future<void> refreshEligibility();
}

class CareerReadingEntitlementRefresher
    implements CareerPremiumEntitlementRefresher {
  const CareerReadingEntitlementRefresher(this._controller);
  final CareerReadingGenerationController _controller;

  @override
  CareerEligibilityState get eligibilityState => _controller.eligibilityState;

  @override
  Future<void> refreshEligibility() => _controller.refreshEligibility();
}

class CareerPremiumPurchaseController extends ChangeNotifier {
  CareerPremiumPurchaseController({
    required this.service,
    required this.paymentApi,
    required this.productController,
    required this.entitlementRefresher,
    required this.applePaymentEnvironment,
    this.googlePurchaseService,
    this.platform = CareerPremiumStorePlatform.apple,
  }) {
    _subscription =
        (platform == CareerPremiumStorePlatform.googlePlay
                ? googlePurchaseService?.purchaseUpdates ?? const Stream.empty()
                : service.purchaseUpdates)
            .listen(_onPurchaseUpdate);
  }

  final AppleStorePurchaseService service;
  final PaymentApiClient paymentApi;
  final CareerPremiumProductController productController;
  final CareerPremiumEntitlementRefresher entitlementRefresher;
  final String? applePaymentEnvironment;
  final GooglePlayPurchaseService? googlePurchaseService;
  final CareerPremiumStorePlatform platform;
  late final StreamSubscription<StorePurchaseUpdate> _subscription;
  CareerPremiumPurchaseState _state = CareerPremiumPurchaseState.idle;
  CareerPremiumRestoreState _restoreState = CareerPremiumRestoreState.idle;
  final List<StorePurchaseUpdate> _restorePurchases = [];
  StorePurchaseUpdate? _verifiedPurchasePendingCompletion;
  StorePurchaseUpdate? _verificationRetryPurchase;
  String? _processingEvidence;
  bool _disposed = false;

  CareerPremiumPurchaseState get state => _state;
  CareerPremiumRestoreState get restoreState => _restoreState;
  bool get canStart =>
      _verificationRetryPurchase == null &&
      (_state == CareerPremiumPurchaseState.idle ||
          _state == CareerPremiumPurchaseState.canceled ||
          _state == CareerPremiumPurchaseState.error);
  bool get canRetryVerification =>
      _state == CareerPremiumPurchaseState.error &&
      _verificationRetryPurchase != null;

  Future<void> startPurchase() async {
    if (!canStart ||
        _restoreState == CareerPremiumRestoreState.restoring ||
        _restoreState == CareerPremiumRestoreState.verifying ||
        entitlementRefresher.eligibilityState ==
            CareerEligibilityState.eligible ||
        productController.state != CareerPremiumProductLoadState.available) {
      return;
    }
    final product = productController.product;
    final environment = applePaymentEnvironment;
    if (product == null ||
        (platform == CareerPremiumStorePlatform.apple && environment == null) ||
        (platform == CareerPremiumStorePlatform.googlePlay &&
            googlePurchaseService == null)) {
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    _setState(CareerPremiumPurchaseState.purchasing);
    try {
      final started = platform == CareerPremiumStorePlatform.googlePlay
          ? await googlePurchaseService!.startCareerPremiumPurchase(product)
          : await service.startCareerPremiumPurchase(product);
      if (!started) {
        _setState(CareerPremiumPurchaseState.error);
      }
    } catch (_) {
      _setState(CareerPremiumPurchaseState.error);
    }
  }

  Future<void> retryEntitlementRefresh() async {
    if (_state != CareerPremiumPurchaseState.refreshFailed ||
        _restoreState == CareerPremiumRestoreState.restoring ||
        _restoreState == CareerPremiumRestoreState.verifying) {
      return;
    }
    await _refreshEntitlementAfterVerification();
  }

  Future<void> retryVerification() async {
    final purchase = _verificationRetryPurchase;
    final product = productController.product;
    if (!canRetryVerification ||
        purchase == null ||
        product == null ||
        _restoreState == CareerPremiumRestoreState.restoring ||
        _restoreState == CareerPremiumRestoreState.verifying) {
      return;
    }
    if (platform == CareerPremiumStorePlatform.googlePlay) {
      await _verifyGooglePurchase(purchase, product);
    } else {
      await _verifyPurchase(purchase, product);
    }
  }

  Future<void> restorePurchases() async {
    if (_restoreState == CareerPremiumRestoreState.restoring ||
        _restoreState == CareerPremiumRestoreState.verifying) {
      return;
    }
    if (_state == CareerPremiumPurchaseState.purchasing ||
        _state == CareerPremiumPurchaseState.pending ||
        _state == CareerPremiumPurchaseState.verifying) {
      return;
    }
    if (applePaymentEnvironment == null) {
      _restoreState = CareerPremiumRestoreState.error;
      notifyListeners();
      return;
    }
    _restorePurchases.clear();
    _restoreState = CareerPremiumRestoreState.restoring;
    notifyListeners();
    try {
      await service.restorePurchases();
      await Future<void>.delayed(Duration.zero);
      final evidence = _restorePurchases
          .map((purchase) => purchase.serverVerificationData)
          .where((value) => value.isNotEmpty)
          .toSet()
          .toList(growable: false);
      if (evidence.isEmpty) {
        _restoreState = CareerPremiumRestoreState.notFound;
        notifyListeners();
        return;
      }
      _restoreState = CareerPremiumRestoreState.verifying;
      notifyListeners();
      await paymentApi.restoreApplePurchases(
        environment: applePaymentEnvironment!,
        signedTransactions: evidence,
      );
      await entitlementRefresher.refreshEligibility();
      if (entitlementRefresher.eligibilityState ==
          CareerEligibilityState.eligible) {
        for (final purchase in _restorePurchases) {
          if (purchase.pendingCompletePurchase) {
            await service.completePurchaseOnce(purchase);
          }
        }
        _restoreState = CareerPremiumRestoreState.success;
      } else {
        _restoreState = CareerPremiumRestoreState.notFound;
      }
    } catch (_) {
      _restoreState = CareerPremiumRestoreState.error;
    } finally {
      _restorePurchases.clear();
      notifyListeners();
    }
  }

  Future<void> _onPurchaseUpdate(StorePurchaseUpdate purchase) async {
    if (platform == CareerPremiumStorePlatform.googlePlay) {
      await _onGooglePurchaseUpdate(purchase);
      return;
    }
    final product = productController.product;
    if (product == null || purchase.productId != product.storeProductId) return;
    if (service.wasCompleted(purchase)) return;
    if (purchase.status == StorePurchaseStatus.restored &&
        _restoreState == CareerPremiumRestoreState.restoring) {
      _restorePurchases.add(purchase);
      return;
    }
    switch (purchase.status) {
      case StorePurchaseStatus.pending:
        _setState(CareerPremiumPurchaseState.pending);
      case StorePurchaseStatus.canceled:
        _setState(CareerPremiumPurchaseState.canceled);
      case StorePurchaseStatus.error:
        _setState(CareerPremiumPurchaseState.error);
      case StorePurchaseStatus.purchased:
      case StorePurchaseStatus.restored:
        await _verifyPurchase(purchase, product);
    }
  }

  Future<void> _onGooglePurchaseUpdate(StorePurchaseUpdate purchase) async {
    final product = productController.product;
    final google = googlePurchaseService;
    if (product == null ||
        google == null ||
        !google.isConfiguredProductId(purchase.productId) ||
        purchase.productId != product.storeProductId) {
      return;
    }
    if (google.wasCompleted(purchase)) return;
    switch (purchase.status) {
      case StorePurchaseStatus.pending:
        _setState(CareerPremiumPurchaseState.pending);
      case StorePurchaseStatus.canceled:
        _setState(CareerPremiumPurchaseState.canceled);
      case StorePurchaseStatus.error:
        _setState(CareerPremiumPurchaseState.error);
      case StorePurchaseStatus.restored:
        return;
      case StorePurchaseStatus.purchased:
        await _verifyGooglePurchase(purchase, product);
    }
  }

  Future<void> _verifyPurchase(
    StorePurchaseUpdate purchase,
    CareerPremiumProduct product,
  ) async {
    final evidence = purchase.serverVerificationData;
    final environment = applePaymentEnvironment;
    if (evidence.isEmpty ||
        environment == null ||
        _processingEvidence == evidence) {
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    _processingEvidence = evidence;
    _verificationRetryPurchase = purchase;
    _setState(CareerPremiumPurchaseState.verifying);
    try {
      await paymentApi.verifyApplePurchase(
        environment: environment,
        productId: product.storeProductId,
        evidence: evidence,
      );
      _verifiedPurchasePendingCompletion = purchase;
      await _refreshEntitlementAfterVerification();
    } catch (_) {
      _setState(CareerPremiumPurchaseState.error);
    } finally {
      _processingEvidence = null;
    }
  }

  Future<void> _verifyGooglePurchase(
    StorePurchaseUpdate purchase,
    CareerPremiumProduct product,
  ) async {
    final purchaseToken = purchase.serverVerificationData;
    if (purchaseToken.isEmpty) {
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    if (_processingEvidence == purchaseToken) return;
    _processingEvidence = purchaseToken;
    _verificationRetryPurchase = purchase;
    _setState(CareerPremiumPurchaseState.verifying);
    try {
      await paymentApi.verifyGooglePurchase(
        productId: product.storeProductId,
        purchaseToken: purchaseToken,
      );
      _verifiedPurchasePendingCompletion = purchase;
      await _refreshEntitlementAfterVerification();
    } catch (_) {
      _setState(CareerPremiumPurchaseState.error);
    } finally {
      _processingEvidence = null;
    }
  }

  Future<void> _refreshEntitlementAfterVerification() async {
    _setState(CareerPremiumPurchaseState.verifying);
    try {
      await entitlementRefresher.refreshEligibility();
      if (entitlementRefresher.eligibilityState ==
          CareerEligibilityState.error) {
        _setState(CareerPremiumPurchaseState.refreshFailed);
        return;
      }
      if (entitlementRefresher.eligibilityState !=
          CareerEligibilityState.eligible) {
        _setState(CareerPremiumPurchaseState.error);
        return;
      }
      final purchase = _verifiedPurchasePendingCompletion;
      if (purchase?.pendingCompletePurchase == true) {
        if (platform == CareerPremiumStorePlatform.googlePlay) {
          await googlePurchaseService!.completePurchaseOnce(purchase!);
        } else {
          await service.completePurchaseOnce(purchase!);
        }
      }
      _verifiedPurchasePendingCompletion = null;
      _verificationRetryPurchase = null;
      _setState(CareerPremiumPurchaseState.success);
    } catch (_) {
      _setState(CareerPremiumPurchaseState.refreshFailed);
    }
  }

  void _setState(CareerPremiumPurchaseState state) {
    if (_disposed) return;
    _state = state;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _subscription.cancel();
    super.dispose();
  }
}

final careerPremiumPurchaseControllerProvider =
    Provider.family<
      CareerPremiumPurchaseController,
      (
        CareerPremiumProductController,
        CareerReadingGenerationController,
        String?,
        CareerPremiumStorePlatform,
      )
    >((ref, scope) {
      final controller = CareerPremiumPurchaseController(
        service: ref.watch(appleStorePurchaseServiceProvider),
        paymentApi: ref.watch(paymentApiClientProvider),
        productController: scope.$1,
        entitlementRefresher: CareerReadingEntitlementRefresher(scope.$2),
        applePaymentEnvironment: scope.$3,
        googlePurchaseService: ref.watch(googlePlayPurchaseServiceProvider),
        platform: scope.$4,
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
