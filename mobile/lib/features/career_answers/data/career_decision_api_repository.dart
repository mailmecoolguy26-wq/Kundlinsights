import '../../../core/api/api_client.dart';
import '../career_decision_controller.dart';
import '../domain/career_decision.dart';

class CareerDecisionApiRepository implements CareerDecisionRepository {
  const CareerDecisionApiRepository(this.client);
  final ApiClient client;
  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required String decisionType,
    required Map<String, Object?> context,
  }) async {
    final response = await client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/career-decisions',
      data: {'decisionType': decisionType, 'context': context},
    );
    final data = response.data?['careerDecision'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Decision response.');
    }
    return CareerDecision.fromJson(data);
  }

  @override
  Future<List<CareerDecisionSummary>> listDecisions({
    required String birthProfileId,
  }) async {
    final response = await client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/career-decisions',
    );
    final rows = response.data?['careerDecisions'];
    if (rows is! List) {
      throw const FormatException('Malformed Career Decision list response.');
    }
    return List.unmodifiable(
      rows.whereType<Map<String, dynamic>>().map(
        CareerDecisionSummary.fromJson,
      ),
    );
  }

  @override
  Future<CareerDecision> getDecision({
    required String birthProfileId,
    required String decisionId,
  }) async {
    final response = await client.get<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/career-decisions/${Uri.encodeComponent(decisionId)}',
    );
    final data = response.data?['careerDecision'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Decision detail response.');
    }
    return CareerDecision.fromJson(data);
  }
}
