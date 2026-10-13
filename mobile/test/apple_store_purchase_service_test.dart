import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/domain/career_premium_product.dart';

const _productId = 'com.kundlinsights.career.premium.annual';
const _profileUnlockProductId = 'com.taraverse.career.profile.unlock';
const _primarySixMonthProductId = 'com.taraverse.career.premium.6month';
const _primaryTwelveMonthProductId = 'com.taraverse.career.premium.12month';
const _addOnSixMonthProductId = 'com.taraverse.career.addon.6month';
const _addOnTwelveMonthProductId = 'com.taraverse.career.addon.12month';

void main() {
  test('uses StoreKit-required auto-consumption only on iOS', () {
    expect(shouldAutoConsumeForStorePlatform(TargetPlatform.iOS), isTrue);
    expect(shouldAutoConsumeForStorePlatform(TargetPlatform.android), isFalse);
  });

  test(
    'maps the configured StoreKit product into normalized available state',
    () async {
      final client = _StoreClient(
        products: const [
          StoreProductDetails(
            id: _productId,
            title: 'Career Premium',
            description: 'Annual access',
            localizedPrice: '₹499.00',
            rawPrice: 499,
            currencyCode: 'INR',
          ),
        ],
      );
      final service = AppleStorePurchaseService(
        client: client,
        careerPremiumAnnualAppleProductId: _productId,
      );
      final result = await service.loadCareerPremiumProduct();

      expect(result.state, CareerPremiumProductLoadState.available);
      expect(result.product?.logicalSku, careerPremiumAnnualLogicalSku);
      expect(result.product?.storeProductId, _productId);
      expect(result.product?.title, 'Career Premium');
      expect(result.product?.description, 'Annual access');
      expect(result.product?.localizedPrice, '₹499.00');
      expect(result.product?.rawPrice, 499);
      expect(result.product?.currencyCode, 'INR');
      expect(client.availabilityChecks, 1);
      expect(client.queries, [_productId]);
    },
  );

  test('controller exposes loading then normalized available state', () async {
    final controller = CareerPremiumProductController(
      AppleStorePurchaseService(
        client: _StoreClient(
          products: const [
            StoreProductDetails(
              id: _productId,
              title: 'Career Premium',
              description: 'Annual access',
              localizedPrice: r'$4.99',
              rawPrice: 4.99,
              currencyCode: 'USD',
            ),
          ],
        ),
        careerPremiumAnnualAppleProductId: _productId,
      ),
    );
    final states = <CareerPremiumProductLoadState>[];
    controller.addListener(() => states.add(controller.state));

    await controller.load();

    expect(states, [
      CareerPremiumProductLoadState.loading,
      CareerPremiumProductLoadState.available,
    ]);
    expect(controller.product?.localizedPrice, r'$4.99');
    controller.dispose();
  });

  test('uses the configured Apple profile unlock as a consumable', () async {
    final client = _StoreClient(
      products: const [
        StoreProductDetails(
          id: _profileUnlockProductId,
          title: 'Career profile unlock',
          description: 'One profile',
          localizedPrice: '₹499.00',
          rawPrice: 499,
          currencyCode: 'INR',
        ),
      ],
    );
    final service = AppleStorePurchaseService(
      client: client,
      careerPremiumAnnualAppleProductId: null,
      careerProfileUnlockAppleProductId: _profileUnlockProductId,
    );
    final result = await service.loadCareerPremiumProduct();

    expect(result.product?.logicalSku, appleCareerProfileUnlockLogicalSku);
    expect(await service.startCareerPremiumPurchase(result.product!), isTrue);
    expect(client.consumablePurchases, [_profileUnlockProductId]);
    expect(client.nonConsumablePurchases, isEmpty);
  });

  test('uses the exact loaded primary or add-on provider product', () async {
    final client = _StoreClient(
      products: const [
        StoreProductDetails(
          id: _primarySixMonthProductId,
          title: 'Primary six',
          description: '',
          localizedPrice: '₹399',
          rawPrice: 399,
          currencyCode: 'INR',
        ),
        StoreProductDetails(
          id: _primaryTwelveMonthProductId,
          title: 'Primary twelve',
          description: '',
          localizedPrice: '₹599',
          rawPrice: 599,
          currencyCode: 'INR',
        ),
        StoreProductDetails(
          id: _addOnSixMonthProductId,
          title: 'Add-on six',
          description: '',
          localizedPrice: '₹399',
          rawPrice: 399,
          currencyCode: 'INR',
        ),
        StoreProductDetails(
          id: _addOnTwelveMonthProductId,
          title: 'Add-on twelve',
          description: '',
          localizedPrice: '₹599',
          rawPrice: 599,
          currencyCode: 'INR',
        ),
      ],
    );
    final service = AppleStorePurchaseService(
      client: client,
      careerPremiumAnnualAppleProductId: null,
      careerPremium6MonthAppleProductId: _primarySixMonthProductId,
      careerPremium12MonthAppleProductId: _primaryTwelveMonthProductId,
      careerPremiumAddOn6MonthAppleProductId: _addOnSixMonthProductId,
      careerPremiumAddOn12MonthAppleProductId: _addOnTwelveMonthProductId,
    );

    final primary = await service.loadCareerPremiumProduct();
    final addOn = await service.loadCareerPremiumProduct(purchaseMode: 'ADDON');
    final primarySix = primary.products.singleWhere(
      (product) => product.logicalSku == careerPremium6MonthLogicalSku,
    );
    final primaryTwelve = primary.products.singleWhere(
      (product) => product.logicalSku == careerPremium12MonthLogicalSku,
    );
    final addOnSix = addOn.products.singleWhere(
      (product) => product.logicalSku == careerPremiumAddOn6MonthLogicalSku,
    );
    final addOnTwelve = addOn.products.singleWhere(
      (product) => product.logicalSku == careerPremiumAddOn12MonthLogicalSku,
    );

    expect(await service.startCareerPremiumPurchase(primarySix), isTrue);
    expect(await service.startCareerPremiumPurchase(primaryTwelve), isTrue);
    expect(await service.startCareerPremiumPurchase(addOnSix), isTrue);
    expect(await service.startCareerPremiumPurchase(addOnTwelve), isTrue);
    expect(client.nonConsumablePurchases, [
      _primarySixMonthProductId,
      _primaryTwelveMonthProductId,
    ]);
    expect(client.consumablePurchases, [
      _addOnSixMonthProductId,
      _addOnTwelveMonthProductId,
    ]);
  });

  test('handles unavailable store, missing configuration, and product not found safely', () async {
    final unavailable = await AppleStorePurchaseService(
      client: _StoreClient(available: false),
      careerPremiumAnnualAppleProductId: _productId,
    ).loadCareerPremiumProduct();
    final missingConfiguration = await AppleStorePurchaseService(
      client: _StoreClient(),
      careerPremiumAnnualAppleProductId: null,
    ).loadCareerPremiumProduct();
    final notFound = await AppleStorePurchaseService(
      client: _StoreClient(notFoundIds: const {_productId}),
      careerPremiumAnnualAppleProductId: _productId,
    ).loadCareerPremiumProduct();

    expect(unavailable.state, CareerPremiumProductLoadState.unavailable);
    expect(
      missingConfiguration.state,
      CareerPremiumProductLoadState.unavailable,
    );
    expect(notFound.state, CareerPremiumProductLoadState.unavailable);
  });

  test(
    'handles query errors and rejects unexpected product identities',
    () async {
      final queryError = await AppleStorePurchaseService(
        client: _StoreClient(errorMessage: 'Store unavailable'),
        careerPremiumAnnualAppleProductId: _productId,
      ).loadCareerPremiumProduct();
      final unexpected = await AppleStorePurchaseService(
        client: _StoreClient(
          products: const [
            StoreProductDetails(
              id: 'another.product',
              title: 'Unexpected',
              description: '',
              localizedPrice: '1',
              rawPrice: 1,
              currencyCode: 'USD',
            ),
          ],
        ),
        careerPremiumAnnualAppleProductId: _productId,
      ).loadCareerPremiumProduct();
      final throws = await AppleStorePurchaseService(
        client: _StoreClient(throwsOnQuery: true),
        careerPremiumAnnualAppleProductId: _productId,
      ).loadCareerPremiumProduct();

      expect(queryError.state, CareerPremiumProductLoadState.error);
      expect(unexpected.state, CareerPremiumProductLoadState.error);
      expect(throws.state, CareerPremiumProductLoadState.error);
    },
  );
}

class _StoreClient
    implements StorePurchaseClient, ConsumableStorePurchaseClient {
  _StoreClient({
    this.available = true,
    this.products = const [],
    this.notFoundIds = const {},
    this.errorMessage,
    this.throwsOnQuery = false,
  });

  final bool available;
  final List<StoreProductDetails> products;
  final Set<String> notFoundIds;
  final String? errorMessage;
  final bool throwsOnQuery;
  int availabilityChecks = 0;
  final List<String> queries = [];
  final List<String> consumablePurchases = [];
  final List<String> nonConsumablePurchases = [];

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => const Stream.empty();

  @override
  Future<bool> buyNonConsumable(String productId) async {
    nonConsumablePurchases.add(productId);
    return true;
  }

  @override
  Future<bool> buyConsumable(String productId) async {
    consumablePurchases.add(productId);
    return true;
  }

  @override
  Future<void> restorePurchases() async {}

  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {}

  @override
  Future<bool> isAvailable() async {
    availabilityChecks++;
    return available;
  }

  @override
  Future<StoreProductQueryResult> queryProductDetails(
    Set<String> productIds,
  ) async {
    queries.addAll(productIds);
    if (throwsOnQuery) throw StateError('query failed');
    return StoreProductQueryResult(
      products: products,
      notFoundIds: notFoundIds,
      errorMessage: errorMessage,
    );
  }
}
