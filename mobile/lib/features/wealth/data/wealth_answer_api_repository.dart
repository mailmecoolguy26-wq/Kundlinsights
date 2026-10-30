import '../../../core/api/api_client.dart';
import '../domain/wealth_answer.dart';
import '../domain/wealth_answer_repository.dart';

class WealthAnswerApiRepository implements WealthAnswerRepository {
  const WealthAnswerApiRepository(this._client);
  final ApiClient _client;
  @override
  Future<WealthAnswer> getAnswer({required String birthProfileId, required WealthIntent intent}) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/wealth-answers',
      data: {'intent': intent.wire},
    );
    final raw = response.data is Map<String, dynamic> ? response.data!['wealthAnswer'] : null;
    if (raw is! Map<String, dynamic>) throw const FormatException('Malformed Wealth Answer API response.');
    return WealthAnswer.fromJson(raw);
  }
}
