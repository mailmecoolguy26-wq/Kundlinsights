import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/presentation/birth_profile_onboarding_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  testWidgets('starts the visible five-step onboarding flow', (tester) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());
    expect(find.text('Step 1 of 5'), findsOneWidget);
    expect(find.text('Profile label'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Step 2 of 5'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('free text without a selected place cannot advance', (
    tester,
  ) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());
    await _toPlace(tester);
    await tester.enterText(find.byType(TextField), 'Delhi');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Complete this field to continue.'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('selecting an authoritative place enables progression', (
    tester,
  ) async {
    final repository = _Profiles()
      ..places = const [
        PlaceCandidate(
          id: 'place-delhi',
          label: 'Delhi, India',
          latitude: 0,
          longitude: 0,
          timezone: 'Asia/Kolkata',
          timezoneProvenance: {},
        ),
      ];
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _toPlace(tester);
    await tester.enterText(find.byType(TextField), 'Delhi');
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Delhi, India'), findsOneWidget);
    await tester.tap(find.text('Delhi, India'));
    await tester.pump();
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(repository.resolvedPlaceId, 'place-delhi');
    scope.dispose();
  });

  testWidgets('editing search text invalidates the selected place', (
    tester,
  ) async {
    final repository = _Profiles()
      ..places = const [
        PlaceCandidate(
          id: 'place-a',
          label: 'Ludhiana, Punjab, India',
          latitude: 0,
          longitude: 0,
          timezone: 'Asia/Kolkata',
          timezoneProvenance: {},
        ),
      ];
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _toPlace(tester);
    await tester.enterText(find.byType(TextField), 'Ludhiana');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Ludhiana, Punjab, India'));
    await tester.pump();
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Ludh');
    await tester.pump();
    expect(find.byIcon(Icons.check_circle), findsNothing);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Complete this field to continue.'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('stale search responses cannot replace newer results', (
    tester,
  ) async {
    final repository = _Profiles()..pendingSearches = true;
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _toPlace(tester);
    await tester.enterText(find.byType(TextField), 'Delhi');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.enterText(find.byType(TextField), 'Delhii');
    await tester.pump(const Duration(milliseconds: 400));
    repository.completeSearch('Delhii', const [
      PlaceCandidate(
        id: 'b',
        label: 'Delhi B',
        latitude: 0,
        longitude: 0,
        timezone: 'Asia/Kolkata',
        timezoneProvenance: {},
      ),
    ]);
    await tester.pump();
    expect(find.text('Delhi B'), findsOneWidget);
    repository.completeSearch('Delhi', const [
      PlaceCandidate(
        id: 'a',
        label: 'Delhi A',
        latitude: 0,
        longitude: 0,
        timezone: 'Asia/Kolkata',
        timezoneProvenance: {},
      ),
    ]);
    await tester.pump();
    expect(find.text('Delhi B'), findsOneWidget);
    expect(find.text('Delhi A'), findsNothing);
    scope.dispose();
  });

  testWidgets('missing date cannot advance to the time step', (tester) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Step 2 of 5'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Step 2 of 5'), findsOneWidget);
    expect(find.text('Complete this field to continue.'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('date picker prevents future dates from being submitted', (
    tester,
  ) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());
    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.tap(find.text('Select date'));
    await tester.pumpAndSettle();
    final picker = tester.widget<CalendarDatePicker>(
      find.byType(CalendarDatePicker),
    );
    expect(
      picker.lastDate.isBefore(DateTime.now().add(const Duration(days: 1))),
      isTrue,
    );
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Step 2 of 5'), findsOneWidget);
    expect(find.text('Complete this field to continue.'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('missing time cannot advance to the place step', (tester) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());
    await _toTime(tester);
    expect(find.text('Step 3 of 5'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(find.text('Step 3 of 5'), findsOneWidget);
    expect(find.text('Complete this field to continue.'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('changing date requires a fresh resolution', (tester) async {
    final repository = _Profiles()..places = _places;
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _toResolvedReview(tester);
    expect(repository.resolutionPlaceIds, ['place-a']);
    await _editReviewRow(tester, 1);
    await _changeDate(tester);
    expect(find.text('Step 2 of 5'), findsOneWidget);
    expect(find.text('Create profile'), findsNothing);
    await _resolveAgain(tester);
    expect(repository.resolutionPlaceIds, ['place-a', 'place-a']);
    expect(find.text('Review profile'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('changing time requires a fresh resolution', (tester) async {
    final repository = _Profiles()..places = _places;
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _toResolvedReview(tester);
    expect(repository.resolutionPlaceIds, ['place-a']);
    await _editReviewRow(tester, 2);
    await _changeTime(tester);
    expect(find.text('Step 3 of 5'), findsOneWidget);
    expect(find.text('Create profile'), findsNothing);
    await _resolveAfterTimeChange(tester);
    expect(repository.resolutionPlaceIds, ['place-a', 'place-a']);
    expect(find.text('Review profile'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('changing place requires a fresh resolution', (tester) async {
    final repository = _Profiles()..places = _places;
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _toResolvedReview(tester);
    expect(repository.resolutionPlaceIds, ['place-a']);
    await _editReviewRow(tester, 3);
    await tester.enterText(find.byType(TextField), 'Mumbai');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Mumbai, Maharashtra, India'));
    await tester.pump();
    expect(find.text('Create profile'), findsNothing);
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(repository.resolutionPlaceIds, ['place-a', 'place-b']);
    expect(find.text('Review profile'), findsOneWidget);
    scope.dispose();
  });

  testWidgets(
    'late stale birth-time resolution cannot replace the current one',
    (tester) async {
      final repository = _Profiles()
        ..places = _places
        ..pendingResolutions = true;
      final scope = _Scope(repository);
      await scope.auth.restore();
      await tester.pumpWidget(scope.app());
      await _toPlace(tester);
      await tester.enterText(find.byType(TextField), 'Ludhiana');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Ludhiana, Punjab, India'));
      await tester.pump();
      await tester.tap(find.text('Continue'));
      await tester.pump();
      expect(repository.resolutionPlaceIds, ['place-a']);

      await tester.enterText(find.byType(TextField), 'Mumbai');
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Mumbai, Maharashtra, India'));
      await tester.pump();
      expect(find.text('Continue'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pump();
      expect(repository.resolutionPlaceIds, ['place-a', 'place-b']);

      repository.completeResolution('place-b', _resolution('Current/Zone'));
      await tester.pump();
      expect(find.text('Review profile'), findsOneWidget);
      expect(
        find.text('Selected birthplace: Mumbai, Maharashtra, India'),
        findsOneWidget,
      );

      repository.completeResolution('place-a', _resolution('Stale/Zone'));
      await tester.pump();
      expect(
        find.text('Selected birthplace: Mumbai, Maharashtra, India'),
        findsOneWidget,
      );
      expect(
        find.text('Selected birthplace: Ludhiana, Punjab, India'),
        findsNothing,
      );

      await tester.tap(find.text('Create Profile'));
      await tester.pump();
      expect(repository.createdBirthData?.timezone, 'Current/Zone');
      scope.dispose();
    },
  );

  testWidgets('resolution failure preserves entered onboarding data', (
    tester,
  ) async {
    final repository = _Profiles()
      ..places = _places
      ..resolutionFailures.add(StateError('provider resolution detail'));
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await tester.enterText(find.byType(TextField), 'My birth profile');
    await _toPlace(tester);
    await tester.enterText(find.byType(TextField), 'Ludhiana');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Ludhiana, Punjab, India'));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(
      find.text('We could not complete that request. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('provider resolution detail'), findsNothing);
    expect(find.text('Step 4 of 5'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle), findsOneWidget);
    scope.dispose();
  });

  testWidgets('resolution retry reaches review with the same inputs', (
    tester,
  ) async {
    final repository = _Profiles()
      ..places = _places
      ..resolutionFailures.add(StateError('provider resolution detail'));
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await tester.enterText(find.byType(TextField), 'My birth profile');
    await _toPlace(tester);
    await tester.enterText(find.byType(TextField), 'Ludhiana');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Ludhiana, Punjab, India'));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pump();
    await tester.tap(find.text('Continue'));
    await tester.pump();
    expect(repository.resolutionPlaceIds, ['place-a', 'place-a']);
    expect(find.text('Review profile'), findsOneWidget);
    expect(find.text('My birth profile'), findsOneWidget);
    expect(find.text('Ludhiana, Punjab, India'), findsWidgets);
    expect(
      find.text('We could not complete that request. Please try again.'),
      findsNothing,
    );
    scope.dispose();
  });

  testWidgets('create pending state keeps the review stable', (tester) async {
    final repository = _Profiles()
      ..places = _places
      ..pendingCreates = true;
    final scope = _Scope(repository);
    await scope.auth.restore();
    await tester.pumpWidget(scope.app());
    await _toResolvedReview(tester);
    await tester.tap(find.text('Create Profile'));
    await tester.pump();
    expect(repository.createCallCount, 1);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Review profile'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('create cannot be submitted twice while pending', (tester) async {
    final repository = _Profiles()
      ..places = _places
      ..pendingCreates = true;
    final scope = _Scope(repository);
    await scope.auth.restore();
    await tester.pumpWidget(scope.app());
    await _toResolvedReview(tester);
    await tester.tap(find.text('Create Profile'));
    await tester.pump();
    await tester.tap(find.byType(FilledButton));
    await tester.pump();
    expect(repository.createCallCount, 1);
    scope.dispose();
  });

  testWidgets('create failure retries successfully and navigates home', (
    tester,
  ) async {
    final repository = _Profiles()
      ..places = _places
      ..createFailures.add(StateError('provider create detail'));
    final scope = _Scope(repository);
    await scope.auth.restore();
    await tester.pumpWidget(scope.app());
    await _toResolvedReview(tester);
    await tester.tap(find.text('Create Profile'));
    await tester.pump();
    expect(
      find.text('We could not complete that request. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('provider create detail'), findsNothing);
    expect(find.text('Review profile'), findsOneWidget);
    await tester.tap(find.text('Create Profile'));
    await tester.pumpAndSettle();
    expect(repository.createCallCount, 2);
    expect(repository.createdProfiles, hasLength(1));
    expect(find.text('Home destination'), findsOneWidget);
    scope.dispose();
  });
}

const _places = [
  PlaceCandidate(
    id: 'place-a',
    label: 'Ludhiana, Punjab, India',
    latitude: 30.9,
    longitude: 75.8,
    timezone: 'Asia/Kolkata',
    timezoneProvenance: {},
  ),
  PlaceCandidate(
    id: 'place-b',
    label: 'Mumbai, Maharashtra, India',
    latitude: 19.1,
    longitude: 72.9,
    timezone: 'Asia/Kolkata',
    timezoneProvenance: {},
  ),
];

ResolvedBirthData _resolution(String timezone) => ResolvedBirthData({
  'localDate': '2000-01-01',
  'localTime': '12:00:00',
  'timezone': timezone,
});

Future<void> _toPlace(WidgetTester tester) async {
  await tester.tap(find.text('Continue'));
  await tester.pump();
  await tester.tap(find.text('Select date'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
  await tester.tap(find.text('Select time'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
}

Future<void> _toTime(WidgetTester tester) async {
  await tester.tap(find.text('Continue'));
  await tester.pump();
  await tester.tap(find.text('Select date'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
}

Future<void> _toResolvedReview(WidgetTester tester) async {
  await _toPlace(tester);
  await tester.enterText(find.byType(TextField), 'Ludhiana');
  await tester.pump(const Duration(milliseconds: 400));
  await tester.tap(find.text('Ludhiana, Punjab, India'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
  expect(find.text('Review profile'), findsOneWidget);
}

Future<void> _editReviewRow(WidgetTester tester, int index) async {
  await tester.tap(find.text('Edit').at(index));
  await tester.pump();
}

Future<void> _changeDate(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.calendar_today_outlined));
  await tester.pumpAndSettle();
  final picker = tester.widget<CalendarDatePicker>(
    find.byType(CalendarDatePicker),
  );
  final initial = picker.initialDate!;
  final target =
      initial.day == DateUtils.getDaysInMonth(initial.year, initial.month)
      ? initial.subtract(const Duration(days: 1))
      : initial.add(const Duration(days: 1));
  await tester.tap(find.text('${target.day}').first);
  await tester.pump();
  await tester.tap(find.text('OK'));
  await tester.pump();
}

Future<void> _changeTime(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.access_time));
  await tester.pumpAndSettle();
  await tester.tap(find.byIcon(Icons.keyboard_outlined));
  await tester.pump();
  await tester.enterText(find.byType(TextFormField).first, '1');
  await tester.enterText(find.byType(TextFormField).last, '30');
  await tester.pump();
  await tester.tap(find.text('OK'));
  await tester.pump();
}

Future<void> _resolveAgain(WidgetTester tester) async {
  await tester.tap(find.text('Continue'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
}

Future<void> _resolveAfterTimeChange(WidgetTester tester) async {
  await tester.tap(find.text('Continue'));
  await tester.pump();
  await tester.tap(find.text('Continue'));
  await tester.pump();
}

class _Scope {
  _Scope([BirthProfileRepository? repository])
    : _repository = repository ?? _Profiles();
  final authSource = _Auth();
  final BirthProfileRepository _repository;
  late final auth = AuthController(authSource);
  late final controller = ProfileController(_repository, auth);
  Widget app() {
    final router = GoRouter(
      initialLocation: '/onboarding',
      routes: [
        GoRoute(
          path: '/onboarding',
          builder: (_, state) =>
              BirthProfileOnboardingScreen(controller: controller),
        ),
        GoRoute(
          path: '/home',
          builder: (_, state) => const Scaffold(body: Text('Home destination')),
        ),
      ],
    );
    return MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }

  void dispose() {
    controller.dispose();
    auth.dispose();
  }
}

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 't';
  @override
  Future<String?> refreshAccessToken() async => 't';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'u');
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
  List<PlaceCandidate> places = const [];
  bool pendingSearches = false;
  bool pendingResolutions = false;
  final pending = <String, Completer<List<PlaceCandidate>>>{};
  final pendingResolution = <String, Completer<ResolvedBirthData>>{};
  final createFailures = <Object>[];
  bool pendingCreates = false;
  final pendingCreate = Completer<BirthProfile>();
  String? resolvedPlaceId;
  final resolutionPlaceIds = <String>[];
  ResolvedBirthData? createdBirthData;
  final createdProfiles = <BirthProfile>[];
  final resolutionFailures = <Object>[];
  int createCallCount = 0;
  @override
  Future<List<BirthProfile>> list() async => const [];
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) {
    if (!pendingSearches) return Future.value(places);
    return (pending[query] ??= Completer<List<PlaceCandidate>>()).future;
  }

  void completeSearch(String query, List<PlaceCandidate> value) =>
      pending[query]!.complete(value);

  void completeResolution(String placeId, ResolvedBirthData value) =>
      pendingResolution[placeId]!.complete(value);

  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async {
    resolvedPlaceId = placeId;
    resolutionPlaceIds.add(placeId);
    if (resolutionFailures.isNotEmpty) throw resolutionFailures.removeAt(0);
    if (pendingResolutions) {
      return (pendingResolution[placeId] ??= Completer<ResolvedBirthData>())
          .future;
    }
    return ResolvedBirthData({
      'localDate': localDate,
      'localTime': localTime,
      'timezone': 'Asia/Kolkata',
    });
  }

  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async {
    createCallCount++;
    if (createFailures.isNotEmpty) throw createFailures.removeAt(0);
    if (pendingCreates) return pendingCreate.future;
    createdBirthData = birthData;
    final profile = BirthProfile(
      id: 'created',
      displayLabel: displayLabel,
      birthData: birthData,
      status: 'ACTIVE',
    );
    createdProfiles.add(profile);
    return profile;
  }

  @override
  Future<BirthProfile> get(String id) async => throw UnimplementedError();
}
