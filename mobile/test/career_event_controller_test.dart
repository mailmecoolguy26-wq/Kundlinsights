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

void main() {
  test(
    'loads backend ordering and preserves it on same-user refresh',
    () async {
      final source = _Auth();
      final auth = AuthController(source);
      await auth.restore();
      final profiles = ProfileController(_Profiles(source), auth);
      await Future<void>.delayed(Duration.zero);
      final repo = _Events();
      final controller = CareerEventController(repo, auth, profiles);
      await Future<void>.delayed(Duration.zero);
      expect(controller.state, CareerEventLoadState.loaded);
      expect(controller.events.map((item) => item.careerEventId), [
        'year',
        'day',
      ]);
      source.refresh();
      await Future<void>.delayed(Duration.zero);
      expect(controller.events.map((item) => item.careerEventId), [
        'year',
        'day',
      ]);
      expect(repo.listCalls, 1);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'profile switch clears immediately and suppresses stale list response',
    () async {
      final source = _Auth();
      final auth = AuthController(source);
      await auth.restore();
      final profiles = ProfileController(_Profiles(source, two: true), auth);
      await Future<void>.delayed(Duration.zero);
      final repo = _Events(pendingA: true);
      final controller = CareerEventController(repo, auth, profiles);
      expect(controller.state, CareerEventLoadState.loading);
      profiles.select(profiles.profiles.last);
      expect(controller.events, isEmpty);
      await Future<void>.delayed(Duration.zero);
      expect(controller.events.single.careerEventId, 'profile-b');
      repo.a.complete([_event('profile-a')]);
      await Future<void>.delayed(Duration.zero);
      expect(controller.events.single.careerEventId, 'profile-b');
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('user switch and logout clear scoped state', () async {
    final source = _Auth();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(source), auth);
    await Future<void>.delayed(Duration.zero);
    final controller = CareerEventController(_Events(), auth, profiles);
    await Future<void>.delayed(Duration.zero);
    expect(controller.events, isNotEmpty);
    source.switchSubject('user-b');
    expect(controller.events, isEmpty);
    await Future<void>.delayed(Duration.zero);
    source.logout();
    expect(controller.events, isEmpty);
    expect(controller.state, CareerEventLoadState.initial);
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test('late profile-A mutation cannot change profile-B state', () async {
    final source = _Auth();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(source, two: true), auth);
    await Future<void>.delayed(Duration.zero);
    final repo = _Events(pendingMutation: true);
    final controller = CareerEventController(repo, auth, profiles);
    await Future<void>.delayed(Duration.zero);
    final write = controller.create(_input);
    await Future<void>.delayed(Duration.zero);
    profiles.select(profiles.profiles.last);
    await Future<void>.delayed(Duration.zero);
    expect(controller.events.single.careerEventId, 'profile-b');
    repo.mutation.complete(_event('profile-a'));
    expect(await write, isFalse);
    expect(controller.events.single.careerEventId, 'profile-b');
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test('create pending and failure preserve the loaded list', () async {
    final source = _Auth();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(source), auth);
    await Future<void>.delayed(Duration.zero);
    final repo = _Events(pendingMutation: true);
    final controller = CareerEventController(repo, auth, profiles);
    await Future<void>.delayed(Duration.zero);
    final create = controller.create(_input);
    expect(controller.mutationState, CareerEventMutationState.creating);
    expect(controller.events, isNotEmpty);
    repo.mutation.completeError(StateError('offline'));
    expect(await create, isFalse);
    expect(controller.state, CareerEventLoadState.loaded);
    expect(controller.events, isNotEmpty);
    expect(controller.mutationState, CareerEventMutationState.error);
    controller.clearMutationError();
    expect(controller.mutationState, CareerEventMutationState.idle);
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test('update and delete expose distinct pending states', () async {
    final source = _Auth();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(source), auth);
    await Future<void>.delayed(Duration.zero);
    final updateRepo = _Events(pendingMutation: true);
    final controller = CareerEventController(updateRepo, auth, profiles);
    await Future<void>.delayed(Duration.zero);
    final update = controller.update('year', _input);
    expect(controller.mutationState, CareerEventMutationState.updating);
    updateRepo.mutation.complete(_event('profile-a'));
    expect(await update, isTrue);
    expect(controller.mutationState, CareerEventMutationState.idle);
    controller.dispose();
    final deleteRepo = _Events(pendingMutation: true);
    final deleting = CareerEventController(deleteRepo, auth, profiles);
    await Future<void>.delayed(Duration.zero);
    final delete = deleting.delete('year');
    expect(deleting.mutationState, CareerEventMutationState.deleting);
    deleteRepo.mutation.complete(_event('profile-a'));
    expect(await delete, isTrue);
    expect(deleting.mutationState, CareerEventMutationState.idle);
    deleting.dispose();
    profiles.dispose();
    auth.dispose();
  });
}

class _Events implements CareerEventRepository {
  _Events({this.pendingA = false, this.pendingMutation = false});
  final bool pendingA;
  final bool pendingMutation;
  final a = Completer<List<CareerEvent>>();
  final mutation = Completer<CareerEvent>();
  int listCalls = 0;
  @override
  Future<List<CareerEvent>> listCareerEvents(String id) {
    listCalls++;
    if (pendingA && id == 'profile-a') return a.future;
    return Future.value(
      id == 'profile-a'
          ? [_event(id), _event(id, eventId: 'day')]
          : [_event(id)],
    );
  }

  @override
  Future<CareerEvent> createCareerEvent(String _, CareerEventInput input) =>
      pendingMutation ? mutation.future : throw UnimplementedError();
  @override
  Future<CareerEvent> updateCareerEvent(
    String _,
    String eventId,
    CareerEventInput input,
  ) => pendingMutation ? mutation.future : throw UnimplementedError();
  @override
  Future<CareerEvent> deleteCareerEvent(String _, String eventId) =>
      pendingMutation ? mutation.future : throw UnimplementedError();
}

const _input = CareerEventInput(
  eventType: CareerEventType.promotion,
  eventDate: CareerEventDate(
    precision: CareerEventDatePrecision.year,
    year: 2021,
  ),
);

CareerEvent _event(String id, {String? eventId}) => CareerEvent(
  careerEventId:
      eventId ??
      (id == 'profile-a'
          ? 'year'
          : id == 'profile-b'
          ? 'profile-b'
          : 'day'),
  birthProfileId: id,
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

class _Auth implements AuthRepository {
  String subject = 'user-a';
  final stream = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => stream.stream;
  @override
  Future<String?> accessToken() async => 't';
  @override
  Future<String?> refreshAccessToken() async => 't';
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
  void switchSubject(String next) {
    subject = next;
    stream.add(AuthSnapshot(AuthStatus.authenticated, subject: next));
  }

  void refresh() =>
      stream.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
  void logout() => stream.add(const AuthSnapshot(AuthStatus.unauthenticated));
}

class _Profiles implements BirthProfileRepository {
  _Profiles(this.auth, {this.two = false});
  final _Auth auth;
  final bool two;
  @override
  Future<List<BirthProfile>> list() async => two
      ? [_profile('profile-a'), _profile('profile-b')]
      : [_profile(auth.subject == 'user-a' ? 'profile-a' : 'profile-b')];
  BirthProfile _profile(String id) => BirthProfile(
    id: id,
    displayLabel: id,
    birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
    status: 'active',
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
