import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_chat/career_chat_controller.dart';
import 'package:kundlinsights_mobile/features/career_chat/domain/career_chat.dart';
import 'package:kundlinsights_mobile/features/career_chat/domain/career_chat_repository.dart';
import 'package:kundlinsights_mobile/features/career_chat/presentation/career_chat_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';

void main() {
  late AuthController auth;
  late ProfileController profiles;
  late _MemoryTaraRepository repository;
  late CareerChatController controller;

  setUp(() async {
    auth = AuthController(_AuthRepository());
    profiles = ProfileController(_ProfileRepository(), auth);
    repository = _MemoryTaraRepository();
    await auth.restore();
    await profiles.load();
    controller = CareerChatController(
      repository,
      profiles,
      CareerExplanationLanguageController(_LanguageStorage()),
    );
  });

  tearDown(() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test(
    'persists, reopens, and resumes a conversation for the active profile',
    () async {
      await controller.send('What should I focus on?');
      expect(controller.messages, hasLength(2));
      expect(controller.messages.first.text, 'What should I focus on?');
      final id = controller.conversationId!;

      controller.startNewConversation();
      expect(controller.messages, isEmpty);
      await controller.openConversation(id);
      expect(controller.messages, hasLength(2));

      await controller.send('And what should I do next?');
      expect(controller.messages, hasLength(4));
      expect(repository.profileIds, everyElement('profile-a'));
    },
  );

  test(
    'never mixes Ask Tara history between selected birth profiles',
    () async {
      await controller.send('Question for A');
      final profileB = profiles.profiles.singleWhere(
        (item) => item.id == 'profile-b',
      );
      profiles.select(profileB);
      await controller.loadHistory();
      expect(controller.messages, isEmpty);
      expect(controller.conversations, isEmpty);

      await controller.send('Question for B');
      expect(controller.messages.first.text, 'Question for B');
      final profileA = profiles.profiles.singleWhere(
        (item) => item.id == 'profile-a',
      );
      profiles.select(profileA);
      await controller.loadHistory();
      expect(controller.messages, isEmpty);
      expect(controller.conversations, hasLength(1));
      await controller.openConversation(
        controller.conversations.single.conversationId,
      );
      expect(controller.messages.first.text, 'Question for A');
    },
  );

  test('keeps a premium action scoped to its selected profile', () async {
    await controller.send('timing A');
    final profileAAction = controller.messages.last;
    expect(profileAAction.action?.type, 'OPEN_CAREER_PREMIUM');
    expect(profileAAction.birthProfileId, 'profile-a');
    expect(controller.canOpenCareerPremium(profileAAction), isTrue);
    final profileB = profiles.profiles.singleWhere((item) => item.id == 'profile-b');
    profiles.select(profileB);
    expect(controller.canOpenCareerPremium(profileAAction), isFalse);
    expect(controller.messages, isEmpty);
    await controller.send('timing B');
    expect(controller.messages.last.action?.type, 'OPEN_CAREER_PREMIUM');
    expect(repository.profileIds.last, 'profile-b');
  });

  testWidgets('renders the structured Career Premium action beneath Tara response', (tester) async {
    await tester.pumpWidget(MaterialApp(home: CareerChatScreen(controller: controller)));
    await controller.send('timing A');
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('ask-tara-open-career-premium')), findsOneWidget);
    expect(find.text('Unlock Career Premium'), findsOneWidget);
  });
}

class _MemoryTaraRepository implements CareerChatRepository {
  final Map<String, TaraConversationSummary> _conversations = {};
  final Map<String, List<TaraConversationMessage>> _messages = {};
  final List<String> profileIds = [];
  int _next = 0;

  @override
  Future<TaraConversationSummary> createConversation({
    required String birthProfileId,
  }) async {
    profileIds.add(birthProfileId);
    final id = 'conversation-${++_next}';
    final now = DateTime.utc(2026, 10, 14);
    final conversation = TaraConversationSummary(
      conversationId: id,
      birthProfileId: birthProfileId,
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
    );
    _conversations[id] = conversation;
    _messages[id] = [];
    return conversation;
  }

  @override
  Future<TaraConversationDetail> getConversation({
    required String birthProfileId,
    required String conversationId,
  }) async {
    profileIds.add(birthProfileId);
    final conversation = _conversations[conversationId]!;
    if (conversation.birthProfileId != birthProfileId) {
      throw StateError('Profile mismatch');
    }
    return TaraConversationDetail(
      conversation: conversation,
      messages: List.unmodifiable(_messages[conversationId]!),
    );
  }

  @override
  Future<List<TaraConversationSummary>> listConversations({
    required String birthProfileId,
  }) async {
    profileIds.add(birthProfileId);
    return _conversations.values
        .where((item) => item.birthProfileId == birthProfileId)
        .toList(growable: false);
  }

  @override
  Future<TaraConversationDetail> sendConversationMessage({
    required String birthProfileId,
    required String conversationId,
    required String message,
    required CareerChatLanguage language,
  }) async {
    profileIds.add(birthProfileId);
    final conversation = _conversations[conversationId]!;
    if (conversation.birthProfileId != birthProfileId) {
      throw StateError('Profile mismatch');
    }
    final rows = _messages[conversationId]!;
    final now = DateTime.utc(2026, 10, 14);
    rows.addAll([
      TaraConversationMessage(
        messageId: 'message-${++_next}',
        role: CareerChatRole.user,
        content: message,
        createdAt: now,
      ),
      TaraConversationMessage(
        messageId: 'message-${++_next}',
        role: CareerChatRole.assistant,
        content: 'Grounded reply for $message',
        createdAt: now,
        action: message.startsWith('timing')
            ? const TaraConversationAction(
                type: 'OPEN_CAREER_PREMIUM',
                label: 'Unlock Career Premium',
              )
            : null,
      ),
    ]);
    _conversations[conversationId] = TaraConversationSummary(
      conversationId: conversation.conversationId,
      birthProfileId: conversation.birthProfileId,
      title: conversation.title == 'New conversation'
          ? message
          : conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: now,
      lastMessagePreview: rows.last.content,
    );
    return getConversation(
      birthProfileId: birthProfileId,
      conversationId: conversationId,
    );
  }

  @override
  Future<CareerChatResponse> send({
    required String birthProfileId,
    required CareerChatRequest request,
  }) => throw UnimplementedError();
}

class _ProfileRepository implements BirthProfileRepository {
  final profiles = [
    _profile('profile-a', 'Profile A'),
    _profile('profile-b', 'Profile B'),
  ];
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();
  @override
  Future<BirthProfile> get(String id) async =>
      profiles.singleWhere((item) => item.id == id);
  @override
  Future<List<BirthProfile>> list() async => profiles;
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) => throw UnimplementedError();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}

BirthProfile _profile(String id, String label) => BirthProfile(
  id: id,
  displayLabel: label,
  status: 'active',
  birthData: ResolvedBirthData(const {
    'localDate': '1990-11-26',
    'localTime': '13:40:00',
    'timezone': 'Asia/Kolkata',
  }),
);

class _AuthRepository implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'subject-a');
  @override
  Future<void> signIn({required String email, required String password}) =>
      throw UnimplementedError();
  @override
  Future<bool> signUp({required String email, required String password}) =>
      throw UnimplementedError();
  @override
  Future<void> signOut() => throw UnimplementedError();
}

class _LanguageStorage implements CareerExplanationLanguageStorage {
  @override
  Future<String?> readLanguage() async => null;
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {}
}
