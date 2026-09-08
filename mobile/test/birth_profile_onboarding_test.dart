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
  testWidgets('renders the polished single-step birth profile form', (
    tester,
  ) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());

    expect(find.textContaining('STEP 1/1'), findsOneWidget);
    expect(find.text('Create your birth profile'), findsOneWidget);
    expect(find.text('FULL NAME'), findsOneWidget);
    expect(find.text('DATE OF BIRTH'), findsOneWidget);
    expect(find.text('TIME OF BIRTH'), findsOneWidget);
    expect(find.text('PLACE OF BIRTH'), findsOneWidget);
    expect(find.text('Vedic Time Precision'), findsOneWidget);
    expect(find.textContaining("don't know my exact birth time"), findsNothing);
    expect(_generate(tester).onPressed, isNull);
    scope.dispose();
  });

  testWidgets('uses canonical date/time and resolved backend birth data', (
    tester,
  ) async {
    final repository = _Profiles()..places = [_place];
    final scope = _Scope(repository);
    await scope.ready();
    await tester.pumpWidget(scope.app());
    await _fillValidForm(tester);

    expect(repository.resolvedPlaceId, _place.id);
    expect(
      repository.resolvedLocalDate,
      matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')),
    );
    expect(repository.resolvedLocalTime, matches(RegExp(r'^\d{2}:\d{2}:00$')));
    expect(
      find.byKey(const ValueKey('resolved-birth-details')),
      findsOneWidget,
    );
    expect(find.textContaining('28.6139° N'), findsOneWidget);
    expect(find.textContaining('UTC +05:30'), findsOneWidget);
    expect(find.text('No matching places found.'), findsNothing);
    expect(_generate(tester).onPressed, isNotNull);

    await tester.enterText(
      find.byKey(const ValueKey('birth-profile-name')),
      'Riya Sharma',
    );
    final generate = find.byKey(const ValueKey('generate-vedic-horoscope'));
    await tester.ensureVisible(generate);
    await tester.tap(generate);
    await tester.pumpAndSettle();
    expect(repository.createdBirthData, same(repository.resolution));
    expect(repository.createdLabel, 'Riya Sharma');
    expect(find.text('Home destination'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('editing place invalidates resolution and disables creation', (
    tester,
  ) async {
    final repository = _Profiles()..places = [_place];
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _fillValidForm(tester);
    expect(_generate(tester).onPressed, isNotNull);

    await tester.enterText(
      find.byKey(const ValueKey('birth-profile-place')),
      'Delhi changed',
    );
    await tester.pump();
    expect(_generate(tester).onPressed, isNull);
    scope.dispose();
  });

  testWidgets('safe resolution errors do not expose provider details', (
    tester,
  ) async {
    final repository = _Profiles()
      ..places = [_place]
      ..resolutionError = StateError('raw resolver details');
    final scope = _Scope(repository);
    await tester.pumpWidget(scope.app());
    await _setDateAndTime(tester);
    await _selectPlace(tester);

    expect(
      find.text('We could not complete that request. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('raw resolver details'), findsNothing);
    expect(_generate(tester).onPressed, isNull);
    scope.dispose();
  });

  testWidgets('add-profile mode retains the visual form and back affordance', (
    tester,
  ) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app(adding: true));
    expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    expect(find.text('Create your birth profile'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('header stays visible when the form scrolls', (tester) async {
    final scope = _Scope();
    await tester.pumpWidget(scope.app());
    await tester.drag(
      find.byType(SingleChildScrollView),
      const Offset(0, -500),
    );
    await tester.pump();
    expect(find.textContaining('STEP 1/1'), findsOneWidget);
    scope.dispose();
  });
}

final _place = PlaceCandidate(
  id: 'place-delhi',
  label: 'Delhi, India',
  latitude: 28.6139,
  longitude: 77.2090,
  timezone: 'Asia/Kolkata',
  timezoneProvenance: const {'source': 'test'},
);

Future<void> _fillValidForm(WidgetTester tester) async {
  await _setDateAndTime(tester);
  await _selectPlace(tester);
}

Future<void> _setDateAndTime(WidgetTester tester) async {
  await tester.ensureVisible(find.byKey(const ValueKey('birth-profile-date')));
  await tester.tap(find.byKey(const ValueKey('birth-profile-date')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.byKey(const ValueKey('birth-profile-time')));
  await tester.tap(find.byKey(const ValueKey('birth-profile-time')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pumpAndSettle();
}

Future<void> _selectPlace(WidgetTester tester) async {
  final field = find.byKey(const ValueKey('birth-profile-place'));
  await tester.ensureVisible(field);
  await tester.enterText(field, 'Delhi');
  await tester.pump(const Duration(milliseconds: 400));
  await tester.tap(find.text('Delhi, India'));
  await tester.pump();
}

FilledButton _generate(WidgetTester tester) => tester.widget<FilledButton>(
  find.byKey(const ValueKey('generate-vedic-horoscope')),
);

class _Scope {
  _Scope([BirthProfileRepository? repository])
    : _repository = repository ?? _Profiles();

  final _AuthSource authSource = _AuthSource();
  final BirthProfileRepository _repository;
  late final AuthController auth = AuthController(authSource);
  late final ProfileController controller = ProfileController(
    _repository,
    auth,
  );

  Future<void> ready() => auth.restore();

  Widget app({bool adding = false}) {
    final router = GoRouter(
      initialLocation: '/onboarding',
      routes: [
        GoRoute(
          path: '/onboarding',
          builder: (_, state) => BirthProfileOnboardingScreen(
            controller: controller,
            adding: adding,
          ),
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

class _AuthSource implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user-1');
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
  Object? resolutionError;
  String? resolvedPlaceId;
  String? resolvedLocalDate;
  String? resolvedLocalTime;
  String? createdLabel;
  ResolvedBirthData? createdBirthData;
  final resolution = const ResolvedBirthData({
    'localDate': '2000-01-01',
    'localTime': '12:00:00',
    'timezone': 'Asia/Kolkata',
    'utc': '2000-01-01T06:30:00.000Z',
    'latitude': 28.6139,
    'longitude': 77.2090,
    'timezoneProvenance': {'source': 'test'},
  });

  @override
  Future<List<BirthProfile>> list() async => const [];
  @override
  Future<BirthProfile> get(String id) async => throw UnimplementedError();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => places;
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async {
    resolvedPlaceId = placeId;
    resolvedLocalDate = localDate;
    resolvedLocalTime = localTime;
    if (resolutionError != null) throw resolutionError!;
    return resolution;
  }

  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async {
    createdLabel = displayLabel;
    createdBirthData = birthData;
    return BirthProfile(
      id: 'profile-1',
      displayLabel: displayLabel,
      birthData: birthData,
      status: 'ACTIVE',
    );
  }
}
