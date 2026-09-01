import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/domain/career_premium_product.dart';

const _productId = 'com.kundlinsights.career.premium.annual';

void main() {
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

      expect(queryError.state, CareerPremiumProductLoadState.unavailable);
      expect(unexpected.state, CareerPremiumProductLoadState.error);
      expect(throws.state, CareerPremiumProductLoadState.error);
    },
  );
}

class _StoreClient implements StorePurchaseClient {
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

  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => const Stream.empty();

  @override
  Future<bool> buyNonConsumable(String productId) async => false;

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
