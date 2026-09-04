import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
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
  testWidgets(
    'generates once, refreshes history, and renders persisted detail',
    (tester) async {
      final harness = await _pumpSuccessFlow(tester);
      addTearDown(harness.dispose);

      final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');
      expect(cta, findsOneWidget);
      expect(tester.widget<FilledButton>(cta).onPressed, isNotNull);

      await tester.tap(cta);
      await tester.pump();
      expect(harness.generationRepository.createCalls, 1);
      expect(harness.generationRepository.birthProfileId, 'profile-a');

      harness.readings.created = true;
      harness.generationRepository.completeCreate();
      await tester.pump();
      await tester.pump();
      await tester.pump();
      await tester.pumpAndSettle();
      await tester.pump();

      expect(harness.readings.listCalls, greaterThanOrEqualTo(2));
      expect(
        harness.readings.lastList.map((reading) => reading.readingId),
        contains('reading-123'),
      );
      expect(find.byType(ReadingDetailScreen), findsOneWidget);
      expect(harness.readings.detailRequests, ['reading-123']);
      expect(find.text('Persisted career detail sentinel 123'), findsOneWidget);
      expect(harness.generationRepository.createCalls, 1);
    },
  );
}

Future<_Harness> _pumpSuccessFlow(WidgetTester tester) async {
  final auth = AuthController(_Auth());
  await auth.restore();
  final profiles = ProfileController(_Profiles(), auth);
  await tester.pump();
  final readings = _Readings();
  final readingController = ReadingController(readings, auth, profiles);
  final generationRepository = _SuccessGenerationRepository();
  final generation = CareerReadingGenerationController(
    generationRepository,
    auth,
    profiles,
    readingController,
    idempotencyKey: () => 'attempt-1',
  );
  final router = GoRouter(
    initialLocation: '/readings',
    routes: [
      GoRoute(
        path: '/readings',
        name: 'readings',
        builder: (context, state) => ReadingsScreen(
          controller: readingController,
          generation: generation,
        ),
        routes: [
          GoRoute(
            path: 'detail/:id',
            name: 'reading-detail',
            builder: (context, state) => ReadingDetailScreen(
              controller: readingController,
              readingId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    MaterialApp.router(
      theme: AppTheme.light,
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
  await tester.pump();
  await tester.pump();
  return _Harness(
    auth,
    profiles,
    readingController,
    generation,
    readings,
    generationRepository,
    router,
  );
}

class _Harness {
  _Harness(
    this.auth,
    this.profiles,
    this.readingController,
    this.generation,
    this.readings,
    this.generationRepository,
    this.router,
  );
  final AuthController auth;
  final ProfileController profiles;
  final ReadingController readingController;
  final CareerReadingGenerationController generation;
  final _Readings readings;
  final _SuccessGenerationRepository generationRepository;
  final GoRouter router;
  void dispose() {
    router.dispose();
    generation.dispose();
    readingController.dispose();
    profiles.dispose();
    auth.dispose();
  }
}

class _SuccessGenerationRepository
    implements CareerReadingGenerationRepository {
  final create = Completer<CreatedCareerReading>();
  int createCalls = 0;
  String? birthProfileId;
  @override
  Future<CareerEligibility> getCareerEligibility({
    required String birthProfileId,
  }) => Future.value(const CareerEligibility(eligible: true));
  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) {
    createCalls++;
    this.birthProfileId = birthProfileId;
    return create.future;
  }

  void completeCreate() =>
      create.complete(const CreatedCareerReading(readingId: 'reading-123'));
}

class _Readings implements ReadingRepository {
  bool created = false;
  int listCalls = 0;
  final List<String> detailRequests = [];
  List<ReadingSummary> lastList = const [];
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async {
    listCalls++;
    lastList = created ? [_summary] : const [];
    return lastList;
  }

  @override
  Future<ReadingDetail> getReadingDetail(String id) async {
    detailRequests.add(id);
    return _detail;
  }
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

final _summary = ReadingSummary.fromJson({
  'readingId': 'reading-123',
  'birthProfileId': 'profile-a',
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
});

final _detail = ReadingDetail.fromJson({
  'readingId': 'reading-123',
  'birthProfileId': 'profile-a',
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
  'content': {
    'domain': 'CAREER',
    'locale': 'en-IN',
    'sections': [
      {
        'section': 'CAREER_STRUCTURE',
        'headline': 'Career structure',
        'items': [
          {
            'headline': 'Career structure',
            'sentence': 'Persisted career detail sentinel 123',
            'sourceAttribution': {'title': null},
          },
        ],
      },
    ],
  },
});
