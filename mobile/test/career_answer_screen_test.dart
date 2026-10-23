import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/career_answer_controller.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer.dart';
import 'package:kundlinsights_mobile/features/career_answers/domain/career_answer_repository.dart';
import 'package:kundlinsights_mobile/features/career_answers/presentation/career_answer_screen.dart';
import 'package:kundlinsights_mobile/features/career_answers/presentation/career_hub_screen.dart';
import 'package:kundlinsights_mobile/features/payments/data/apple_store_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/data/debug_local_storekit_entitlement_session.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';

void main() {
  testWidgets('renders the consolidated Career Hub and practical questions', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: CareerHubScreen()));

    expect(find.text('CAREER & BUSINESS'), findsOneWidget);
    expect(find.text('Your Career Outlook'), findsOneWidget);
    expect(find.text('When is my next strong career window?'), findsNothing);
    expect(find.text('My current career phase'), findsNothing);
    expect(find.text('Career Activity'), findsNothing);
    expect(find.text('Stronger Career Window'), findsNothing);
    expect(find.text('DEV SAMPLE DATA'), findsNothing);
    expect(find.text('DEV SAMPLE CONTROLS'), findsNothing);
    await tester.drag(find.byType(ListView), const Offset(0, -360));
    await tester.pump();
    expect(find.text('Career Timeline'), findsOneWidget);
    expect(find.text('Career Events'), findsOneWidget);
    expect(find.text('View Career Timeline'), findsNothing);
    for (final title in const [
      'Should I switch jobs?',
      'Should I start a business?',
      'I have a job offer',
      'Compare two offers',
      'Promotion / growth',
      'Career abroad',
    ]) {
      expect(find.text(title), findsOneWidget);
    }
  });

  test('omits technical saved phase copy from the Career Hub projection', () {
    final detail = _careerReadingDetail(
      phase: 'A supplied 10th-house lord relation is recorded in this Career context.',
      timingMeaning:
          'Career-related support becomes stronger during this period.',
    );

    expect(careerHubCustomerPhase(detail), isNull);
    expect(
      careerHubCustomerMeaning(detail.careerTimingPeriods!.single),
      'Career-related support becomes stronger during this period.',
    );
  });

  test('keeps a saved customer-facing phase available to the Career Hub', () {
    final detail = _careerReadingDetail(
      phase: 'Your current phase is more supportive for active career conversations.',
      timingMeaning:
          'Career-related support becomes stronger during this period.',
    );

    expect(
      careerHubCustomerPhase(detail),
      'Your current phase is more supportive for active career conversations.',
    );
  });

  testWidgets('Career hub retains normal back navigation to the app shell', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => Navigator.of(context).push<void>(
                  MaterialPageRoute<void>(
                    builder: (_) => const CareerHubScreen(),
                  ),
                ),
                child: const Text('Open Career'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Career'));
    await tester.pumpAndSettle();
    expect(find.text('CAREER & BUSINESS'), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Open Career'), findsOneWidget);
  });

  test('reuses a Career answer for the same profile and question', () async {
    final repository = _Answers(answer: _answer(window: true));
    final harness = await _Harness.create(repository);

    await harness.controller.load(CareerQuestionType.careerActivityTiming);
    await harness.controller.load(CareerQuestionType.careerActivityTiming);

    expect(repository.profileIds, ['profile-a']);
    expect(repository.questionTypes, [CareerQuestionType.careerActivityTiming]);
    expect(harness.controller.answer?.window, isNotNull);

    harness.dispose();
  });

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

  testWidgets(
    'renders the stronger Career window without beta or prediction language',
    (tester) async {
      final harness = await _Harness.create(_Answers(answer: _jobAnswer()));
      addTearDown(harness.dispose);
      await tester.pumpWidget(
        _screen(harness.controller, CareerQuestionType.jobFavourabilityTiming),
      );
      await tester.pump();
      expect(find.text('Stronger Career Window'), findsOneWidget);
      expect(find.text('Stronger Support'), findsOneWidget);
      expect(find.text('ACTION'), findsOneWidget);
      expect(find.text('WHY TARAVERSE THINKS THIS'), findsOneWidget);
      await tester.tap(find.text('WHY TARAVERSE THINKS THIS'));
      await tester.pumpAndSettle();
      expect(find.text('Career timing is activated'), findsOneWidget);
      expect(find.textContaining('guarantee employment'), findsOneWidget);
      expect(find.textContaining('This beta'), findsNothing);
      expect(find.textContaining('probability'), findsNothing);
      expect(harness.repository.questionTypes, [
        CareerQuestionType.jobFavourabilityTiming,
      ]);
    },
  );

  testWidgets(
    'renders the date-free TaraVerse Premium teaser instead of a Career Reading prerequisite',
    (tester) async {
      final harness = await _Harness.create(_Answers(answer: _jobTeaser()));
      addTearDown(harness.dispose);
      await tester.pumpWidget(
        _screen(harness.controller, CareerQuestionType.jobFavourabilityTiming),
      );
      await tester.pump();
      expect(
        find.text('A stronger career window is coming up'),
        findsOneWidget,
      );
      expect(find.text('Unlock TaraVerse Premium'), findsWidgets);
      expect(find.text('Create your Career Reading first'), findsNothing);
      expect(find.textContaining('2027'), findsNothing);
      expect(find.textContaining('Jan'), findsNothing);
      await tester.drag(find.byType(ListView), const Offset(0, -260));
      await tester.pump();
      expect(find.textContaining('Exact date range'), findsOneWidget);
    },
  );

  test('keeps Job Favourability answers profile-scoped and refreshes after a local purchase', () async {
    final session = DebugLocalStoreKitEntitlementSession(enabled: true);
    final harness = await _Harness.create(
      _Answers(answer: _jobTeaser()),
      localDebugSession: session,
    );
    addTearDown(harness.dispose);

    await harness.controller.load(CareerQuestionType.jobFavourabilityTiming);
    expect(
      harness.controller.answer?.answerability,
      CareerAnswerability.premiumRequired,
    );
    expect(harness.repository.profileIds, ['profile-a']);

    session.activateIfLocalXcodeTransaction(
      purchase: _xcodePurchase(),
      expectedProductId: 'com.taraverse.career.premium.6month',
      authenticatedSubject: 'user-a',
      birthProfileId: 'profile-a',
    );
    await _flushController();

    expect(harness.controller.answer?.jobFavourability, isNotNull);
    expect(
      harness.controller.answer?.answerability,
      CareerAnswerability.supported,
    );
    expect(harness.repository.profileIds, ['profile-a']);

    harness.profiles.select(harness.profile('profile-b'));
    await _flushController();
    expect(
      harness.controller.answer?.answerability,
      CareerAnswerability.premiumRequired,
    );
    expect(harness.repository.profileIds, ['profile-a', 'profile-b']);

    harness.profiles.select(harness.profile('profile-a'));
    await _flushController();
    expect(harness.controller.answer?.jobFavourability, isNotNull);
    expect(harness.repository.profileIds, ['profile-a', 'profile-b']);
  });
}

Future<void> _flushController() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

StorePurchaseUpdate _xcodePurchase() => StorePurchaseUpdate(
  status: StorePurchaseStatus.purchased,
  productId: 'com.taraverse.career.premium.6month',
  serverVerificationData: _xcodeJws(),
  pendingCompletePurchase: true,
  transactionId: 'local-profile-a-transaction',
);

String _xcodeJws() {
  final payload = base64Url
      .encode(
        utf8.encode(
          '{"environment":"Xcode","productId":"com.taraverse.career.premium.6month"}',
        ),
      )
      .replaceAll('=', '');
  return 'header.$payload.signature';
}

Widget _screen(
  CareerAnswerController controller, [
  CareerQuestionType type = CareerQuestionType.careerActivityTiming,
]) => MaterialApp(
  home: CareerAnswerScreen(controller: controller, questionType: type),
);

CareerAnswer _jobAnswer() => CareerAnswer.fromJson({
  'questionType': 'JOB_FAVOURABILITY_TIMING',
  'answerability': 'SUPPORTED',
  'projectionStatus': 'BETA_CONVERGENCE_AVAILABLE',
  'sourceReadingId': 'reading-a',
  'broadWindow': {
    'start': '2027-01-01T00:00:00.000Z',
    'end': '2027-02-01T00:00:00.000Z',
  },
  'strongerConcentrationWindow': null,
  'strength': 'STRONGER',
  'evidenceAgreementCount': 3,
  'evidenceReasonCodes': [
    'CAREER_TIMING_ACTIVATED',
    'JUPITER_WORK_RELATED_AREA',
  ],
  'recommendedActionCodes': ['PREPARE_CAREER_MATERIALS_AND_CONVERSATIONS'],
  'limitationCode': 'BETA_DESCRIPTIVE_CONVERGENCE_ONLY',
  'provenance': const {},
  'rulesetVersion': 'career-answer-v1',
});

CareerAnswer _jobTeaser() => CareerAnswer.fromJson({
  'questionType': 'JOB_FAVOURABILITY_TIMING',
  'answerability': 'PREMIUM_REQUIRED',
  'status': 'PREMIUM_REQUIRED',
  'teaser': {
    'title': 'A stronger career window is coming up',
    'subtitle': 'TaraVerse has identified a period where multiple career-related signals align.',
  },
  'premiumBenefits': [
    'Exact date range',
    'Why this period is stronger',
    'What actions to take',
    'Supporting Dasha and transit insights',
    'Additional upcoming windows',
  ],
  'limitationCode': 'CAREER_PREMIUM_REQUIRED',
});

CareerAnswer _answer({
  required bool window,
  String? sourceReadingId = 'reading-a',
}) => CareerAnswer.fromJson(
  _answerJson(window: window, sourceReadingId: sourceReadingId),
);

ReadingDetail _careerReadingDetail({
  required String phase,
  required String timingMeaning,
}) => ReadingDetail(
  readingId: 'reading-a',
  birthProfileId: 'profile-a',
  domain: 'CAREER',
  status: 'READY',
  createdAt: '2026-10-15T00:00:00.000Z',
  readingInstant: '2026-10-15T00:00:00.000Z',
  locale: 'en',
  content: ReadingContent(
    domain: 'CAREER',
    locale: 'en',
    sections: [
      ReadingSection(
        section: 'current-context',
        headline: 'Current context',
        items: [ReadingSectionItem(headline: 'Phase', sentence: phase)],
      ),
    ],
  ),
  careerTimingPeriods: [
    CareerTimingPeriod(
      startDate: '2026-11-20T00:00:00.000Z',
      endDate: '2027-01-10T00:00:00.000Z',
      evidenceState: 'MULTIPLE_TIMING_FACTORS_CONVERGE',
      headline: 'Next stronger Career window',
      summary: 'Technical Dasha evidence.',
      whyItems: const [],
      whatThisCanMean: timingMeaning,
      professionalDirection: 'Prepare for important conversations.',
      technicalDetails: const {},
      disclosure: 'No guarantee.',
      sourceRuleVersion: 'test',
      longWindow: false,
    ),
  ],
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

  static Future<_Harness> create(
    _Answers repository, {
    DebugLocalStoreKitEntitlementSession? localDebugSession,
  }) async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    return _Harness(
      auth,
      profiles,
      CareerAnswerController(repository, profiles, localDebugSession),
      repository,
    );
  }

  BirthProfile profile(String id) =>
      profiles.profiles.singleWhere((profile) => profile.id == id);

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
    BirthProfile(
      id: 'profile-b',
      displayLabel: 'Profile B',
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
