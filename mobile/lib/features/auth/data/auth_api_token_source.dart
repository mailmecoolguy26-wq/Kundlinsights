import '../../../core/api/api_client.dart';
import '../domain/auth_repository.dart';

/// Keeps backend bearer authentication coupled to the session repository only,
/// never to presentation or astrology features.
class AuthApiTokenSource implements AccessTokenSource {
  const AuthApiTokenSource(this._repository);

  final AuthRepository _repository;

  @override
  Future<String?> accessToken() => _repository.accessToken();

  @override
  Future<String?> refreshAccessToken() => _repository.refreshAccessToken();

  @override
  Future<void> invalidate() => _repository.signOut();
}
