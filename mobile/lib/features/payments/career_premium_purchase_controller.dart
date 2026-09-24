import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/secure_state_store.dart';
import '../../core/analytics/analytics.dart';
import '../readings/career_reading_generation_controller.dart';
import 'career_premium_product_controller.dart';
import 'data/apple_store_purchase_service.dart';
import 'data/career_premium_product_loader.dart';
import 'data/google_play_purchase_service.dart';
import 'data/payment_api_client.dart';
import 'data/pending_apple_purchase_store.dart';
import 'domain/career_premium_product.dart';

enum CareerPremiumPurchaseState {
  initializing,
  idle,
  purchasing,
  pending,
  verifying,
  refreshFailed,
  paymentStatusUnknown,
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
    this.pendingApplePurchaseStore,
    this.platform = CareerPremiumStorePlatform.apple,
    String? Function()? activeBirthProfileId,
    Analytics? analytics,
  }) {
    _analytics = analytics ?? Analytics(const NoopAnalyticsProvider());
    _activeBirthProfileId = activeBirthProfileId ?? (() => null);
    if (platform == CareerPremiumStorePlatform.apple &&
        pendingApplePurchaseStore != null) {
      unawaited(_initialize());
    } else {
      _state = CareerPremiumPurchaseState.idle;
      _recoveryInitialized = true;
      _subscribeToPurchaseUpdates();
    }
  }

  final AppleStorePurchaseService service;
  final PaymentApiClient paymentApi;
  final CareerPremiumProductController productController;
  final CareerPremiumEntitlementRefresher entitlementRefresher;
  final String? applePaymentEnvironment;
  final GooglePlayPurchaseService? googlePurchaseService;
  final PendingApplePurchaseStore? pendingApplePurchaseStore;
  final CareerPremiumStorePlatform platform;
  late final String? Function() _activeBirthProfileId;
  late final Analytics _analytics;
  StreamSubscription<StorePurchaseUpdate>? _subscription;
  CareerPremiumPurchaseState _state = CareerPremiumPurchaseState.initializing;
  CareerPremiumRestoreState _restoreState = CareerPremiumRestoreState.idle;
  final List<StorePurchaseUpdate> _restorePurchases = [];
  StorePurchaseUpdate? _verifiedPurchasePendingCompletion;
  StorePurchaseUpdate? _verificationRetryPurchase;
  String? _processingEvidence;
  String? _pendingGooglePurchaseTarget;
  String? _pendingApplePurchaseTarget;
  PendingApplePurchase? _pendingApplePurchase;
  final Map<String, String> _applePurchaseTargets = {};
  final Map<String, String> _googlePurchaseTargets = {};
  bool _disposed = false;
  bool _recoveryInitialized = false;
  bool _purchaseAttemptActive = false;

  CareerPremiumPurchaseState get state => _state;
  CareerPremiumRestoreState get restoreState => _restoreState;
  PendingApplePurchase? get pendingApplePurchase => _pendingApplePurchase;
  bool get recoveryInitialized => _recoveryInitialized;
  bool get canStart =>
      _recoveryInitialized &&
      _pendingApplePurchase == null &&
      _verificationRetryPurchase == null &&
      (_state == CareerPremiumPurchaseState.idle ||
          _state == CareerPremiumPurchaseState.canceled ||
          _state == CareerPremiumPurchaseState.error);
  bool get canRetryVerification =>
      (_state == CareerPremiumPurchaseState.error ||
          _state == CareerPremiumPurchaseState.paymentStatusUnknown) &&
      _verificationRetryPurchase != null;

  Future<void> _initialize() async {
    if (platform == CareerPremiumStorePlatform.apple &&
        pendingApplePurchaseStore != null) {
      _pendingApplePurchase = await pendingApplePurchaseStore!.load();
      if (_pendingApplePurchase != null) {
        _applePurchaseTargets[_pendingApplePurchase!.evidence] =
            _pendingApplePurchase!.birthProfileId;
        _state = CareerPremiumPurchaseState.paymentStatusUnknown;
      } else {
        _state = CareerPremiumPurchaseState.idle;
      }
    } else {
      _state = CareerPremiumPurchaseState.idle;
    }
    if (_disposed) return;
    _subscribeToPurchaseUpdates();
    _recoveryInitialized = true;
    notifyListeners();
  }

  void _subscribeToPurchaseUpdates() {
    _subscription =
        (platform == CareerPremiumStorePlatform.googlePlay
                ? googlePurchaseService?.purchaseUpdates ?? const Stream.empty()
                : service.purchaseUpdates)
            .listen(_onPurchaseUpdate);
  }

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
    _purchaseAttemptActive = true;
    unawaited(_analytics.track(AnalyticsEvent.purchaseStarted, {
      'sku': product.logicalSku,
      'payment_provider': platform.name,
      'product_type': 'career_premium',
    }));
    try {
      if (platform == CareerPremiumStorePlatform.apple) {
        if (product.logicalSku == appleCareerProfileUnlockLogicalSku) {
          final target = _activeBirthProfileId();
          if (target == null || target.isEmpty) {
            _setState(CareerPremiumPurchaseState.error);
            return;
          }
          _pendingApplePurchaseTarget = target;
        }
      }
      if (platform == CareerPremiumStorePlatform.googlePlay &&
          product.logicalSku == careerProfileUnlockLogicalSku) {
        final target = _activeBirthProfileId();
        if (target == null || target.isEmpty) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        _pendingGooglePurchaseTarget = target;
      }
      final started = platform == CareerPremiumStorePlatform.googlePlay
          ? await googlePurchaseService!.startCareerPremiumPurchase(product)
          : await service.startCareerPremiumPurchase(product);
      if (!started) {
        _pendingGooglePurchaseTarget = null;
        _pendingApplePurchaseTarget = null;
        _setState(CareerPremiumPurchaseState.error);
        _trackFailure('provider_error');
      }
    } catch (_) {
      _setState(CareerPremiumPurchaseState.error);
      _trackFailure('provider_error');
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
    if (platform == CareerPremiumStorePlatform.apple &&
        _pendingApplePurchase != null &&
        _verificationRetryPurchase == null) {
      await retryPendingAppleVerification();
      return;
    }
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

  /// Re-sends only the persisted StoreKit transaction to its original profile.
  /// It never opens StoreKit or consults the currently selected profile.
  Future<void> retryPendingAppleVerification() async {
    final pending = _pendingApplePurchase;
    if (platform != CareerPremiumStorePlatform.apple || pending == null) return;
    await _verifyPersistedApplePurchase(pending, _verificationRetryPurchase);
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
    if (platform == CareerPremiumStorePlatform.googlePlay) {
      await _restoreGooglePurchases();
      return;
    }
    // The new Apple product is consumable and profile-scoped. Its unfinished
    // transaction is reconciled through the purchase stream and secure record,
    // never through StoreKit's subscription restore path.
    if (productController.product?.logicalSku ==
        appleCareerProfileUnlockLogicalSku) {
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
        _pendingApplePurchaseTarget = null;
        _setState(CareerPremiumPurchaseState.canceled);
        _trackFailure('cancelled');
      case StorePurchaseStatus.error:
        _pendingApplePurchaseTarget = null;
        _setState(CareerPremiumPurchaseState.error);
        _trackFailure('provider_error');
      case StorePurchaseStatus.purchased:
      case StorePurchaseStatus.restored:
        final existing = _pendingApplePurchase;
        if (existing != null &&
            existing.evidence != purchase.serverVerificationData) {
          // TaraVerse supports one unresolved Apple consumable at a time.
          _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
          return;
        }
        final target = existing?.birthProfileId ?? _pendingApplePurchaseTarget;
        if (product.logicalSku == appleCareerProfileUnlockLogicalSku &&
            (target == null || target.isEmpty)) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        if (target != null && target.isNotEmpty) {
          _applePurchaseTargets.putIfAbsent(
            purchase.serverVerificationData,
            () => target,
          );
        }
        _pendingApplePurchaseTarget = null;
        if (product.logicalSku == appleCareerProfileUnlockLogicalSku) {
          final persisted = await _persistApplePending(
            purchase,
            target!,
            product,
          );
          if (!persisted) return;
        }
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
        _trackFailure('cancelled');
      case StorePurchaseStatus.error:
        _setState(CareerPremiumPurchaseState.error);
        _trackFailure('provider_error');
      case StorePurchaseStatus.restored:
        return;
      case StorePurchaseStatus.purchased:
        if (product.logicalSku == careerProfileUnlockLogicalSku) {
          final target = _pendingGooglePurchaseTarget;
          if (target == null || target.isEmpty) {
            _setState(CareerPremiumPurchaseState.error);
            return;
          }
          _googlePurchaseTargets.putIfAbsent(
            purchase.serverVerificationData,
            () => target,
          );
          _pendingGooglePurchaseTarget = null;
        }
        await _verifyGooglePurchase(purchase, product);
    }
  }

  Future<void> _restoreGooglePurchases() async {
    final google = googlePurchaseService;
    final product = productController.product;
    if (google == null || product == null) {
      _restoreState = CareerPremiumRestoreState.error;
      notifyListeners();
      return;
    }
    _restorePurchases.clear();
    _restoreState = CareerPremiumRestoreState.restoring;
    notifyListeners();
    try {
      await google.restorePurchases();
      await Future<void>.delayed(Duration.zero);
      final evidence = _restorePurchases
          .map((purchase) => purchase.serverVerificationData)
          .where((value) => value.isNotEmpty)
          .toSet()
          .toList(growable: false);
      if (evidence.isEmpty) {
        _restoreState = CareerPremiumRestoreState.notFound;
        return;
      }
      _restoreState = CareerPremiumRestoreState.verifying;
      notifyListeners();
      for (final purchaseToken in evidence) {
        await paymentApi.verifyGooglePurchase(
          productId: product.storeProductId,
          purchaseToken: purchaseToken,
        );
      }
      await entitlementRefresher.refreshEligibility();
      if (entitlementRefresher.eligibilityState ==
          CareerEligibilityState.eligible) {
        for (final purchase in _restorePurchases) {
          if (purchase.pendingCompletePurchase) {
            await google.completePurchaseOnce(purchase);
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

  Future<void> _verifyPurchase(
    StorePurchaseUpdate purchase,
    CareerPremiumProduct product,
  ) async {
    final evidence = purchase.serverVerificationData;
    final environment = applePaymentEnvironment;
    final target = _applePurchaseTargets[evidence];
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
      if (product.logicalSku == appleCareerProfileUnlockLogicalSku) {
        if (target == null ||
            paymentApi is! AppleProfileUnlockPaymentApiClient) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        await (paymentApi as AppleProfileUnlockPaymentApiClient)
            .verifyAppleProfileUnlockPurchase(
              environment: environment,
              productId: product.storeProductId,
              evidence: evidence,
              birthProfileId: target,
            );
      } else {
        await paymentApi.verifyApplePurchase(
          environment: environment,
          productId: product.storeProductId,
          evidence: evidence,
        );
      }
      _verifiedPurchasePendingCompletion = purchase;
      await _refreshEntitlementAfterVerification();
    } catch (error) {
      if (product.logicalSku == appleCareerProfileUnlockLogicalSku) {
        await _handleAppleVerificationFailure(error, purchase);
      } else {
        _setState(CareerPremiumPurchaseState.error);
      }
      _trackFailure('verification_failed');
    } finally {
      _processingEvidence = null;
    }
  }

  Future<bool> _persistApplePending(
    StorePurchaseUpdate purchase,
    String target,
    CareerPremiumProduct product,
  ) async {
    final environment = applePaymentEnvironment;
    final evidence = purchase.serverVerificationData;
    if (environment == null || evidence.isEmpty) {
      _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
      return false;
    }
    final pending = PendingApplePurchase(
      transactionId: purchase.transactionId,
      birthProfileId: target,
      productId: product.storeProductId,
      evidence: evidence,
      environment: environment,
      updatedAt: DateTime.now(),
    );
    try {
      await pendingApplePurchaseStore?.save(pending);
      _pendingApplePurchase = pending;
      return true;
    } catch (_) {
      _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
      return false;
    }
  }

  Future<void> _verifyPersistedApplePurchase(
    PendingApplePurchase pending,
    StorePurchaseUpdate? redeliveredPurchase,
  ) async {
    if (_processingEvidence == pending.evidence ||
        paymentApi is! AppleProfileUnlockPaymentApiClient) {
      return;
    }
    _processingEvidence = pending.evidence;
    _setState(CareerPremiumPurchaseState.verifying);
    try {
      await (paymentApi as AppleProfileUnlockPaymentApiClient)
          .verifyAppleProfileUnlockPurchase(
            environment: pending.environment,
            productId: pending.productId,
            evidence: pending.evidence,
            birthProfileId: pending.birthProfileId,
          );
      _verifiedPurchasePendingCompletion = redeliveredPurchase;
      await _refreshEntitlementAfterVerification();
      // Without a native redelivery there is no safe StoreKit object to finish.
      // Retain the secure record and wait for StoreKit to redeliver it.
      if (redeliveredPurchase == null && !_disposed) {
        _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
      }
    } catch (error) {
      await _handleAppleVerificationFailure(error, redeliveredPurchase);
    } finally {
      _processingEvidence = null;
    }
  }

  Future<void> _handleAppleVerificationFailure(
    Object error,
    StorePurchaseUpdate? purchase,
  ) async {
    final status = error is DioException ? error.response?.statusCode : null;
    final definitive = status != null && status >= 400 && status < 500;
    if (!definitive) {
      _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
      return;
    }
    // A trusted 4xx rejection cannot grant entitlement. If StoreKit supplied a
    // native transaction, finish it to avoid an unrecoverable redelivery loop.
    try {
      if (purchase?.pendingCompletePurchase == true) {
        await service.completePurchaseOnce(purchase!);
      }
      await pendingApplePurchaseStore?.clear();
      _pendingApplePurchase = null;
      _verificationRetryPurchase = null;
      _setState(CareerPremiumPurchaseState.error);
    } catch (_) {
      _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
    }
  }

  Future<void> _verifyGooglePurchase(
    StorePurchaseUpdate purchase,
    CareerPremiumProduct product,
  ) async {
    final purchaseToken = purchase.serverVerificationData;
    final target = _googlePurchaseTargets[purchaseToken];
    if (purchaseToken.isEmpty ||
        (product.logicalSku == careerProfileUnlockLogicalSku &&
            target == null)) {
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
        birthProfileId: target,
      );
      _verifiedPurchasePendingCompletion = purchase;
      await _refreshEntitlementAfterVerification();
    } catch (_) {
      _setState(CareerPremiumPurchaseState.error);
      _trackFailure('verification_failed');
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
        if (platform == CareerPremiumStorePlatform.googlePlay &&
            productController.product?.logicalSku ==
                careerProfileUnlockLogicalSku) {
          await googlePurchaseService!.consumePurchaseOnce(purchase!);
        } else if (platform == CareerPremiumStorePlatform.googlePlay) {
          await googlePurchaseService!.completePurchaseOnce(purchase!);
        } else {
          await service.completePurchaseOnce(purchase!);
        }
      }
      _verifiedPurchasePendingCompletion = null;
      _verificationRetryPurchase = null;
      if (purchase != null) {
        _googlePurchaseTargets.remove(purchase.serverVerificationData);
        if (platform == CareerPremiumStorePlatform.apple) {
          _applePurchaseTargets.remove(purchase.serverVerificationData);
          await pendingApplePurchaseStore?.clear();
          _pendingApplePurchase = null;
        }
      }
      _setState(CareerPremiumPurchaseState.success);
      _purchaseAttemptActive = false;
    } catch (_) {
      _setState(CareerPremiumPurchaseState.refreshFailed);
    }
  }

  void _setState(CareerPremiumPurchaseState state) {
    if (_disposed) return;
    _state = state;
    notifyListeners();
  }

  void _trackFailure(String category) {
    if (!_purchaseAttemptActive) return;
    _purchaseAttemptActive = false;
    unawaited(_analytics.track(AnalyticsEvent.purchaseFailed, {
      'failure_category': category,
      'payment_provider': platform.name,
      'product_type': 'career_premium',
    }));
  }

  @override
  void dispose() {
    _disposed = true;
    _subscription?.cancel();
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
        pendingApplePurchaseStore: SecurePendingApplePurchaseStore(
          ref.watch(secureStateStoreProvider),
        ),
        platform: scope.$4,
        activeBirthProfileId: () => scope.$2.activeBirthProfileId,
        analytics: ref.watch(analyticsProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
