enum AuthStatus { initializing, unauthenticated, authenticated, loading, error }

class AuthSnapshot {
  const AuthSnapshot(this.status, {this.subject, this.message});
  final AuthStatus status;

  /// Verified Supabase subject used only to scope in-memory client state.
  ///
  /// This is not a backend application-user identifier and never contains a
  /// token or claims payload.
  final String? subject;
  final String? message;
}

abstract interface class AuthRepository {
  Stream<AuthSnapshot> get states;
  Future<AuthSnapshot> restore();
  Future<void> signIn({required String email, required String password});
  Future<bool> signUp({required String email, required String password});
  Future<void> signOut();
  Future<String?> accessToken();
  Future<String?> refreshAccessToken();
}
