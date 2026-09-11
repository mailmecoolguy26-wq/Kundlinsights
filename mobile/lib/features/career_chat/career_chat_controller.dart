import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/api_failure.dart';
import '../profiles/profile_controller.dart';
import '../readings/career_explanation_language.dart';
import 'domain/career_chat.dart';
import 'domain/career_chat_repository.dart';

class CareerChatMessage {
  CareerChatMessage.user(this.text)
    : role = CareerChatRole.user,
      response = null;
  CareerChatMessage.assistant(this.response)
    : role = CareerChatRole.assistant,
      text = response!.answer.headlineFact;

  final CareerChatRole role;
  final String text;
  final CareerChatResponse? response;
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
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

class CareerChatController extends ChangeNotifier {
  CareerChatController(this._repository, this._profiles, this._language) {
    _profiles.addListener(_onProfileChanged);
  }

  final CareerChatRepository _repository;
  final ProfileController _profiles;
  final CareerExplanationLanguageController _language;
  final List<CareerChatMessage> _messages = [];
  String? _profileId;
  bool _sending = false;
  ApiFailure? _failure;

  List<CareerChatMessage> get messages => List.unmodifiable(_messages);
  bool get isSending => _sending;
  bool get requiresPremium => _failure?.code == 'ENTITLEMENT_REQUIRED';
  bool get hasActiveProfile => _profiles.activeProfile != null;
  String? get activeProfileName => _profiles.activeProfile?.label;
  CareerChatLanguage get language =>
      _language.language == CareerExplanationLanguage.hinglish
      ? CareerChatLanguage.hinglish
      : CareerChatLanguage.english;

  Future<void> send(String rawMessage) async {
    final message = rawMessage.trim();
    final profile = _profiles.activeProfile;
    if (_sending ||
        message.isEmpty ||
        message.length > 2000 ||
        profile == null) {
      return;
    }
    _ensureProfile(profile.id);
    final user = CareerChatMessage.user(message);
    _messages.add(user);
    _failure = null;
    _sending = true;
    notifyListeners();
    try {
      final response = await _repository.send(
        birthProfileId: profile.id,
        request: CareerChatRequest(
          message: message,
          conversationContext: _context(),
          language: language,
        ),
      );
      if (_profiles.activeProfile?.id != profile.id) return;
      _messages.add(CareerChatMessage.assistant(response));
    } on ApiFailure catch (error) {
      if (_profiles.activeProfile?.id != profile.id) return;
      user.failed = true;
      _failure = error;
    } catch (_) {
      if (_profiles.activeProfile?.id != profile.id) return;
      user.failed = true;
      _failure = null;
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
    return send(message.text);
  }

  List<CareerChatContextMessage> _context() => _messages
      .take(_messages.length - 1)
      .where((message) => !message.failed)
      .map(
        (message) =>
            CareerChatContextMessage(role: message.role, text: message.text),
      )
      .toList()
      .reversed
      .take(8)
      .toList()
      .reversed
      .toList();

  void _onProfileChanged() {
    final id = _profiles.activeProfile?.id;
    if (id != _profileId) {
      _profileId = id;
      _messages.clear();
      _sending = false;
      _failure = null;
      notifyListeners();
    }
  }

  void _ensureProfile(String id) {
    if (_profileId != id) _onProfileChanged();
  }

  @override
  void dispose() {
    _profiles.removeListener(_onProfileChanged);
    super.dispose();
  }
}
