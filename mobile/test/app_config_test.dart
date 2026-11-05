import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/core/config/app_config.dart';

void main() {
  test('accepts HTTPS and explicit simulator development API endpoints', () {
    expect(
      AppConfig.isAcceptedApiBaseUrl(Uri.parse('https://api.example.test')),
      isTrue,
    );
    expect(
      AppConfig.isAcceptedApiBaseUrl(Uri.parse('http://localhost:3000')),
      isTrue,
    );
    expect(
      AppConfig.isAcceptedApiBaseUrl(Uri.parse('http://127.0.0.1:3000')),
      isTrue,
    );
    expect(
      AppConfig.isAcceptedApiBaseUrl(Uri.parse('http://10.0.2.2:3000')),
      isTrue,
    );
    expect(
      AppConfig.isAcceptedApiBaseUrl(Uri.parse('http://api.example.test')),
      isFalse,
    );
  });

  test(
    'retains optional Apple and Google subscription product configuration',
    () {
      const config = AppConfig.test(
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'test-key',
        apiBaseUrl: 'https://api.example.test',
        careerPremiumAnnualAppleProductId: 'apple.annual',
        careerPremiumAnnualGoogleProductId: 'google.annual',
      );

      expect(config.careerPremiumAnnualAppleProductId, 'apple.annual');
      expect(config.careerPremiumAnnualGoogleProductId, 'google.annual');
    },
  );

  test(
    'rejects missing schemes, insecure production hosts, and relative URLs',
    () {
      for (final value in [
        'api.example.test',
        '/v1',
        'http://api.example.test',
      ]) {
        expect(
          () =>
              AppConfig.validateApiBaseUrl(value, allowLocalDevelopment: false),
          throwsFormatException,
        );
      }
      expect(
        AppConfig.validateApiBaseUrl(
          'https://api.example.test',
          allowLocalDevelopment: false,
        ).host,
        'api.example.test',
      );
      expect(
        AppConfig.validateApiBaseUrl(
          'http://10.0.2.2:3000',
          allowLocalDevelopment: true,
        ).host,
        '10.0.2.2',
      );
    },
  );
}
