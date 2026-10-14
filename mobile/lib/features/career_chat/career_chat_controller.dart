import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/analytics/analytics.dart';
import '../../core/errors/api_failure.dart';
import '../profiles/profile_controller.dart';
import '../readings/career_explanation_language.dart';
import 'domain/career_chat.dart';
import 'domain/career_chat_repository.dart';

class CareerChatMessage {
  CareerChatMessage.user(this.text, {this.birthProfileId})
    : role = CareerChatRole.user,
      response = null,
      action = null,
      messageId = null;
  CareerChatMessage.assistant(this.response, {this.birthProfileId})
    : role = CareerChatRole.assistant,
      text = response!.answer.headlineFact,
      action = null,
      messageId = null;
  CareerChatMessage.persisted({
    required this.messageId,
    required this.role,
    required this.text,
    required this.birthProfileId,
    this.action,
  }) : response = null;

  final String? messageId;
  final CareerChatRole role;
  final String text;
  final CareerChatResponse? response;
  final TaraConversationAction? action;
  final String? birthProfileId;
  bool failed = false;
}

final careerChatRepositoryProvider = Provider<CareerChatRepository>((ref) {
  throw UnimplementedError(
    'CareerChatRepository must be provided by bootstrap.',
  );
});

final careerChatControllerProvider =
    Provider.family<
      CareerChatController,
      (ProfileController, CareerExplanationLanguageController)
    >((ref, scope) {
      final controller = CareerChatController(
        ref.watch(careerChatRepositoryProvider),
        scope.$1,
        scope.$2,
        analytics: ref.watch(analyticsProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class CareerChatController extends ChangeNotifier {
  CareerChatController(
    this._repository,
    this._profiles,
    this._language, {
    Analytics? analytics,
  }) : _analytics = analytics ?? Analytics(const NoopAnalyticsProvider()) {
    _profiles.addListener(_onProfileChanged);
    _onProfileChanged();
  }

  final CareerChatRepository _repository;
  final ProfileController _profiles;
  final CareerExplanationLanguageController _language;
  final Analytics _analytics;
  final List<CareerChatMessage> _messages = [];
  String? _profileId;
  String? _conversationId;
  List<TaraConversationSummary> _conversations = const [];
  bool _sending = false;
  bool _disposed = false;
  ApiFailure? _failure;

  List<CareerChatMessage> get messages => List.unmodifiable(_messages);
  List<TaraConversationSummary> get conversations => _conversations;
  String? get conversationId => _conversationId;
  bool get isSending => _sending;
  bool get requiresPremium => _failure?.code == 'ENTITLEMENT_REQUIRED';
  bool get hasActiveProfile => _profiles.activeProfile != null;
  String? get activeProfileId => _profiles.activeProfile?.id;
  String? get activeProfileName => _profiles.activeProfile?.label;
  CareerChatLanguage get language =>
      _language.language == CareerExplanationLanguage.hinglish
      ? CareerChatLanguage.hinglish
      : CareerChatLanguage.english;

  bool canOpenCareerPremium(CareerChatMessage message) =>
      message.action?.type == 'OPEN_CAREER_PREMIUM' &&
      message.birthProfileId != null &&
      message.birthProfileId == _profiles.activeProfile?.id;

  Future<bool> send(String rawMessage) async {
    final message = rawMessage.trim();
    final profile = _profiles.activeProfile;
    if (_sending ||
        message.isEmpty ||
        message.length > 2000 ||
        profile == null) {
      return false;
    }
    _ensureProfile(profile.id);
    unawaited(
      _analytics.track(AnalyticsEvent.taraQuestionSent, {
        'birth_profile_id': profile.id,
        'source': 'ask_tara',
        'is_premium': true,
      }),
    );
    _failure = null;
    final priorMatchingUserMessages = _matchingUserMessages(message);
    final optimisticMessage = CareerChatMessage.user(
      message,
      birthProfileId: profile.id,
    );
    _messages.add(optimisticMessage);
    _sending = true;
    _debugSend('TARA_LOCAL_APPEND', profileId: profile.id);
    notifyListeners();
    try {
      final conversation = _conversationId == null
          ? await _repository.createConversation(birthProfileId: profile.id)
          : null;
      if (conversation != null) _conversationId = conversation.conversationId;
      _debugSend('TARA_API_SEND_START', profileId: profile.id);
      final detail = await _repository.sendConversationMessage(
        birthProfileId: profile.id,
        conversationId: _conversationId!,
        message: message,
        language: language,
      );
      if (_profiles.activeProfile?.id != profile.id) return false;
      _debugSend('TARA_STATE_BEFORE_RELOAD', profileId: profile.id);
      _apply(
        detail,
        optimisticMessage: optimisticMessage,
        priorMatchingUserMessages: priorMatchingUserMessages,
      );
      _debugSend('TARA_STATE_AFTER_RELOAD', profileId: profile.id);
      _debugSend('TARA_API_SEND_SUCCESS', profileId: profile.id);
      return true;
    } on ApiFailure catch (error) {
      if (_profiles.activeProfile?.id != profile.id) return false;
      _failure = error;
      optimisticMessage.failed = true;
      _debugSend('TARA_API_SEND_FAILURE', profileId: profile.id, error: error);
      notifyListeners();
      return false;
    } catch (error) {
      if (_profiles.activeProfile?.id != profile.id) return false;
      _failure = null;
      optimisticMessage.failed = true;
      _debugSend('TARA_API_SEND_FAILURE', profileId: profile.id, error: error);
      notifyListeners();
      return false;
    } finally {
      if (_profiles.activeProfile?.id == profile.id) {
        _sending = false;
        notifyListeners();
      }
    }
  }

  Future<void> retry(CareerChatMessage message) {
    if (!message.failed) return Future.value();
    _messages.remove(message);
    return send(message.text).then((_) {});
  }

  Future<void> loadHistory() async {
    final profile = _profiles.activeProfile;
    if (profile == null) return;
    _ensureProfile(profile.id);
    try {
      final conversations = await _repository.listConversations(
        birthProfileId: profile.id,
      );
      if (_disposed || _profiles.activeProfile?.id != profile.id) return;
      _conversations = conversations;
      notifyListeners();
    } catch (_) {
      // History is additive. A transient history load failure must not block
      // Home, profile switching, or the grounded chat flow.
      if (!_disposed && _profiles.activeProfile?.id == profile.id) {
        _conversations = const [];
        notifyListeners();
      }
    }
  }

  Future<void> openConversation(String id) async {
    final profile = _profiles.activeProfile;
    if (profile == null) return;
    _ensureProfile(profile.id);
    _apply(
      await _repository.getConversation(
        birthProfileId: profile.id,
        conversationId: id,
      ),
    );
    await loadHistory();
  }

  Future<void> refreshCurrentConversation() async {
    final id = _conversationId;
    if (id != null) await openConversation(id);
  }

  void startNewConversation() {
    _conversationId = null;
    _messages.clear();
    _failure = null;
    notifyListeners();
  }

  void _apply(
    TaraConversationDetail detail, {
    CareerChatMessage? optimisticMessage,
    int priorMatchingUserMessages = 0,
  }) {
    _conversationId = detail.conversation.conversationId;
    final persistedMessages = detail.messages
        .map(
          (item) => CareerChatMessage.persisted(
            messageId: item.messageId,
            role: item.role,
            text: item.content,
            birthProfileId: detail.conversation.birthProfileId,
            action: item.action,
          ),
        )
        .toList(growable: true);
    // The message POST is followed by a canonical history reload. Keep the
    // locally accepted user message if a lagging read has not included it yet.
    // Count prior matching messages so repeated identical questions are not
    // confused with the just-submitted one.
    if (optimisticMessage != null &&
        persistedMessages
                .where(
                  (item) =>
                      item.role == CareerChatRole.user &&
                      item.text == optimisticMessage.text,
                )
                .length <=
            priorMatchingUserMessages) {
      persistedMessages.add(optimisticMessage);
    }
    _messages
      ..clear()
      ..addAll(persistedMessages);
    if (kDebugMode) {
      for (final message in _messages.where(
        (message) => message.role == CareerChatRole.assistant,
      )) {
        debugPrint(
          'TARA_ACTION_CONTROLLER '
          'messageId=${message.messageId} '
          'actionType=${message.action?.type} '
          'actionLabel=${message.action?.label} '
          'birthProfileId=${message.birthProfileId}',
        );
      }
    }
  }

  void _onProfileChanged() {
    final id = _profiles.activeProfile?.id;
    if (id != _profileId) {
      _profileId = id;
      _messages.clear();
      _conversationId = null;
      _conversations = const [];
      _sending = false;
      _failure = null;
      if (id != null) unawaited(loadHistory());
      notifyListeners();
    }
  }

  void _ensureProfile(String id) {
    if (_profileId != id) _onProfileChanged();
  }

  int _matchingUserMessages(String text) => _messages
      .where((item) => item.role == CareerChatRole.user && item.text == text)
      .length;

  void _debugSend(String prefix, {required String profileId, Object? error}) {
    if (!kDebugMode) return;
    final errorCode = error is ApiFailure ? error.code : null;
    debugPrint(
      '$prefix '
      'conversationId=$_conversationId '
      'birthProfileId=$profileId '
      'messageCount=${_messages.length} '
      'sendState=${_sending ? 'sending' : 'idle'} '
      'errorClass=${error?.runtimeType} '
      'errorCode=$errorCode',
    );
  }

  @override
  void dispose() {
    _disposed = true;
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
