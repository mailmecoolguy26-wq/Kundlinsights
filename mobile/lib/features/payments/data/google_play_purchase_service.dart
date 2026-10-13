import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/career_premium_product.dart';
import 'apple_store_purchase_service.dart';
import 'career_premium_product_loader.dart';

const careerProfileUnlockLogicalSku = 'career_profile_unlock';
const careerPremium6MonthGoogleLogicalSku = 'career_premium_6_month';
const careerPremium12MonthGoogleLogicalSku = 'career_premium_12_month';
const careerPremiumAddOn6MonthGoogleLogicalSku = 'career_premium_addon_6_month';
const careerPremiumAddOn12MonthGoogleLogicalSku =
    'career_premium_addon_12_month';

class GooglePlayPurchaseService implements CareerPremiumProductLoader {
  GooglePlayPurchaseService({
    required this.client,
    required this.careerPremiumAnnualGoogleProductId,
    this.careerPremium6MonthGoogleProductId,
    this.careerPremium12MonthGoogleProductId,
    this.careerPremiumAddOn6MonthGoogleProductId,
    this.careerPremiumAddOn12MonthGoogleProductId,
    this.careerProfileUnlockGoogleProductId,
  });

  final StorePurchaseClient client;
  final String? careerPremiumAnnualGoogleProductId;
  final String? careerPremium6MonthGoogleProductId;
  final String? careerPremium12MonthGoogleProductId;
  final String? careerPremiumAddOn6MonthGoogleProductId;
  final String? careerPremiumAddOn12MonthGoogleProductId;
  final String? careerProfileUnlockGoogleProductId;
  final Set<String> _completedEvidence = {};

  Stream<StorePurchaseUpdate> get purchaseUpdates => client.purchaseUpdates;

  bool isConfiguredProductId(String productId) =>
      productId == careerPremiumAnnualGoogleProductId ||
      productId == careerPremium6MonthGoogleProductId ||
      productId == careerPremium12MonthGoogleProductId ||
      productId == careerPremiumAddOn6MonthGoogleProductId ||
      productId == careerPremiumAddOn12MonthGoogleProductId ||
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
    final productId = product.logicalSku == careerPremium6MonthGoogleLogicalSku
        ? careerPremium6MonthGoogleProductId
        : product.logicalSku == careerPremium12MonthGoogleLogicalSku
        ? careerPremium12MonthGoogleProductId
        : product.logicalSku == careerPremiumAddOn6MonthGoogleLogicalSku
        ? careerPremiumAddOn6MonthGoogleProductId
        : product.logicalSku == careerPremiumAddOn12MonthGoogleLogicalSku
        ? careerPremiumAddOn12MonthGoogleProductId
        : product.logicalSku == careerProfileUnlockLogicalSku
        ? careerProfileUnlockGoogleProductId
        : careerPremiumAnnualGoogleProductId;
    if (productId == null ||
        productId.isEmpty ||
        !{
          careerProfileUnlockLogicalSku,
          careerPremiumAnnualLogicalSku,
          careerPremium6MonthGoogleLogicalSku,
          careerPremium12MonthGoogleLogicalSku,
          careerPremiumAddOn6MonthGoogleLogicalSku,
          careerPremiumAddOn12MonthGoogleLogicalSku,
        }.contains(product.logicalSku) ||
        product.storeProductId != productId) {
      return false;
    }
    if ({
      careerProfileUnlockLogicalSku,
      careerPremiumAddOn6MonthGoogleLogicalSku,
      careerPremiumAddOn12MonthGoogleLogicalSku,
    }.contains(product.logicalSku)) {
      return (client as dynamic).buyConsumable(productId) as Future<bool>;
    }
    return client.buyNonConsumable(productId);
  }

  Future<void> restorePurchases() => client.restorePurchases();

  @override
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct({
    String? purchaseMode,
  }) async {
    final primaryIds = [
      careerPremium6MonthGoogleProductId,
      careerPremium12MonthGoogleProductId,
      careerPremiumAnnualGoogleProductId,
    ].whereType<String>().where((id) => id.isNotEmpty).toSet();
    final addOnIds = [
      careerPremiumAddOn6MonthGoogleProductId,
      careerPremiumAddOn12MonthGoogleProductId,
    ].whereType<String>().where((id) => id.isNotEmpty).toSet();
    final recurringIds = purchaseMode == 'ADDON' ? addOnIds : primaryIds;
    final ids =
        recurringIds.isEmpty &&
            careerProfileUnlockGoogleProductId != null &&
            careerProfileUnlockGoogleProductId!.isNotEmpty
        ? {careerProfileUnlockGoogleProductId!}
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
              logicalSku: product.id == careerPremium6MonthGoogleProductId
                  ? careerPremium6MonthGoogleLogicalSku
                  : product.id == careerPremium12MonthGoogleProductId
                  ? careerPremium12MonthGoogleLogicalSku
                  : product.id == careerProfileUnlockGoogleProductId
                  ? careerProfileUnlockLogicalSku
                  : product.id == careerPremiumAddOn6MonthGoogleProductId
                  ? careerPremiumAddOn6MonthGoogleLogicalSku
                  : product.id == careerPremiumAddOn12MonthGoogleProductId
                  ? careerPremiumAddOn12MonthGoogleLogicalSku
                  : careerPremiumAnnualLogicalSku,
              storeProductId: product.id,
              title: product.title,
              description: product.description,
              localizedPrice: product.localizedPrice,
              rawPrice: product.rawPrice,
              currencyCode: product.currencyCode,
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
}

final googlePlayPurchaseServiceProvider = Provider<GooglePlayPurchaseService?>(
  (ref) => null,
);
