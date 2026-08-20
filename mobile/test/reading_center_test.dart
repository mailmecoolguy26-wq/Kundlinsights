import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/theme/app_theme.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';
import 'package:kundlinsights_mobile/features/readings/reading_controller.dart';
import 'package:kundlinsights_mobile/features/readings/readings_screen.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  test('parses only the safe list and stored detail DTO contracts', () {
    final summary = ReadingSummary.fromJson(_summaryJson());
    final detail = ReadingDetail.fromJson(_detailJson());
    expect(summary.readingId, 'reading-a');
    expect(summary.birthProfileId, 'profile-a');
    expect(detail.content.sections.single.headline, 'Career structure');
    expect(
      detail.content.sections.single.items.single.sentence,
      'Stored text.',
    );
    expect(detail.content.sections.single.items.single.sourceTitle, isNull);
    expect(
      () => ReadingDetail.fromJson({..._detailJson(), 'content': null}),
      throwsFormatException,
    );
  });

  test(
    'preserves backend list order and supports the documented 50-item cap',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _ReadingRepository()
        ..nextList = List<ReadingSummary>.generate(
          50,
          (index) => ReadingSummary.fromJson({
            ..._summaryJson(profileId: 'profile-a'),
            'readingId': 'reading-$index',
          }),
        );
      final controller = ReadingController(repository, auth, profiles);
      await _settle();
      expect(controller.readings, hasLength(50));
      expect(controller.readings.first.readingId, 'reading-0');
      expect(controller.readings.last.readingId, 'reading-49');
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test(
    'loads, refreshes, and protects list/detail state across identity scopes',
    () async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _ReadingRepository(deferredListCalls: {1, 3});
      final controller = ReadingController(repository, auth, profiles);
      await _settle();
      expect(controller.listState, ReadingListState.loading);
      repository.completeList(1, [_summary('profile-a')]);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-a');

      profiles.select(profiles.profiles.last);
      expect(controller.readings, isEmpty);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-b');

      final refresh = controller.refresh();
      expect(controller.listState, ReadingListState.refreshing);
      await _settle();
      repository.completeList(3, [_summary('profile-b')]);
      await refresh;
      expect(controller.readings.single.birthProfileId, 'profile-b');

      final detail = controller.loadDetail('reading-b');
      await _settle();
      repository.completeDetail(_detail('profile-b'));
      await detail;
      expect(controller.detail?.birthProfileId, 'profile-b');

      authSource.switchSubject('user-b');
      expect(controller.readings, isEmpty);
      expect(controller.detail, isNull);
      await _settle();
      expect(controller.readings.single.birthProfileId, 'profile-user-b');
      authSource.logout();
      expect(controller.readings, isEmpty);
      expect(controller.detail, isNull);
      expect(controller.listState, ReadingListState.initial);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );

  test('blocks stale user-A and profile-A list responses', () async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await _settle();
    final repository = _ReadingRepository(deferredListCalls: {1, 2, 3});
    final controller = ReadingController(repository, auth, profiles);
    await _settle();

    profiles.select(profiles.profiles.last);
    await _settle();
    repository.completeList(1, [_summary('profile-a')]);
    await _settle();
    expect(controller.readings, isEmpty);
    repository.completeList(2, [_summary('profile-b')]);
    await _settle();
    expect(controller.readings.single.birthProfileId, 'profile-b');

    final staleUserA = controller.refresh();
    await _settle();
    authSource.switchSubject('user-b');
    expect(controller.readings, isEmpty);
    await _settle();
    repository.completeList(3, [_summary('profile-b')]);
    await staleUserA;
    await _settle();
    expect(controller.readings.single.birthProfileId, 'profile-user-b');
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets('renders non-empty, empty, error, and stored detail content', (
    tester,
  ) async {
    final authSource = _AuthSource();
    final auth = AuthController(authSource);
    await auth.restore();
    final profiles = ProfileController(_Profiles(authSource), auth);
    await _settle();
    final repository = _ReadingRepository();
    final controller = ReadingController(repository, auth, profiles);
    await tester.pumpWidget(_localized(ReadingsScreen(controller: controller)));
    await tester.pumpAndSettle();
    expect(find.text('Career Reading'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Career Reading')), findsOneWidget);

    repository.nextList = const [];
    await controller.refresh();
    await tester.pumpAndSettle();
    expect(find.text('No readings yet.'), findsOneWidget);

    repository.failList = true;
    await controller.refresh();
    await tester.pumpAndSettle();
    expect(find.text('Something went wrong'), findsOneWidget);

    repository.failList = false;
    await controller.loadDetail('reading-a');
    await tester.pumpWidget(
      _localized(
        ReadingDetailScreen(controller: controller, readingId: 'reading-a'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Career structure'), findsOneWidget);
    expect(find.text('Stored text.'), findsOneWidget);
    expect(repository.listCalls, greaterThan(0));
    expect(repository.detailCalls, greaterThan(0));
    controller.dispose();
    profiles.dispose();
    auth.dispose();
  });

  testWidgets(
    'renders the safe detail error without retaining stored content',
    (tester) async {
      final authSource = _AuthSource();
      final auth = AuthController(authSource);
      await auth.restore();
      final profiles = ProfileController(_Profiles(authSource), auth);
      await _settle();
      final repository = _ReadingRepository()..failDetail = true;
      final controller = ReadingController(repository, auth, profiles);
      await tester.pumpWidget(
        _localized(
          ReadingDetailScreen(controller: controller, readingId: 'reading-123'),
        ),
      );
      await tester.pumpAndSettle();
      expect(controller.detailState, ReadingDetailState.error);
      expect(controller.detail, isNull);
      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Stored text.'), findsNothing);
      expect(repository.detailCalls, 1);
      controller.dispose();
      profiles.dispose();
      auth.dispose();
    },
  );
}

Widget _localized(Widget child) => MaterialApp(
  theme: AppTheme.light,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: child,
);

Future<void> _settle() => Future<void>.delayed(Duration.zero);

ReadingSummary _summary(String profileId) =>
    ReadingSummary.fromJson(_summaryJson(profileId: profileId));
ReadingDetail _detail(String profileId) =>
    ReadingDetail.fromJson(_detailJson(profileId: profileId));
Map<String, dynamic> _summaryJson({String profileId = 'profile-a'}) => {
  'readingId': 'reading-a',
  'birthProfileId': profileId,
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
};
Map<String, dynamic> _detailJson({String profileId = 'profile-a'}) => {
  ..._summaryJson(profileId: profileId),
  'content': {
    'domain': 'CAREER',
    'locale': 'en-IN',
    'sections': [
      {
        'section': 'CAREER_STRUCTURE',
        'headline': 'Career structure',
        'items': [
          {
            'headline': 'Career structure',
            'sentence': 'Stored text.',
            'sourceAttribution': {'title': null},
          },
        ],
      },
    ],
  },
};

class _ReadingRepository implements ReadingRepository {
  _ReadingRepository({Set<int>? deferredListCalls})
    : _deferredListCalls = deferredListCalls ?? const {};
  final Set<int> _deferredListCalls;
  final Map<int, Completer<List<ReadingSummary>>> _pendingLists = {};
  Completer<ReadingDetail>? _pendingDetail;
  int listCalls = 0;
  int detailCalls = 0;
  bool failList = false;
  bool failDetail = false;
  List<ReadingSummary>? nextList;
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) {
    listCalls++;
    if (failList) {
      return Future<List<ReadingSummary>>.error(StateError('failed'));
    }
    if (_deferredListCalls.contains(listCalls)) {
      final result = Completer<List<ReadingSummary>>();
      _pendingLists[listCalls] = result;
      return result.future;
    }
    return Future.value(nextList ?? [_summary(birthProfileId!)]);
  }

  void completeList(int call, List<ReadingSummary> value) =>
      _pendingLists.remove(call)!.complete(value);
  @override
  Future<ReadingDetail> getReadingDetail(String readingId) {
    detailCalls++;
    if (failDetail) {
      return Future<ReadingDetail>.error(StateError('safe detail failure'));
    }
    if (_deferredListCalls.isNotEmpty) {
      _pendingDetail = Completer<ReadingDetail>();
      return _pendingDetail!.future;
    }
    return Future.value(_detail('profile-a'));
  }

  void completeDetail(ReadingDetail value) => _pendingDetail!.complete(value);
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
  void switchSubject(String value) {
    subject = value;
    _states.add(AuthSnapshot(AuthStatus.authenticated, subject: value));
  }

  void logout() => _states.add(const AuthSnapshot(AuthStatus.unauthenticated));
}

class _Profiles implements BirthProfileRepository {
  _Profiles(this.auth);
  final _AuthSource auth;
  @override
  Future<List<BirthProfile>> list() async => auth.subject == 'user-b'
      ? [_profile('profile-user-b')]
      : [_profile('profile-a'), _profile('profile-b')];
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
