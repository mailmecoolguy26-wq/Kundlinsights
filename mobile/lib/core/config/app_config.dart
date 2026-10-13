class AppConfig {
  const AppConfig._({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
    this.careerPremiumAnnualAppleProductId,
    this.careerPremium6MonthAppleProductId,
    this.careerPremium12MonthAppleProductId,
    this.careerPremiumAddOn6MonthAppleProductId,
    this.careerPremiumAddOn12MonthAppleProductId,
    this.careerProfileUnlockAppleProductId,
    this.careerPremiumAnnualGoogleProductId,
    this.careerPremium6MonthGoogleProductId,
    this.careerPremium12MonthGoogleProductId,
    this.careerPremiumAddOn6MonthGoogleProductId,
    this.careerPremiumAddOn12MonthGoogleProductId,
    this.careerProfileUnlockGoogleProductId,
    this.applePaymentEnvironment,
    this.razorpayKeyId,
    this.razorpayCareerPremiumEnabled = false,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;
  final String? careerPremiumAnnualAppleProductId;
  final String? careerPremium6MonthAppleProductId;
  final String? careerPremium12MonthAppleProductId;
  final String? careerPremiumAddOn6MonthAppleProductId;
  final String? careerPremiumAddOn12MonthAppleProductId;
  final String? careerProfileUnlockAppleProductId;
  final String? careerPremiumAnnualGoogleProductId;
  final String? careerPremium6MonthGoogleProductId;
  final String? careerPremium12MonthGoogleProductId;
  final String? careerPremiumAddOn6MonthGoogleProductId;
  final String? careerPremiumAddOn12MonthGoogleProductId;
  final String? careerProfileUnlockGoogleProductId;
  final String? applePaymentEnvironment;
  final String? razorpayKeyId;
  final bool razorpayCareerPremiumEnabled;

  /// Razorpay is opt-in: both the public checkout key and feature policy are
  /// required. Apple and Google selection remain independent of this policy.
  bool get isRazorpayCareerPremiumEligible =>
      razorpayKeyId != null && razorpayCareerPremiumEnabled;

  /// Test-only construction; production configuration is build-time only.
  const AppConfig.test({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
    this.careerPremiumAnnualAppleProductId,
    this.careerPremium6MonthAppleProductId,
    this.careerPremium12MonthAppleProductId,
    this.careerPremiumAddOn6MonthAppleProductId,
    this.careerPremiumAddOn12MonthAppleProductId,
    this.careerProfileUnlockAppleProductId,
    this.careerPremiumAnnualGoogleProductId,
    this.careerPremium6MonthGoogleProductId,
    this.careerPremium12MonthGoogleProductId,
    this.careerPremiumAddOn6MonthGoogleProductId,
    this.careerPremiumAddOn12MonthGoogleProductId,
    this.careerProfileUnlockGoogleProductId,
    this.applePaymentEnvironment,
    this.razorpayKeyId,
    this.razorpayCareerPremiumEnabled = false,
  });

  static AppConfig? fromEnvironment() {
    const url = String.fromEnvironment('SUPABASE_URL');
    const key = String.fromEnvironment('SUPABASE_ANON_KEY');
    const api = String.fromEnvironment('API_BASE_URL');
    const appleProductId = String.fromEnvironment(
      'APPLE_CAREER_PREMIUM_ANNUAL_PRODUCT_ID',
    );
    const apple6MonthProductId = String.fromEnvironment(
      'APPLE_CAREER_PREMIUM_6_MONTH_PRODUCT_ID',
    );
    const apple12MonthProductId = String.fromEnvironment(
      'APPLE_CAREER_PREMIUM_12_MONTH_PRODUCT_ID',
    );
    const appleProfileUnlockProductId = String.fromEnvironment(
      'APPLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID',
    );
    const appleAddOn6MonthProductId = String.fromEnvironment(
      'APPLE_CAREER_PREMIUM_ADDON_6_MONTH_PRODUCT_ID',
    );
    const appleAddOn12MonthProductId = String.fromEnvironment(
      'APPLE_CAREER_PREMIUM_ADDON_12_MONTH_PRODUCT_ID',
    );
    const googleProductId = String.fromEnvironment(
      'GOOGLE_CAREER_PREMIUM_ANNUAL_PRODUCT_ID',
    );
    const google6MonthProductId = String.fromEnvironment(
      'GOOGLE_CAREER_PREMIUM_6_MONTH_PRODUCT_ID',
    );
    const google12MonthProductId = String.fromEnvironment(
      'GOOGLE_CAREER_PREMIUM_12_MONTH_PRODUCT_ID',
    );
    const googleProfileUnlockProductId = String.fromEnvironment(
      'GOOGLE_CAREER_PROFILE_UNLOCK_PRODUCT_ID',
    );
    const googleAddOn6MonthProductId = String.fromEnvironment(
      'GOOGLE_CAREER_PREMIUM_ADDON_6_MONTH_PRODUCT_ID',
    );
    const googleAddOn12MonthProductId = String.fromEnvironment(
      'GOOGLE_CAREER_PREMIUM_ADDON_12_MONTH_PRODUCT_ID',
    );
    const applePaymentEnvironment = String.fromEnvironment(
      'APPLE_PAYMENT_ENVIRONMENT',
    );
    const razorpayKeyId = String.fromEnvironment('RAZORPAY_KEY_ID');
    const razorpayCareerPremiumEnabled = bool.fromEnvironment(
      'RAZORPAY_CAREER_PREMIUM_ENABLED',
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
      careerPremium6MonthAppleProductId: apple6MonthProductId.isEmpty
          ? null
          : apple6MonthProductId,
      careerPremium12MonthAppleProductId: apple12MonthProductId.isEmpty
          ? null
          : apple12MonthProductId,
      careerPremiumAddOn6MonthAppleProductId: appleAddOn6MonthProductId.isEmpty
          ? null
          : appleAddOn6MonthProductId,
      careerPremiumAddOn12MonthAppleProductId:
          appleAddOn12MonthProductId.isEmpty
          ? null
          : appleAddOn12MonthProductId,
      careerProfileUnlockAppleProductId: appleProfileUnlockProductId.isEmpty
          ? null
          : appleProfileUnlockProductId,
      careerPremiumAnnualGoogleProductId: googleProductId.isEmpty
          ? null
          : googleProductId,
      careerPremium6MonthGoogleProductId: google6MonthProductId.isEmpty
          ? null
          : google6MonthProductId,
      careerPremium12MonthGoogleProductId: google12MonthProductId.isEmpty
          ? null
          : google12MonthProductId,
      careerPremiumAddOn6MonthGoogleProductId:
          googleAddOn6MonthProductId.isEmpty
          ? null
          : googleAddOn6MonthProductId,
      careerPremiumAddOn12MonthGoogleProductId:
          googleAddOn12MonthProductId.isEmpty
          ? null
          : googleAddOn12MonthProductId,
      careerProfileUnlockGoogleProductId: googleProfileUnlockProductId.isEmpty
          ? null
          : googleProfileUnlockProductId,
      applePaymentEnvironment:
          applePaymentEnvironment == 'SANDBOX' ||
              applePaymentEnvironment == 'PRODUCTION'
          ? applePaymentEnvironment
          : null,
      razorpayKeyId: razorpayKeyId.isEmpty ? null : razorpayKeyId,
      razorpayCareerPremiumEnabled: razorpayCareerPremiumEnabled,
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
