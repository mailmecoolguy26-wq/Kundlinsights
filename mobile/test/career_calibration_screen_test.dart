import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_events/career_event_controller.dart';
import 'package:kundlinsights_mobile/features/career_events/domain/career_event.dart';
import 'package:kundlinsights_mobile/features/career_events/domain/career_event_repository.dart';
import 'package:kundlinsights_mobile/features/career_events/presentation/career_calibration_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  testWidgets('empty history shows the calibration introduction', (
    tester,
  ) async {
    final scope = await _scope(events: const []);
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();
    expect(find.text('Help us learn from your career journey'), findsOneWidget);
    expect(find.text('Step 1 of 1'), findsOneWidget);
    await _revealStart(tester);
    expect(find.byKey(const ValueKey('start-calibration')), findsOneWidget);
    expect(
      find.textContaining('Year or month precision is supported'),
      findsOneWidget,
    );
    expect(find.textContaining('3–5'), findsNothing);
    scope.dispose();
  });

  testWidgets('Career History back button returns to the pushed screen', (
    tester,
  ) async {
    final scope = await _scope(events: const []);
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () => Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (_) =>
                      CareerCalibrationScreen(controller: scope.controller),
                ),
              ),
              child: const Text('Open Career History'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open Career History'));
    await tester.pumpAndSettle();
    expect(find.byType(BackButton), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Open Career History'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('Career History back button falls back to Profile when direct', (
    tester,
  ) async {
    final scope = await _scope(events: const []);
    final router = GoRouter(
      initialLocation: '/career',
      routes: [
        GoRoute(
          path: '/career',
          builder: (_, _) =>
              CareerCalibrationScreen(controller: scope.controller),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, _) => const Scaffold(body: Text('Profile parent')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Profile parent'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('close action retains the direct Profile fallback', (
    tester,
  ) async {
    final scope = await _scope(events: const []);
    final router = GoRouter(
      initialLocation: '/career',
      routes: [
        GoRoute(
          path: '/career',
          builder: (_, _) =>
              CareerCalibrationScreen(controller: scope.controller),
        ),
        GoRoute(
          path: '/profile',
          builder: (_, _) => const Scaffold(body: Text('Profile parent')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('calibration-close')));
    await tester.pumpAndSettle();
    expect(find.text('Profile parent'), findsOneWidget);
    scope.dispose();
  });

  testWidgets('dirty form confirms app-bar back and allows discard', (
    tester,
  ) async {
    final scope = await _scope(events: const []);
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();

    await _revealStart(tester);
    await tester.tap(find.byKey(const ValueKey('start-calibration')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField).first, '2020');
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.text('Discard changes?'), findsOneWidget);
    await tester.tap(find.text('Keep editing'));
    await tester.pumpAndSettle();
    expect(find.byType(CareerEventFormScreen), findsOneWidget);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Discard'));
    await tester.pumpAndSettle();
    await _revealStart(tester);
    expect(find.byKey(const ValueKey('start-calibration')), findsOneWidget);
    scope.dispose();
  });

  testWidgets('unchanged form exits through system back', (tester) async {
    final scope = await _scope(events: const []);
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();

    await _revealStart(tester);
    await tester.tap(find.byKey(const ValueKey('start-calibration')));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    await _revealStart(tester);
    expect(find.byKey(const ValueKey('start-calibration')), findsOneWidget);
    scope.dispose();
  });

  testWidgets('existing events use dark review cards with truthful precision', (
    tester,
  ) async {
    final scope = await _scope(
      events: [
        _event(
          'event-day',
          CareerEventDatePrecision.day,
          input: const CareerEventInput(
            eventType: CareerEventType.promotion,
            eventDate: CareerEventDate(
              precision: CareerEventDatePrecision.day,
              year: 2021,
              month: 4,
              day: 5,
            ),
            title: 'Senior Analyst',
          ),
        ),
        _event('event-month', CareerEventDatePrecision.month),
      ],
    );
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();

    expect(find.text('Your Career Events'), findsOneWidget);
    expect(find.text('2 events saved'), findsOneWidget);
    expect(find.byKey(const ValueKey('saved-event-count')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('career-history-ready-card')),
      findsNothing,
    );
    expect(find.text('Senior Analyst'), findsOneWidget);
    expect(find.text('Help us learn from your career journey'), findsNothing);
    expect(find.text('Step 2 of 4'), findsNothing);
    final localizations = MaterialLocalizations.of(
      tester.element(find.byKey(const ValueKey('career-event-event-day'))),
    );
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('career-event-event-day')),
        matching: find.text(
          localizations.formatMediumDate(DateTime(2021, 4, 5)),
        ),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('career-event-event-month')),
        matching: find.text(localizations.formatMonthYear(DateTime(2021, 4))),
      ),
      findsOneWidget,
    );
    final eventCard = tester.widget<Container>(
      find.byKey(const ValueKey('career-event-event-day')),
    );
    expect(
      (eventCard.decoration! as BoxDecoration).color,
      const Color(0xFF120D29),
    );
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('career-event-event-day')),
        matching: find.byType(Card),
      ),
      findsNothing,
    );
    await _revealAdd(tester);
    expect(find.byKey(const ValueKey('add-career-event')), findsOneWidget);
    expect(tester.takeException(), isNull);
    scope.dispose();
  });

  testWidgets('year-only career events do not invent a month or day', (
    tester,
  ) async {
    final scope = await _scope(
      events: [_event('event-year', CareerEventDatePrecision.year)],
    );
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();

    expect(
      find.descendant(
        of: find.byKey(const ValueKey('career-event-event-year')),
        matching: find.text('2021'),
      ),
      findsOneWidget,
    );
    expect(find.textContaining('April 2021'), findsNothing);
    scope.dispose();
  });

  testWidgets('existing review preserves edit, delete, and add actions', (
    tester,
  ) async {
    final scope = await _scope(
      events: [_event('event-1', CareerEventDatePrecision.year)],
    );
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('edit-career-event-event-1')));
    await tester.pumpAndSettle();
    expect(find.byType(CareerEventFormScreen), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('delete-career-event-event-1')));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);

    await tester.tap(find.byKey(const ValueKey('add-career-event')));
    await tester.pumpAndSettle();
    expect(find.byType(CareerEventFormScreen), findsOneWidget);
    scope.dispose();
  });
}

Widget _app(CareerEventController controller) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: CareerCalibrationScreen(controller: controller),
);

Future<void> _revealStart(WidgetTester tester) => tester.scrollUntilVisible(
  find.byKey(const ValueKey('start-calibration')),
  180,
  scrollable: find.byType(Scrollable).first,
);

Future<void> _revealAdd(WidgetTester tester) => tester.scrollUntilVisible(
  find.byKey(const ValueKey('add-career-event')),
  180,
  scrollable: find.byType(Scrollable).first,
);

Future<_Scope> _scope({
  List<CareerEvent> events = const [],
  _Events? repository,
}) async {
  final authSource = _Auth();
  final auth = AuthController(authSource);
  await auth.restore();
  final profiles = ProfileController(_Profiles(), auth);
  await profiles.load();
  final eventsRepository = repository ?? _Events();
  eventsRepository.events = events;
  final controller = CareerEventController(eventsRepository, auth, profiles);
  return _Scope(auth, profiles, controller);
}

class _Scope {
  _Scope(this.auth, this.profiles, this.controller);
  final AuthController auth;
  final ProfileController profiles;
  final CareerEventController controller;
  void dispose() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
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

final _profile = BirthProfile(
  id: 'profile-a',
  displayLabel: 'Profile',
  birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
  status: 'active',
);

class _Events implements CareerEventRepository {
  List<CareerEvent> events = const [];
  CareerEventInput? lastInput;
  @override
  Future<List<CareerEvent>> listCareerEvents(String id) async => events;
  @override
  Future<CareerEvent> createCareerEvent(
    String id,
    CareerEventInput input,
  ) async {
    lastInput = input;
    final event = _event('new', input.eventDate.precision, input: input);
    events = [...events, event];
    return event;
  }

  @override
  Future<CareerEvent> updateCareerEvent(
    String id,
    String eventId,
    CareerEventInput input,
  ) => throw UnimplementedError();
  @override
  Future<CareerEvent> deleteCareerEvent(String id, String eventId) =>
      throw UnimplementedError();
}

CareerEvent _event(
  String id,
  CareerEventDatePrecision precision, {
  CareerEventInput? input,
}) => CareerEvent(
  careerEventId: id,
  birthProfileId: 'profile-a',
  eventType: input?.eventType ?? CareerEventType.promotion,
  eventDate:
      input?.eventDate ??
      CareerEventDate(
        precision: precision,
        year: 2021,
        month: precision == CareerEventDatePrecision.year ? null : 4,
        day: precision == CareerEventDatePrecision.day ? 5 : null,
      ),
  title: input?.title,
  notes: input?.notes,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
);
