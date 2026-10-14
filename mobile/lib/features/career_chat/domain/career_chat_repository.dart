import 'career_chat.dart';

abstract interface class CareerChatRepository {
  Future<CareerChatResponse> send({
    required String birthProfileId,
    required CareerChatRequest request,
  });
  Future<TaraConversationSummary> createConversation({
    required String birthProfileId,
  });
  Future<List<TaraConversationSummary>> listConversations({
    required String birthProfileId,
  });
  Future<TaraConversationDetail> getConversation({
    required String birthProfileId,
    required String conversationId,
  });
  Future<TaraConversationDetail> sendConversationMessage({
    required String birthProfileId,
    required String conversationId,
    required String message,
    required CareerChatLanguage language,
  });
}

class UnavailableCareerChatRepository implements CareerChatRepository {
  const UnavailableCareerChatRepository();

  @override
  Future<CareerChatResponse> send({
    required String birthProfileId,
    required CareerChatRequest request,
  }) => Future<CareerChatResponse>.error(
    StateError('Configuration is required.'),
  );
  @override
  Future<TaraConversationSummary> createConversation({
    required String birthProfileId,
  }) => Future.error(StateError('Configuration is required.'));
  @override
  Future<List<TaraConversationSummary>> listConversations({
    required String birthProfileId,
  }) => Future.error(StateError('Configuration is required.'));
  @override
  Future<TaraConversationDetail> getConversation({
    required String birthProfileId,
    required String conversationId,
  }) => Future.error(StateError('Configuration is required.'));
  @override
  Future<TaraConversationDetail> sendConversationMessage({
    required String birthProfileId,
    required String conversationId,
    required String message,
    required CareerChatLanguage language,
  }) => Future.error(StateError('Configuration is required.'));
}
