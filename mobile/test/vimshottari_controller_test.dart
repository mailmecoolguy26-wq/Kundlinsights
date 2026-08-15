import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari.dart';
import 'package:kundlinsights_mobile/features/vimshottari/domain/vimshottari_repository.dart';
import 'package:kundlinsights_mobile/features/vimshottari/vimshottari_controller.dart';

void main() {
  test('clears Dasha for profile and user changes while same-user refresh preserves it', () async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await profiles.load();
    final repository = _Repository();
    final controller = VimshottariController(
      repository,
      auth,
      profiles,
      now: () => DateTime.utc(2027),
    );
    await _settle();
    expect(controller.current!.birthProfileId, 'a');
    await controller.loadTimeline();
    expect(controller.timeline!.birthProfileId, 'a');

    profiles.select(profiles.profiles.last);
    expect(controller.current, isNull);
    expect(controller.timeline, isNull);
    await _settle();
    expect(controller.current!.birthProfileId, 'b');
    expect(controller.timeline!.birthProfileId, 'b');

    final calls = repository.currentCalls;
    authSource.refresh();
    await _settle();
    expect(repository.currentCalls, calls);
    expect(controller.current!.birthProfileId, 'b');

    authSource.switchSubject('user-b');
    expect(controller.current, isNull);
    await _settle();
    expect(controller.current!.birthProfileId, 'b-1');

    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test(
    'does not allow stale timeline requests to overwrite a new level',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await profiles.load();
      final repository = _Repository(deferFirstTimeline: true);
      final controller = VimshottariController(
        repository,
        auth,
        profiles,
        now: () => DateTime.utc(2027),
      );
      await _settle();

      final first = controller.loadTimeline(level: VimshottariLevel.md);
      await _settle();
      final second = controller.loadTimeline(level: VimshottariLevel.pd);
      await _settle();
      expect(controller.timelineLevel, VimshottariLevel.pd);
      expect(controller.timeline!.level, VimshottariLevel.pd);
      repository.firstTimeline.complete(_timeline('a', VimshottariLevel.md));
      await first;
      await second;
      expect(controller.timeline!.level, VimshottariLevel.pd);

      await controller.loadTimeline(
        windowDays: VimshottariController.maxWindowDays,
      );
      expect(controller.timelineState, VimshottariLoadState.loaded);
      await controller.loadTimeline(
        windowDays: VimshottariController.maxWindowDays + 1,
      );
      expect(controller.timelineState, VimshottariLoadState.error);
      expect(repository.timelineCalls, 3);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

class _Repository implements VimshottariRepository {
  _Repository({this.deferFirstTimeline = false});
  final bool deferFirstTimeline;
  final firstTimeline = Completer<VimshottariTimeline>();
  int currentCalls = 0;
  int timelineCalls = 0;
  @override
  Future<VimshottariCurrent> getCurrent({
    required String birthProfileId,
    required DateTime atUtc,
  }) async {
    currentCalls++;
    return _current(birthProfileId);
  }

  @override
  Future<VimshottariTimeline> getTimeline({
    required String birthProfileId,
    required DateTime fromUtc,
    required DateTime toUtc,
    required VimshottariLevel level,
  }) {
    timelineCalls++;
    if (deferFirstTimeline && timelineCalls == 1) return firstTimeline.future;
    return Future.value(_timeline(birthProfileId, level));
  }
}

VimshottariCurrent _current(String id) => VimshottariCurrent(
  birthProfileId: id,
  at: '2027-01-01T00:00:00.000Z',
  mahadasha: _period('Mercury'),
  antardasha: _period('Venus'),
  pratyantardasha: _period('Sun'),
);
VimshottariTimeline _timeline(String id, VimshottariLevel level) =>
    VimshottariTimeline(
      birthProfileId: id,
      level: level,
      from: '2027-01-01T00:00:00.000Z',
      to: '2028-01-01T00:00:00.000Z',
      periods: [_period('Mercury')],
    );
DashaPeriod _period(String lord) => DashaPeriod(
  lord: lord,
  start: '2027-01-01T00:00:00.000Z',
  end: '2027-02-01T00:00:00.000Z',
);

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
  void refresh() =>
      _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
  void switchSubject(String value) {
    subject = value;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: value));
  }
}

class _Profiles implements BirthProfileRepository {
  _Profiles(this.auth);
  final _AuthSource auth;
  @override
  Future<List<BirthProfile>> list() async => auth.subject == 'user-b'
      ? [_profile('b-1')]
      : [_profile('a'), _profile('b')];
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
  BirthProfile _profile(String id) => BirthProfile(
    id: id,
    displayLabel: id,
    status: 'active',
    birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
  );
}
