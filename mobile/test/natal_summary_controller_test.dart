import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary.dart';
import 'package:kundlinsights_mobile/features/natal/domain/natal_summary_repository.dart';
import 'package:kundlinsights_mobile/features/natal/natal_summary_controller.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  test(
    'scopes natal state to active profile and authenticated subject',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await profiles.load();
      final natalRepository = _NatalRepository();
      final natal = NatalSummaryController(natalRepository, auth, profiles);
      await _settle();
      expect(natal.summary!.birthProfileId, 'a');

      profiles.select(profiles.profiles.last);
      expect(natal.summary, isNull);
      expect(natal.state, NatalSummaryLoadState.loading);
      await _settle();
      expect(natal.summary!.birthProfileId, 'b');

      final callsBeforeRefresh = natalRepository.calls;
      authSource.refresh();
      await _settle();
      expect(natalRepository.calls, callsBeforeRefresh);
      expect(natal.summary!.birthProfileId, 'b');

    authSource.switchSubject('user-b');
    expect(natal.summary, isNull);
    await _settle();
    expect(natal.summary!.birthProfileId, 'b-1');

    await authSource.logout();
    expect(natal.summary, isNull);
    expect(natal.state, NatalSummaryLoadState.initial);

      natal.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );
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
  Future<void> signOut() async {
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }

  Future<void> logout() => signOut();
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
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();
  @override
  Future<BirthProfile> get(String id) => throw UnimplementedError();
  @override
  Future<List<BirthProfile>> list() async => auth.subject == 'user-b'
      ? [_profile('b-1')]
      : [_profile('a'), _profile('b')];
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
    birthData: ResolvedBirthData(const {'timezone': 'Asia/Kolkata'}),
  );
}

class _NatalRepository implements NatalSummaryRepository {
  int calls = 0;
  @override
  Future<NatalSummary> getNatalSummary(String birthProfileId) async {
    calls++;
    return _summary(
      birthProfileId == 'a' || birthProfileId == 'b' ? birthProfileId : 'b-1',
    );
  }
}

NatalSummary _summary(String id) {
  const sign = NatalSign(
    rashiIndex: 1,
    sanskritName: 'Mesha',
    englishName: 'Aries',
  );
  const nakshatra = NatalNakshatra(nakshatraIndex: 1, name: 'Ashwini');
  const ascendant = NatalPosition(
    body: 'Ascendant',
    longitude: 0,
    sign: sign,
    degreeWithinSign: 0,
    house: 1,
    nakshatra: nakshatra,
    pada: 1,
    speed: null,
    motion: null,
    retrograde: false,
  );
  final planets = Graha.values
      .map(
        (graha) => NatalPosition(
          body: graha.apiName,
          longitude: 0,
          sign: sign,
          degreeWithinSign: 0,
          house: 1,
          nakshatra: nakshatra,
          pada: 1,
          speed: 1,
          motion: 'direct',
          retrograde: false,
        ),
      )
      .toList();
  return NatalSummary(
    birthProfileId: id,
    summary: NatalIdentitySummary(
      ascendant: ascendant,
      moonSign: sign,
      moonNakshatra: nakshatra,
      moonPada: 1,
      sunSign: sign,
    ),
    planets: planets,
  );
}
