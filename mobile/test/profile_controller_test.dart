import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  test('isolates profile state across authenticated subject changes and preserves it for a same-subject refresh', () async {
    final authRepository = _Auth();
    final auth = AuthController(authRepository);
    await auth.restore();
    final repository = _Profiles();
    final controller = ProfileController(repository, auth);
    await controller.load();
    expect(controller.profiles, hasLength(2));
    expect(controller.activeProfile!.id, 'a');
    controller.select(controller.profiles.last);
    expect(controller.activeProfile!.id, 'b');

    final listCallsBeforeRefresh = repository.listCalls;
    authRepository.refresh();
    expect(repository.listCalls, listCallsBeforeRefresh);
    expect(controller.activeProfile!.id, 'b');

    repository.currentSubject = 'user-b';
    repository.holdNextLoad = true;
    authRepository.swapTo('user-b');
    expect(controller.state, ProfileLoadState.loading);
    expect(controller.profiles, isEmpty);
    expect(controller.activeProfile, isNull);
    repository.completePendingLoad();
    await Future<void>.delayed(Duration.zero);
    expect(controller.profiles.map((profile) => profile.id), ['b-1']);
    expect(controller.activeProfile!.id, 'b-1');

    final resolved = ResolvedBirthData(const {
      'localDate': '1990-11-26',
      'localTime': '13:40:00',
      'timezone': 'Asia/Kolkata',
      'utc': '1990-11-26T08:10:00.000Z',
      'latitude': 17.385,
      'longitude': 78.4867,
      'timezoneProvenance': {},
    });
    await controller.create(displayLabel: 'Riya', birthData: resolved);
    expect(identical(repository.createdData, resolved), isTrue);
    expect(controller.activeProfile!.displayLabel, 'Riya');

    await auth.logout();
    expect(controller.profiles, isEmpty);
    expect(controller.activeProfile, isNull);

    repository.currentSubject = 'user-c';
    authRepository.swapTo('user-c');
    expect(controller.profiles, isEmpty);
    expect(controller.activeProfile, isNull);
    await Future<void>.delayed(Duration.zero);
    expect(controller.profiles.map((profile) => profile.id), ['c-1']);
    controller.dispose();
    auth.dispose();
  });

  test(
    'user switch to zero profiles clears the previous active profile',
    () async {
      final source = _Auth();
      final auth = AuthController(source);
      await auth.restore();
      final repository = _Profiles();
      final controller = ProfileController(repository, auth);
      await controller.load();
      controller.select(controller.profiles.last);
      expect(controller.activeProfile!.id, 'b');

      repository.currentSubject = 'zero-profiles';
      source.swapTo('zero-profiles');
      expect(controller.profiles, isEmpty);
      expect(controller.activeProfile, isNull);
      await Future<void>.delayed(Duration.zero);
      expect(controller.state, ProfileLoadState.ready);
      expect(controller.profiles, isEmpty);
      expect(controller.activeProfile, isNull);

      controller.dispose();
      auth.dispose();
    },
  );
}

class _Auth implements AuthRepository {
  String? subject = 'user-a';
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => subject == null ? null : 'token';
  @override
  Future<String?> refreshAccessToken() async => accessToken();
  @override
  Future<AuthSnapshot> restore() async => AuthSnapshot(
    subject == null ? AuthStatus.unauthenticated : AuthStatus.authenticated,
    subject: subject,
  );
  @override
  Future<void> signIn({required String email, required String password}) async {
    subject = 'user-a';
    _states.add(
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user-a'),
    );
  }

  @override
  Future<void> signOut() async {
    subject = null;
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }

  void refresh() =>
      _states.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));
  void swapTo(String nextSubject) {
    subject = nextSubject;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: nextSubject));
  }

  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;
}

class _Profiles implements BirthProfileRepository {
  ResolvedBirthData? createdData;
  String currentSubject = 'user-a';
  int listCalls = 0;
  bool holdNextLoad = false;
  Completer<List<BirthProfile>>? _pendingLoad;
  BirthProfile _profile(String id, String label) => BirthProfile(
    id: id,
    displayLabel: label,
    status: 'active',
    birthData: ResolvedBirthData(const {
      'localDate': '1990-11-26',
      'localTime': '13:40:00',
      'timezone': 'Asia/Kolkata',
    }),
  );
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async {
    createdData = birthData;
    return BirthProfile(
      id: 'created',
      displayLabel: displayLabel,
      status: 'active',
      birthData: birthData,
    );
  }

  @override
  Future<BirthProfile> get(String id) async => _profile(id, 'Profile');
  @override
  Future<List<BirthProfile>> list() async {
    listCalls++;
    if (holdNextLoad) {
      holdNextLoad = false;
      _pendingLoad = Completer<List<BirthProfile>>();
      return _pendingLoad!.future;
    }
    return switch (currentSubject) {
      'user-a' => [_profile('a', 'A'), _profile('b', 'B')],
      'user-b' => [_profile('b-1', 'B')],
      'user-c' => [_profile('c-1', 'C')],
      'zero-profiles' => const [],
      _ => const [],
    };
  }

  void completePendingLoad() {
    final pending = _pendingLoad;
    _pendingLoad = null;
    pending?.complete(switch (currentSubject) {
      'user-b' => [_profile('b-1', 'B')],
      'user-c' => [_profile('c-1', 'C')],
      _ => const [],
    });
  }

  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async => ResolvedBirthData({
    'localDate': localDate,
    'localTime': localTime,
    'timezone': 'Asia/Kolkata',
  });
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}
