import '../domain/career_premium_product.dart';

abstract interface class CareerPremiumProductLoader {
  Future<CareerPremiumProductLoadResult> loadCareerPremiumProduct();
}

enum CareerPremiumStorePlatform { apple, googlePlay }

CareerPremiumProductLoader selectCareerPremiumProductLoader({
  required CareerPremiumStorePlatform platform,
  required CareerPremiumProductLoader apple,
  required CareerPremiumProductLoader googlePlay,
}) => platform == CareerPremiumStorePlatform.googlePlay ? googlePlay : apple;

class CareerPremiumProductLoadResult {
  const CareerPremiumProductLoadResult._(this.state, {this.product});
  const CareerPremiumProductLoadResult.available(CareerPremiumProduct product)
    : this._(CareerPremiumProductLoadState.available, product: product);
  const CareerPremiumProductLoadResult.unavailable()
    : this._(CareerPremiumProductLoadState.unavailable);
  const CareerPremiumProductLoadResult.error()
    : this._(CareerPremiumProductLoadState.error);

  final CareerPremiumProductLoadState state;
  final CareerPremiumProduct? product;
}
