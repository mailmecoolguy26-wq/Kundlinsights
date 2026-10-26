import '../../../core/api/api_client.dart';
import '../career_decision_controller.dart';
import '../domain/career_decision.dart';

class CareerDecisionApiRepository implements CareerDecisionRepository {
  const CareerDecisionApiRepository(this.client);
  final ApiClient client;
  @override
  Future<CareerDecision> submit({
    required String birthProfileId,
    required Map<String, Object?> context,
  }) async {
    final response = await client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/career-decisions',
      data: {'decisionType': 'JOB_OFFER', 'context': context},
    );
    final data = response.data?['careerDecision'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Decision response.');
    }
    return CareerDecision.fromJson(data);
  }
}
