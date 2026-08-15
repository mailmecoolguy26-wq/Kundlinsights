import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/transits/domain/transit_snapshot.dart';
import 'package:kundlinsights_mobile/features/transits/domain/transit_snapshot_repository.dart';
import 'package:kundlinsights_mobile/features/transits/transit_snapshot_controller.dart';

void main() {
  test('preserves backend fields and rejects invalid Graha collections', () {
    final snapshot = TransitSnapshot.fromJson(_json('a'));
    expect(snapshot.planets, hasLength(9));
    final sun = snapshot.planets.first;
    expect(sun.sign.englishName, 'Backend supplied sign');
    expect(sun.degreeWithinSign, 99.75);
    expect(sun.natalHouse, 12);
    expect(sun.retrograde, isTrue);
    expect(snapshot.sadeSati.phase, 'rising');
    expect(
      () => TransitSnapshot.fromJson({..._json('a'), 'planets': []}),
      throwsFormatException,
    );
  });

  test(
    'isolates profile, user, stale profile, and stale refresh requests',
    () async {
      final authSource = _Auth();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await profiles.load();
      final repo = _Repo();
      final controller = TransitSnapshotController(
        repo,
        auth,
        profiles,
        now: () => DateTime.utc(2027),
      );
      await _settle();
      repo.complete('a', _snapshot('a'));
      await _settle();
      expect(controller.snapshot?.birthProfileId, 'a');

      profiles.select(profiles.profiles.last);
      expect(controller.snapshot, isNull);
      await _settle();
      repo.complete('b', _snapshot('b'));
      await _settle();
      expect(controller.snapshot?.birthProfileId, 'b');

      authSource.refresh();
      await _settle();
      expect(controller.snapshot?.birthProfileId, 'b');

      final first = controller.refresh();
      await _settle();
      final second = controller.refresh();
      await _settle();
      repo.completeLatest('b', _snapshot('b'));
      await second;
      repo.complete('b', _snapshot('b'));
      await first;
      expect(controller.snapshot?.birthProfileId, 'b');

      authSource.switchSubject('user-b');
      expect(controller.snapshot, isNull);
      await _settle();
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);
TransitSnapshot _snapshot(String id) => TransitSnapshot.fromJson(_json(id));
Map<String, dynamic> _json(String id) => {
  'birthProfileId': id,
  'at': '2027-01-01T00:00:00.000Z',
  'planets': List.generate(
    TransitSnapshot.grahas.length,
    (i) => {
      'planet': TransitSnapshot.grahas[i],
      'longitude': i == 0 ? 1.0 : i + .0,
      'sign': {
        'rashiIndex': 12,
        'sanskritName': 'Test',
        'englishName': i == 0 ? 'Backend supplied sign' : 'Test',
      },
      'degreeWithinSign': i == 0 ? 99.75 : 1.0,
      'natalHouse': i == 0 ? 12 : 1,
      'motion': 'direct',
      'retrograde': i == 0,
    },
  ),
  'sadeSati': {'active': true, 'phase': 'rising', 'houseFromNatalMoon': 12},
};

class _Repo implements TransitSnapshotRepository {
  final _pending = <String, List<Completer<TransitSnapshot>>>{};
  @override
  Future<TransitSnapshot> getTransitSnapshot({
    required String birthProfileId,
    required DateTime atUtc,
  }) {
    final c = Completer<TransitSnapshot>();
    (_pending[birthProfileId] ??= []).add(c);
    return c.future;
  }

  void complete(String id, TransitSnapshot value) =>
      _pending[id]!.removeAt(0).complete(value);
  void completeLatest(String id, TransitSnapshot value) =>
      _pending[id]!.removeLast().complete(value);
}

class _Auth implements AuthRepository {
  String subject = 'user-a';
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
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
  void refresh() =>
      _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
  void switchSubject(String next) {
    subject = next;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: next));
  }
}

class _Profiles implements BirthProfileRepository {
  _Profiles(this.auth);
  final _Auth auth;
  @override
  Future<List<BirthProfile>> list() async => [
    _profile(auth.subject == 'user-a' ? 'a' : 'u-b'),
    if (auth.subject == 'user-a') _profile('b'),
  ];
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
