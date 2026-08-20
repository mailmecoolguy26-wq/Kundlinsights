import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
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
    'eligible CAREER entitlement produces generation-available state',
    () async {
      final auth = AuthController(_Auth());
      await auth.restore();
      final profiles = ProfileController(_Profiles(), auth);
      await Future<void>.delayed(Duration.zero);
      final readings = ReadingController(_Readings(), auth, profiles);
      final controller = CareerReadingGenerationController(
        _Generation(),
        auth,
        profiles,
        readings,
      );
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.eligible);
      expect(controller.canGenerate, isTrue);
      controller.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('ineligible CAREER entitlement prevents generation', () async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final generation = _Generation(eligible: false);
    final readings = ReadingController(_Readings(), auth, profiles);
    final controller = CareerReadingGenerationController(
      generation,
      auth,
      profiles,
      readings,
    );
    await Future<void>.delayed(Duration.zero);
    expect(controller.eligibilityState, CareerEligibilityState.ineligible);
    expect(controller.canGenerate, isFalse);
    expect(generation.creates, 0);
    controller.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test('unresolved entitlement keeps generation unavailable', () async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final generation = _Generation(pending: true);
    final readings = ReadingController(_Readings(), auth, profiles);
    final controller = CareerReadingGenerationController(
      generation,
      auth,
      profiles,
      readings,
    );
    expect(controller.eligibilityState, CareerEligibilityState.loading);
    expect(controller.canGenerate, isFalse);
    expect(generation.creates, 0);
    controller.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test('unresolved create exposes generation loading state', () async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final generation = _Generation(createPending: true);
    final readings = ReadingController(_Readings(), auth, profiles);
    final controller = CareerReadingGenerationController(
      generation,
      auth,
      profiles,
      readings,
    );
    await Future<void>.delayed(Duration.zero);
    controller.generate();
    await Future<void>.delayed(Duration.zero);
    expect(controller.generationState, CareerGenerationState.generating);
    expect(controller.canGenerate, isFalse);
    expect(generation.creates, 1);
    controller.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test(
    'second generation attempt is suppressed while first is in flight',
    () async {
      final auth = AuthController(_Auth());
      await auth.restore();
      final profiles = ProfileController(_Profiles(), auth);
      await Future<void>.delayed(Duration.zero);
      final generation = _Generation(createPending: true);
      final readings = ReadingController(_Readings(), auth, profiles);
      final controller = CareerReadingGenerationController(
        generation,
        auth,
        profiles,
        readings,
      );
      await Future<void>.delayed(Duration.zero);
      controller.generate();
      await Future<void>.delayed(Duration.zero);
      controller.generate();
      expect(controller.generationState, CareerGenerationState.generating);
      expect(controller.canGenerate, isFalse);
      expect(generation.creates, 1);
      controller.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('entitlement rejection refreshes availability to ineligible', () async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final generation = _Generation(entitlementRace: true);
    final readings = ReadingController(_Readings(), auth, profiles);
    final controller = CareerReadingGenerationController(
      generation,
      auth,
      profiles,
      readings,
    );
    await Future<void>.delayed(Duration.zero);
    expect(controller.eligibilityState, CareerEligibilityState.eligible);
    await controller.generate();
    await Future<void>.delayed(Duration.zero);
    expect(generation.creates, 1);
    expect(generation.gets, 2);
    expect(controller.generationState, CareerGenerationState.error);
    expect(controller.createdReadingId, isNull);
    expect(controller.eligibilityState, CareerEligibilityState.ineligible);
    expect(controller.canGenerate, isFalse);
    controller.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test('network failure ends generation without success', () async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final generation = _Generation(networkFailure: true);
    final readings = ReadingController(_Readings(), auth, profiles);
    final controller = CareerReadingGenerationController(
      generation,
      auth,
      profiles,
      readings,
    );
    await Future<void>.delayed(Duration.zero);
    expect(controller.eligibilityState, CareerEligibilityState.eligible);
    await controller.generate();
    await Future<void>.delayed(Duration.zero);
    expect(controller.generationState, isNot(CareerGenerationState.generating));
    expect(controller.createdReadingId, isNull);
    expect(generation.creates, 1);
    controller.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });

  test(
    'direct authenticated user switch clears User A generation state',
    () async {
      final source = _Auth();
      final auth = AuthController(source);
      await auth.restore();
      final profiles = ProfileController(_Profiles(auth: source), auth);
      await Future<void>.delayed(Duration.zero);
      final readings = ReadingController(_Readings(), auth, profiles);
      final controller = CareerReadingGenerationController(
        _Generation(),
        auth,
        profiles,
        readings,
      );
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.eligible);
      expect(controller.canGenerate, isTrue);
      source.switchSubject('user-b');
      expect(
        controller.eligibilityState,
        isNot(CareerEligibilityState.eligible),
      );
      expect(controller.canGenerate, isFalse);
      await Future<void>.delayed(Duration.zero);
      expect(controller.createdReadingId, isNull);
      controller.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'stale User A entitlement response cannot repopulate User B state',
    () async {
      final source = _Auth();
      final auth = AuthController(source);
      await auth.restore();
      final profiles = ProfileController(_Profiles(auth: source), auth);
      await Future<void>.delayed(Duration.zero);
      final generation = _Generation(staleUserEntitlement: true);
      final readings = ReadingController(_Readings(), auth, profiles);
      final controller = CareerReadingGenerationController(
        generation,
        auth,
        profiles,
        readings,
      );
      expect(controller.eligibilityState, CareerEligibilityState.loading);

      source.switchSubject('user-b');
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.ineligible);
      expect(controller.canGenerate, isFalse);

      generation.wait.complete(const CareerEligibility(eligible: true));
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.ineligible);
      expect(controller.canGenerate, isFalse);
      expect(generation.creates, 0);
      controller.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'stale Profile A entitlement response cannot repopulate Profile B state',
    () async {
      final auth = AuthController(_Auth());
      await auth.restore();
      final profiles = ProfileController(_Profiles(twoProfiles: true), auth);
      await Future<void>.delayed(Duration.zero);
      final generation = _Generation(staleProfileEntitlement: true);
      final readings = ReadingController(_Readings(), auth, profiles);
      final controller = CareerReadingGenerationController(
        generation,
        auth,
        profiles,
        readings,
      );
      expect(controller.eligibilityState, CareerEligibilityState.loading);

      profiles.select(profiles.profiles.last);
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.ineligible);
      expect(controller.canGenerate, isFalse);

      generation.wait.complete(const CareerEligibility(eligible: true));
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.ineligible);
      expect(controller.canGenerate, isFalse);
      expect(generation.creates, 0);
      controller.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'logout clears P12 state and blocks a stale entitlement response',
    () async {
      final source = _Auth();
      final auth = AuthController(source);
      await auth.restore();
      final profiles = ProfileController(_Profiles(), auth);
      await Future<void>.delayed(Duration.zero);
      final generation = _Generation(holdSecondEntitlement: true);
      final readings = ReadingController(_Readings(), auth, profiles);
      final controller = CareerReadingGenerationController(
        generation,
        auth,
        profiles,
        readings,
      );
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.eligible);
      expect(controller.canGenerate, isTrue);

      final refresh = controller.refreshEligibility();
      expect(controller.eligibilityState, CareerEligibilityState.loading);
      source.logout();
      expect(controller.eligibilityState, CareerEligibilityState.initial);
      expect(controller.generationState, CareerGenerationState.idle);
      expect(controller.canGenerate, isFalse);
      expect(controller.createdReadingId, isNull);

      generation.wait.complete(const CareerEligibility(eligible: true));
      await refresh;
      await Future<void>.delayed(Duration.zero);
      expect(controller.eligibilityState, CareerEligibilityState.initial);
      expect(controller.generationState, CareerGenerationState.idle);
      expect(controller.canGenerate, isFalse);
      expect(controller.createdReadingId, isNull);
      expect(generation.creates, 0);
      controller.dispose();
      readings.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('same-user token refresh preserves eligible generation state', () async {
    final source = _Auth();
    final auth = AuthController(source);
    await auth.restore();
    final profiles = ProfileController(_Profiles(), auth);
    await Future<void>.delayed(Duration.zero);
    final generation = _Generation();
    final readings = ReadingController(_Readings(), auth, profiles);
    final controller = CareerReadingGenerationController(
      generation,
      auth,
      profiles,
      readings,
    );
    await Future<void>.delayed(Duration.zero);
    expect(auth.state.subject, 'user-a');
    expect(controller.eligibilityState, CareerEligibilityState.eligible);
    expect(controller.generationState, CareerGenerationState.idle);
    expect(controller.canGenerate, isTrue);

    source.refresh();
    await Future<void>.delayed(Duration.zero);
    expect(auth.state.subject, 'user-a');
    expect(controller.eligibilityState, CareerEligibilityState.eligible);
    expect(controller.generationState, CareerGenerationState.idle);
    expect(controller.canGenerate, isTrue);
    expect(generation.creates, 0);
    controller.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
  });
}

class _Generation implements CareerReadingGenerationRepository {
  _Generation({
    this.eligible = true,
    this.pending = false,
    this.createPending = false,
    this.entitlementRace = false,
    this.networkFailure = false,
    this.staleUserEntitlement = false,
    this.staleProfileEntitlement = false,
    this.holdSecondEntitlement = false,
  });
  final bool eligible,
      pending,
      createPending,
      entitlementRace,
      networkFailure,
      staleUserEntitlement,
      staleProfileEntitlement,
      holdSecondEntitlement;
  int gets = 0;
  final wait = Completer<CareerEligibility>();
  final createWait = Completer<CreatedCareerReading>();
  int creates = 0;
  @override
  Future<CareerEligibility> getCareerEligibility() {
    gets++;
    return pending ||
            ((staleUserEntitlement || staleProfileEntitlement) && gets == 1) ||
            (holdSecondEntitlement && gets == 2)
        ? wait.future
        : Future.value(
            CareerEligibility(
              eligible:
                  entitlementRace && gets > 1 ||
                      staleUserEntitlement ||
                      staleProfileEntitlement
                  ? false
                  : eligible,
            ),
          );
  }

  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) {
    creates++;
    if (entitlementRace) {
      return Future.error(StateError('ENTITLEMENT_EXHAUSTED'));
    }
    if (networkFailure) return Future.error(StateError('NETWORK_FAILURE'));
    return createPending
        ? createWait.future
        : Future.error(UnimplementedError());
  }
}

class _Readings implements ReadingRepository {
  @override
  Future<ReadingDetail> getReadingDetail(String id) =>
      throw UnimplementedError();
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async =>
      const [];
}

class _Auth implements AuthRepository {
  String subject = 'user-a';
  final _stream = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _stream.stream;
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
    _stream.add(AuthSnapshot(AuthStatus.authenticated, subject: next));
  }

  void refresh() =>
      _stream.add(AuthSnapshot(AuthStatus.authenticated, subject: subject));

  void logout() => _stream.add(const AuthSnapshot(AuthStatus.unauthenticated));
}

class _Profiles implements BirthProfileRepository {
  _Profiles({this.auth, this.twoProfiles = false});
  final _Auth? auth;
  final bool twoProfiles;
  @override
  Future<List<BirthProfile>> list() async {
    if (twoProfiles) return [_profile('profile-a'), _profile('profile-b')];
    return [_profile(auth?.subject == 'user-b' ? 'profile-b' : 'profile-a')];
  }

  BirthProfile _profile(String id) => BirthProfile(
    id: id,
    displayLabel: 'A',
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
