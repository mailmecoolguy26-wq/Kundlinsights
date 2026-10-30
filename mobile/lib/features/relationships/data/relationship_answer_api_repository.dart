import '../../../core/api/api_client.dart';
import '../domain/relationship_answer.dart';
import '../domain/relationship_answer_repository.dart';

class RelationshipAnswerApiRepository implements RelationshipAnswerRepository {
  const RelationshipAnswerApiRepository(this._client);

  final ApiClient _client;

  @override
  Future<RelationshipAnswer> getAnswer({
    required String birthProfileId,
    required RelationshipIntent intent,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/relationship-answers',
      data: {'intent': intent.wire},
    );
    final raw = response.data is Map<String, dynamic>
        ? response.data!['relationshipAnswer']
        : null;
    if (raw is! Map<String, dynamic>) {
      throw const FormatException(
        'Malformed Relationship Answer API response.',
      );
    }
    return RelationshipAnswer.fromJson(raw);
  }
}
