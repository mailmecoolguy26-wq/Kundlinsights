import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';

import 'career_premium_product_loader.dart';
import '../domain/career_premium_product.dart';

const careerPremiumAnnualLogicalSku = 'career_premium_annual';
const careerPremium6MonthLogicalSku = 'career_premium_6_month';
const careerPremium12MonthLogicalSku = 'career_premium_12_month';
const careerPremiumAddOn6MonthLogicalSku = 'career_premium_addon_6_month';
const careerPremiumAddOn12MonthLogicalSku = 'career_premium_addon_12_month';
const appleCareerProfileUnlockLogicalSku = 'career_profile_unlock';

@visibleForTesting
bool shouldAutoConsumeForStorePlatform(TargetPlatform platform) =>
    platform == TargetPlatform.iOS;

class StoreProductDetails {
  const StoreProductDetails({
    required this.id,
    required this.title,
    required this.description,
    required this.localizedPrice,
    required this.rawPrice,
    required this.currencyCode,
    this.subscriptionPeriod,
  });

  final String id;
  final String title;
  final String description;
  final String localizedPrice;
  final double rawPrice;
  final String currencyCode;
  final StoreSubscriptionPeriod? subscriptionPeriod;
}

class StoreProductQueryResult {
  const StoreProductQueryResult({
    required this.products,
    required this.notFoundIds,
    this.errorMessage,
  });

  final List<StoreProductDetails> products;
  final Set<String> notFoundIds;
  final String? errorMessage;
}

enum StorePurchaseStatus { pending, purchased, restored, error, canceled }

class StorePurchaseUpdate {
  const StorePurchaseUpdate({
    required this.productId,
    required this.status,
    required this.serverVerificationData,
    required this.pendingCompletePurchase,
    this.transactionId,
    this.nativePurchase,
  });

  final String productId;
  final StorePurchaseStatus status;
  final String serverVerificationData;
  final bool pendingCompletePurchase;
  final String? transactionId;
  final Object? nativePurchase;
}

abstract interface class StorePurchaseClient {
  Future<bool> isAvailable();
  Future<StoreProductQueryResult> queryProductDetails(Set<String> productIds);
  Stream<StorePurchaseUpdate> get purchaseUpdates;
  Future<bool> buyNonConsumable(String productId);
  Future<void> restorePurchases();
  Future<void> completePurchase(StorePurchaseUpdate purchase);
}

abstract interface class ConsumableStorePurchaseClient {
  Future<bool> buyConsumable(String productId);
}

class InAppPurchaseStorePurchaseClient
    implements StorePurchaseClient, ConsumableStorePurchaseClient {
  InAppPurchaseStorePurchaseClient(this._purchase);
  final InAppPurchase _purchase;
  final Map<String, ProductDetails> _products = {};

  @override
  Future<bool> isAvailable() => _purchase.isAvailable();

  @override
  Future<StoreProductQueryResult> queryProductDetails(
    Set<String> productIds,
  ) async {
    final response = await _purchase.queryProductDetails(productIds);
    _products
      ..clear()
      ..addEntries(
        response.productDetails.map((product) => MapEntry(product.id, product)),
      );
    return StoreProductQueryResult(
      products: response.productDetails
          .map(
            (product) => StoreProductDetails(
              id: product.id,
              title: product.title,
              description: product.description,
              localizedPrice: product.price,
              rawPrice: product.rawPrice,
              currencyCode: product.currencyCode,
              subscriptionPeriod: _subscriptionPeriod(product),
            ),
          )
          .toList(growable: false),
      notFoundIds: response.notFoundIDs.toSet(),
      errorMessage: response.error?.message,
    );
  }

  StoreSubscriptionPeriod? _subscriptionPeriod(ProductDetails product) {
    if (product is AppStoreProductDetails) {
      final period = product.skProduct.subscriptionPeriod;
      return period == null
          ? null
          : _period(value: period.numberOfUnits, unit: period.unit.name);
    }
    if (product is AppStoreProduct2Details) {
      final period = product.sk2Product.subscription?.subscriptionPeriod;
      return period == null
          ? null
          : _period(value: period.value, unit: period.unit.name);
    }
    return null;
  }

  StoreSubscriptionPeriod? _period({required int value, required String unit}) {
    if (value <= 0) return null;
    final mapped = switch (unit) {
      'day' => StoreSubscriptionPeriodUnit.day,
      'week' => StoreSubscriptionPeriodUnit.week,
      'month' => StoreSubscriptionPeriodUnit.month,
      'year' => StoreSubscriptionPeriodUnit.year,
      _ => null,
    };
    return mapped == null
        ? null
        : StoreSubscriptionPeriod(value: value, unit: mapped);
  }

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => _purchase.purchaseStream
      .map((purchases) {
        if (kDebugMode) {
          debugPrint('PURCHASE_STREAM_EVENT count=${purchases.length}');
        }
        return purchases;
      })
      .expand((purchases) => purchases)
      .map(
        (purchase) => StorePurchaseUpdate(
          productId: purchase.productID,
          status: switch (purchase.status) {
            PurchaseStatus.pending => StorePurchaseStatus.pending,
            PurchaseStatus.purchased => StorePurchaseStatus.purchased,
            PurchaseStatus.restored => StorePurchaseStatus.restored,
            PurchaseStatus.error => StorePurchaseStatus.error,
            PurchaseStatus.canceled => StorePurchaseStatus.canceled,
          },
          serverVerificationData:
              purchase.verificationData.serverVerificationData,
          pendingCompletePurchase: purchase.pendingCompletePurchase,
          transactionId: purchase.purchaseID,
          nativePurchase: purchase,
        ),
      );

  @override
  Future<bool> buyNonConsumable(String productId) async {
    final product = _products[productId];
    if (product == null) return false;
    _debugProductDetails(product);
    return _purchase.buyNonConsumable(
      purchaseParam: PurchaseParam(productDetails: product),
    );
  }

  @override
  Future<bool> buyConsumable(String productId) async {
    final product = _products[productId];
    if (product == null) return false;
    _debugProductDetails(product);
    try {
      return await _purchase.buyConsumable(
        purchaseParam: PurchaseParam(productDetails: product),
        // The StoreKit implementation asserts that consumables use automatic
        // consumption. Google Play retains its existing manual-consumption
        // behavior through the false Android value and consumePurchaseOnce.
        autoConsume: shouldAutoConsumeForStorePlatform(defaultTargetPlatform),
      );
    } catch (error, stackTrace) {
      if (kDebugMode) {
        final platformError = error is PlatformException ? error : null;
        debugPrint(
          'PURCHASE_CALL_EXCEPTION '
          'productId=${product.id} '
          'exceptionType=${error.runtimeType} '
          'exceptionCode=${platformError?.code ?? 'none'} '
          'exceptionMessage=${_safeExceptionText(platformError?.message)} '
          'exceptionDetails=${_safeExceptionText(platformError?.details?.toString())}',
        );
        debugPrint('PURCHASE_CALL_STACK\n$stackTrace');
      }
      rethrow;
    }
  }

  void _debugProductDetails(ProductDetails product) {
    if (!kDebugMode) return;
    debugPrint(
      'PURCHASE_PRODUCT_DETAILS '
      'id=${product.id} runtimeType=${product.runtimeType} price=${product.price}',
    );
  }

  String _safeExceptionText(String? value) {
    if (value == null || value.trim().isEmpty) return 'none';
    // Native StoreKit error text is diagnostic-only; bound it to avoid
    // accidentally emitting opaque payload-like values in debug logs.
    final normalized = value.replaceAll(RegExp(r'\s+'), ' ').trim();
    return normalized.length <= 200 ? normalized : normalized.substring(0, 200);
  }

  Future<void> consumePurchase(StorePurchaseUpdate purchase) async {
    final nativePurchase = purchase.nativePurchase;
    if (nativePurchase is! PurchaseDetails) {
      throw StateError('Invalid Google Play purchase.');
    }
    await _purchase
        .getPlatformAddition<InAppPurchaseAndroidPlatformAddition>()
        .consumePurchase(nativePurchase);
  }

  @override
  Future<void> restorePurchases() => _purchase.restorePurchases();

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) {
    final nativePurchase = purchase.nativePurchase;
    if (nativePurchase is! PurchaseDetails) {
      return Future.error(StateError('Invalid StoreKit purchase.'));
    }
    return _purchase.completePurchase(nativePurchase);
  }
}

class AppleStorePurchaseService implements CareerPremiumProductLoader {
  AppleStorePurchaseService({
    required this.client,
    required this.careerPremiumAnnualAppleProductId,
    this.careerPremium6MonthAppleProductId,
    this.careerPremium12MonthAppleProductId,
    this.careerPremiumAddOn6MonthAppleProductId,
    this.careerPremiumAddOn12MonthAppleProductId,
    this.careerProfileUnlockAppleProductId,
  });

  final StorePurchaseClient client;
  final String? careerPremiumAnnualAppleProductId;
  final String? careerPremium6MonthAppleProductId;
  final String? careerPremium12MonthAppleProductId;
  final String? careerPremiumAddOn6MonthAppleProductId;
  final String? careerPremiumAddOn12MonthAppleProductId;
  final String? careerProfileUnlockAppleProductId;
  final Set<String> _completedPurchaseKeys = {};

  @override
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct({
    String? purchaseMode,
  }) async {
    final primaryIds = [
      careerPremium6MonthAppleProductId,
      careerPremium12MonthAppleProductId,
      careerPremiumAnnualAppleProductId,
    ].whereType<String>().where((id) => id.isNotEmpty).toSet();
    final addOnIds = [
      careerPremiumAddOn6MonthAppleProductId,
      careerPremiumAddOn12MonthAppleProductId,
    ].whereType<String>().where((id) => id.isNotEmpty).toSet();
    final recurringIds = purchaseMode == 'ADDON' ? addOnIds : primaryIds;
    // A retained pre-subscription client may still need to recover its old
    // profile unlock. New app wiring always supplies recurring plan IDs.
    final ids =
        recurringIds.isEmpty &&
            careerProfileUnlockAppleProductId != null &&
            careerProfileUnlockAppleProductId!.isNotEmpty
        ? {careerProfileUnlockAppleProductId!}
        : recurringIds;
    if (ids.isEmpty) {
      return const CareerPremiumProductLoadResult.unavailable();
    }
    try {
      if (!await client.isAvailable()) {
        return const CareerPremiumProductLoadResult.unavailable();
      }
      final result = await client.queryProductDetails(ids);
      if (result.errorMessage != null) {
        return const CareerPremiumProductLoadResult.error();
      }
      final products = result.products
          .where((product) => ids.contains(product.id))
          .map(
            (product) => CareerPremiumProduct(
              logicalSku: product.id == careerPremium6MonthAppleProductId
                  ? careerPremium6MonthLogicalSku
                  : product.id == careerPremium12MonthAppleProductId
                  ? careerPremium12MonthLogicalSku
                  : product.id == careerProfileUnlockAppleProductId
                  ? appleCareerProfileUnlockLogicalSku
                  : product.id == careerPremiumAddOn6MonthAppleProductId
                  ? careerPremiumAddOn6MonthLogicalSku
                  : product.id == careerPremiumAddOn12MonthAppleProductId
                  ? careerPremiumAddOn12MonthLogicalSku
                  : careerPremiumAnnualLogicalSku,
              storeProductId: product.id,
              title: product.title,
              description: product.description,
              localizedPrice: product.localizedPrice,
              rawPrice: product.rawPrice,
              currencyCode: product.currencyCode,
              subscriptionPeriod: product.subscriptionPeriod,
            ),
          )
          .toList(growable: false);
      return products.isEmpty
          ? result.products.isEmpty
                ? const CareerPremiumProductLoadResult.unavailable()
                : const CareerPremiumProductLoadResult.error()
          : CareerPremiumProductLoadResult.availablePlans(products);
    } catch (_) {
      return const CareerPremiumProductLoadResult.error();
    }
  }

  Stream<StorePurchaseUpdate> get purchaseUpdates => client.purchaseUpdates;

  Future<bool> startCareerPremiumPurchase(CareerPremiumProduct product) async {
    final expectedProductId = switch (product.logicalSku) {
      careerPremium6MonthLogicalSku => careerPremium6MonthAppleProductId,
      careerPremium12MonthLogicalSku => careerPremium12MonthAppleProductId,
      careerPremiumAddOn6MonthLogicalSku =>
        careerPremiumAddOn6MonthAppleProductId,
      careerPremiumAddOn12MonthLogicalSku =>
        careerPremiumAddOn12MonthAppleProductId,
      appleCareerProfileUnlockLogicalSku => careerProfileUnlockAppleProductId,
      _ => careerPremiumAnnualAppleProductId,
    };
    if (expectedProductId == null ||
        expectedProductId.isEmpty ||
        !{
          careerPremium6MonthLogicalSku,
          careerPremium12MonthLogicalSku,
          careerPremiumAddOn6MonthLogicalSku,
          careerPremiumAddOn12MonthLogicalSku,
          careerPremiumAnnualLogicalSku,
          appleCareerProfileUnlockLogicalSku,
        }.contains(product.logicalSku) ||
        product.storeProductId != expectedProductId) {
      return false;
    }
    return {
              appleCareerProfileUnlockLogicalSku,
              careerPremiumAddOn6MonthLogicalSku,
              careerPremiumAddOn12MonthLogicalSku,
            }.contains(product.logicalSku) &&
            client is ConsumableStorePurchaseClient
        ? (client as ConsumableStorePurchaseClient).buyConsumable(
            expectedProductId,
          )
        : client.buyNonConsumable(expectedProductId);
  }

  bool wasCompleted(StorePurchaseUpdate purchase) =>
      _completedPurchaseKeys.contains(_completionKey(purchase));

  /// Returns true only when this call invoked and completed the native
  /// StoreKit finish operation. Callers use that result for their own
  /// completion bookkeeping; entitlement handling is deliberately separate.
  Future<bool> completePurchaseOnce(StorePurchaseUpdate purchase) async {
    final key = _completionKey(purchase);
    if (key == null || _completedPurchaseKeys.contains(key)) return false;
    await client.completePurchase(purchase);
    _completedPurchaseKeys.add(key);
    return true;
  }

  /// StoreKit can use the same signed verification payload shape for distinct
  /// local transactions. Completion must therefore be transaction-scoped
  /// whenever the platform provides a transaction identifier; evidence remains
  /// the conservative fallback for older store clients that do not.
  String? _completionKey(StorePurchaseUpdate purchase) {
    final transactionId = purchase.transactionId?.trim();
    if (transactionId != null && transactionId.isNotEmpty) {
      return '${purchase.productId}:transaction:$transactionId';
    }
    final evidence = purchase.serverVerificationData;
    return evidence.isEmpty ? null : '${purchase.productId}:evidence:$evidence';
  }

  Future<void> restorePurchases() => client.restorePurchases();
}

final appleStorePurchaseServiceProvider = Provider<AppleStorePurchaseService>(
  (ref) => AppleStorePurchaseService(
    client: const _UnavailableStorePurchaseClient(),
    careerPremiumAnnualAppleProductId: null,
    careerProfileUnlockAppleProductId: null,
  ),
);

class _UnavailableStorePurchaseClient implements StorePurchaseClient {
  const _UnavailableStorePurchaseClient();

  @override
  Future<bool> isAvailable() async => false;

  @override
  Future<StoreProductQueryResult> queryProductDetails(Set<String> productIds) =>
      Future.error(StateError('StoreKit is unavailable.'));

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => const Stream.empty();

  @override
  Future<bool> buyNonConsumable(String productId) async => false;
  @override
  Future<void> restorePurchases() =>
      Future.error(StateError('StoreKit is unavailable.'));

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) =>
      Future.error(StateError('StoreKit is unavailable.'));
}
