import 'package:flutter/foundation.dart';

import '../../../core/api/api_client.dart';
import '../domain/career_chat.dart';
import '../domain/career_chat_repository.dart';

class CareerChatApiRepository implements CareerChatRepository {
  const CareerChatApiRepository(this._client);
  final ApiClient _client;

  void _debugAction(String prefix, Map<String, Object?> fields) {
    if (!kDebugMode) return;
    debugPrint(
      '$prefix ${fields.entries.map((entry) => '${entry.key}=${entry.value}').join(' ')}',
    );
  }

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
    return _detail(response.data, source: 'GET');
  }

  @override
  Future<TaraConversationDetail> sendConversationMessage({
    required String birthProfileId,
    required String conversationId,
    required String message,
    required CareerChatLanguage language,
  }) async {
    final response = await _client.post<Map<String, dynamic>>(
      '${_path(birthProfileId)}/${Uri.encodeComponent(conversationId)}/messages',
      data: {
        'message': message,
        'language': language == CareerChatLanguage.hinglish
            ? 'HINGLISH'
            : 'ENGLISH',
      },
    );
    // The endpoint returns the just-persisted pair, including allowlisted
    // server-authored actions. Reload to keep chronology canonical, but retain
    // that just-created action if a lagging history read does not yet return its
    // metadata. This never invents an action or changes its profile scope.
    final postedAssistant = response.data?['assistantMessage'];
    final rawMetadata = postedAssistant is Map
        ? postedAssistant['metadata']
        : null;
    final rawAction = postedAssistant is Map ? postedAssistant['action'] : null;
    _debugAction('TARA_ACTION_POST', {
      'assistantMessageId': postedAssistant is Map
          ? postedAssistant['messageId']
          : null,
      'assistantMessageMetadata': rawMetadata is Map
          ? rawMetadata
          : rawMetadata?.runtimeType,
      'assistantMessageAction': rawAction is Map
          ? rawAction
          : rawAction?.runtimeType,
    });
    final assistantId = postedAssistant is Map
        ? postedAssistant['messageId']
        : null;
    final action = postedAssistant is Map
        ? TaraConversationAction.fromJson(postedAssistant['action'])
        : null;
    final detail = await getConversation(
      birthProfileId: birthProfileId,
      conversationId: conversationId,
    );
    final result = assistantId is! String || action == null
        ? detail
        : TaraConversationDetail(
            conversation: detail.conversation,
            messages: detail.messages
                .map(
                  (item) => item.messageId != assistantId
                      ? item
                      : TaraConversationMessage(
                          messageId: item.messageId,
                          role: item.role,
                          content: item.content,
                          createdAt: item.createdAt,
                          action: item.action ?? action,
                        ),
                )
                .toList(growable: false),
          );
    for (final item in result.messages.where(
      (item) => item.role == CareerChatRole.assistant,
    )) {
      _debugAction('TARA_ACTION_REPOSITORY', {
        'messageId': item.messageId,
        'actionType': item.action?.type,
        'actionLabel': item.action?.label,
        'conversationBirthProfileId': result.conversation.birthProfileId,
      });
    }
    return result;
  }

  TaraConversationDetail _detail(
    Map<String, dynamic>? data, {
    required String source,
  }) {
    final conversation = data?['conversation'];
    final messages = data?['messages'];
    if (conversation is! Map<String, dynamic> || messages is! List) {
      throw const FormatException('Malformed Tara conversation detail.');
    }
    final parsedConversation = TaraConversationSummary.fromJson(conversation);
    final parsedMessages = messages
        .whereType<Map>()
        .map(
          (item) =>
              TaraConversationMessage.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
    for (final item in parsedMessages.where(
      (item) => item.role == CareerChatRole.assistant,
    )) {
      _debugAction('TARA_ACTION_DTO', {
        'source': source,
        'messageId': item.messageId,
        'actionType': item.action?.type,
        'actionLabel': item.action?.label,
        'conversationBirthProfileId': parsedConversation.birthProfileId,
      });
    }
    return TaraConversationDetail(
      conversation: parsedConversation,
      messages: parsedMessages,
    );
  }
}
