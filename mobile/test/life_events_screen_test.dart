import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/router/app_router.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/life_events/domain/life_event.dart';
import 'package:kundlinsights_mobile/features/life_events/domain/life_event_repository.dart';
import 'package:kundlinsights_mobile/features/life_events/life_event_controller.dart';
import 'package:kundlinsights_mobile/features/life_events/presentation/life_events_screen.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';

void main() {
  late AuthController auth;
  late ProfileController profiles;
  late _LifeEvents repository;
  late LifeEventController controller;

  setUp(() async {
    auth = AuthController(_Auth());
    await auth.restore();
    profiles = ProfileController(_Profiles(), auth);
    await profiles.load();
    repository = _LifeEvents();
    controller = LifeEventController(repository, auth, profiles);
    await Future<void>.delayed(Duration.zero);
  });

  tearDown(() {
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets('renders persisted events and category filters', (tester) async {
    await tester.pumpWidget(
      MaterialApp(home: LifeEventsScreen(controller: controller)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Job changed'), findsOneWidget);
    expect(find.text('Vehicle purchased'), findsOneWidget);
    expect(find.textContaining('3/4/2022'), findsOneWidget);
    expect(find.textContaining('8/2021'), findsOneWidget);
    expect(find.textContaining('2020'), findsOneWidget);
    await tester.tap(find.text('Career'));
    await tester.pumpAndSettle();
    expect(find.text('Job changed'), findsOneWidget);
    expect(find.text('Vehicle purchased'), findsNothing);
  });

  testWidgets('honors the Career entry prefilter and confirms deletion', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LifeEventsScreen(
          controller: controller,
          initialCategory: LifeEventCategory.careerBusiness,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Job changed'), findsOneWidget);
    expect(find.text('Vehicle purchased'), findsNothing);
    await tester.tap(find.byType(PopupMenuButton<String>).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(find.text('Delete Life Event?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(repository.deletedProfiles, isEmpty);
  });

  testWidgets('contextually preselects Area when adding a Life Event', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: LifeEventsScreen(controller: controller)),
    );
    await tester.pumpAndSettle();

    for (final expectation in <(String, LifeEventCategory)>[
      ('Career', LifeEventCategory.careerBusiness),
      ('Property', LifeEventCategory.property),
      ('Vehicle', LifeEventCategory.vehicle),
      ('Family', LifeEventCategory.relationshipsFamily),
    ]) {
      await tester.tap(find.text(expectation.$1));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('add-life-event')));
      await tester.pumpAndSettle();
      expect(_areaField(tester).initialValue, expectation.$2);
      await tester.pageBack();
      await tester.pumpAndSettle();
    }

    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('add-life-event')));
    await tester.pumpAndSettle();
    expect(_areaField(tester).initialValue, LifeEventCategory.careerBusiness);
  });

  testWidgets('editing a Vehicle event uses its persisted Area and type', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: LifeEventsScreen(controller: controller)),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byType(PopupMenuButton<String>).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();

    expect(_areaField(tester).initialValue, LifeEventCategory.vehicle);
    final typeField = tester.widget<DropdownButtonFormField<LifeEventType>>(
      find.byType(DropdownButtonFormField<LifeEventType>),
    );
    expect(typeField.initialValue, LifeEventType.vehiclePurchase);
  });

  testWidgets('a new Career route overrides a previous Family selection', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LifeEventsScreen(
          controller: controller,
          initialCategory: LifeEventCategory.relationshipsFamily,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(_chip(tester, 'Family').selected, isTrue);

    await tester.pumpWidget(
      MaterialApp(
        home: LifeEventsScreen(
          controller: controller,
          initialCategory: LifeEventCategory.careerBusiness,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(_chip(tester, 'Career').selected, isTrue);
    expect(_chip(tester, 'Family').selected, isFalse);
  });

  testWidgets(
    'Profile entry starts at All and profile changes retain route filter',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: LifeEventsScreen(controller: controller)),
      );
      await tester.pumpAndSettle();
      expect(_chip(tester, 'All').selected, isTrue);

      await tester.pumpWidget(
        MaterialApp(
          home: LifeEventsScreen(
            controller: controller,
            initialCategory: LifeEventCategory.careerBusiness,
          ),
        ),
      );
      await tester.pumpAndSettle();
      final profileB = profiles.profiles.singleWhere(
        (profile) => profile.id == 'profile-b',
      );
      profiles.select(profileB);
      await tester.pumpAndSettle();

      expect(_chip(tester, 'Career').selected, isTrue);
      expect(find.text('Job changed'), findsNothing);
      expect(find.text('No Life Events added yet.'), findsOneWidget);
    },
  );

  test('route parameter supports all reusable domain filters', () {
    expect(
      lifeEventCategoryFromRouteParameter('CAREER_BUSINESS'),
      LifeEventCategory.careerBusiness,
    );
    expect(
      lifeEventCategoryFromRouteParameter('PROPERTY'),
      LifeEventCategory.property,
    );
    expect(
      lifeEventCategoryFromRouteParameter('VEHICLE'),
      LifeEventCategory.vehicle,
    );
    expect(
      lifeEventCategoryFromRouteParameter('RELATIONSHIPS_FAMILY'),
      LifeEventCategory.relationshipsFamily,
    );
    expect(lifeEventCategoryFromRouteParameter(null), isNull);
  });

  testWidgets('shows the empty state for a profile with no events', (
    tester,
  ) async {
    final profileB = profiles.profiles.singleWhere(
      (profile) => profile.id == 'profile-b',
    );
    profiles.select(profileB);
    await tester.pumpWidget(
      MaterialApp(home: LifeEventsScreen(controller: controller)),
    );
    await tester.pumpAndSettle();

    expect(find.text('No Life Events added yet.'), findsOneWidget);
    expect(repository.listedProfiles.last, 'profile-b');
  });

  test(
    'creates, updates, deletes, and reloads for the selected profile',
    () async {
      final input = LifeEventInput(
        category: LifeEventCategory.property,
        type: LifeEventType.propertyPurchase,
        date: const LifeEventDate(
          precision: LifeEventPrecision.month,
          year: 2020,
          month: 8,
        ),
        note: 'First home',
      );
      expect(await controller.save(input), isTrue);
      expect(repository.createdProfiles, ['profile-a']);
      final created = controller.events.singleWhere(
        (event) => event.id == 'created-1',
      );

      expect(await controller.save(input, editing: created), isTrue);
      expect(repository.updatedProfiles, ['profile-a']);
      await controller.remove(created);
      expect(repository.deletedProfiles, ['profile-a']);

      final profileB = profiles.profiles.singleWhere(
        (profile) => profile.id == 'profile-b',
      );
      profiles.select(profileB);
      await Future<void>.delayed(Duration.zero);
      expect(controller.events, isEmpty);
      expect(repository.listedProfiles.last, 'profile-b');
    },
  );
}

ChoiceChip _chip(WidgetTester tester, String label) =>
    tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, label));

DropdownButtonFormField<LifeEventCategory> _areaField(WidgetTester tester) =>
    tester.widget<DropdownButtonFormField<LifeEventCategory>>(
      find.byType(DropdownButtonFormField<LifeEventCategory>),
    );

class _LifeEvents implements LifeEventRepository {
  final Map<String, List<LifeEvent>> _events = {
    'profile-a': [
      _event(
        'career-1',
        'profile-a',
        LifeEventCategory.careerBusiness,
        LifeEventType.jobChanged,
        const LifeEventDate(
          precision: LifeEventPrecision.day,
          year: 2022,
          month: 4,
          day: 3,
        ),
      ),
      _event(
        'vehicle-1',
        'profile-a',
        LifeEventCategory.vehicle,
        LifeEventType.vehiclePurchase,
        const LifeEventDate(precision: LifeEventPrecision.year, year: 2020),
      ),
      _event(
        'property-1',
        'profile-a',
        LifeEventCategory.property,
        LifeEventType.propertyPurchase,
        const LifeEventDate(
          precision: LifeEventPrecision.month,
          year: 2021,
          month: 8,
        ),
      ),
    ],
    'profile-b': [],
  };
  final List<String> listedProfiles = [];
  final List<String> createdProfiles = [];
  final List<String> updatedProfiles = [];
  final List<String> deletedProfiles = [];
  int _id = 0;

  @override
  Future<List<LifeEvent>> list(
    String profileId, {
    LifeEventCategory? category,
  }) async {
    listedProfiles.add(profileId);
    return List<LifeEvent>.of(_events[profileId] ?? const []);
  }

  @override
  Future<LifeEvent> create(String profileId, LifeEventInput input) async {
    createdProfiles.add(profileId);
    final value = _event(
      'created-${++_id}',
      profileId,
      input.category,
      input.type,
      input.date,
      input.note,
    );
    _events.putIfAbsent(profileId, () => []).add(value);
    return value;
  }

  @override
  Future<LifeEvent> update(
    String profileId,
    String id,
    LifeEventInput input,
  ) async {
    updatedProfiles.add(profileId);
    final value = _event(
      id,
      profileId,
      input.category,
      input.type,
      input.date,
      input.note,
    );
    final values = _events[profileId]!;
    values[values.indexWhere((event) => event.id == id)] = value;
    return value;
  }

  @override
  Future<void> delete(String profileId, String id) async {
    deletedProfiles.add(profileId);
    _events[profileId]!.removeWhere((event) => event.id == id);
  }
}

LifeEvent _event(
  String id,
  String profileId,
  LifeEventCategory category,
  LifeEventType type,
  LifeEventDate date, [
  String? note,
]) => LifeEvent(
  id: id,
  birthProfileId: profileId,
  category: category,
  type: type,
  date: date,
  note: note,
);

class _Auth implements AuthRepository {
  final _states = StreamController<AuthSnapshot>.broadcast(sync: true);
  @override
  Stream<AuthSnapshot> get states => _states.stream;
  @override
  Future<String?> accessToken() async => 'token';
  @override
  Future<String?> refreshAccessToken() async => 'token';
  @override
  Future<AuthSnapshot> restore() async =>
      const AuthSnapshot(AuthStatus.authenticated, subject: 'user-a');
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
  @override
  Future<List<BirthProfile>> list() async => [
    BirthProfile(
      id: 'profile-a',
      displayLabel: 'Profile A',
      status: 'active',
      birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
    ),
    BirthProfile(
      id: 'profile-b',
      displayLabel: 'Profile B',
      status: 'active',
      birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
    ),
  ];
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
