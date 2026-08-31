import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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
  testWidgets('empty history has an add event CTA', (tester) async {
    final scope = await _scope(events: const []);
    await tester.pumpWidget(_app(scope.controller));
    await tester.pumpAndSettle();
    expect(find.text('No career history added'), findsOneWidget);
    expect(find.text('Add career event'), findsWidgets);
    expect(find.text('Career History'), findsOneWidget);
    expect(find.text('Career Calibration'), findsNothing);
    scope.dispose();
  });
}

Widget _app(CareerEventController controller) => MaterialApp(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: CareerCalibrationScreen(controller: controller),
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
  title: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
);
