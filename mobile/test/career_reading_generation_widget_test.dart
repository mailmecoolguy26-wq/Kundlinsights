import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/theme/app_theme.dart';
import 'package:kundlinsights_mobile/features/auth/auth_controller.dart';
import 'package:kundlinsights_mobile/features/auth/domain/auth_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile.dart';
import 'package:kundlinsights_mobile/features/profiles/domain/birth_profile_repository.dart';
import 'package:kundlinsights_mobile/features/profiles/profile_controller.dart';
import 'package:kundlinsights_mobile/features/payments/career_premium_purchase_controller.dart';
import 'package:kundlinsights_mobile/features/payments/data/payment_api_client.dart';
import 'package:kundlinsights_mobile/features/payments/data/razorpay_purchase_service.dart';
import 'package:kundlinsights_mobile/features/payments/razorpay_career_premium_controller.dart';
import 'package:kundlinsights_mobile/features/readings/career_reading_generation_controller.dart';
import 'package:kundlinsights_mobile/features/readings/domain/career_reading_generation.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading.dart';
import 'package:kundlinsights_mobile/features/readings/domain/reading_repository.dart';
import 'package:kundlinsights_mobile/features/readings/reading_controller.dart';
import 'package:kundlinsights_mobile/features/readings/readings_screen.dart';
import 'package:kundlinsights_mobile/l10n/app_localizations.dart';

void main() {
  testWidgets('shows eligible generation alongside empty reading history', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester);
    addTearDown(harness.dispose);

    final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');
    expect(cta, findsOneWidget);
    expect(tester.widget<FilledButton>(cta).onPressed, isNotNull);
    expect(find.text('No readings yet.'), findsOneWidget);
    _expectNoPaymentUi();
  });

  testWidgets('shows an existing Career reading instead of regeneration', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, history: [_summary()]);
    addTearDown(harness.dispose);

    expect(
      find.widgetWithText(FilledButton, 'VIEW CAREER READING →'),
      findsOneWidget,
    );
    expect(
      find.text('Your personalized Career Reading is ready'),
      findsOneWidget,
    );
    expect(find.text('Generate Career Reading'), findsNothing);
    expect(find.text('CAREER READING'), findsOneWidget);
    expect(find.textContaining('Created:'), findsNothing);
  });

  testWidgets('shows neutral ineligible state without payment UI', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, eligible: false);
    addTearDown(harness.dispose);

    expect(
      find.text("Career Reading isn't available for this profile right now."),
      findsOneWidget,
    );
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    _expectNoPaymentUi();
  });

  testWidgets('keeps generation visible while entitlement is checking', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, entitlementPending: true);
    addTearDown(harness.dispose);

    expect(find.text('Checking Career Reading availability…'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    expect(harness.generationRepository.createCalls, 0);
    _expectNoPaymentUi();
  });

  testWidgets('shows a safe entitlement error without create or payment UI', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, entitlementFailure: true);
    addTearDown(harness.dispose);

    expect(
      find.text('Career Reading availability is unavailable right now.'),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
    expect(find.text('transport failure secret'), findsNothing);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    expect(harness.generationRepository.createCalls, 0);
    _expectNoPaymentUi();
  });

  testWidgets('shows generation progress and suppresses repeated CTA taps', (
    tester,
  ) async {
    final harness = await _pumpReadingCenter(tester, createPending: true);
    addTearDown(harness.dispose);
    final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');

    await tester.tap(cta);
    await tester.tap(cta);
    await tester.pump();

    expect(find.text('Generating your Career Reading…'), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    expect(harness.generationRepository.createCalls, 1);
  });

  testWidgets('exposes accessible generation CTA and unavailable state', (
    tester,
  ) async {
    final eligible = await _pumpReadingCenter(tester);
    addTearDown(eligible.dispose);
    final semantics = tester.ensureSemantics();
    final cta = find.widgetWithText(FilledButton, 'Generate Career Reading');
    expect(
      tester.getSemantics(cta),
      matchesSemantics(
        label: 'Generate Career Reading',
        isButton: true,
        isEnabled: true,
        hasEnabledState: true,
        hasTapAction: true,
        hasFocusAction: true,
        isFocusable: true,
      ),
    );

    await tester.pumpWidget(const SizedBox());
    final ineligible = await _pumpReadingCenter(tester, eligible: false);
    addTearDown(ineligible.dispose);
    expect(
      find.text("Career Reading isn't available for this profile right now."),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Generate Career Reading'), findsNothing);
    semantics.dispose();
  });

  testWidgets('exposes accessible entitlement and generation progress', (
    tester,
  ) async {
    final loading = await _pumpReadingCenter(tester, entitlementPending: true);
    addTearDown(loading.dispose);
    final semantics = tester.ensureSemantics();
    expect(
      find.bySemanticsLabel('Checking Career Reading availability…'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox());
    final generating = await _pumpReadingCenter(tester, createPending: true);
    addTearDown(generating.dispose);
    await tester.tap(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
    );
    await tester.pump();
    expect(find.text('Generating your Career Reading…'), findsOneWidget);
    expect(
      find.widgetWithText(FilledButton, 'Generate Career Reading'),
      findsNothing,
    );
    semantics.dispose();
  });

  testWidgets('hydrates Razorpay once per active profile scope', (
    tester,
  ) async {
    final api = _HydrationApi();
    final razorpay = _razorpay(api);
    final harness = await _pumpReadingCenter(
      tester,
      profiles: [_Profiles.profileA, _Profiles.profileB],
      razorpay: razorpay,
    );
    addTearDown(harness.dispose);

    expect(api.profileLookups, ['profile-a']);
    await tester.pump();
    expect(api.profileLookups, ['profile-a']);

    harness.profiles.select(_Profiles.profileB);
    await tester.pump();
    await tester.pump();
    expect(api.profileLookups, ['profile-a', 'profile-b']);

    harness.profiles.select(_Profiles.profileA);
    await tester.pump();
    await tester.pump();
    expect(api.profileLookups, ['profile-a', 'profile-b', 'profile-a']);
  });

  testWidgets('does not hydrate a null active profile', (tester) async {
    final api = _HydrationApi();
    final harness = await _pumpReadingCenter(
      tester,
      profiles: const [],
      razorpay: _razorpay(api),
    );
    addTearDown(harness.dispose);

    await tester.pump();
    expect(api.profileLookups, isEmpty);
  });

  testWidgets('in-flight Profile A hydration cannot affect Profile B state', (
    tester,
  ) async {
    final pendingA = Completer<Map<String, dynamic>>();
    final api = _HydrationApi()..pending['profile-a'] = pendingA;
    final razorpay = _razorpay(api);
    final harness = await _pumpReadingCenter(
      tester,
      profiles: [_Profiles.profileA, _Profiles.profileB],
      razorpay: razorpay,
    );
    addTearDown(harness.dispose);

    harness.profiles.select(_Profiles.profileB);
    await tester.pump();
    await tester.pump();
    expect(api.profileLookups, ['profile-a', 'profile-b']);

    pendingA.complete(const {
      'order': {'providerOrderId': 'order-a'},
    });
    await tester.pump();
    await tester.pump();
    expect(
      razorpay.stateFor('profile-a'),
      RazorpayCareerPremiumState.paymentStatusUnknown,
    );
    expect(razorpay.stateFor('profile-b'), RazorpayCareerPremiumState.idle);
  });
}

Future<_Harness> _pumpReadingCenter(
  WidgetTester tester, {
  bool eligible = true,
  bool entitlementPending = false,
  bool entitlementFailure = false,
  bool createPending = false,
  List<ReadingSummary> history = const [],
  List<BirthProfile>? profiles,
  RazorpayCareerPremiumController? razorpay,
}) async {
  final auth = AuthController(_Auth());
  await auth.restore();
  final profileController = ProfileController(_Profiles(profiles), auth);
  await tester.pump();
  final readings = ReadingController(
    _Readings(history),
    auth,
    profileController,
  );
  final generationRepository = _GenerationRepository(
    eligible: eligible,
    entitlementPending: entitlementPending,
    entitlementFailure: entitlementFailure,
    createPending: createPending,
  );
  final generation = CareerReadingGenerationController(
    generationRepository,
    auth,
    profileController,
    readings,
  );
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: ReadingsScreen(
        controller: readings,
        generation: generation,
        razorpayPremium: razorpay,
      ),
    ),
  );
  await tester.pump();
  return _Harness(
    auth,
    profileController,
    readings,
    generation,
    generationRepository,
    razorpay,
  );
}

void _expectNoPaymentUi() {
  expect(find.text('Buy'), findsNothing);
  expect(find.text('Unlock'), findsNothing);
  expect(find.text('Purchase'), findsNothing);
  expect(find.textContaining(RegExp(r'[₹$]')), findsNothing);
}

class _Harness {
  _Harness(
    this.auth,
    this.profiles,
    this.readings,
    this.generation,
    this.generationRepository,
    this.razorpay,
  );
  final AuthController auth;
  final ProfileController profiles;
  final ReadingController readings;
  final CareerReadingGenerationController generation;
  final _GenerationRepository generationRepository;
  final RazorpayCareerPremiumController? razorpay;
  void dispose() {
    generation.dispose();
    readings.dispose();
    profiles.dispose();
    auth.dispose();
    razorpay?.dispose();
  }
}

class _GenerationRepository implements CareerReadingGenerationRepository {
  _GenerationRepository({
    required this.eligible,
    required this.entitlementPending,
    required this.entitlementFailure,
    required this.createPending,
  });
  final bool eligible, entitlementPending, entitlementFailure, createPending;
  final entitlement = Completer<CareerEligibility>();
  final create = Completer<CreatedCareerReading>();
  int createCalls = 0;
  @override
  Future<CareerEligibility> getCareerEligibility({
    required String birthProfileId,
  }) {
    if (entitlementPending) return entitlement.future;
    if (entitlementFailure) {
      return Future<CareerEligibility>.error(
        StateError('transport failure secret'),
      );
    }
    return Future.value(CareerEligibility(eligible: eligible));
  }

  @override
  Future<CreatedCareerReading> createCareerReading({
    required String birthProfileId,
    required String idempotencyKey,
  }) {
    createCalls++;
    return createPending
        ? create.future
        : Future<CreatedCareerReading>.error(UnimplementedError());
  }
}

class _Readings implements ReadingRepository {
  _Readings(this.history);
  final List<ReadingSummary> history;
  @override
  Future<List<ReadingSummary>> getReadings({String? birthProfileId}) async =>
      history;
  @override
  Future<ReadingDetail> getReadingDetail(String id) =>
      throw UnimplementedError();
}

class _Auth implements AuthRepository {
  @override
  Stream<AuthSnapshot> get states => const Stream.empty();
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
  _Profiles([List<BirthProfile>? profiles]) : _items = profiles ?? [profileA];

  final List<BirthProfile> _items;
  @override
  Future<List<BirthProfile>> list() async => _items;
  static final profileA = BirthProfile(
    id: 'profile-a',
    displayLabel: 'Profile A',
    status: 'active',
    birthData: ResolvedBirthData(const {'timezone': 'UTC'}),
  );
  static final profileB = BirthProfile(
    id: 'profile-b',
    displayLabel: 'Profile B',
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

RazorpayCareerPremiumController _razorpay(_HydrationApi api) =>
    RazorpayCareerPremiumController(
      api: api,
      checkout: _NoopCheckout(),
      entitlements: _IneligibleEntitlements(),
    );

class _HydrationApi extends PaymentApiClient {
  final List<String> profileLookups = [];
  final Map<String, Completer<Map<String, dynamic>>> pending = {};

  @override
  Future<void> verifyApplePurchase({
    required String environment,
    required String productId,
    required String evidence,
  }) async {}

  @override
  Future<void> restoreApplePurchases({
    required String environment,
    required List<String> signedTransactions,
  }) async {}

  @override
  Future<void> verifyGooglePurchase({
    required String productId,
    required String purchaseToken,
    String? birthProfileId,
  }) async {}

  @override
  Future<Map<String, dynamic>> getLatestUnresolvedRazorpayOrder({
    required String birthProfileId,
  }) {
    profileLookups.add(birthProfileId);
    return pending[birthProfileId]?.future ??
        Future.value(const {'order': null});
  }
}

class _NoopCheckout implements RazorpayCheckout {
  @override
  Future<RazorpayPaymentEvidence> open({
    required String keyId,
    required String orderId,
    required int amountMinor,
    required String currency,
  }) => throw UnimplementedError();

  @override
  void dispose() {}
}

class _IneligibleEntitlements implements CareerPremiumEntitlementRefresher {
  @override
  CareerEligibilityState get eligibilityState =>
      CareerEligibilityState.ineligible;

  @override
  Future<void> refreshEligibility() async {}
}

ReadingSummary _summary() => ReadingSummary.fromJson({
  'readingId': 'reading-a',
  'birthProfileId': 'profile-a',
  'domain': 'CAREER',
  'status': 'active',
  'createdAt': '2027-01-01T10:00:00.000Z',
  'readingInstant': '2027-01-01T10:00:00.000Z',
  'locale': 'en-IN',
});
