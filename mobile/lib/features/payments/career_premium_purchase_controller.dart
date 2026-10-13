import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/secure_state_store.dart';
import '../../core/analytics/analytics.dart';
import '../readings/career_reading_generation_controller.dart';
import 'career_premium_product_controller.dart';
import 'data/apple_store_purchase_service.dart';
import 'data/career_premium_product_loader.dart';
import 'data/google_play_purchase_service.dart';
import 'data/debug_local_storekit_entitlement_session.dart';
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
  reconciliationRequired,
  error,
}

class _LocalDebugPurchaseScope {
  const _LocalDebugPurchaseScope(
    this.authenticatedSubject,
    this.birthProfileId,
  );

  final String authenticatedSubject;
  final String birthProfileId;
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
    this.debugLocalStoreKitEntitlementSession,
    this.pendingApplePurchaseStore,
    this.platform = CareerPremiumStorePlatform.apple,
    String? Function()? activeBirthProfileId,
    String? Function()? activeAuthenticatedSubject,
    String? Function()? currentPurchaseMode,
    String? Function()? backendPurchaseMode,
    Listenable? entitlementScope,
    Analytics? analytics,
  }) {
    _analytics = analytics ?? Analytics(const NoopAnalyticsProvider());
    _activeBirthProfileId = activeBirthProfileId ?? (() => null);
    _activeAuthenticatedSubject = activeAuthenticatedSubject ?? (() => null);
    _currentPurchaseMode = currentPurchaseMode ?? (() => null);
    _backendPurchaseMode = backendPurchaseMode ?? (() => null);
    _entitlementScope = entitlementScope;
    _entitlementScope?.addListener(_onEntitlementScopeChanged);
    _onEntitlementScopeChanged();
    // StoreKit may redeliver an unfinished transaction as soon as its stream
    // has a listener. Observe product loading too, so a redelivery that wins
    // the race with StoreKit product loading can be handled once its product
    // metadata is available.
    productController.addListener(_onProductControllerChanged);
    _subscribeToPurchaseUpdates();
    if (platform == CareerPremiumStorePlatform.apple &&
        pendingApplePurchaseStore != null) {
      unawaited(_initialize());
    } else {
      _state = CareerPremiumPurchaseState.idle;
      _recoveryInitialized = true;
    }
  }

  final AppleStorePurchaseService service;
  final PaymentApiClient paymentApi;
  final CareerPremiumProductController productController;
  final CareerPremiumEntitlementRefresher entitlementRefresher;
  final String? applePaymentEnvironment;
  final GooglePlayPurchaseService? googlePurchaseService;
  final DebugLocalStoreKitEntitlementSession?
  debugLocalStoreKitEntitlementSession;
  final PendingApplePurchaseStore? pendingApplePurchaseStore;
  final CareerPremiumStorePlatform platform;
  late final String? Function() _activeBirthProfileId;
  late final String? Function() _activeAuthenticatedSubject;
  late final String? Function() _currentPurchaseMode;
  late final String? Function() _backendPurchaseMode;
  Listenable? _entitlementScope;
  late final Analytics _analytics;
  StreamSubscription<StorePurchaseUpdate>? _subscription;
  CareerPremiumPurchaseState _state = CareerPremiumPurchaseState.initializing;
  CareerPremiumRestoreState _restoreState = CareerPremiumRestoreState.idle;
  final List<StorePurchaseUpdate> _restorePurchases = [];
  StorePurchaseUpdate? _verifiedPurchasePendingCompletion;
  CareerPremiumProduct? _verifiedGooglePurchaseProduct;
  String? _verifiedGooglePurchaseTarget;
  StorePurchaseUpdate? _verificationRetryPurchase;
  String? _processingEvidence;
  String? _pendingGooglePurchaseTarget;
  String? _pendingApplePurchaseTarget;
  String? _purchaseAttemptAppleProfileId;
  final Map<String, String> _pendingApplePurchaseTargetsByProductId = {};
  final Map<String, _LocalDebugPurchaseScope>
  _pendingLocalDebugScopesByProductId = {};
  PendingApplePurchase? _pendingApplePurchase;
  final Map<String, String> _applePurchaseTargets = {};
  final Map<String, String> _googlePurchaseTargets = {};
  final Map<String, CareerPremiumProduct> _pendingGoogleProductsById = {};
  final Map<String, CareerPremiumProduct> _googlePurchaseProducts = {};
  final List<StorePurchaseUpdate> _deferredApplePurchaseUpdates = [];
  bool _disposed = false;
  bool _recoveryInitialized = false;
  bool _purchaseAttemptActive = false;
  bool _localRestoreActivated = false;
  bool _localRestoreReconciliationRequired = false;
  bool _drainingDeferredApplePurchaseUpdates = false;

  CareerPremiumPurchaseState get state => _state;
  CareerPremiumRestoreState get restoreState => _restoreState;
  PendingApplePurchase? get pendingApplePurchase => _pendingApplePurchase;
  bool get recoveryInitialized => _recoveryInitialized;
  bool get hasLocalDebugEntitlement =>
      debugLocalStoreKitEntitlementSession?.isActiveFor(
        authenticatedSubject: _activeAuthenticatedSubject(),
        birthProfileId: _activeBirthProfileId(),
      ) ??
      false;
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
    _recoveryInitialized = true;
    notifyListeners();
  }

  void _subscribeToPurchaseUpdates() {
    if (_subscription != null) return;
    _debugPurchaseLifecycle('PURCHASE_STREAM_SUBSCRIBE');
    _subscription =
        (platform == CareerPremiumStorePlatform.googlePlay
                ? googlePurchaseService?.purchaseUpdates ?? const Stream.empty()
                : service.purchaseUpdates)
            .listen(_onPurchaseUpdate);
  }

  void _onProductControllerChanged() {
    if (_disposed ||
        productController.state != CareerPremiumProductLoadState.available ||
        _deferredApplePurchaseUpdates.isEmpty ||
        _drainingDeferredApplePurchaseUpdates) {
      return;
    }
    unawaited(_drainDeferredApplePurchaseUpdates());
  }

  Future<void> _drainDeferredApplePurchaseUpdates() async {
    if (_drainingDeferredApplePurchaseUpdates || _disposed) return;
    _drainingDeferredApplePurchaseUpdates = true;
    try {
      while (_deferredApplePurchaseUpdates.isNotEmpty && !_disposed) {
        final purchase = _deferredApplePurchaseUpdates.removeAt(0);
        await _onPurchaseUpdate(purchase, deferWhenProductUnavailable: false);
      }
    } finally {
      _drainingDeferredApplePurchaseUpdates = false;
    }
  }

  Future<void> startPurchase() => startPurchaseFor(productController.product);

  Future<void> startPurchaseFor(CareerPremiumProduct? selectedProduct) async {
    if (!canStart ||
        _restoreState == CareerPremiumRestoreState.restoring ||
        _restoreState == CareerPremiumRestoreState.verifying ||
        entitlementRefresher.eligibilityState ==
            CareerEligibilityState.eligible ||
        productController.state != CareerPremiumProductLoadState.available) {
      return;
    }
    final product = selectedProduct;
    final environment = applePaymentEnvironment;
    if (product == null ||
        (platform == CareerPremiumStorePlatform.apple && environment == null) ||
        (platform == CareerPremiumStorePlatform.googlePlay &&
            googlePurchaseService == null)) {
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    if (_hasLocalDebugPurchaseModeMismatch(product)) {
      _debugPurchaseInvoke(product, mismatch: true);
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    if (_mustRejectSecondLocalPrimary(product)) {
      _debugPurchaseInvoke(product);
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    _setState(CareerPremiumPurchaseState.purchasing);
    _debugPurchaseLifecycle(
      'PURCHASE_CALL_START productId=${product.storeProductId}',
    );
    _purchaseAttemptActive = true;
    unawaited(
      _analytics.track(AnalyticsEvent.purchaseStarted, {
        'sku': product.logicalSku,
        'payment_provider': platform.name,
        'product_type': 'career_premium',
      }),
    );
    try {
      if (platform == CareerPremiumStorePlatform.apple &&
          (_requiresProfileAssociation(product) ||
              _shouldCaptureLocalDebugScope(product))) {
        final target = _activeBirthProfileId();
        final subject = _activeAuthenticatedSubject();
        if (target == null ||
            target.isEmpty ||
            (_shouldCaptureLocalDebugScope(product) &&
                (subject == null || subject.isEmpty))) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        if (_requiresProfileAssociation(product)) {
          _pendingApplePurchaseTarget = target;
          _purchaseAttemptAppleProfileId = target;
          _pendingApplePurchaseTargetsByProductId[product.storeProductId] =
              target;
        }
        if (_shouldCaptureLocalDebugScope(product)) {
          _pendingLocalDebugScopesByProductId[product.storeProductId] =
              _LocalDebugPurchaseScope(subject!, target);
        }
      }
      if (platform == CareerPremiumStorePlatform.googlePlay &&
          _requiresProfileAssociation(product)) {
        final target = _activeBirthProfileId();
        if (target == null || target.isEmpty) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        _pendingGooglePurchaseTarget = target;
        _pendingGoogleProductsById[product.storeProductId] = product;
      }
      // This is the final, exact product/mode record before the StoreKit
      // invocation. `product` is the selected provider product from the
      // current mode-specific loader; it is never reconstructed from duration.
      _debugPurchaseInvoke(product);
      final started = platform == CareerPremiumStorePlatform.googlePlay
          ? await googlePurchaseService!.startCareerPremiumPurchase(product)
          : await service.startCareerPremiumPurchase(product);
      _debugPurchaseLifecycle(
        'PURCHASE_CALL_RETURN result=${started ? 'accepted' : 'false'}',
      );
      if (!started) {
        _pendingGooglePurchaseTarget = null;
        _pendingGoogleProductsById.remove(product.storeProductId);
        _pendingApplePurchaseTarget = null;
        _purchaseAttemptAppleProfileId = null;
        _pendingApplePurchaseTargetsByProductId.remove(product.storeProductId);
        _pendingLocalDebugScopesByProductId.remove(product.storeProductId);
        _setState(CareerPremiumPurchaseState.error);
        _trackFailure('provider_error');
      }
    } catch (error, stackTrace) {
      _debugPurchaseLifecycle('PURCHASE_CALL_RETURN result=exception');
      _debugPurchaseCallException(product, error);
      if (kDebugMode) {
        debugPrint('PURCHASE_CALL_STACK\n$stackTrace');
      }
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
    _localRestoreActivated = false;
    _localRestoreReconciliationRequired = false;
    _restoreState = CareerPremiumRestoreState.restoring;
    notifyListeners();
    try {
      await service.restorePurchases();
      await Future<void>.delayed(Duration.zero);
      if (_localRestoreReconciliationRequired) {
        return;
      }
      final evidence = _restorePurchases
          .map((purchase) => purchase.serverVerificationData)
          .where((value) => value.isNotEmpty)
          .toSet()
          .toList(growable: false);
      if (evidence.isEmpty) {
        if (_localRestoreActivated) {
          _restoreState = CareerPremiumRestoreState.success;
          return;
        }
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

  Future<void> _onPurchaseUpdate(
    StorePurchaseUpdate purchase, {
    bool deferWhenProductUnavailable = true,
  }) async {
    _debugPurchaseLifecycle(
      'PURCHASE_UPDATE status=${purchase.status.name} '
      'productId=${purchase.productId} '
      'pendingCompletePurchase=${purchase.pendingCompletePurchase}',
    );
    if (platform == CareerPremiumStorePlatform.googlePlay) {
      await _onGooglePurchaseUpdate(purchase);
      return;
    }
    final product = _productForStoreProductId(purchase.productId);
    if (product == null) {
      if (deferWhenProductUnavailable &&
          productController.state != CareerPremiumProductLoadState.available) {
        _deferApplePurchaseUpdate(purchase);
      }
      return;
    }
    final localSession = debugLocalStoreKitEntitlementSession;
    final localClassification = localSession?.classify(
      purchase: purchase,
      expectedProductId: product.storeProductId,
    );
    _debugLocalStoreKitEvent(
      purchase: purchase,
      classification: localClassification,
      branch: 'RECEIVED',
    );
    if (localSession?.hasHandledTransaction(purchase) ?? false) {
      _debugLocalStoreKitEvent(
        purchase: purchase,
        classification: localClassification,
        branch: 'LOCAL_DEBUG_DUPLICATE',
      );
      if (purchase.status == StorePurchaseStatus.restored &&
          _restoreState == CareerPremiumRestoreState.restoring) {
        _localRestoreActivated = true;
      }
      await _settleLocalStoreKitEntitlement(purchase, localSession!);
      return;
    }
    if (purchase.status == StorePurchaseStatus.restored &&
        _restoreState == CareerPremiumRestoreState.restoring) {
      if (await _activateLocalStoreKitEntitlement(
        purchase,
        product,
        isRestore: true,
      )) {
        if (_localRestoreReconciliationRequired) return;
        _localRestoreActivated = true;
        return;
      }
      if (_localRestoreReconciliationRequired) return;
      if (service.wasCompleted(purchase)) return;
      _restorePurchases.add(purchase);
      return;
    }
    switch (purchase.status) {
      case StorePurchaseStatus.pending:
        _setState(CareerPremiumPurchaseState.pending);
      case StorePurchaseStatus.canceled:
        _pendingApplePurchaseTarget = null;
        _purchaseAttemptAppleProfileId = null;
        _pendingApplePurchaseTargetsByProductId.remove(purchase.productId);
        _setState(CareerPremiumPurchaseState.canceled);
        _trackFailure('cancelled');
      case StorePurchaseStatus.error:
        _pendingApplePurchaseTarget = null;
        _purchaseAttemptAppleProfileId = null;
        _pendingApplePurchaseTargetsByProductId.remove(purchase.productId);
        _setState(CareerPremiumPurchaseState.error);
        _trackFailure('provider_error');
      case StorePurchaseStatus.purchased:
      case StorePurchaseStatus.restored:
        if (await _activateLocalStoreKitEntitlement(
          purchase,
          product,
          isRestore: purchase.status == StorePurchaseStatus.restored,
        )) {
          return;
        }
        if (service.wasCompleted(purchase)) return;
        _debugLocalStoreKitEvent(
          purchase: purchase,
          classification: localClassification,
          branch: 'BACKEND_VERIFY',
        );
        final existing = _pendingApplePurchase;
        if (existing != null &&
            existing.evidence != purchase.serverVerificationData) {
          // TaraVerse supports one unresolved Apple consumable at a time.
          _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
          return;
        }
        final target =
            existing?.birthProfileId ??
            _pendingApplePurchaseTargetsByProductId[purchase.productId] ??
            _pendingApplePurchaseTarget ??
            _purchaseAttemptAppleProfileId;
        if (_requiresProfileAssociation(product) &&
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
        _purchaseAttemptAppleProfileId = null;
        _pendingApplePurchaseTargetsByProductId.remove(purchase.productId);
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

  CareerPremiumProduct? _productForStoreProductId(String productId) {
    for (final product in productController.products) {
      if (product.storeProductId == productId) return product;
    }
    return null;
  }

  bool _requiresProfileAssociation(CareerPremiumProduct product) => {
    careerProfileUnlockLogicalSku,
    careerPremium6MonthLogicalSku,
    careerPremium12MonthLogicalSku,
    careerPremiumAddOn6MonthLogicalSku,
    careerPremiumAddOn12MonthLogicalSku,
  }.contains(product.logicalSku);

  bool _shouldCaptureLocalDebugScope(CareerPremiumProduct product) =>
      platform == CareerPremiumStorePlatform.apple &&
      debugLocalStoreKitEntitlementSession?.enabled == true &&
      _localDebugEntitlementSourceFor(product) != null;

  void _deferApplePurchaseUpdate(StorePurchaseUpdate purchase) {
    final duplicate = _deferredApplePurchaseUpdates.any(
      (queued) =>
          queued.productId == purchase.productId &&
          queued.transactionId == purchase.transactionId &&
          queued.serverVerificationData == purchase.serverVerificationData,
    );
    if (!duplicate) {
      _deferredApplePurchaseUpdates.add(purchase);
    }
  }

  Future<bool> _activateLocalStoreKitEntitlement(
    StorePurchaseUpdate purchase,
    CareerPremiumProduct product, {
    required bool isRestore,
  }) async {
    final session = debugLocalStoreKitEntitlementSession;
    final localSource = _localDebugEntitlementSourceFor(product);
    if (platform != CareerPremiumStorePlatform.apple ||
        localSource == null ||
        session == null) {
      return false;
    }
    final classification = session.classify(
      purchase: purchase,
      expectedProductId: product.storeProductId,
    );
    final pendingScope =
        _pendingLocalDebugScopesByProductId[product.storeProductId];
    _debugAddOnLocalVerify(
      purchase: purchase,
      classification: classification,
      profileId: pendingScope?.birthProfileId,
      recognized: classification.isQualifyingXcodeTransaction,
      bypassApplied: false,
      activationResult: 'pending',
    );
    if (!session.enabled || !classification.isQualifyingXcodeTransaction) {
      return false;
    }
    final subject = _activeAuthenticatedSubject();
    final activated = subject != null && subject.isNotEmpty
        ? (isRestore
              ? session.activateAssociatedProfileForLocalXcodeTransaction(
                  purchase: purchase,
                  expectedProductId: product.storeProductId,
                  authenticatedSubject: subject,
                )
              : pendingScope != null &&
                    pendingScope.authenticatedSubject == subject &&
                    session.activateIfLocalXcodeTransaction(
                      purchase: purchase,
                      expectedProductId: product.storeProductId,
                      authenticatedSubject: pendingScope.authenticatedSubject,
                      birthProfileId: pendingScope.birthProfileId,
                      entitlementSource: localSource,
                    ))
        : false;
    _debugAddOnLocalVerify(
      purchase: purchase,
      classification: classification,
      profileId: pendingScope?.birthProfileId,
      recognized: true,
      bypassApplied: activated,
      activationResult: activated
          ? localSource
          : (isRestore ? 'reconciliation_required' : 'origin_scope_missing'),
    );
    if (!activated) {
      _debugLocalStoreKitEvent(
        purchase: purchase,
        classification: classification,
        branch: 'LOCAL_DEBUG_RECONCILIATION_REQUIRED',
      );
      if (isRestore) {
        _localRestoreReconciliationRequired = true;
        _restoreState = CareerPremiumRestoreState.reconciliationRequired;
        notifyListeners();
      } else {
        _setState(CareerPremiumPurchaseState.paymentStatusUnknown);
      }
      return true;
    }
    _debugLocalStoreKitEvent(
      purchase: purchase,
      classification: classification,
      branch: 'LOCAL_DEBUG',
    );
    if (kDebugMode) {
      final profileId = pendingScope?.birthProfileId;
      debugPrint(
        'PURCHASE_SUCCESS profile=${profileId == null ? 'associated' : 'p${profileId.hashCode}'}',
      );
    }
    await _settleLocalStoreKitEntitlement(
      purchase,
      session,
      refreshEligibility: true,
    );
    return true;
  }

  /// Maps only known Career Premium StoreKit products into memory-only local
  /// debug entitlement provenance. This prevents an unrecognised product from
  /// entering the Xcode bypass and keeps primary/add-on scope explicit.
  String? _localDebugEntitlementSourceFor(CareerPremiumProduct product) =>
      switch (product.logicalSku) {
        careerPremiumAnnualLogicalSku ||
        careerPremium6MonthLogicalSku ||
        careerPremium12MonthLogicalSku => 'PRIMARY_SUBSCRIPTION',
        careerPremiumAddOn6MonthLogicalSku ||
        careerPremiumAddOn12MonthLogicalSku => 'ADDON_PURCHASE',
        _ => null,
      };

  bool _isAddOnProduct(CareerPremiumProduct product) => {
    careerPremiumAddOn6MonthLogicalSku,
    careerPremiumAddOn12MonthLogicalSku,
  }.contains(product.logicalSku);

  bool _isPrimaryCareerProduct(CareerPremiumProduct product) => {
    careerPremiumAnnualLogicalSku,
    careerPremium6MonthLogicalSku,
    careerPremium12MonthLogicalSku,
  }.contains(product.logicalSku);

  bool _mustRejectSecondLocalPrimary(CareerPremiumProduct product) {
    final session = debugLocalStoreKitEntitlementSession;
    final subject = _activeAuthenticatedSubject();
    final profile = _activeBirthProfileId();
    return platform == CareerPremiumStorePlatform.apple &&
        session?.enabled == true &&
        _isPrimaryCareerProduct(product) &&
        !session!.isActiveFor(
          authenticatedSubject: subject,
          birthProfileId: profile,
        ) &&
        session.hasActivePrimarySubscription(subject);
  }

  bool _hasLocalDebugPurchaseModeMismatch(CareerPremiumProduct product) {
    final session = debugLocalStoreKitEntitlementSession;
    if (!kDebugMode || session?.enabled != true) return false;
    final effectivePurchaseMode = _effectivePurchaseMode(session!);
    return switch (effectivePurchaseMode) {
      'ADDON' => !_isAddOnProduct(product),
      'PRIMARY_SUBSCRIPTION' => !_isPrimaryCareerProduct(product),
      _ => true,
    };
  }

  void _debugPurchaseInvoke(
    CareerPremiumProduct product, {
    bool mismatch = false,
  }) {
    final session = debugLocalStoreKitEntitlementSession;
    if (!kDebugMode || session?.enabled != true) return;
    final localSession = session!;
    final subject = _activeAuthenticatedSubject();
    final profile = _activeBirthProfileId();
    final effectivePurchaseMode = _effectivePurchaseMode(localSession);
    debugPrint(
      'CAREER_PURCHASE_INVOKE '
      'subject=${subject ?? 'unknown'} '
      'profile=${profile ?? 'unknown'} '
      'hasLocalPrimary=${localSession.hasActivePrimarySubscription(subject)} '
      'backendPurchaseMode=${_backendPurchaseMode() ?? 'none'} '
      'effectivePurchaseMode=$effectivePurchaseMode '
      'selectedProductId=${product.storeProductId} '
      'productType=${_isAddOnProduct(product) ? 'addon' : 'subscription'} '
      'modeMismatch=$mismatch',
    );
  }

  String? _effectivePurchaseMode(
    DebugLocalStoreKitEntitlementSession session,
  ) => session.resolvePurchaseMode(
    authenticatedSubject: _activeAuthenticatedSubject(),
    birthProfileId: _activeBirthProfileId(),
    backendPurchaseMode: _backendPurchaseMode() ?? _currentPurchaseMode(),
  );

  Future<void> _settleLocalStoreKitEntitlement(
    StorePurchaseUpdate purchase,
    DebugLocalStoreKitEntitlementSession session, {
    bool refreshEligibility = false,
  }) async {
    _verificationRetryPurchase = null;
    _verifiedPurchasePendingCompletion = null;
    _processingEvidence = null;
    _pendingApplePurchaseTarget = null;
    _purchaseAttemptAppleProfileId = null;
    _pendingApplePurchaseTargetsByProductId.remove(purchase.productId);
    _pendingLocalDebugScopesByProductId.remove(purchase.productId);
    _purchaseAttemptActive = false;
    if (refreshEligibility) {
      // This preserves the backend as production authority: the debug seam
      // only asks the normal profile eligibility controller to refresh; it
      // never writes or fabricates a server entitlement.
      await entitlementRefresher.refreshEligibility();
    }
    try {
      if (purchase.pendingCompletePurchase &&
          !session.wasTransactionCompletionRecorded(purchase)) {
        _debugPurchaseLifecycle('COMPLETE_PURCHASE_ATTEMPT');
        final completed = await service.completePurchaseOnce(purchase);
        if (completed) {
          session.recordTransactionCompletion(purchase);
          _debugPurchaseLifecycle('COMPLETE_PURCHASE_SUCCESS');
          _debugAddOnCompletion(purchase, 'success');
        } else {
          _debugPurchaseLifecycle('COMPLETE_PURCHASE_SKIPPED');
          _debugAddOnCompletion(purchase, 'skipped');
        }
      }
    } catch (error) {
      _debugPurchaseLifecycle('COMPLETE_PURCHASE_FAILURE ${error.runtimeType}');
      _debugAddOnCompletion(purchase, 'failure:${error.runtimeType}');
      _debugLocalStoreKitEvent(
        purchase: purchase,
        branch: 'LOCAL_COMPLETE_FAILED',
      );
    }
    _setState(CareerPremiumPurchaseState.success);
  }

  void _debugAddOnLocalVerify({
    required StorePurchaseUpdate purchase,
    required DebugStoreKitTransactionClassification classification,
    required String? profileId,
    required bool recognized,
    required bool bypassApplied,
    required String activationResult,
  }) {
    final product = _productForStoreProductId(purchase.productId);
    if (!kDebugMode || product == null || !_isAddOnProduct(product)) return;
    debugPrint(
      'CAREER_ADDON_LOCAL_VERIFY '
      'productId=${purchase.productId} '
      'environment=${classification.environment.name} '
      'profile=${profileId == null ? 'unknown' : 'p${profileId.hashCode}'} '
      'recognized=$recognized '
      'bypassApplied=$bypassApplied '
      'activationResult=$activationResult',
    );
  }

  void _debugAddOnCompletion(StorePurchaseUpdate purchase, String result) {
    final product = _productForStoreProductId(purchase.productId);
    if (!kDebugMode || product == null || !_isAddOnProduct(product)) return;
    debugPrint(
      'CAREER_ADDON_LOCAL_VERIFY '
      'productId=${purchase.productId} '
      'completionResult=$result',
    );
  }

  Future<void> _onGooglePurchaseUpdate(StorePurchaseUpdate purchase) async {
    final product =
        _pendingGoogleProductsById[purchase.productId] ??
        _productForStoreProductId(purchase.productId);
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
        final target = _pendingGooglePurchaseTarget;
        if (_requiresProfileAssociation(product) &&
            (target == null || target.isEmpty)) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        if (target != null && target.isNotEmpty) {
          _googlePurchaseTargets.putIfAbsent(
            purchase.serverVerificationData,
            () => target,
          );
        }
        _googlePurchaseProducts.putIfAbsent(
          purchase.serverVerificationData,
          () => product,
        );
        _pendingGooglePurchaseTarget = null;
        _pendingGoogleProductsById.remove(purchase.productId);
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
        if (paymentApi is ProfileScopedSubscriptionPaymentApiClient) {
          await (paymentApi as ProfileScopedSubscriptionPaymentApiClient)
              .restoreGoogleCareerPremiumPurchase(
                productId: product.storeProductId,
                purchaseToken: purchaseToken,
              );
        } else {
          await paymentApi.verifyGooglePurchase(
            productId: product.storeProductId,
            purchaseToken: purchaseToken,
          );
        }
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
        if (_requiresProfileAssociation(product) && target == null) {
          _setState(CareerPremiumPurchaseState.error);
          return;
        }
        if (target != null &&
            paymentApi is ProfileScopedSubscriptionPaymentApiClient) {
          await (paymentApi as ProfileScopedSubscriptionPaymentApiClient)
              .verifyAppleCareerPremiumPurchase(
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
        (_requiresProfileAssociation(product) && target == null)) {
      _setState(CareerPremiumPurchaseState.error);
      return;
    }
    if (_processingEvidence == purchaseToken) return;
    _processingEvidence = purchaseToken;
    _verificationRetryPurchase = purchase;
    _verifiedGooglePurchaseProduct = product;
    _verifiedGooglePurchaseTarget = target;
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
      final settlesInactiveGoogleProfile =
          platform == CareerPremiumStorePlatform.googlePlay &&
          _verifiedGooglePurchaseTarget != null &&
          _verifiedGooglePurchaseTarget != _activeBirthProfileId();
      if (entitlementRefresher.eligibilityState !=
              CareerEligibilityState.eligible &&
          !settlesInactiveGoogleProfile) {
        _setState(CareerPremiumPurchaseState.error);
        return;
      }
      final purchase = _verifiedPurchasePendingCompletion;
      if (purchase?.pendingCompletePurchase == true) {
        final googleProduct = _verifiedGooglePurchaseProduct;
        if (platform == CareerPremiumStorePlatform.googlePlay &&
            (googleProduct?.logicalSku == careerProfileUnlockLogicalSku ||
                (googleProduct != null && _isAddOnProduct(googleProduct)))) {
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
        _googlePurchaseProducts.remove(purchase.serverVerificationData);
        if (platform == CareerPremiumStorePlatform.apple) {
          _applePurchaseTargets.remove(purchase.serverVerificationData);
          await pendingApplePurchaseStore?.clear();
          _pendingApplePurchase = null;
        }
      }
      _setState(CareerPremiumPurchaseState.success);
      _verifiedGooglePurchaseProduct = null;
      _verifiedGooglePurchaseTarget = null;
      _purchaseAttemptActive = false;
    } catch (_) {
      _setState(CareerPremiumPurchaseState.refreshFailed);
    }
  }

  void _setState(CareerPremiumPurchaseState state) {
    if (_disposed) return;
    if (kDebugMode && debugLocalStoreKitEntitlementSession?.enabled == true) {
      debugPrint('LOCAL_STOREKIT_DEBUG state=$_state->$state');
    }
    _state = state;
    notifyListeners();
  }

  void _onEntitlementScopeChanged() {
    debugLocalStoreKitEntitlementSession?.synchronizeAuthenticatedSubject(
      _activeAuthenticatedSubject(),
    );
    if (debugLocalStoreKitEntitlementSession?.enabled == true) {
      final active = hasLocalDebugEntitlement;
      if (active && _state != CareerPremiumPurchaseState.success) {
        _state = CareerPremiumPurchaseState.success;
      } else if (!active && _state == CareerPremiumPurchaseState.success) {
        _state = CareerPremiumPurchaseState.idle;
      }
    }
    if (!_disposed) notifyListeners();
  }

  void _debugLocalStoreKitEvent({
    required StorePurchaseUpdate purchase,
    DebugStoreKitTransactionClassification? classification,
    required String branch,
  }) {
    final session = debugLocalStoreKitEntitlementSession;
    if (!kDebugMode || session == null) return;
    final environment = classification?.environment.name ?? 'unknown';
    debugPrint(
      'LOCAL_STOREKIT_DEBUG '
      'status=${purchase.status.name} '
      'productId=${purchase.productId} '
      'dedupeKey=${session.debugDedupeKey(purchase)} '
      'environment=$environment '
      'localSeam=${session.enabled ? 'enabled' : 'disabled'} '
      'branch=$branch',
    );
  }

  void _debugPurchaseLifecycle(String message) {
    if (!kDebugMode) return;
    debugPrint(message);
  }

  /// Emits only local, bounded native purchase diagnostics. In particular it
  /// never prints signed StoreKit data, receipts, account data, or arbitrary
  /// platform detail objects.
  void _debugPurchaseCallException(CareerPremiumProduct product, Object error) {
    if (!kDebugMode) return;
    final platform = error is PlatformException ? error : null;
    debugPrint(
      'PURCHASE_CALL_EXCEPTION '
      'productId=${product.storeProductId} '
      'exceptionType=${error.runtimeType} '
      'exceptionCode=${platform?.code ?? 'none'} '
      'exceptionMessage=${_safeNativeExceptionText(platform?.message)} '
      'exceptionDetails=${_safeNativeExceptionDetails(platform?.details)}',
    );
  }

  String _safeNativeExceptionText(String? value) {
    if (value == null || value.isEmpty) return 'none';
    // Native StoreKit messages are normally short text. Reject structured or
    // oversized values rather than risking a receipt/token being logged.
    final safe = RegExp(r'^[A-Za-z0-9 _.,:;()\-]{1,240}$');
    return safe.hasMatch(value) ? value : 'redacted';
  }

  String _safeNativeExceptionDetails(Object? value) {
    if (value == null) return 'none';
    if (value is bool || value is num) return '$value';
    if (value is String) return _safeNativeExceptionText(value);
    return 'redacted:${value.runtimeType}';
  }

  void _trackFailure(String category) {
    if (!_purchaseAttemptActive) return;
    _purchaseAttemptActive = false;
    unawaited(
      _analytics.track(AnalyticsEvent.purchaseFailed, {
        'failure_category': category,
        'payment_provider': platform.name,
        'product_type': 'career_premium',
      }),
    );
  }

  @override
  void dispose() {
    _disposed = true;
    _entitlementScope?.removeListener(_onEntitlementScopeChanged);
    productController.removeListener(_onProductControllerChanged);
    _debugPurchaseLifecycle('PURCHASE_STREAM_DISPOSE');
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
        debugLocalStoreKitEntitlementSession: ref.watch(
          debugLocalStoreKitEntitlementSessionProvider,
        ),
        pendingApplePurchaseStore: SecurePendingApplePurchaseStore(
          ref.watch(secureStateStoreProvider),
        ),
        platform: scope.$4,
        activeBirthProfileId: () => scope.$2.activeBirthProfileId,
        activeAuthenticatedSubject: () => scope.$2.activeAuthenticatedSubject,
        currentPurchaseMode: () => scope.$2.purchaseMode,
        backendPurchaseMode: () => scope.$2.backendPurchaseMode,
        entitlementScope: scope.$2,
        analytics: ref.watch(analyticsProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });
