import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/theme/app_theme.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/career_reading_generation.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';
import 'package:kundlinsights_mobile/features/readings/reading_controller.dart';
import 'package:kundlinsights_mobile/features/readings/readings_screen.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  testWidgets('shows eligible generation alongside empty reading history', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester);
    addTearDown(harness.dispose);

    final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');
    expect(cta, findsOneWidget);
    expect(tester.widget<FilledButton>(cta).onPressed, isNotNull);
    expect(find.text('No readings yet.'), findsOneWidget);
    _expectNoPaymentUi();
  });

  testWidgets('shows eligible generation alongside saved reading history', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, history: [_summary()]);
    addTearDown(harness.dispose);

    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsOneWidget,
    );
    expect(find.text('Career Reading'), findsWidgets);
  });

  testWidgets('shows neutral ineligible state without payment UI', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, eligible: false);
    addTearDown(harness.dispose);

    expect(
      find.text('Career Reading is currently unavailable.'),
      findsOneWidget,
    );
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    _expectNoPaymentUi();
  });

  testWidgets('keeps generation visible while entitlement is checking', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, entitlementPending: true);
    addTearDown(harness.dispose);

    expect(find.text('Checking Career Reading availability…'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    expect(harness.generationRepository.createCalls, 0);
    _expectNoPaymentUi();
  });

  testWidgets('shows a safe entitlement error without create or payment UI', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, entitlementFailure: true);
    addTearDown(harness.dispose);

    expect(
      find.text('Career Reading availability is unavailable right now.'),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
    expect(find.text('transport failure secret'), findsNothing);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    expect(harness.generationRepository.createCalls, 0);
    _expectNoPaymentUi();
  });

  testWidgets('shows generation progress and suppresses repeated CTA taps', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, createPending: true);
    addTearDown(harness.dispose);
    final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');

    await tester.tap(cta);
    await tester.tap(cta);
    await tester.pump();

    expect(find.text('Generating your Career Reading…'), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    expect(harness.generationRepository.createCalls, 1);
  });

  testWidgets('exposes accessible generation CTA and unavailable state', (
    tester,
  ) async {
    final eligible = await _pumpReadingCenter(tester);
    addTearDown(eligible.dispose);
    final semantics = tester.ensureSemantics();
    final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');
    expect(
      tester.getSemantics(cta),
      matchesSemantics(
        label: 'Generate Career Reading',
        isButton: true,
        isEnabled: true,
        hasEnabledState: true,
        hasTapAction: true,
        hasFocusAction: true,
        isFocusable: true,
      ),
    );

    await tester.pumpWidget(const SizedBox());
    final ineligible = await _pumpReadingCenter(tester, eligible: false);
    addTearDown(ineligible.dispose);
    expect(
      find.bySemanticsLabel('Career Reading is currently unavailable.'),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Generate Career Reading'), findsNothing);
    semantics.dispose();
  });

  testWidgets('exposes accessible entitlement and generation progress', (
    tester,
  ) async {
    final loading = await _pumpReadingCenter(tester, entitlementPending: true);
    addTearDown(loading.dispose);
    final semantics = tester.ensureSemantics();
    expect(
      find.bySemanticsLabel('Checking Career Reading availability…'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox());
    final generating = await _pumpReadingCenter(tester, createPending: true);
    addTearDown(generating.dispose);
    await tester.tap(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
    );
    await tester.pump();
    expect(
      find.bySemanticsLabel('Generating your Career Reading…'),
      findsOneWidget,
    );
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    semantics.dispose();
  });
}

Future<_Harness> _pumpReadingCenter(
  WidgetTester tester, {
  bool eligible = true,
  bool entitlementPending = false,
  bool entitlementFailure = false,
  bool createPending = false,
  List<ReadingSummary> history = const [],
}) async {
  final auth = AuthController(_Auth());
  await auth.restore();
  final profiles = ProfileController(_Profiles(), auth);
  await tester.pump();
  final readings = ReadingController(_Readings(history), auth, profiles);
  final generationRepository = _GenerationRepository(
    eligible: eligible,
    entitlementPending: entitlementPending,
    entitlementFailure: entitlementFailure,
    createPending: createPending,
  );
  final generation = CareerReadingGenerationController(
    generationRepository,
    auth,
    profiles,
    readings,
  );
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: ReadingsScreen(controller: readings, generation: generation),
    ),
  );
  await tester.pump();
  return _Harness(auth, profiles, readings, generation, generationRepository);
}

void _expectNoPaymentUi() {
  expect(find.text('Buy'), findsNothing);
  expect(find.text('Unlock'), findsNothing);
  expect(find.text('Purchase'), findsNothing);
  expect(find.textContaining(RegExp(r'[₹$]')), findsNothing);
}

class _Harness {
  _Harness(
    this.auth,
    this.profiles,
    this.readings,
    this.generation,
    this.generationRepository,
  );
  final AuthController auth;
  final ProfileController profiles;
  final ReadingController readings;
  final CareerReadingGenerationController generation;
  final _GenerationRepository generationRepository;
  void dispose() {
    generation.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

class _GenerationRepository implements CareerReadingGenerationRepository {
  _GenerationRepository({
    required this.eligible,
    required this.entitlementPending,
    required this.entitlementFailure,
    required this.createPending,
  });
  final bool eligible, entitlementPending, entitlementFailure, createPending;
  final entitlement = Completer<CareerEligibility>();
  final create = Completer<CreatedCareerReading>();
  int createCalls = 0;
  @override
  Future<CareerEligibility> getCareerEligibility() {
    if (entitlementPending) return entitlement.future;
    if (entitlementFailure) {
      return Future<CareerEligibility>.error(
        StateError('transport failure secret'),
      );
    }
    return Future.value(CareerEligibility(eligible: eligible));
  }

  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) {
    createCalls++;
    return createPending
        ? create.future
        : Future<CreatedCareerReading>.error(UnimplementedError());
  }
}

class _Readings implements ReadingRepository {
  _Readings(this.history);
  final List<ReadingSummary> history;
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async =>
      history;
  @override
  Future<ReadingDetail> getReadingDetail(String id) =>
      throw UnimplementedError();
}

class _Auth implements AuthRepository {
  @override
  Stream<AuthSnapshot> get states => const Stream.empty();
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
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
  Future<List<BirthProfile>> list() async => [_profile];
  static final _profile = BirthProfile(
    id: 'profile-a',
    displayLabel: 'Profile A',
    status: 'active',
    birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
  );
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

ReadingSummary _summary() => ReadingSummary.fromJson({
  'readingId': 'reading-a',
  'birthProfileId': 'profile-a',
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
});
