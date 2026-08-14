enum AuthStatus { initializing, unauthenticated, authenticated, loading, error }

class AuthSnapshot {
  const AuthSnapshot(this.status, {this.message});
  final AuthStatus status;
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
