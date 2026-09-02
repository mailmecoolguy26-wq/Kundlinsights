import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_product_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/career_premium_product_loader.dart';
import 'package:kundlinsights_mobile/features/payments/data/google_play_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/domain/career_premium_product.dart';

const _googleProductId = 'career_premium_annual_google';

void main() {
  test(
    'maps the configured Google Play subscription into normalized metadata',
    () async {
      final client = _StoreClient(
        products: const [
          StoreProductDetails(
            id: _googleProductId,
            title: 'Career Premium',
            description: 'Annual subscription',
            localizedPrice: '₹499.00',
            rawPrice: 499,
            currencyCode: 'INR',
          ),
        ],
      );
      final result = await GooglePlayPurchaseService(
        client: client,
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ).loadCareerPremiumProduct();

      expect(result.state, CareerPremiumProductLoadState.available);
      expect(result.product?.logicalSku, careerPremiumAnnualLogicalSku);
      expect(result.product?.storeProductId, _googleProductId);
      expect(result.product?.title, 'Career Premium');
      expect(result.product?.description, 'Annual subscription');
      expect(result.product?.localizedPrice, '₹499.00');
      expect(result.product?.rawPrice, 499);
      expect(result.product?.currencyCode, 'INR');
      expect(client.queries, [_googleProductId]);
      expect(client.purchaseCalls, 0);
      expect(client.restoreCalls, 0);
    },
  );

  test(
    'handles unavailable billing, missing config, and missing product safely',
    () async {
      final unavailable = await GooglePlayPurchaseService(
        client: _StoreClient(available: false),
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ).loadCareerPremiumProduct();
      final missingConfig = await GooglePlayPurchaseService(
        client: _StoreClient(),
        careerPremiumAnnualGoogleProductId: null,
      ).loadCareerPremiumProduct();
      final missingProduct = await GooglePlayPurchaseService(
        client: _StoreClient(notFoundIds: const {_googleProductId}),
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ).loadCareerPremiumProduct();

      expect(unavailable.state, CareerPremiumProductLoadState.unavailable);
      expect(missingConfig.state, CareerPremiumProductLoadState.unavailable);
      expect(missingProduct.state, CareerPremiumProductLoadState.unavailable);
    },
  );

  test(
    'handles query failures and rejects unexpected Google product IDs',
    () async {
      final queryFailure = await GooglePlayPurchaseService(
        client: _StoreClient(throwsOnQuery: true),
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ).loadCareerPremiumProduct();
      final unexpected = await GooglePlayPurchaseService(
        client: _StoreClient(
          products: const [
            StoreProductDetails(
              id: 'different.product',
              title: 'Different',
              description: '',
              localizedPrice: r'$1.00',
              rawPrice: 1,
              currencyCode: 'USD',
            ),
          ],
        ),
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ).loadCareerPremiumProduct();

      expect(queryFailure.state, CareerPremiumProductLoadState.error);
      expect(unexpected.state, CareerPremiumProductLoadState.error);
    },
  );

  test('the shared controller normalizes either platform loader', () async {
    final android = CareerPremiumProductController(
      GooglePlayPurchaseService(
        client: _StoreClient(products: const [_googleProduct]),
        careerPremiumAnnualGoogleProductId: _googleProductId,
      ),
    );
    final ios = CareerPremiumProductController(
      AppleStorePurchaseService(
        client: _StoreClient(products: const [_appleProduct]),
        careerPremiumAnnualAppleProductId: 'career_premium_annual_apple',
      ),
    );

    await android.load();
    await ios.load();
    expect(android.product?.logicalSku, careerPremiumAnnualLogicalSku);
    expect(ios.product?.logicalSku, careerPremiumAnnualLogicalSku);
    android.dispose();
    ios.dispose();
  });

  test(
    'platform selection chooses Google Play on Android and Apple elsewhere',
    () async {
      final apple = GooglePlayPurchaseService(
        client: _StoreClient(),
        careerPremiumAnnualGoogleProductId: null,
      );
      final google = GooglePlayPurchaseService(
        client: _StoreClient(),
        careerPremiumAnnualGoogleProductId: null,
      );

      expect(
        selectCareerPremiumProductLoader(
          platform: CareerPremiumStorePlatform.googlePlay,
          apple: apple,
          googlePlay: google,
        ),
        same(google),
      );
      expect(
        selectCareerPremiumProductLoader(
          platform: CareerPremiumStorePlatform.apple,
          apple: apple,
          googlePlay: google,
        ),
        same(apple),
      );
    },
  );
}

const _googleProduct = StoreProductDetails(
  id: _googleProductId,
  title: 'Google Career',
  description: '',
  localizedPrice: '₹549.00',
  rawPrice: 549,
  currencyCode: 'INR',
);
const _appleProduct = StoreProductDetails(
  id: 'career_premium_annual_apple',
  title: 'Apple Career',
  description: '',
  localizedPrice: r'$4.99',
  rawPrice: 4.99,
  currencyCode: 'USD',
);

class _StoreClient implements StorePurchaseClient {
  _StoreClient({
    this.available = true,
    this.products = const [],
    this.notFoundIds = const {},
    this.throwsOnQuery = false,
  });

  final bool available;
  final List<StoreProductDetails> products;
  final Set<String> notFoundIds;
  final bool throwsOnQuery;
  final queries = <String>[];
  int purchaseCalls = 0;
  int restoreCalls = 0;

  @override
  Future<bool> isAvailable() async => available;
  @override
  Stream<StorePurchaseUpdate> get purchaseUpdates => const Stream.empty();
  @override
  Future<StoreProductQueryResult> queryProductDetails(
    Set<String> productIds,
  ) async {
    queries.addAll(productIds);
    if (throwsOnQuery) throw StateError('query failed');
    return StoreProductQueryResult(
      products: products,
      notFoundIds: notFoundIds,
    );
  }

  @override
  Future<bool> buyNonConsumable(String productId) async {
    purchaseCalls++;
    return false;
  }

  @override
  Future<void> restorePurchases() async => restoreCalls++;
  @override
  Future<void> completePurchase(StorePurchaseUpdate purchase) async {}
}
