import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/career_answer_controller.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/presentation/career_answer_screen.dart';
import 'package:kundlinsights_mobile/features/career_answers/presentation/career_hub_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  testWidgets(
    'reserves only the approved unsupported Career questions as coming soon',
    (tester) async {
      await tester.pumpWidget(const MaterialApp(home: CareerHubScreen()));

      expect(find.text('CAREER & BUSINESS'), findsOneWidget);
      expect(find.text('What do you want clarity on?'), findsOneWidget);
      expect(find.text('My current career phase'), findsOneWidget);
      expect(find.text('When is career activity stronger?'), findsOneWidget);
      for (final title in const [
        'Find my next job',
        'Should I switch jobs?',
        'Should I start a business?',
        'I have a job offer',
        'Compare two offers',
        'Promotion / growth',
        'Career abroad',
      ]) {
        expect(find.text(title), findsOneWidget);
      }
    },
  );

  testWidgets('renders loading and then a grounded possible activity answer', (
    tester,
  ) async {
    final pending = Completer<CareerAnswer>();
    final harness = await _Harness.create(_Answers(pending: pending));
    addTearDown(harness.dispose);

    await tester.pumpWidget(_screen(harness.controller));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(_answer(window: true));
    await tester.pump();
    await tester.pump();

    expect(
      find.text(
        'Career activity is more strongly indicated during this period',
      ),
      findsOneWidget,
    );
    expect(find.text('POSSIBLE CAREER ACTIVITY SIGNAL'), findsOneWidget);
    expect(find.textContaining('not a favourable window'), findsOneWidget);
    expect(harness.repository.profileIds, ['profile-a']);
    expect(harness.repository.questionTypes, [
      CareerQuestionType.careerActivityTiming,
    ]);
  });

  testWidgets('renders no-window answer without inventing a period', (
    tester,
  ) async {
    final harness = await _Harness.create(
      _Answers(answer: _answer(window: false)),
    );
    addTearDown(harness.dispose);

    await tester.pumpWidget(_screen(harness.controller));
    await tester.pump();

    expect(
      find.text('No concentrated Career activity signal is identified'),
      findsOneWidget,
    );
    expect(find.text('POSSIBLE CAREER ACTIVITY SIGNAL'), findsNothing);
    expect(
      find.textContaining('cannot determine a stronger period'),
      findsOneWidget,
    );
  });

  testWidgets(
    'renders the Career Reading prerequisite instead of answer evidence when no reading exists',
    (tester) async {
      final harness = await _Harness.create(
        _Answers(answer: _answer(window: false, sourceReadingId: null)),
      );
      addTearDown(harness.dispose);

      await tester.pumpWidget(_screen(harness.controller));
      await tester.pump();

      expect(find.text('Create your Career Reading first'), findsOneWidget);
      expect(
        find.text(
          'TaraVerse needs your Career Reading before it can answer personalized Career questions.',
        ),
        findsOneWidget,
      );
      expect(find.text('Generate Career Reading'), findsOneWidget);
      expect(find.text('Add Career History'), findsOneWidget);
      expect(find.text('CAREER & BUSINESS'), findsOneWidget);
      expect(find.byType(FilledButton), findsOneWidget);
      expect(find.byType(OutlinedButton), findsOneWidget);
      final primary = tester.widget<FilledButton>(find.byType(FilledButton));
      final secondary = tester.widget<OutlinedButton>(
        find.byType(OutlinedButton),
      );
      expect(
        primary.style?.backgroundColor?.resolve(<WidgetState>{}),
        const Color(0xFFD6B15A),
      );
      expect(
        secondary.style?.foregroundColor?.resolve(<WidgetState>{}),
        const Color(0xFFD6B15A),
      );
      expect(find.text('WHY TARAVERSE THINKS THIS'), findsNothing);
      expect(find.text('SEE DETAILED ASTROLOGY'), findsNothing);
      expect(find.textContaining('Career Premium'), findsNothing);
    },
  );

  testWidgets('keeps the Career Answer title when a reading exists', (
    tester,
  ) async {
    final harness = await _Harness.create(
      _Answers(answer: _answer(window: false)),
    );
    addTearDown(harness.dispose);

    await tester.pumpWidget(_screen(harness.controller));
    await tester.pump();

    expect(find.text('CAREER ANSWER'), findsOneWidget);
    expect(find.text('CAREER & BUSINESS'), findsNothing);
  });

  testWidgets('renders a retryable error when the answer request fails', (
    tester,
  ) async {
    final harness = await _Harness.create(_Answers(failure: true));
    addTearDown(harness.dispose);

    await tester.pumpWidget(_screen(harness.controller));
    await tester.pump();

    expect(find.text('Career answer unavailable'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
  });

  test('ignores malformed optional window data defensively', () {
    final answer = CareerAnswer.fromJson(
      _answerJson(window: false)
        ..['answer'] = {
          ...(_answerJson(window: false)['answer'] as Map<String, dynamic>),
          'window': {
            'start': 'not-a-date',
            'end': '2027-02-01T00:00:00.000Z',
            'classification': 'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
          },
        },
    );

    expect(answer.window, isNull);
  });
}

Widget _screen(CareerAnswerController controller) => MaterialApp(
  home: CareerAnswerScreen(
    controller: controller,
    questionType: CareerQuestionType.careerActivityTiming,
  ),
);

CareerAnswer _answer({
  required bool window,
  String? sourceReadingId = 'reading-a',
}) => CareerAnswer.fromJson(
  _answerJson(window: window, sourceReadingId: sourceReadingId),
);

Map<String, dynamic> _answerJson({
  required bool window,
  String? sourceReadingId = 'reading-a',
}) => {
  'questionType': 'CAREER_ACTIVITY_TIMING',
  'answerability': window ? 'SUPPORTED' : 'INSUFFICIENT_EVIDENCE',
  'answer': {
    'headline': window
        ? 'Career activity is more strongly indicated during this period'
        : 'No concentrated Career activity signal is identified',
    'summary': window
        ? 'This period contains more of the currently supported Career timing signals.'
        : 'The current validated evidence cannot determine a stronger period here.',
    'limitation': 'This is a possible Career activity signal, not a favourable window, job-offer prediction, or guarantee.',
    'actionItems': const ['Use this as context, not a predicted outcome.'],
    if (window)
      'window': {
        'start': '2027-01-01T00:00:00.000Z',
        'end': '2027-03-01T00:00:00.000Z',
        'classification': 'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
      },
  },
  'agreement': {
    'availableMajorSignals': 3,
    'alignedMajorSignals': 3,
    'primaryEligibility': window,
    'supportSignals': const ['D10'],
  },
  'evidence': const [
    {
      'family': 'DASHA',
      'role': 'PRIMARY',
      'summary': 'Career-linked Dasha is active.',
    },
  ],
  'sourceReadingId': sourceReadingId,
  'rulesetVersion': 'career-v2-phase-1',
};

class _Harness {
  _Harness(this.auth, this.profiles, this.controller, this.repository);
  final AuthController auth;
  final ProfileController profiles;
  final CareerAnswerController controller;
  final _Answers repository;

  static Future<_Harness> create(_Answers repository) async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    return _Harness(
      auth,
      profiles,
      CareerAnswerController(repository, profiles),
      repository,
    );
  }

  void dispose() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

class _Answers implements CareerAnswerRepository {
  _Answers({this.answer, this.pending, this.failure = false});
  final CareerAnswer? answer;
  final Completer<CareerAnswer>? pending;
  final bool failure;
  final List<String> profileIds = [];
  final List<CareerQuestionType> questionTypes = [];

  @override
  Future<CareerAnswer> getAnswer({
    required String birthProfileId,
    required CareerQuestionType questionType,
    String? readingId,
  }) {
    profileIds.add(birthProfileId);
    questionTypes.add(questionType);
    if (failure) return Future<CareerAnswer>.error(StateError('offline'));
    return pending?.future ?? Future<CareerAnswer>.value(answer!);
  }
}

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'test-token';
  @override
  Future<String?> refreshAccessToken() async => 'test-token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user-a');
  @override
  Future<void> signIn({
    required String email,
    required String password,
  }) async {}
  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;
  @override
  Future<void> signOut() async {}
}

class _Profiles implements BirthProfileRepository {
  @override
  Future<List<BirthProfile>> list() async => [
    BirthProfile(
      id: 'profile-a',
      displayLabel: 'Profile A',
      status: 'active',
      birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
    ),
  ];
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();
  @override
  Future<BirthProfile> get(String id) => throw UnimplementedError();
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) => throw UnimplementedError();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}
