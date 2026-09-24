import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/account/profile_screen.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_explanation_language.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';
import 'package:kundlinsights_mobile/core/push/push_notification_service.dart';

void main() {
  late _AuthRepository authRepository;
  late AuthController authController;
  late ProfileController profileController;

  setUp(() async {
    authRepository = _AuthRepository();
    authController = AuthController(authRepository);
    await authController.restore();
    profileController = ProfileController(_ProfileRepository(), authController);
    await profileController.load();
  });

  tearDown(() {
    profileController.dispose();
    authController.dispose();
    authRepository.dispose();
  });

  testWidgets('renders the active profile hub and opens Birth Profiles', (
    tester,
  ) async {
    await tester.pumpWidget(_app(profileController, authController));

    expect(find.text('PROFILE'), findsOneWidget);
    expect(find.text('Profile & Settings'), findsOneWidget);
    expect(find.text('Aditi Sharma'), findsOneWidget);
    expect(find.text('ACTIVE PROFILE'), findsOneWidget);
    expect(find.text('Manage saved birth profiles'), findsOneWidget);
    expect(find.text('Terms of Service'), findsNothing);

    await tester.tap(find.text('Birth Profiles'));
    await tester.pumpAndSettle();
    expect(find.text('Birth profiles destination'), findsOneWidget);
  });

  testWidgets('reacts to the active profile and preserves logout behavior', (
    tester,
  ) async {
    await tester.pumpWidget(_app(profileController, authController));
    profileController.select(profileController.profiles.last);
    await tester.pump();
    expect(find.text('Rohan Mehta'), findsOneWidget);

    await tester.tap(find.text('Sign out'));
    await tester.pump();
    expect(authRepository.signOutCalls, 1);
  });

  testWidgets('offers the persisted Career Reading language selector', (
    tester,
  ) async {
    final language = CareerExplanationLanguageController(_LanguageStorage());
    await tester.pumpWidget(_app(profileController, authController, language));
    expect(find.text('Astrology Language'), findsOneWidget);
    expect(find.text('English'), findsOneWidget);
    expect(find.text('Hinglish'), findsOneWidget);
    await tester.tap(find.text('Hinglish'));
    await tester.pump();
    expect(language.language, CareerExplanationLanguage.hinglish);
  });

  testWidgets('renders independent notification preferences and permission', (
    tester,
  ) async {
    final push = _PushRuntime();
    await tester.pumpWidget(
      _app(profileController, authController, null, push),
    );
    await tester.pump();
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Push notifications  ·  Not yet enabled'), findsOneWidget);
    final switches = tester
        .widgetList<SwitchListTile>(find.byType(SwitchListTile))
        .toList();
    expect(switches.take(3).map((item) => item.value), [true, false, true]);
  });

  testWidgets('persists each notification preference independently', (
    tester,
  ) async {
    final push = _PushRuntime();
    await tester.pumpWidget(
      _app(profileController, authController, null, push),
    );
    await tester.pump();
    final switches = find.byType(Switch);
    await tester.tap(switches.at(0));
    await tester.pump();
    expect(push.updates.last.readingUpdates, isFalse);
    await tester.tap(switches.at(1));
    await tester.pump();
    expect(push.updates.last.careerReminders, isTrue);
    await tester.tap(switches.at(2));
    await tester.pump();
    expect(push.updates.last.offersAndUpdates, isFalse);
    expect(push.updates, hasLength(3));
  });

  testWidgets('renders granted and denied permission labels independently', (
    tester,
  ) async {
    final granted = _PushRuntime()..permission = PushPermissionState.granted;
    await tester.pumpWidget(
      _app(profileController, authController, null, granted),
    );
    await tester.pump();
    expect(find.textContaining('Enabled'), findsOneWidget);
    final denied = _PushRuntime()..permission = PushPermissionState.denied;
    await tester.pumpWidget(
      _app(profileController, authController, null, denied),
    );
    await tester.pump();
    expect(find.textContaining('Disabled'), findsOneWidget);
    final values = tester
        .widgetList<SwitchListTile>(find.byType(SwitchListTile))
        .take(3)
        .map((e) => e.value);
    expect(values, [true, false, true]);
  });

  testWidgets(
    'restores a failed preference update and renders safe diagnostics',
    (tester) async {
      final push = _PushRuntime()..failUpdates = true;
      push.tokenAcquired = false;
      push.registrationSucceeded = true;
      push.lastPushType = 'TEST_TYPE';
      push.lastResolvedDestination = 'READING_DETAIL';
      push.pending = true;
      await tester.pumpWidget(
        _app(profileController, authController, null, push),
      );
      await tester.pumpAndSettle();
      final readingUpdates = tester.widget<SwitchListTile>(
        find.byType(SwitchListTile).at(0),
      );
      expect(readingUpdates.value, isTrue);
      expect(readingUpdates.onChanged, isNotNull);
      await tester.tap(find.byType(Switch).at(0));
      await tester.pump();
      await tester.pump();
      expect(push.updates.single.readingUpdates, isFalse);
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile).at(0)).value,
        isTrue,
      );
      expect(
        find.text('Notification settings could not be saved.'),
        findsOneWidget,
      );
      expect(find.textContaining('Firebase initialized: true'), findsOneWidget);
      expect(find.textContaining('FCM token acquired: false'), findsOneWidget);
      expect(find.textContaining('Backend registration: true'), findsOneWidget);
      expect(find.textContaining('TEST_TYPE'), findsOneWidget);
      expect(find.textContaining('READING_DETAIL'), findsOneWidget);
      expect(find.textContaining('Pending intent: true'), findsOneWidget);
      expect(find.textContaining('token_'), findsNothing);
    },
  );
}

Widget _app(
  ProfileController profiles,
  AuthController auth, [
  CareerExplanationLanguageController? language,
  PushRuntime? push,
]) {
  final router = GoRouter(
    initialLocation: '/profile',
    routes: [
      GoRoute(
        path: '/profile',
        builder: (context, state) => ProfileScreen(
          authController: auth,
          profileController: profiles,
          careerExplanationLanguage: language,
          pushNotifications: push,
        ),
      ),
      GoRoute(
        path: '/profiles',
        builder: (context, state) =>
            const Scaffold(body: Text('Birth profiles destination')),
      ),
    ],
  );
  return MaterialApp.router(
    routerConfig: router,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
  );
}

class _PushRuntime implements PushRuntime, PushNotificationPreferencesApi {
  bool failUpdates = false;
  bool pending = false;
  PushPermissionState permission = PushPermissionState.notDetermined;
  PushNotificationPreferences value = const PushNotificationPreferences(
    readingUpdates: true,
    careerReminders: false,
    offersAndUpdates: true,
  );
  final updates = <PushNotificationPreferences>[];
  @override
  bool initialized = true;
  @override
  bool tokenAcquired = false;
  @override
  bool registrationSucceeded = false;
  @override
  bool get tokenRefreshActive => false;
  @override
  String? lastPushType;
  @override
  String? lastResolvedDestination;
  @override
  bool get hasPendingIntent => pending;
  @override
  PushNotificationPreferencesApi? get preferencesApi => this;
  @override
  PushNotificationActivityApi? get activityApi => null;
  @override
  Future<PushPermissionState> permissionState() async => permission;
  @override
  Future<PushPermissionState> requestPermission() async =>
      PushPermissionState.granted;
  @override
  void queueForegroundTap(PushDestinationIntent? intent) {}
  @override
  Future<PushNotificationPreferences> getPreferences() async => value;
  @override
  Future<PushNotificationPreferences> updatePreferences(
    PushNotificationPreferences value,
  ) async {
    updates.add(value);
    if (failUpdates) throw StateError('safe failure');
    this.value = value;
    return value;
  }
}

class _LanguageStorage implements CareerExplanationLanguageStorage {
  @override
  Future<String?> readLanguage() async => null;
  @override
  Future<void> writeLanguage(CareerExplanationLanguage language) async {}
}

class _AuthRepository implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast();
  int signOutCalls = 0;

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
  Future<void> signOut() async {
    signOutCalls++;
    _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
  }

  @override
  Future<bool> signUp({
    required String email,
    required String password,
  }) async => true;

  void dispose() => _states.close();
}

class _ProfileRepository implements BirthProfileRepository {
  @override
  Future<BirthProfile> create({
    required String? displayLabel,
    required ResolvedBirthData birthData,
  }) => throw UnimplementedError();

  @override
  Future<BirthProfile> get(String id) => throw UnimplementedError();

  @override
  Future<List<BirthProfile>> list() async => [
    _profile('a', 'Aditi Sharma'),
    _profile('b', 'Rohan Mehta'),
  ];

  @override
  Future<ResolvedBirthData> resolveBirthTime({
    required String placeId,
    required String localDate,
    required String localTime,
  }) => throw UnimplementedError();

  @override
  Future<List<PlaceCandidate>> searchPlaces(String query) =>
      throw UnimplementedError();

  BirthProfile _profile(String id, String label) => BirthProfile(
    id: id,
    displayLabel: label,
    status: 'ACTIVE',
    birthData: ResolvedBirthData(const {
      'localDate': '1994-01-01',
      'localTime': '12:00:00',
      'timezone': 'Asia/Kolkata',
    }),
  );
}
