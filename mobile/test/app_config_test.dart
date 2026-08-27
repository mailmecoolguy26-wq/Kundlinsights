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
}
