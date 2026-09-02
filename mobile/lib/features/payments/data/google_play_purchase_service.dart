import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/career_premium_product.dart';
import 'apple_store_purchase_service.dart';
import 'career_premium_product_loader.dart';

class GooglePlayPurchaseService implements CareerPremiumProductLoader {
  GooglePlayPurchaseService({
    required this.client,
    required this.careerPremiumAnnualGoogleProductId,
  });

  final StorePurchaseClient client;
  final String? careerPremiumAnnualGoogleProductId;
  final Set<String> _completedEvidence = {};

  Stream<StorePurchaseUpdate> get purchaseUpdates => client.purchaseUpdates;

  bool isConfiguredProductId(String productId) =>
      productId == careerPremiumAnnualGoogleProductId;

  bool wasCompleted(StorePurchaseUpdate purchase) =>
      _completedEvidence.contains(purchase.serverVerificationData);

  Future<void> completePurchaseOnce(StorePurchaseUpdate purchase) async {
    final evidence = purchase.serverVerificationData;
    if (evidence.isEmpty || _completedEvidence.contains(evidence)) return;
    await client.completePurchase(purchase);
    _completedEvidence.add(evidence);
  }

  Future<bool> startCareerPremiumPurchase(CareerPremiumProduct product) async {
    final productId = careerPremiumAnnualGoogleProductId;
    if (productId == null ||
        productId.isEmpty ||
        product.logicalSku != careerPremiumAnnualLogicalSku ||
        product.storeProductId != productId) {
      return false;
    }
    return client.buyNonConsumable(productId);
  }

  @override
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct() async {
    final productId = careerPremiumAnnualGoogleProductId;
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
          logicalSku: careerPremiumAnnualLogicalSku,
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
