import '../../../core/api/api_client.dart';
import '../domain/career_answer.dart';
import '../domain/career_answer_repository.dart';

class CareerAnswerApiRepository implements CareerAnswerRepository {
  const CareerAnswerApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<CareerAnswer> getAnswer({
    required String birthProfileId,
    required CareerQuestionType questionType,
    String? readingId,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/career-answers',
      data: {
        'questionType': questionType.wireName,
        'readingId': ?readingId,
      },
    );
    final data = response.data;
    final answer = data is Map<String, dynamic> ? data['careerAnswer'] : null;
    if (answer is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Answer API response.');
    }
    return CareerAnswer.fromJson(answer);
  }
}
