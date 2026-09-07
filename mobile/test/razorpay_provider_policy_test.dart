import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';

AppConfig _config({String? razorpayKeyId, bool enabled = false}) =>
    AppConfig.test(
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-anon-key',
      apiBaseUrl: 'https://api.example.test',
      careerPremiumAnnualAppleProductId: 'apple.product',
      careerPremiumAnnualGoogleProductId: 'google.product',
      razorpayKeyId: razorpayKeyId,
      razorpayCareerPremiumEnabled: enabled,
    );

void main() {
  test('Razorpay is disabled when the feature flag is false', () {
    final config = _config(razorpayKeyId: 'rzp_test_public', enabled: false);

    expect(config.isRazorpayCareerPremiumEligible, isFalse);
  });

  test('Razorpay is disabled when the public key is missing', () {
    final config = _config(enabled: true);

    expect(config.isRazorpayCareerPremiumEligible, isFalse);
  });

  test('Razorpay is enabled only with policy and public key', () {
    final config = _config(razorpayKeyId: 'rzp_test_public', enabled: true);

    expect(config.isRazorpayCareerPremiumEligible, isTrue);
  });

  test('Apple and Google product configuration is independent', () {
    final config = _config(razorpayKeyId: 'rzp_test_public', enabled: false);

    expect(config.careerPremiumAnnualAppleProductId, 'apple.product');
    expect(config.careerPremiumAnnualGoogleProductId, 'google.product');
    expect(config.isRazorpayCareerPremiumEligible, isFalse);
  });
}
