class AppConfig {
  const AppConfig._({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
  });

  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;

  /// Test-only construction; production configuration is build-time only.
  const AppConfig.test({
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
  });

  static AppConfig? fromEnvironment() {
    const url = String.fromEnvironment('SUPABASE_URL');
    const key = String.fromEnvironment('SUPABASE_ANON_KEY');
    const api = String.fromEnvironment('API_BASE_URL');
    if (url.isEmpty || key.isEmpty || api.isEmpty) return null;
    final supabase = Uri.tryParse(url);
    final base = Uri.tryParse(api);
    final usesHttpsOrLocalhost =
        base != null &&
        (base.scheme == 'https' ||
            base.host == 'localhost' ||
            base.host == '127.0.0.1');
    if (supabase == null ||
        base == null ||
        !supabase.hasScheme ||
        !base.hasScheme ||
        !usesHttpsOrLocalhost) {
      return null;
    }
    return AppConfig._(supabaseUrl: url, supabaseAnonKey: key, apiBaseUrl: api);
  }
}
