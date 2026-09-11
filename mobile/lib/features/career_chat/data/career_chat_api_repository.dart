import '../../../core/api/api_client.dart';
import '../domain/career_chat.dart';
import '../domain/career_chat_repository.dart';

class CareerChatApiRepository implements CareerChatRepository {
  const CareerChatApiRepository(this._client);
  final ApiClient _client;

  @override
  Future<CareerChatResponse> send({
    required String birthProfileId,
    required CareerChatRequest request,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '/v1/birth-profiles/${Uri.encodeComponent(birthProfileId)}/career-chat/messages',
      data: request.toJson(),
    );
    final data = response.data;
    final chat = data is Map<String, dynamic> ? data['careerChat'] : null;
    if (chat is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Chat API response.');
    }
    return CareerChatResponse.fromJson(chat);
  }
}
