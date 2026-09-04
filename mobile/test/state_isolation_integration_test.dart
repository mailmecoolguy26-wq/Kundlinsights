import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/career_events/career_event_controller.dart';
import 'package:kundlinsights_mobile/features/career_events/domain/career_event.dart';
import 'package:kundlinsights_mobile/features/career_events/domain/career_event_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/career_reading_generation.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';
import 'package:kundlinsights_mobile/features/readings/reading_controller.dart';

void main() {
  test(
    'direct user switch clears every scoped feature and rejects delayed A data',
    () async {
      final source = _AuthSource();
      final auth = AuthController(source);
      await auth.restore();
      final profiles = ProfileController(_Profiles(source), auth);
      await _settle();
      final eventsRepository = _Events();
      final readingsRepository = _Readings();
      final readings = ReadingController(readingsRepository, auth, profiles);
      final events = CareerEventController(eventsRepository, auth, profiles);
      final generation = CareerReadingGenerationController(
        _Generation(),
        auth,
        profiles,
        readings,
      );
      await _settle();
      expect(profiles.activeProfile!.id, 'a');
      expect(events.state, CareerEventLoadState.loading);
      expect(readings.listState, ReadingListState.loading);

      source.switchSubject('user-b');
      expect(profiles.activeProfile, isNull);
      expect(events.events, isEmpty);
      expect(events.state, CareerEventLoadState.initial);
      expect(readings.readings, isEmpty);
      expect(readings.listState, ReadingListState.initial);
      expect(generation.generationState, CareerGenerationState.idle);
      expect(generation.canGenerate, isFalse);

      await _settle();
      expect(profiles.activeProfile!.id, 'b');
      await _settle();
      expect(events.events.single.birthProfileId, 'b');
      expect(readings.readings.single.birthProfileId, 'b');
      expect(generation.eligibilityState, CareerEligibilityState.ineligible);

      eventsRepository.completeA([_event('a')]);
      readingsRepository.completeA([_summary('a')]);
      await _settle();
      expect(events.events.single.birthProfileId, 'b');
      expect(readings.readings.single.birthProfileId, 'b');

      generation.dispose();
      events.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('profile switch clears cross-feature state while same-user refresh preserves it', () async {
    final source = _AuthSource();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(source), auth);
    await _settle();
    final readings = ReadingController(_Readings(holdA: false), auth, profiles);
    final events = CareerEventController(_Events(holdA: false), auth, profiles);
    final generation = CareerReadingGenerationController(
      _Generation(eligible: true),
      auth,
      profiles,
      readings,
    );
    await _settle();
    expect(events.events.single.birthProfileId, 'a');
    expect(readings.readings.single.birthProfileId, 'a');
    expect(generation.canGenerate, isTrue);

    source.refresh();
    await _settle();
    expect(profiles.activeProfile!.id, 'a');
    expect(events.events.single.birthProfileId, 'a');
    expect(readings.readings.single.birthProfileId, 'a');
    expect(generation.canGenerate, isTrue);

    profiles.select(profiles.profiles.last);
    expect(events.events, isEmpty);
    expect(readings.readings, isEmpty);
    expect(generation.canGenerate, isFalse);
    await _settle();
    expect(events.events.single.birthProfileId, 'a-2');
    expect(readings.readings.single.birthProfileId, 'a-2');
    expect(generation.canGenerate, isTrue);

    generation.dispose();
    events.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

class _AuthSource implements AuthRepository {
  String subject = 'user-a';
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      AuthSnapshot(AuthStatus.authenticated, subject: subject);
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
  void switchSubject(String value) {
    subject = value;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: value));
  }

  void refresh() =>
      _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
}

class _Profiles implements BirthProfileRepository {
  _Profiles(this.auth);
  final _AuthSource auth;
  @override
  Future<List<BirthProfile>> list() async => auth.subject == 'user-b'
      ? [_profile('b')]
      : [_profile('a'), _profile('a-2')];
  BirthProfile _profile(String id) => BirthProfile(
    id: id,
    displayLabel: id,
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

class _Events implements CareerEventRepository {
  _Events({this.holdA = true});
  final bool holdA;
  final a = Completer<List<CareerEvent>>();
  @override
  Future<List<CareerEvent>> listCareerEvents(String profileId) =>
      holdA && profileId == 'a' ? a.future : Future.value([_event(profileId)]);
  void completeA(List<CareerEvent> value) => a.complete(value);
  @override
  Future<CareerEvent> createCareerEvent(String _, CareerEventInput input) =>
      throw UnimplementedError();
  @override
  Future<CareerEvent> updateCareerEvent(
    String _,
    String eventId,
    CareerEventInput input,
  ) => throw UnimplementedError();
  @override
  Future<CareerEvent> deleteCareerEvent(String _, String eventId) =>
      throw UnimplementedError();
}

class _Readings implements ReadingRepository {
  _Readings({this.holdA = true});
  final bool holdA;
  final a = Completer<List<ReadingSummary>>();
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) =>
      holdA && birthProfileId == 'a'
      ? a.future
      : Future.value([_summary(birthProfileId!)]);
  void completeA(List<ReadingSummary> value) => a.complete(value);
  @override
  Future<ReadingDetail> getReadingDetail(String readingId) =>
      throw UnimplementedError();
}

class _Generation implements CareerReadingGenerationRepository {
  _Generation({this.eligible = false});
  final bool eligible;
  @override
  Future<CareerEligibility> getCareerEligibility({
    required String birthProfileId,
  }) async => CareerEligibility(eligible: eligible);
  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) => throw UnimplementedError();
}

CareerEvent _event(String profileId) => CareerEvent(
  careerEventId: 'event-$profileId',
  birthProfileId: profileId,
  eventType: CareerEventType.promotion,
  eventDate: CareerEventDate(
    precision: CareerEventDatePrecision.year,
    year: 2021,
  ),
  title: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
);

ReadingSummary _summary(String profileId) => ReadingSummary(
  readingId: 'reading-$profileId',
  birthProfileId: profileId,
  domain: 'CAREER',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  readingInstant: '2026-01-01T00:00:00.000Z',
  locale: 'en-IN',
);
