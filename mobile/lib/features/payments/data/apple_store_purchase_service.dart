import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import 'career_premium_product_loader.dart';
import '../domain/career_premium_product.dart';

const careerPremiumAnnualLogicalSku = 'career_premium_annual';
const appleCareerProfileUnlockLogicalSku = 'career_profile_unlock';

class StoreProductDetails {
  const StoreProductDetails({
    required this.id,
    required this.title,
    required this.description,
    required this.localizedPrice,
    required this.rawPrice,
    required this.currencyCode,
  });

  final String id;
  final String title;
  final String description;
  final String localizedPrice;
  final double rawPrice;
  final String currencyCode;
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
            ),
          )
          .toList(growable: false),
      notFoundIds: response.notFoundIDs.toSet(),
      errorMessage: response.error?.message,
    );
  }

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => _purchase.purchaseStream
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
    return _purchase.buyNonConsumable(
      purchaseParam: PurchaseParam(productDetails: product),
    );
  }

  @override
  Future<bool> buyConsumable(String productId) async {
    final product = _products[productId];
    if (product == null) return false;
    return _purchase.buyConsumable(
      purchaseParam: PurchaseParam(productDetails: product),
      autoConsume: false,
    );
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
    this.careerProfileUnlockAppleProductId,
  });

  final StorePurchaseClient client;
  final String? careerPremiumAnnualAppleProductId;
  final String? careerProfileUnlockAppleProductId;
  final Set<String> _completedEvidence = {};

  @override
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct() async {
    final profileUnlock = careerProfileUnlockAppleProductId;
    final productId = profileUnlock?.isNotEmpty == true
        ? profileUnlock
        : careerPremiumAnnualAppleProductId;
    if (productId == null || productId.isEmpty) {
      return const CareerPremiumProductLoadResult.unavailable();
    }
    try {
      if (!await client.isAvailable()) {
        return const CareerPremiumProductLoadResult.unavailable();
      }
      final result = await client.queryProductDetails({productId});
      if (result.errorMessage != null ||
          result.notFoundIds.contains(productId)) {
        return const CareerPremiumProductLoadResult.unavailable();
      }
      final matches = result.products.where(
        (product) => product.id == productId,
      );
      if (matches.length != 1) {
        return const CareerPremiumProductLoadResult.error();
      }
      final product = matches.single;
      return CareerPremiumProductLoadResult.available(
        CareerPremiumProduct(
          logicalSku: profileUnlock?.isNotEmpty == true
              ? appleCareerProfileUnlockLogicalSku
              : careerPremiumAnnualLogicalSku,
          storeProductId: product.id,
          title: product.title,
          description: product.description,
          localizedPrice: product.localizedPrice,
          rawPrice: product.rawPrice,
          currencyCode: product.currencyCode,
        ),
      );
    } catch (_) {
      return const CareerPremiumProductLoadResult.error();
    }
  }

  Stream<StorePurchaseUpdate> get purchaseUpdates => client.purchaseUpdates;

  Future<bool> startCareerPremiumPurchase(CareerPremiumProduct product) async {
    final profileUnlock = careerProfileUnlockAppleProductId;
    final expectedProductId = profileUnlock?.isNotEmpty == true
        ? profileUnlock
        : careerPremiumAnnualAppleProductId;
    if (expectedProductId == null ||
        expectedProductId.isEmpty ||
        product.logicalSku !=
            (profileUnlock?.isNotEmpty == true
                ? appleCareerProfileUnlockLogicalSku
                : careerPremiumAnnualLogicalSku) ||
        product.storeProductId != expectedProductId) {
      return false;
    }
    if (profileUnlock?.isNotEmpty == true &&
        client is ConsumableStorePurchaseClient) {
      return (client as ConsumableStorePurchaseClient).buyConsumable(
        expectedProductId,
      );
    }
    return profileUnlock?.isNotEmpty == true
        ? false
        : client.buyNonConsumable(expectedProductId);
  }

  bool wasCompleted(StorePurchaseUpdate purchase) =>
      _completedEvidence.contains(purchase.serverVerificationData);

  Future<void> completePurchaseOnce(StorePurchaseUpdate purchase) async {
    final evidence = purchase.serverVerificationData;
    if (evidence.isEmpty || _completedEvidence.contains(evidence)) return;
    await client.completePurchase(purchase);
    _completedEvidence.add(evidence);
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
