import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/ashtakavarga_controller.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/domain/ashtakavarga.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/domain/ashtakavarga_repository.dart';
import 'package:kundlinsights_mobile/features/ashtakavarga/presentation/ashtakavarga_screen.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

import 'ashtakavarga_fixture.dart';

void main() {
  test(
    'loads, reports errors, and isolates profile and authenticated user state',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _Repository();
      final controller = AshtakavargaController(repository, auth, profiles);
      await _settle();

      expect(controller.state, AshtakavargaLoadState.loaded);
      expect(controller.data!.birthProfileId, 'a');
      profiles.select(profiles.profiles.last);
      expect(controller.data, isNull);
      await _settle();
      expect(controller.data!.birthProfileId, 'b');

      final callsBeforeRefresh = repository.calls;
      authSource.refresh();
      await _settle();
      expect(repository.calls, callsBeforeRefresh);
      expect(controller.data!.birthProfileId, 'b');

      authSource.switchSubject('user-b');
      expect(controller.data, isNull);
      await _settle();
      await _settle();
      expect(controller.data!.birthProfileId, 'b-1');

      repository.failNext = true;
      controller.refresh();
      await _settle();
      expect(controller.state, AshtakavargaLoadState.error);
      expect(controller.data, isNull);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('discards stale profile and older refresh responses', () async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await _settle();
    final repository = _Repository(deferCalls: {1, 3});
    final controller = AshtakavargaController(repository, auth, profiles);
    await _settle();

    profiles.select(profiles.profiles.last);
    await _settle();
    repository.complete(1, 'a');
    await _settle();
    expect(controller.data!.birthProfileId, 'b');

    controller.refresh();
    await _settle();
    controller.refresh();
    await _settle();
    expect(controller.data!.birthProfileId, 'b');
    repository.complete(3, 'b');
    await _settle();
    expect(controller.data!.birthProfileId, 'b');

    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets('renders the factual Bhav-first Ashtakavarga screen', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(402, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await tester.pump();
    final controller = AshtakavargaController(
      _Repository(bhavFirst: true),
      auth,
      profiles,
    );
    await tester.pump();
    await tester.pumpWidget(
      MaterialApp(
        home: AshtakavargaScreen(
          profileController: profiles,
          controller: controller,
        ),
      ),
    );
    // The loaded screen contains Material/refresh animations that can keep
    // scheduling frames. The controller data is already deterministic here,
    // so advance only the frames needed to render it.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('ASHTAKAVARGA'), findsOneWidget);
    expect(find.text('Planetary Point Distribution'), findsOneWidget);
    expect(find.text('SARVASHTAKAVARGA'), findsOneWidget);
    expect(find.text('1st Bhav'), findsNWidgets(3));
    expect(find.text('12th Bhav'), findsNWidgets(3));
    expect(find.text('Lagna BAV 5'), findsNWidgets(12));
    expect(find.text('Sun'), findsOneWidget);
    expect(find.text('Rahu'), findsNothing);
    expect(
      find.byKey(const ValueKey('ashtakavarga_back_button')),
      findsOneWidget,
    );
    final rect = tester.getRect(
      find.byKey(const ValueKey('ashtakavarga_back_button')),
    );
    expect(rect.left, closeTo(20, 2));
    expect(rect.width, closeTo(48, .1));
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);

class _Repository implements AshtakavargaRepository {
  _Repository({Set<int>? deferCalls, this.bhavFirst = false})
    : _deferCalls = deferCalls ?? const {};

  final Set<int> _deferCalls;
  final bool bhavFirst;
  final Map<int, Completer<Ashtakavarga>> _pending = {};
  int calls = 0;
  bool failNext = false;

  @override
  Future<Ashtakavarga> getAshtakavarga({required String birthProfileId}) {
    calls++;
    if (failNext) {
      failNext = false;
      return Future<Ashtakavarga>.error(StateError('expected test failure'));
    }
    if (_deferCalls.contains(calls)) {
      final completer = Completer<Ashtakavarga>();
      _pending[calls] = completer;
      return completer.future;
    }
    final data = ashtakavargaFixture(profileId: birthProfileId);
    if (bhavFirst) {
      data['lagnaRashiIndex'] = 1;
      for (final score
          in (data['lagnaBav'] as Map<String, dynamic>)['signScores']
              as List<dynamic>) {
        (score as Map<String, dynamic>)['score'] = 5;
      }
    }
    return Future.value(Ashtakavarga.fromJson(data));
  }

  void complete(int call, String profileId) => _pending
      .remove(call)!
      .complete(
        Ashtakavarga.fromJson(ashtakavargaFixture(profileId: profileId)),
      );
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
  _Profiles(this._auth);
  final _AuthSource _auth;

  @override
  Future<List<BirthProfile>> list() async => _auth.subject == 'user-b'
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
