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
import '../../features/vimshottari/presentation/vimshottari_timeline_screen.dart';
import '../../features/vimshottari/vimshottari_controller.dart';
import '../../features/transits/presentation/current_transits_screen.dart';
import '../../features/transits/transit_snapshot_controller.dart';
import '../../features/ashtakavarga/ashtakavarga_controller.dart';
import '../../features/ashtakavarga/presentation/ashtakavarga_screen.dart';
import '../../l10n/app_localizations.dart';

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
) => GoRouter(
  initialLocation: '/splash',
  refreshListenable: Listenable.merge([authController, profiles]),
  redirect: (context, state) {
    final auth = authController.state.status;
    final location = state.matchedLocation;
    final authRoute = location == '/login' || location == '/signup';
    if (auth == AuthStatus.initializing || auth == AuthStatus.loading) {
      return location == '/splash' ? null : '/splash';
    }
    if (auth != AuthStatus.authenticated) {
      return authRoute ? null : '/login';
    }
    if (profiles.state == ProfileLoadState.loading ||
        profiles.state == ProfileLoadState.error) {
      return null;
    }
    if (profiles.isEmpty) {
      return location == '/onboarding' ? null : '/onboarding';
    }
    if (location == '/splash' || authRoute || location == '/onboarding') {
      return '/home';
    }
    return null;
  },
  routes: [
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
      builder: (context, state) => const _LoadingScreen(),
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
      path: '/signup',
      builder: (context, state) => SignupScreen(controller: authController),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) =>
          BirthProfileOnboardingScreen(controller: profiles),
    ),
    GoRoute(
      path: '/profiles',
      builder: (context, state) => BirthProfilesScreen(controller: profiles),
      routes: [
        GoRoute(
          path: 'add',
          builder: (context, state) =>
              BirthProfileOnboardingScreen(controller: profiles, adding: true),
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
                natalController: natal,
                vimshottariController: vimshottari,
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
              builder: (context, state) => const InsightsScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/readings',
              name: 'readings',
              builder: (context, state) =>
                  ReadingsScreen(controller: readings, generation: generation),
              routes: [
                GoRoute(
                  path: 'detail/:id',
                  name: 'reading-detail',
                  builder: (context, state) => ReadingDetailScreen(
                    controller: readings,
                    readingId: state.pathParameters['id']!,
                  ),
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
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class _ProfileLoadError extends StatelessWidget {
  const _ProfileLoadError({required this.onRetry});
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      body: Center(
        child: FilledButton(onPressed: onRetry, child: Text(t.retry)),
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
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: t.home,
          ),
          NavigationDestination(
            icon: const Icon(Icons.diamond_outlined),
            selectedIcon: const Icon(Icons.diamond),
            label: t.kundli,
          ),
          NavigationDestination(
            icon: const Icon(Icons.auto_awesome_outlined),
            selectedIcon: const Icon(Icons.auto_awesome),
            label: t.insights,
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu_book_outlined),
            selectedIcon: const Icon(Icons.menu_book),
            label: t.readings,
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: t.profile,
          ),
        ],
      ),
    );
  }
}

class SecondaryPlaceholder extends StatelessWidget {
  const SecondaryPlaceholder({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: Center(
      child: Text(
        'This screen will be connected in a later milestone.',
        style: Theme.of(context).textTheme.bodyLarge,
      ),
    ),
  );
}
