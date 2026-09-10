import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/transits/domain/transit_snapshot.dart';
import 'package:kundlinsights_mobile/features/transits/domain/transit_snapshot_repository.dart';
import 'package:kundlinsights_mobile/features/transits/presentation/current_transits_screen.dart';
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

  test('parses additive transit insight context and skips malformed items', () {
    final data = _json('a', insightContext: _insightContext())
      ..['insightContext']['careerRelevance'] = [
        ..._insightContext()['careerRelevance'],
        {'planet': 4},
      ]
      ..['insightContext']['upcomingTransitions'] = [
        ..._insightContext()['upcomingTransitions'],
        {'type': 'UNKNOWN'},
      ];
    final context = TransitSnapshot.fromJson(data).insightContext!;
    expect(context.activatedHouses.single.house, 10);
    expect(context.careerRelevance.single.planet, 'Jupiter');
    expect(context.specialStates.single.type, 'RETROGRADE');
    expect(context.upcomingTransitions.single.type, 'INGRESS');
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

  testWidgets('renders real transit fields in the dark Gochar presentation', (
    tester,
  ) async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(_Auth()), auth);
    await profiles.load();
    final controller = TransitSnapshotController(
      _ImmediateRepo(_snapshot('a')),
      auth,
      profiles,
    );
    addTearDown(() {
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    });

    await tester.pumpWidget(
      MaterialApp(
        home: CurrentTransitsScreen(
          profileController: profiles,
          controller: controller,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
    expect(scaffold.backgroundColor, const Color(0xFF0B071B));
    expect(find.text('GOCHAR'), findsOneWidget);
    expect(find.text('Current Transits'), findsOneWidget);
    expect(find.text('a'), findsOneWidget);
    expect(find.text('Your Transit Snapshot'), findsOneWidget);
    expect(find.text('ALL CURRENT TRANSITS'), findsOneWidget);
    expect(find.text('Sun'), findsOneWidget);
    expect(
      find.textContaining('Backend supplied sign · 99.75° · House 12'),
      findsOneWidget,
    );
    expect(find.text('Retrograde'), findsOneWidget);
    expect(find.text('HOUSES ACTIVATED'), findsOneWidget);
    expect(find.textContaining('12th House'), findsOneWidget);
    expect(find.text('MOST IMPORTANT RIGHT NOW'), findsNothing);
    expect(find.text('Transit Timeline'), findsNothing);
    expect(find.text('Career Impact'), findsNothing);
    expect(find.text('What to Watch'), findsNothing);
  });

  testWidgets('renders only supplied safe transit insight sections', (
    tester,
  ) async {
    final auth = AuthController(_Auth());
    await auth.restore();
    final profiles = ProfileController(_Profiles(_Auth()), auth);
    await profiles.load();
    final controller = TransitSnapshotController(
      _ImmediateRepo(
        TransitSnapshot.fromJson(_json('a', insightContext: _insightContext())),
      ),
      auth,
      profiles,
    );
    addTearDown(() {
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    });
    await tester.pumpWidget(
      MaterialApp(
        home: CurrentTransitsScreen(
          profileController: profiles,
          controller: controller,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('CAREER-RELEVANT TRANSITS'), findsOneWidget);
    expect(find.text('Mixed evidence'), findsOneWidget);
    expect(find.text('Jupiter'), findsWidgets);
    expect(
      find.text(
        'This transit contributes to your current Career timing analysis.',
      ),
      findsOneWidget,
    );
    expect(find.text('See Career Timing'), findsOneWidget);
    expect(find.text('UPCOMING TRANSIT CHANGES'), findsOneWidget);
    expect(find.text('Jupiter enters Gemini'), findsOneWidget);
    expect(find.text('SPECIAL TRANSIT STATUS'), findsOneWidget);
    expect(find.text('Sade Sati'), findsOneWidget);
    expect(find.text('Saturn · Retrograde'), findsNothing);
    for (final forbidden in [
      'Major Influence',
      'Supportive',
      'Watch',
      'Most Important Right Now',
      'Professional Direction',
      'Opportunity',
      'Pressure / Change',
      'What to Watch',
    ]) {
      expect(find.text(forbidden), findsNothing);
    }
  });

  testWidgets(
    'groups and bounds factual transition rows without relation noise',
    (tester) async {
      final auth = AuthController(_Auth());
      await auth.restore();
      final profiles = ProfileController(_Profiles(_Auth()), auth);
      await profiles.load();
      final controller = TransitSnapshotController(
        _ImmediateRepo(
          TransitSnapshot.fromJson(
            _json('a', insightContext: _timelineInsightContext()),
          ),
        ),
        auth,
        profiles,
      );
      addTearDown(() {
        controller.dispose();
        profiles.dispose();
        auth.dispose();
      });
      await tester.pumpWidget(
        MaterialApp(
          home: CurrentTransitsScreen(
            profileController: profiles,
            controller: controller,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('11 SEP 2027'), findsOneWidget);
      expect(find.text('Mars association begins with Ketu'), findsOneWidget);
      expect(find.text('Jupiter aspect ends with Sun'), findsOneWidget);
      expect(find.text('Moon association changes with Moon'), findsNothing);
      expect(find.text('Moon aspect changes'), findsNothing);
      expect(find.text('Saturn enters Pisces'), findsNothing);
      expect(find.text('View More Transit Changes'), findsOneWidget);
      await tester.drag(find.byType(ListView).first, const Offset(0, -1100));
      await tester.pumpAndSettle();
      await tester.tap(find.text('View More Transit Changes'));
      await tester.pumpAndSettle();
      expect(find.text('Show Less'), findsOneWidget);
      expect(find.text('Saturn enters Pisces'), findsOneWidget);
    },
  );

  testWidgets(
    'compacts same-date relations while keeping the complete factual list expandable',
    (tester) async {
      final auth = AuthController(_Auth());
      await auth.restore();
      final profiles = ProfileController(_Profiles(_Auth()), auth);
      await profiles.load();
      final controller = TransitSnapshotController(
        _ImmediateRepo(
          TransitSnapshot.fromJson(
            _json('a', insightContext: _denseTimelineInsightContext()),
          ),
        ),
        auth,
        profiles,
      );
      addTearDown(() {
        controller.dispose();
        profiles.dispose();
        auth.dispose();
      });
      await tester.pumpWidget(
        MaterialApp(
          home: CurrentTransitsScreen(
            profileController: profiles,
            controller: controller,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Mars enters Cancer'), findsOneWidget);
      expect(find.text('Mars association begins with Ketu'), findsOneWidget);
      expect(find.text('Mars aspect begins with Moon'), findsOneWidget);
      expect(find.text('Sun association begins with Jupiter'), findsOneWidget);
      expect(find.text('Saturn turns direct'), findsOneWidget);
      expect(find.text('Sade Sati phase changes'), findsOneWidget);
      expect(find.text('+4 more changes'), findsOneWidget);
      expect(find.text('Mars association begins with Mercury'), findsNothing);
      expect(find.text('Mars aspect begins with Rahu'), findsNothing);
      expect(find.text('Sun association begins with Venus'), findsNothing);

      await tester.ensureVisible(find.text('View More Transit Changes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('View More Transit Changes'));
      await tester.pumpAndSettle();
      expect(find.text('Mars association begins with Mercury'), findsOneWidget);
      expect(find.text('Mars aspect begins with Rahu'), findsOneWidget);
      expect(find.text('Sun association begins with Venus'), findsOneWidget);

      await tester.ensureVisible(find.text('Show Less'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Show Less'));
      await tester.pumpAndSettle();
      expect(find.text('+4 more changes'), findsOneWidget);
    },
  );
}

Future<void> _settle() => Future<void>.delayed(Duration.zero);
TransitSnapshot _snapshot(String id) => TransitSnapshot.fromJson(_json(id));
Map<String, dynamic> _json(String id, {Map<String, dynamic>? insightContext}) {
  final value = <String, dynamic>{
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
  if (insightContext != null) value['insightContext'] = insightContext;
  return value;
}

Map<String, dynamic> _insightContext() => {
  'activatedHouses': [
    {
      'house': 10,
      'planets': ['Jupiter', 'Sun'],
    },
  ],
  'careerRelevance': [
    {
      'planet': 'Jupiter',
      'status': 'MIXED',
      'summary': 'ignored',
      'presentation': {
        'english':
            'This transit contributes to your current Career timing analysis.',
        'hinglish':
            'Yeh Gochar aapki current Career timing analysis ka hissa hai.',
      },
      'timing': {'instant': '2027-01-01T00:00:00.000Z'},
    },
  ],
  'specialStates': [
    {
      'type': 'RETROGRADE',
      'planet': 'Saturn',
      'status': 'ACTIVE',
      'summary': 'ignored',
      'presentation': {
        'english': 'Saturn is currently retrograde.',
        'hinglish': 'Shani Dev abhi Vakri hain.',
      },
    },
  ],
  'upcomingTransitions': [
    {
      'type': 'INGRESS',
      'planet': 'Jupiter',
      'at': '2027-01-10T00:00:00.000Z',
      'fromSign': 'Taurus',
      'toSign': 'Gemini',
    },
  ],
  'horizon': {
    'from': '2027-01-01T00:00:00.000Z',
    'to': '2027-01-31T00:00:00.000Z',
  },
};

Map<String, dynamic> _timelineInsightContext() => {
  ..._insightContext(),
  'specialStates': [
    {
      'type': 'RETROGRADE',
      'planet': 'Saturn',
      'status': 'ACTIVE',
      'presentation': {'english': 'ignored', 'hinglish': 'ignored'},
    },
  ],
  'upcomingTransitions': [
    {
      'type': 'ASSOCIATION_CHANGE',
      'planet': 'Mars',
      'targetPlanet': 'Ketu',
      'change': 'start',
      'at': '2027-09-11T00:00:00.000Z',
    },
    {
      'type': 'DRISHTI_CHANGE',
      'planet': 'Jupiter',
      'targetPlanet': 'Sun',
      'change': 'end',
      'at': '2027-09-11T00:00:00.000Z',
    },
    for (var index = 0; index < 13; index++)
      {
        'type': 'INGRESS',
        'planet': index == 12 ? 'Saturn' : (index.isEven ? 'Mars' : 'Jupiter'),
        'at':
            '2027-09-${(12 + index).toString().padLeft(2, '0')}T00:00:00.000Z',
        'toSign': index == 12 ? 'Pisces' : 'Aries',
      },
  ],
};

Map<String, dynamic> _denseTimelineInsightContext() => {
  ..._insightContext(),
  'upcomingTransitions': [
    {
      'type': 'INGRESS',
      'planet': 'Mars',
      'at': '2027-09-18T00:00:00.000Z',
      'toSign': 'Cancer',
    },
    for (final target in ['Ketu', 'Mercury', 'Sun'])
      {
        'type': 'ASSOCIATION_CHANGE',
        'planet': 'Mars',
        'targetPlanet': target,
        'change': 'start',
        'at': '2027-09-18T00:00:00.000Z',
      },
    for (final target in ['Moon', 'Rahu'])
      {
        'type': 'DRISHTI_CHANGE',
        'planet': 'Mars',
        'targetPlanet': target,
        'change': 'start',
        'at': '2027-09-18T00:00:00.000Z',
      },
    for (final target in ['Venus', 'Jupiter'])
      {
        'type': 'ASSOCIATION_CHANGE',
        'planet': 'Sun',
        'targetPlanet': target,
        'change': 'start',
        'at': '2027-09-18T00:00:00.000Z',
      },
    {
      'type': 'STATION_DIRECT',
      'planet': 'Saturn',
      'at': '2027-09-18T00:00:00.000Z',
    },
    {
      'type': 'SADE_SATI_PHASE_CHANGE',
      'planet': 'Saturn',
      'at': '2027-09-18T00:00:00.000Z',
    },
  ],
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

class _ImmediateRepo implements TransitSnapshotRepository {
  const _ImmediateRepo(this.snapshot);
  final TransitSnapshot snapshot;
  @override
  Future<TransitSnapshot> getTransitSnapshot({
    required String birthProfileId,
    required DateTime atUtc,
  }) async => snapshot;
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
