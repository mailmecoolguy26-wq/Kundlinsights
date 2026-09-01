class AppConfig {
  const AppConfig._({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
    this.careerPremiumAnnualAppleProductId,
    this.applePaymentEnvironment,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;
  final String? careerPremiumAnnualAppleProductId;
  final String? applePaymentEnvironment;

  /// Test-only construction; production configuration is build-time only.
  const AppConfig.test({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
    this.careerPremiumAnnualAppleProductId,
    this.applePaymentEnvironment,
  });

  static AppConfig? fromEnvironment() {
    const url = String.fromEnvironment('SUPABASE_URL');
    const key = String.fromEnvironment('SUPABASE_ANON_KEY');
    const api = String.fromEnvironment('API_BASE_URL');
    const appleProductId = String.fromEnvironment(
      'APPLE_CAREER_PREMIUM_ANNUAL_PRODUCT_ID',
    );
    const applePaymentEnvironment = String.fromEnvironment(
      'APPLE_PAYMENT_ENVIRONMENT',
    );
    if (url.isEmpty || key.isEmpty || api.isEmpty) return null;
    final supabase = Uri.tryParse(url);
    final base = Uri.tryParse(api);
    final usesAcceptedApiBaseUrl = base != null && isAcceptedApiBaseUrl(base);
    if (supabase == null ||
        base == null ||
        !supabase.hasScheme ||
        !base.hasScheme ||
        !usesAcceptedApiBaseUrl) {
      return null;
    }
    return AppConfig._(
      supabaseUrl: url,
      supabaseAnonKey: key,
      apiBaseUrl: api,
      careerPremiumAnnualAppleProductId: appleProductId.isEmpty
          ? null
          : appleProductId,
      applePaymentEnvironment:
          applePaymentEnvironment == 'SANDBOX' ||
              applePaymentEnvironment == 'PRODUCTION'
          ? applePaymentEnvironment
          : null,
    );
  }

  /// Allows TLS endpoints everywhere and loopback endpoints only for local
  /// development. `10.0.2.2` is Android Emulator's host-machine loopback.
  static bool isAcceptedApiBaseUrl(Uri base) {
    if (base.scheme == 'https') return true;
    return (base.scheme == 'http' || base.scheme == 'https') &&
        const {'localhost', '127.0.0.1', '10.0.2.2'}.contains(base.host);
  }
}
