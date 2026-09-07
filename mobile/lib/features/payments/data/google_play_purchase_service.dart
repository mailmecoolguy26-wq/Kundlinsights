import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/career_premium_product.dart';
import 'apple_store_purchase_service.dart';
import 'career_premium_product_loader.dart';

const careerProfileUnlockLogicalSku = 'career_profile_unlock';

class GooglePlayPurchaseService implements CareerPremiumProductLoader {
  GooglePlayPurchaseService({
    required this.client,
    required this.careerPremiumAnnualGoogleProductId,
    this.careerProfileUnlockGoogleProductId,
  });

  final StorePurchaseClient client;
  final String? careerPremiumAnnualGoogleProductId;
  final String? careerProfileUnlockGoogleProductId;
  final Set<String> _completedEvidence = {};

  Stream<StorePurchaseUpdate> get purchaseUpdates => client.purchaseUpdates;

  bool isConfiguredProductId(String productId) =>
      productId == careerPremiumAnnualGoogleProductId ||
      productId == careerProfileUnlockGoogleProductId;

  bool wasCompleted(StorePurchaseUpdate purchase) =>
      _completedEvidence.contains(purchase.serverVerificationData);

  Future<void> completePurchaseOnce(StorePurchaseUpdate purchase) async {
    final evidence = purchase.serverVerificationData;
    if (evidence.isEmpty || _completedEvidence.contains(evidence)) return;
    await client.completePurchase(purchase);
    _completedEvidence.add(evidence);
  }

  Future<void> consumePurchaseOnce(StorePurchaseUpdate purchase) async {
    final evidence = purchase.serverVerificationData;
    if (evidence.isEmpty || _completedEvidence.contains(evidence)) return;
    await (client as dynamic).consumePurchase(purchase);
    _completedEvidence.add(evidence);
  }

  Future<bool> startCareerPremiumPurchase(CareerPremiumProduct product) async {
    final productId = product.logicalSku == careerProfileUnlockLogicalSku
        ? careerProfileUnlockGoogleProductId
        : careerPremiumAnnualGoogleProductId;
    if (productId == null ||
        productId.isEmpty ||
        !{
          careerProfileUnlockLogicalSku,
          careerPremiumAnnualLogicalSku,
        }.contains(product.logicalSku) ||
        product.storeProductId != productId) {
      return false;
    }
    if (product.logicalSku == careerProfileUnlockLogicalSku) {
      return (client as dynamic).buyConsumable(productId) as Future<bool>;
    }
    return client.buyNonConsumable(productId);
  }

  Future<void> restorePurchases() => client.restorePurchases();

  @override
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct() async {
    final productId =
        careerProfileUnlockGoogleProductId ??
        careerPremiumAnnualGoogleProductId;
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
          logicalSku: productId == careerProfileUnlockGoogleProductId
              ? careerProfileUnlockLogicalSku
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
}

final googlePlayPurchaseServiceProvider = Provider<GooglePlayPurchaseService?>(
  (ref) => null,
);
