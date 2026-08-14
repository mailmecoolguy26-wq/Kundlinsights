import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/profile_screen.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/auth/presentation/auth_screens.dart';
import '../../features/home/home_screen.dart';
import '../../features/insights/insights_screen.dart';
import '../../features/kundli/kundli_screen.dart';
import '../../features/readings/readings_screen.dart';
import '../../l10n/app_localizations.dart';

GoRouter createAppRouter(AuthController authController) => GoRouter(
  initialLocation: '/splash',
  refreshListenable: authController,
  redirect: (context, state) {
    final status = authController.state.status;
    final location = state.matchedLocation;
    final isAuthRoute = location == '/login' || location == '/signup';

    if (status == AuthStatus.initializing || status == AuthStatus.loading) {
      return location == '/splash' ? null : '/splash';
    }
    if (status != AuthStatus.authenticated) {
      return isAuthRoute ? null : '/login';
    }
    return location == '/splash' || isAuthRoute ? '/home' : null;
  },
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const _SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => LoginScreen(controller: authController),
    ),
    GoRoute(
      path: '/signup',
      builder: (context, state) => SignupScreen(controller: authController),
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AppShell(navigationShell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/home',
              name: 'home',
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/kundli',
              name: 'kundli',
              builder: (context, state) => const KundliScreen(),
              routes: [
                GoRoute(
                  path: 'planet',
                  name: 'planet-detail',
                  builder: (context, state) =>
                      const SecondaryPlaceholder(title: 'Planet Detail'),
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
              builder: (context, state) => const ReadingsScreen(),
              routes: [
                GoRoute(
                  path: 'detail',
                  name: 'reading-detail',
                  builder: (context, state) =>
                      const SecondaryPlaceholder(title: 'Reading Detail'),
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
              builder: (context, state) =>
                  ProfileScreen(authController: authController),
            ),
          ],
        ),
      ],
    ),
  ],
);

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) {
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
