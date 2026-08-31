import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/presentation/birth_profiles_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  testWidgets('zero profiles renders an empty state with an add-profile CTA', (
    tester,
  ) async {
    final auth = AuthController(_Auth());
    final controller = ProfileController(_Profiles(), auth);
    await auth.restore();
    await tester.pumpWidget(_app(controller));
    await tester.pump();

    expect(find.text('No birth profile yet'), findsOneWidget);
    expect(find.text('Create a birth profile to get started.'), findsOneWidget);
    expect(find.text('Add profile'), findsWidgets);
    expect(find.byType(ListView), findsNothing);
    expect(find.text('Birth profile'), findsNothing);

    controller.dispose();
    auth.dispose();
  });

  testWidgets('profile error retry rebuilds with successful profiles', (
    tester,
  ) async {
    final repository = _Profiles()
      ..failures = 1
      ..profiles = [_profile('first', 'First profile')];
    final auth = AuthController(_Auth());
    final controller = ProfileController(repository, auth);
    await auth.restore();
    await tester.pumpWidget(_app(controller));
    await tester.pump();
    await tester.pump();
    expect(
      find.text('We could not complete that request. Please try again.'),
      findsOneWidget,
    );

    await tester.tap(find.text('Retry'));
    await tester.pump();
    await tester.pump();
    expect(repository.listCalls, 2);
    expect(find.text('First profile'), findsOneWidget);
    expect(
      find.text('We could not complete that request. Please try again.'),
      findsNothing,
    );

    controller.dispose();
    auth.dispose();
  });

  testWidgets('profile loading renders no stale profile data', (tester) async {
    final repository = _Profiles()..holdLoad = true;
    final auth = AuthController(_Auth());
    final controller = ProfileController(repository, auth);
    await auth.restore();
    await tester.pumpWidget(_app(controller));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Pratik'), findsNothing);
    expect(find.text('No birth profile yet'), findsNothing);

    controller.dispose();
    auth.dispose();
  });

  testWidgets('multiple profiles retain their own date and time summaries', (
    tester,
  ) async {
    final repository = _Profiles()
      ..profiles = [
        _profile('pratik', 'Pratik', '1990-01-02', '03:04:00'),
        _profile('family', 'Family Member', '2001-05-06', '07:08:00'),
      ];
    final auth = AuthController(_Auth());
    final controller = ProfileController(repository, auth);
    await auth.restore();
    await tester.pumpWidget(_app(controller));
    await tester.pump();
    await tester.pump();

    expect(find.text('Pratik'), findsOneWidget);
    expect(find.text('1990-01-02 · 03:04:00'), findsOneWidget);
    expect(find.text('Family Member'), findsOneWidget);
    expect(find.text('2001-05-06 · 07:08:00'), findsOneWidget);

    controller.dispose();
    auth.dispose();
  });

  testWidgets('active profile has an explicit text indicator', (tester) async {
    final repository = _Profiles()
      ..profiles = [
        _profile('pratik', 'Pratik'),
        _profile('family', 'Family Member'),
      ];
    final auth = AuthController(_Auth());
    final controller = ProfileController(repository, auth);
    await auth.restore();
    await tester.pumpWidget(_app(controller));
    await tester.pump();
    await tester.pump();

    expect(find.text('Active'), findsOneWidget);
    final pratikCard = find.ancestor(
      of: find.text('Pratik'),
      matching: find.byType(Card),
    );
    expect(
      find.descendant(of: pratikCard, matching: find.text('Active')),
      findsOneWidget,
    );

    controller.dispose();
    auth.dispose();
  });

  testWidgets('tapping a non-active profile selects and marks it active', (
    tester,
  ) async {
    final repository = _Profiles()
      ..profiles = [
        _profile('pratik', 'Pratik'),
        _profile('family', 'Family Member'),
      ];
    final auth = AuthController(_Auth());
    final controller = ProfileController(repository, auth);
    await auth.restore();
    await tester.pumpWidget(_app(controller));
    await tester.pump();
    await tester.pump();

    await tester.tap(find.text('Family Member'));
    await tester.pumpAndSettle();
    expect(controller.activeProfile?.id, 'family');
    final familyCard = find.ancestor(
      of: find.text('Family Member'),
      matching: find.byType(Card),
    );
    expect(
      find.descendant(of: familyCard, matching: find.text('Active')),
      findsOneWidget,
    );

    controller.dispose();
    auth.dispose();
  });

  testWidgets('profile detail renders the display label', (tester) async {
    final scope = await _detailScope(
      tester,
      _profile('detail-id', 'Unique Detail Label'),
    );
    expect(find.text('Unique Detail Label'), findsWidgets);
    scope.dispose();
  });

  testWidgets('profile detail formats the authoritative birth date and time', (
    tester,
  ) async {
    final scope = await _detailScope(
      tester,
      _profile('detail-id', 'Detail', '1992-11-26', '13:40:00'),
    );
    expect(find.textContaining('Nov'), findsOneWidget);
    expect(find.textContaining('1:40'), findsOneWidget);
    expect(find.text('1992-11-26 · 13:40:00'), findsNothing);
    scope.dispose();
  });

  testWidgets('profile detail exposes no edit control', (tester) async {
    final scope = await _detailScope(tester, _profile('detail-id', 'Detail'));
    expect(find.text('Edit'), findsNothing);
    expect(find.byIcon(Icons.edit), findsNothing);
    scope.dispose();
  });

  testWidgets('profile detail exposes no delete control', (tester) async {
    final scope = await _detailScope(tester, _profile('detail-id', 'Detail'));
    expect(find.textContaining('Delete'), findsNothing);
    expect(find.byIcon(Icons.delete), findsNothing);
    scope.dispose();
  });

  testWidgets('profile detail does not expose technical fixture values', (
    tester,
  ) async {
    final profile = BirthProfile(
      id: 'database-id-do-not-show',
      displayLabel: 'Detail',
      status: 'active',
      birthData: ResolvedBirthData(const {
        'localDate': '1992-11-26',
        'localTime': '13:40:00',
        'timezone': 'Asia/Kolkata',
        'utc': '2099-01-01T00:00:00.000Z',
        'latitude': 17.385123,
        'longitude': 78.486789,
        'timezoneProvenance': {'provider': 'internal-provider-id'},
        'placeId': 'place-id-do-not-show',
      }),
    );
    final scope = await _detailScope(tester, profile);
    expect(find.textContaining('database-id-do-not-show'), findsNothing);
    expect(find.textContaining('2099-01-01T00:00:00.000Z'), findsNothing);
    expect(find.textContaining('17.385123'), findsNothing);
    expect(find.textContaining('internal-provider-id'), findsNothing);
    expect(find.textContaining('place-id-do-not-show'), findsNothing);
    scope.dispose();
  });

  testWidgets('profile detail remains usable at large text scale', (
    tester,
  ) async {
    final scope = await _detailScope(
      tester,
      _profile('detail-id', 'Large Text Detail'),
      textScaleFactor: 2,
    );
    await tester.scrollUntilVisible(
      find.text('Profile editing and deletion are not available yet.'),
      200,
    );
    expect(
      find.text('Profile editing and deletion are not available yet.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
    scope.dispose();
  });
}

Future<_DetailScope> _detailScope(
  WidgetTester tester,
  BirthProfile profile, {
  double textScaleFactor = 1,
}) async {
  final scope = _DetailScope(_Profiles()..profiles = [profile], profile.id);
  await scope.auth.restore();
  await tester.pumpWidget(scope.app(textScaleFactor));
  await tester.pump();
  await tester.pump();
  return scope;
}

BirthProfile _profile(
  String id,
  String label, [
  String localDate = '1990-01-02',
  String localTime = '03:04:00',
]) => BirthProfile(
  id: id,
  displayLabel: label,
  status: 'active',
  birthData: ResolvedBirthData({
    'localDate': localDate,
    'localTime': localTime,
    'timezone': 'Asia/Kolkata',
  }),
);

Widget _app(ProfileController controller) {
  final router = GoRouter(
    initialLocation: '/profiles',
    routes: [
      GoRoute(
        path: '/profiles',
        builder: (_, state) => BirthProfilesScreen(controller: controller),
      ),
      GoRoute(
        path: '/profiles/add',
        builder: (_, state) => const Scaffold(body: Text('Add destination')),
      ),
      GoRoute(
        path: '/profiles/:id',
        builder: (_, state) => BirthProfilesScreen(controller: controller),
      ),
    ],
  );
  return MaterialApp.router(
    routerConfig: router,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
  );
}

class _DetailScope {
  _DetailScope(this._repository, this._profileId);

  final _Profiles _repository;
  final String _profileId;
  late final AuthController auth = AuthController(_Auth());
  late final ProfileController controller = ProfileController(
    _repository,
    auth,
  );

  Widget app(double textScaleFactor) => MaterialApp(
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context)
          .copyWith(textScaler: TextScaler.linear(textScaleFactor)),
      child: child!,
    ),
    home: ProfileDetailScreen(controller: controller, profileId: _profileId),
  );

  void dispose() {
    controller.dispose();
    auth.dispose();
  }
}

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user');
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
}

class _Profiles implements BirthProfileRepository {
  List<BirthProfile> profiles = const [];
  int failures = 0;
  int listCalls = 0;
  bool holdLoad = false;
  @override
  Future<List<BirthProfile>> list() async {
    listCalls++;
    if (holdLoad) return Completer<List<BirthProfile>>().future;
    if (failures > 0) {
      failures--;
      throw StateError('provider list detail');
    }
    return profiles;
  }

  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) async => throw UnimplementedError();
  @override
  Future<BirthProfile> get(String id) async => throw UnimplementedError();
  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) async => throw UnimplementedError();
  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) async => const [];
}
