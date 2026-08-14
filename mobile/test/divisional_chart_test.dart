import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/divisional/divisional_chart_controller.dart';
import 'package:kundlinsights_mobile/features/divisional/domain/divisional_chart.dart';
import 'package:kundlinsights_mobile/features/divisional/domain/divisional_chart_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  test(
    'D9 and D10 parsing preserves API-authoritative sign, degree, and house',
    () {
      final d9 = DivisionalChart.fromJson(
        _dto('profile-a', DivisionalChartType.d9),
      );
      final d10 = DivisionalChart.fromJson(
        _dto('profile-a', DivisionalChartType.d10),
      );

      expect(d9.type, DivisionalChartType.d9);
      expect(d10.type, DivisionalChartType.d10);
      expect(d9.houses, hasLength(12));
      expect(d10.houses, hasLength(12));
      expect(d9.planets, hasLength(9));
      expect(d10.planets, hasLength(9));
      final d9Sun = d9.planets.first;
      expect(d9Sun.sign.englishName, 'Virgo');
      expect(d9Sun.house, 7);
      expect(d9Sun.degreeWithinSign, 12.345);
      expect(d10.planets.first.sign.englishName, 'Aries');
      expect(d10.planets.first.house, 4);
    },
  );

  test('divisional state clears for profile and user changes but survives same-subject refresh', () async {
    final source = _AuthSource();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(source), auth);
    await profiles.load();
    final repository = _Charts();
    final controller = DivisionalChartController(repository, auth, profiles);

    await controller.load(DivisionalChartType.d9);
    expect(controller.chart(DivisionalChartType.d9)!.birthProfileId, 'a');
    source.refresh();
    await _settle();
    expect(controller.chart(DivisionalChartType.d9)!.birthProfileId, 'a');

    profiles.select(profiles.profiles.last);
    expect(controller.chart(DivisionalChartType.d9), isNull);
    await controller.load(DivisionalChartType.d10);
    expect(controller.chart(DivisionalChartType.d10)!.birthProfileId, 'b');

    source.switchSubject('user-b');
    expect(controller.chart(DivisionalChartType.d10), isNull);
    await _settle();
    await controller.load(DivisionalChartType.d9);
    expect(controller.chart(DivisionalChartType.d9)!.birthProfileId, 'b-1');

    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

Map<String, dynamic> _dto(String id, DivisionalChartType type) {
  final d9 = type == DivisionalChartType.d9;
  final houses = List.generate(
    12,
    (index) => {
      'house': index + 1,
      'sign': _sign(
        index + 1,
        d9 ? 'Sign ${index + 1}' : 'D10 Sign ${index + 1}',
      ),
    },
  );
  houses[0]['sign'] = _sign(1, d9 ? 'Aries' : 'Aries');
  houses[6]['sign'] = _sign(7, 'Virgo');
  houses[3]['sign'] = _sign(4, 'Aries');
  final planets = List.generate(9, (index) {
    final d9Sun = d9 && index == 0;
    final d10Sun = !d9 && index == 0;
    final house = d9Sun
        ? 7
        : d10Sun
        ? 4
        : index + 1;
    return {
      'body': DivisionalChart.grahas[index],
      'sign': houses[house - 1]['sign'],
      'degreeWithinSign': d9Sun ? 12.345 : index + .5,
      'house': house,
    };
  });
  return {
    'birthProfileId': id,
    'chart': type.apiName,
    'ascendant': {
      'body': 'Ascendant',
      'sign': houses[0]['sign'],
      'degreeWithinSign': 1.25,
      'house': 1,
    },
    'houses': houses,
    'planets': planets,
  };
}

Map<String, dynamic> _sign(int index, String name) => {
  'rashiIndex': index,
  'sanskritName': name,
  'englishName': name,
};

class _Charts implements DivisionalChartRepository {
  @override
  Future<DivisionalChart> getChart({
    required String birthProfileId,
    required DivisionalChartType type,
  }) async => DivisionalChart.fromJson(_dto(birthProfileId, type));
}

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
