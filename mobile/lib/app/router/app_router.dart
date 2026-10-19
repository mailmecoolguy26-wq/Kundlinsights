import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/profile_screen.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/auth/presentation/auth_screens.dart';
import '../../features/home/home_screen.dart';
import '../../features/insights/insights_screen.dart';
import '../../features/kundli/kundli_screen.dart';
import '../../features/kundli/planet_detail_screen.dart';
import '../../features/natal/natal_summary_controller.dart';
import '../../features/divisional/divisional_chart_controller.dart';
import '../../features/profiles/presentation/birth_profile_onboarding_screen.dart';
import '../../features/profiles/presentation/birth_profiles_screen.dart';
import '../../features/profiles/profile_controller.dart';
import '../../features/readings/readings_screen.dart';
import '../../features/readings/reading_controller.dart';
import '../../features/readings/career_reading_generation_controller.dart';
import '../../features/readings/career_explanation_language.dart';
import '../../features/payments/career_premium_product_controller.dart';
import '../../features/payments/career_premium_purchase_controller.dart';
import '../../features/payments/razorpay_career_premium_controller.dart';
import '../../features/payments/presentation/career_premium_paywall.dart';
import '../../features/career_events/career_event_controller.dart';
import '../../features/career_events/presentation/career_calibration_screen.dart';
import '../../features/life_events/domain/life_event.dart';
import '../../features/life_events/life_event_controller.dart';
import '../../features/life_events/presentation/life_events_screen.dart';
import '../../features/vimshottari/presentation/vimshottari_timeline_screen.dart';
import '../../features/vimshottari/presentation/dasha_period_insight_screen.dart';
import '../../features/vimshottari/presentation/dasha_hierarchy_screen.dart';
import '../../features/vimshottari/presentation/dasha_status_view.dart';
import '../../features/vimshottari/vimshottari_controller.dart';
import '../../features/transits/presentation/current_transits_screen.dart';
import '../../features/transits/transit_snapshot_controller.dart';
import '../../features/ashtakavarga/ashtakavarga_controller.dart';
import '../../features/ashtakavarga/presentation/ashtakavarga_screen.dart';
import '../../features/splash/splash_launch_gate.dart';
import '../../features/splash/presentation/stitch_splash_screen.dart';
import '../../features/career_chat/career_chat_controller.dart';
import '../../features/career_chat/presentation/career_chat_screen.dart';
import '../../features/career_answers/career_answer_controller.dart';
import '../../features/career_answers/domain/career_answer.dart';
import '../../features/career_answers/presentation/career_hub_screen.dart';
import '../../features/career_answers/presentation/career_answer_screen.dart';
import '../../features/vehicle/vehicle_answer_controller.dart';
import '../../features/vehicle/presentation/vehicle_hub_screen.dart';
import '../../features/property/property_answer_controller.dart';
import '../../features/property/presentation/property_hub_screen.dart';
import '../../core/analytics/analytics.dart';
import '../../core/push/push_notification_service.dart';
import '../../core/push/push_permission_prompt.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_page_scaffold.dart';
import '../../shared/widgets/states.dart';

@visibleForTesting
ValueKey<String> careerReadingDetailPageKey(String readingId) =>
    ValueKey<String>('reading-detail:$readingId');

@visibleForTesting
LifeEventCategory? lifeEventCategoryFromRouteParameter(String? wire) =>
    _lifeEventCategoryFromWire(wire);

LifeEventCategory? _lifeEventCategoryFromWire(String? wire) {
  for (final category in LifeEventCategory.values) {
    if (category.wire == wire) return category;
  }
  return null;
}

GoRouter createAppRouter(
  AuthController authController,
  ProfileController profiles,
  NatalSummaryController natal,
  DivisionalChartController divisional,
  VimshottariController vimshottari,
  TransitSnapshotController transits,
  AshtakavargaController ashtakavarga,
  ReadingController readings,
  CareerReadingGenerationController generation,
  CareerPremiumProductController premiumProduct,
  CareerPremiumPurchaseController premiumPurchase,
  CareerEventController careerEvents, {
  required LifeEventController lifeEvents,
  Analytics? analytics,
  required CareerChatController careerChat,
  required CareerAnswerController careerAnswers,
  VehicleAnswerController? vehicleAnswers,
  PropertyAnswerController? propertyAnswers,
  RazorpayCareerPremiumController? razorpayPremium,
  required CareerExplanationLanguageController careerExplanationLanguage,
  required SplashLaunchGate splashLaunchGate,
  PushRuntime? pushNotifications,
  PushPermissionPrompt? pushPermissionPrompt,
}) => GoRouter(
  initialLocation: '/splash',
  refreshListenable: Listenable.merge([
    authController,
    profiles,
    splashLaunchGate,
  ]),
  redirect: (context, state) {
    final auth = authController.state.status;
    final location = state.matchedLocation;
    final authRoute =
        location == '/login' ||
        location == '/signup' ||
        location == '/verify-otp';
    final destination = !splashLaunchGate.isOpen
        ? (location == '/splash' ? null : '/splash')
        : auth == AuthStatus.initializing || auth == AuthStatus.loading
        ? (location == '/splash' || authRoute ? null : '/splash')
        : auth != AuthStatus.authenticated
        ? (authRoute ? null : '/login')
        : profiles.state == ProfileLoadState.loading
        ? (location == '/profiles-loading' ? null : '/profiles-loading')
        : profiles.state == ProfileLoadState.error
        ? (location == '/profiles-error' ? null : '/profiles-error')
        : profiles.isEmpty
        ? (location == '/onboarding' ? null : '/onboarding')
        : location == '/splash' ||
              location == '/profiles-loading' ||
              authRoute ||
              location == '/onboarding'
        ? '/home'
        : null;
    if (kDebugMode) {
      debugPrint(
        'AUTH_ROUTER_DECISION '
        'authEvent=router '
        'sessionPresent=${auth == AuthStatus.authenticated} '
        'userPresent=${authController.state.subject != null} '
        'accessTokenPresent=unknown '
        'refreshTokenPresent=unknown '
        'routerDestination=${destination ?? location}',
      );
    }
    return destination;
  },
  routes: [
    GoRoute(
      path: '/life-events',
      builder: (context, state) => LifeEventsScreen(
        key: ValueKey(
          'life-events:${state.uri.queryParameters['initialCategory'] ?? 'ALL'}',
        ),
        controller: lifeEvents,
        initialCategory: lifeEventCategoryFromRouteParameter(
          state.uri.queryParameters['initialCategory'],
        ),
      ),
    ),
    GoRoute(
      path: '/vehicle',
      name: 'vehicle-hub',
      builder: (context, state) => vehicleAnswers == null
          ? const _VehicleUnavailable()
          : VehicleHubScreen(
              controller: vehicleAnswers,
              language: careerExplanationLanguage,
              analytics: analytics ?? Analytics(const NoopAnalyticsProvider()),
            ),
    ),
    GoRoute(
      path: '/property',
      name: 'property-hub',
      builder: (context, state) => propertyAnswers == null
          ? const _PropertyUnavailable()
          : PropertyHubScreen(controller: propertyAnswers),
    ),
    GoRoute(
      path: '/career',
      name: 'career-hub',
      builder: (context, state) => const CareerHubScreen(),
      routes: [
        GoRoute(
          path: 'answer/:questionType',
          name: 'career-answer',
          builder: (context, state) {
            final question = CareerQuestionType.fromWire(
              state.pathParameters['questionType'],
            );
            if (question == null) {
              return const _CareerAnswerUnavailable();
            }
            return CareerAnswerScreen(
              controller: careerAnswers,
              questionType: question,
            );
          },
        ),
      ],
    ),
    GoRoute(
      path: '/career-chat',
      name: 'career-chat',
      builder: (context, state) => CareerChatScreen(controller: careerChat),
    ),
    GoRoute(
      path: '/ashtakavarga',
      name: 'ashtakavarga',
      builder: (context, state) => AshtakavargaScreen(
        profileController: profiles,
        controller: ashtakavarga,
      ),
    ),
    GoRoute(
      path: '/transits',
      name: 'current-transits',
      builder: (context, state) => CurrentTransitsScreen(
        profileController: profiles,
        controller: transits,
      ),
    ),
    GoRoute(
      path: '/splash',
      builder: (context, state) => const StitchSplashScreen(),
    ),
    GoRoute(
      path: '/vimshottari/mahadasha',
      builder: (context, state) => DashaHierarchyScreen(
        profileController: profiles,
        controller: vimshottari,
        level: DashaHierarchyLevel.mahadasha,
      ),
    ),
    GoRoute(
      path: '/vimshottari/antardasha',
      builder: (context, state) {
        final value = state.uri.queryParameters['mahadashaStart'];
        final start = value == null ? null : DateTime.tryParse(value)?.toUtc();
        return start == null
            ? DashaInvalidLinkScreen(
                onBackToDasha: () => context.go('/vimshottari'),
              )
            : DashaHierarchyScreen(
                profileController: profiles,
                controller: vimshottari,
                level: DashaHierarchyLevel.antardasha,
                mahadashaStart: start,
              );
      },
    ),
    GoRoute(
      path: '/vimshottari/pratyantar',
      builder: (context, state) {
        final md = state.uri.queryParameters['mahadashaStart'];
        final ad = state.uri.queryParameters['antardashaStart'];
        final mdStart = md == null ? null : DateTime.tryParse(md)?.toUtc();
        final adStart = ad == null ? null : DateTime.tryParse(ad)?.toUtc();
        return mdStart == null || adStart == null
            ? DashaInvalidLinkScreen(
                onBackToDasha: () => context.go('/vimshottari'),
              )
            : DashaHierarchyScreen(
                profileController: profiles,
                controller: vimshottari,
                level: DashaHierarchyLevel.pratyantar,
                mahadashaStart: mdStart,
                antardashaStart: adStart,
              );
      },
    ),
    GoRoute(
      path: '/vimshottari/period-insight',
      builder: (context, state) {
        final value = state.uri.queryParameters['pratyantarStart'];
        final instant = value == null
            ? null
            : DateTime.tryParse(value)?.toUtc();
        return instant == null
            ? DashaInvalidLinkScreen(
                onBackToDasha: () => context.go('/vimshottari'),
              )
            : DashaPeriodInsightScreen(
                profileController: profiles,
                controller: vimshottari,
                pratyantarStart: instant,
              );
      },
    ),
    GoRoute(
      path: '/vimshottari',
      name: 'vimshottari-timeline',
      builder: (context, state) => VimshottariTimelineScreen(
        profileController: profiles,
        controller: vimshottari,
      ),
    ),
    GoRoute(
      path: '/profiles-loading',
      builder: (context, state) => const _LoadingScreen(),
    ),
    GoRoute(
      path: '/profiles-error',
      builder: (context, state) => _ProfileLoadError(onRetry: profiles.load),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => LoginScreen(controller: authController),
    ),
    GoRoute(
      path: '/verify-otp',
      builder: (context, state) => VerifyOtpScreen(
        controller: authController,
        phoneNumber: state.uri.queryParameters['phone'],
      ),
    ),
    GoRoute(
      path: '/signup',
      builder: (context, state) => SignupScreen(controller: authController),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => BirthProfileOnboardingScreen(
        controller: profiles,
        onProfileCreated: pushPermissionPrompt?.maybeShow,
      ),
    ),
    GoRoute(
      path: '/profiles',
      builder: (context, state) => BirthProfilesScreen(controller: profiles),
      routes: [
        GoRoute(
          path: 'add',
          builder: (context, state) => BirthProfileOnboardingScreen(
            controller: profiles,
            adding: true,
            onProfileCreated: pushPermissionPrompt?.maybeShow,
          ),
        ),
        GoRoute(
          path: ':id',
          builder: (context, state) => ProfileDetailScreen(
            controller: profiles,
            profileId: state.pathParameters['id']!,
          ),
        ),
      ],
    ),
    GoRoute(
      path: '/career-calibration',
      name: 'career-calibration',
      builder: (context, state) =>
          CareerCalibrationScreen(controller: careerEvents),
    ),
    GoRoute(
      path: '/career-premium',
      builder: (context, state) {
        final returnQuestion = CareerQuestionType.fromWire(
          state.uri.queryParameters['returnQuestion'],
        );
        void returnToRequestedCareerAnswer() {
          if (context.canPop()) {
            // The paywall is pushed from the Career answer. Preserve that
            // route (and, behind it, the app shell/profile switcher) rather
            // than replacing the whole stack after a successful purchase.
            context.pop();
            if (returnQuestion != null) {
              unawaited(careerAnswers.load(returnQuestion));
            }
            return;
          }
          if (kDebugMode) {
            debugPrint(
              'PAYWALL_DISMISS destination=${returnQuestion?.wireName ?? 'home'}',
            );
          }
          if (returnQuestion == null) {
            context.go('/home');
            return;
          }
          context.go('/career/answer/${returnQuestion.wireName}');
        }

        // The ProfileController is the source of truth for the profile that
        // owns this top-level purchase route. Generation can be transiently
        // reset while its profile-scoped eligibility refreshes.
        final profileId = profiles.activeProfile?.id;
        return ListenableBuilder(
          listenable: generation,
          builder: (context, _) {
            if (generation.eligibilityState == CareerEligibilityState.initial ||
                generation.eligibilityState == CareerEligibilityState.loading) {
              return const Scaffold(
                body: Center(child: CircularProgressIndicator()),
              );
            }
            if (generation.eligibilityState == CareerEligibilityState.error) {
              return Scaffold(
                body: Center(
                  child: TextButton(
                    onPressed: generation.refreshEligibility,
                    child: const Text('Retry'),
                  ),
                ),
              );
            }
            if (generation.eligibilityState ==
                CareerEligibilityState.eligible) {
              if (returnQuestion != null) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (context.mounted) returnToRequestedCareerAnswer();
                });
                return const Scaffold(
                  body: Center(child: CircularProgressIndicator()),
                );
              }
              return Scaffold(
                body: Center(
                  child: FilledButton(
                    onPressed: () => context.go('/readings'),
                    child: const Text('Career Premium Active'),
                  ),
                ),
              );
            }
            return CareerPremiumPaywall(
              dedicatedRazorpaySurface: true,
              activeProfileLabel: profiles.activeProfile?.label,
              razorpayProfileId: profileId,
              generationController: generation,
              analytics: analytics ?? Analytics(const NoopAnalyticsProvider()),
              productController: premiumProduct,
              hasAccess: false,
              purchaseMode: generation.purchaseMode,
              purchaseController: premiumPurchase,
              razorpayController: razorpayPremium,
              razorpayState: profileId == null
                  ? null
                  : razorpayPremium?.stateFor(profileId),
              onRazorpayStart: profileId == null
                  ? null
                  : () => razorpayPremium?.start(birthProfileId: profileId),
              onRazorpayStartForPlan: profileId == null
                  ? null
                  : (logicalSku) => razorpayPremium?.start(
                      birthProfileId: profileId,
                      logicalSku: logicalSku,
                    ),
              onRazorpayRecover: profileId == null
                  ? null
                  : () => razorpayPremium?.recover(birthProfileId: profileId),
              onRazorpayReset: profileId == null
                  ? null
                  : () => razorpayPremium?.returnToPaywall(
                      birthProfileId: profileId,
                    ),
              onSubscribePressed: premiumPurchase.startPurchase,
              onPlanSelected: premiumPurchase.startPurchaseFor,
              onContinuePressed: generation.generate,
              onBackHomePressed: () => context.go('/home'),
              onPaywallDisplayed: (id) async {
                try {
                  await pushNotifications?.activityApi
                      ?.recordCareerPaywallViewed(id);
                } catch (_) {}
              },
              onLocalDebugEntitlementActivated: returnToRequestedCareerAnswer,
            );
          },
        );
      },
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) =>
          AppShell(navigationShell: shell, profiles: profiles),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              name: 'home',
              builder: (context, state) => HomeScreen(
                profileController: profiles,
                careerEventController: careerEvents,
                readingController: readings,
                careerGenerationController: generation,
                careerChatController: careerChat,
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/kundli',
              name: 'kundli',
              builder: (context, state) => KundliScreen(
                profileController: profiles,
                natalController: natal,
                divisionalController: divisional,
              ),
              routes: [
                GoRoute(
                  path: 'planet/:planet',
                  name: 'planet-detail',
                  builder: (context, state) => PlanetDetailScreen(
                    natalController: natal,
                    planetName: state.pathParameters['planet']!,
                  ),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/insights',
              name: 'insights',
              builder: (context, state) => InsightsScreen(
                generation: generation,
                onOpenCareer: () => context.push('/career'),
                onOpenCareerChat: () => context.push('/career-chat'),
                onOpenVehicle: () => context.push('/vehicle'),
              ),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/readings',
              name: 'readings',
              builder: (context, state) => ReadingsScreen(
                controller: readings,
                generation: generation,
                premiumProduct: premiumProduct,
                premiumPurchase: premiumPurchase,
                razorpayPremium: razorpayPremium,
                activeProfileLabel: profiles.activeProfile?.label,
                analytics:
                    analytics ?? Analytics(const NoopAnalyticsProvider()),
              ),
              routes: [
                GoRoute(
                  path: 'detail/:id',
                  name: 'reading-detail',
                  pageBuilder: (context, state) {
                    final readingId = state.pathParameters['id']!;
                    final key = careerReadingDetailPageKey(readingId);
                    return MaterialPage<void>(
                      key: key,
                      name: state.name,
                      restorationId: key.value,
                      child: ReadingDetailScreen(
                        controller: readings,
                        generation: generation,
                        careerExplanationLanguage: careerExplanationLanguage,
                        readingId: readingId,
                        onViewed: (id) async {
                          try {
                            await pushNotifications?.activityApi
                                ?.recordReadingViewed(id);
                          } catch (_) {}
                        },
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profile',
              name: 'profile',
              builder: (context, state) => ProfileScreen(
                authController: authController,
                profileController: profiles,
                careerExplanationLanguage: careerExplanationLanguage,
                pushNotifications: pushNotifications,
              ),
            ),
          ],
        ),
      ],
    ),
  ],
);

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();
  @override
  Widget build(BuildContext context) =>
      const AppPageScaffold(body: LoadingState());
}

class _VehicleUnavailable extends StatelessWidget {
  const _VehicleUnavailable();
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: Text('Vehicle timing unavailable')));
}

class _PropertyUnavailable extends StatelessWidget {
  const _PropertyUnavailable();
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: Text('Property timing unavailable')));
}

class _CareerAnswerUnavailable extends StatelessWidget {
  const _CareerAnswerUnavailable();

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF061A1A),
    body: Center(
      child: TextButton(
        onPressed: () => context.go('/career'),
        child: const Text('Career question unavailable'),
      ),
    ),
  );
}

class _ProfileLoadError extends StatelessWidget {
  const _ProfileLoadError({required this.onRetry});
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AppPageScaffold(
      body: ErrorState(
        message: t.profileRequestFailed,
        onRetry: onRetry,
        retryLabel: t.retry,
      ),
    );
  }
}

class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.navigationShell,
    required this.profiles,
  });
  final StatefulNavigationShell navigationShell;
  final ProfileController profiles;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: profiles,
    builder: (context, child) => _build(context),
  );

  Widget _build(BuildContext context) {
    if (profiles.state == ProfileLoadState.loading) {
      return const _LoadingScreen();
    }
    if (profiles.state == ProfileLoadState.error) {
      return _ProfileLoadError(onRetry: profiles.load);
    }
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: DecoratedBox(
        decoration: const BoxDecoration(
          color: _ShellNavigationColors.midnight,
          border: Border(top: BorderSide(color: _ShellNavigationColors.border)),
        ),
        child: NavigationBarTheme(
          data: NavigationBarThemeData(
            height: 72,
            backgroundColor: _ShellNavigationColors.midnight,
            surfaceTintColor: Colors.transparent,
            indicatorColor: Colors.transparent,
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              final selected = states.contains(WidgetState.selected);
              return TextStyle(
                color: selected
                    ? _ShellNavigationColors.selected
                    : _ShellNavigationColors.inactive,
                fontSize: 11,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                height: 1.15,
              );
            }),
            iconTheme: const WidgetStatePropertyAll(IconThemeData(size: 22)),
          ),
          child: NavigationBar(
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: (index) => navigationShell.goBranch(
              index,
              initialLocation: index == navigationShell.currentIndex,
            ),
            destinations: [
              NavigationDestination(
                icon: const _ShellNavigationIcon(Icons.home_outlined),
                selectedIcon: const _ShellNavigationIcon(
                  Icons.home,
                  selected: true,
                ),
                label: t.home,
              ),
              NavigationDestination(
                icon: const _ShellNavigationIcon(Icons.diamond_outlined),
                selectedIcon: const _ShellNavigationIcon(
                  Icons.diamond,
                  selected: true,
                ),
                label: t.kundli,
              ),
              NavigationDestination(
                icon: const _ShellNavigationIcon(Icons.auto_awesome_outlined),
                selectedIcon: const _ShellNavigationIcon(
                  Icons.auto_awesome,
                  selected: true,
                ),
                label: t.insights,
              ),
              NavigationDestination(
                icon: const _ShellNavigationIcon(Icons.menu_book_outlined),
                selectedIcon: const _ShellNavigationIcon(
                  Icons.menu_book,
                  selected: true,
                ),
                label: t.readings,
              ),
              NavigationDestination(
                icon: const _ShellNavigationIcon(Icons.person_outline),
                selectedIcon: const _ShellNavigationIcon(
                  Icons.person,
                  selected: true,
                ),
                label: t.profile,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ShellNavigationIcon extends StatelessWidget {
  const _ShellNavigationIcon(this.icon, {this.selected = false});
  final IconData icon;
  final bool selected;

  @override
  Widget build(BuildContext context) => Container(
    width: 36,
    height: 30,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: selected ? _ShellNavigationColors.selectedSurface : null,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Icon(
      icon,
      color: selected
          ? _ShellNavigationColors.selected
          : _ShellNavigationColors.inactive,
      size: 22,
    ),
  );
}

abstract final class _ShellNavigationColors {
  static const midnight = Color(0xFF061A1A);
  static const inactive = Color(0xFFA8B7B4);
  static const selected = Color(0xFF35B9AC);
  static const border = Color(0x33255C57);
  static const selectedSurface = Color(0x1F35B9AC);
}
