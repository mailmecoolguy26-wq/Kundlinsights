import '../domain/career_premium_product.dart';

abstract interface class CareerPremiumProductLoader {
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct({
    String? purchaseMode,
  });
}

enum CareerPremiumStorePlatform { apple, googlePlay, razorpay }

CareerPremiumProductLoader selectCareerPremiumProductLoader({
  required CareerPremiumStorePlatform platform,
  required CareerPremiumProductLoader apple,
  required CareerPremiumProductLoader googlePlay,
}) => platform == CareerPremiumStorePlatform.googlePlay ? googlePlay : apple;

class CareerPremiumProductLoadResult {
  const CareerPremiumProductLoadResult._(
    this.state, {
    this.products = const [],
  });
  CareerPremiumProductLoadResult.available(CareerPremiumProduct product)
    : this._(CareerPremiumProductLoadState.available, products: [product]);
  const CareerPremiumProductLoadResult.availablePlans(
    List<CareerPremiumProduct> products,
  ) : this._(CareerPremiumProductLoadState.available, products: products);
  const CareerPremiumProductLoadResult.unavailable()
    : this._(CareerPremiumProductLoadState.unavailable);
  const CareerPremiumProductLoadResult.error()
    : this._(CareerPremiumProductLoadState.error);

  final CareerPremiumProductLoadState state;
  final List<CareerPremiumProduct> products;
  CareerPremiumProduct? get product => products.isEmpty ? null : products.first;
}
