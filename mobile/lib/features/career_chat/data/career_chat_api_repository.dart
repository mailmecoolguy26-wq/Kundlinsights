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

  String _path(String profileId) =>
      '/v1/birth-profiles/${Uri.encodeComponent(profileId)}/tara/conversations';

  @override
  Future<TaraConversationSummary> createConversation({
    required String birthProfileId,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      _path(birthProfileId),
      data: const {},
    );
    final item = response.data?['conversation'];
    if (item is! Map<String, dynamic>) {
      throw const FormatException('Malformed Tara conversation.');
    }
    return TaraConversationSummary.fromJson(item);
  }

  @override
  Future<List<TaraConversationSummary>> listConversations({
    required String birthProfileId,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      _path(birthProfileId),
    );
    final values = response.data?['conversations'];
    if (values is! List) {
      throw const FormatException('Malformed Tara conversations.');
    }
    return values
        .whereType<Map>()
        .map(
          (item) =>
              TaraConversationSummary.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
  }

  @override
  Future<TaraConversationDetail> getConversation({
    required String birthProfileId,
    required String conversationId,
  }) async {
    final response = await _client.get<Map<String, dynamic>>(
      '${_path(birthProfileId)}/${Uri.encodeComponent(conversationId)}',
    );
    return _detail(response.data);
  }

  @override
  Future<TaraConversationDetail> sendConversationMessage({
    required String birthProfileId,
    required String conversationId,
    required String message,
    required CareerChatLanguage language,
  }) async {
    await _client.post<Map<String, dynamic>>(
      '${_path(birthProfileId)}/${Uri.encodeComponent(conversationId)}/messages',
      data: {
        'message': message,
        'language': language == CareerChatLanguage.hinglish
            ? 'HINGLISH'
            : 'ENGLISH',
      },
    );
    // The endpoint returns message pair; reload keeps the client chronology canonical.
    return getConversation(
      birthProfileId: birthProfileId,
      conversationId: conversationId,
    );
  }

  TaraConversationDetail _detail(Map<String, dynamic>? data) {
    final conversation = data?['conversation'];
    final messages = data?['messages'];
    if (conversation is! Map<String, dynamic> || messages is! List) {
      throw const FormatException('Malformed Tara conversation detail.');
    }
    return TaraConversationDetail(
      conversation: TaraConversationSummary.fromJson(conversation),
      messages: messages
          .whereType<Map>()
          .map(
            (item) => TaraConversationMessage.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false),
    );
  }
}
