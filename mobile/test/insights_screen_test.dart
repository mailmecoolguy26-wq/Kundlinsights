import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kundlinsights_mobile/features/insights/insights_screen.dart';

void main() {
  testWidgets(
    'renders the dark Insights hierarchy and passive upcoming modules',
    (tester) async {
      await tester.pumpWidget(_app());

      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
      expect(scaffold.backgroundColor, const Color(0xFF0B071B));
      expect(find.text('INSIGHTS'), findsOneWidget);
      expect(find.text('Explore Your Insights'), findsOneWidget);
      expect(find.text('CURRENT TRANSITS'), findsNothing);
      expect(find.text('Current Transits'), findsOneWidget);
      expect(find.text('LIVE'), findsOneWidget);
      expect(find.text('AVAILABLE'), findsOneWidget);
      expect(find.text('Career'), findsOneWidget);
      expect(find.text('PREMIUM'), findsOneWidget);
      expect(find.text('Marriage'), findsOneWidget);
      expect(find.text('Wealth & Property'), findsOneWidget);
      expect(find.text('COMING SOON'), findsNWidgets(3));
      expect(find.byType(NavigationBar), findsNothing);
    },
  );

  testWidgets('Current Transits preserves its existing route', (tester) async {
    await tester.pumpWidget(_app());

    await tester.tap(find.text('Current Transits'));
    await tester.pumpAndSettle();

    expect(find.text('Current Transits destination'), findsOneWidget);
  });
}

Widget _app() {
  final router = GoRouter(
    initialLocation: '/insights',
    routes: [
      GoRoute(
        path: '/insights',
        builder: (context, state) => const InsightsScreen(),
      ),
      GoRoute(
        path: '/transits',
        name: 'current-transits',
        builder: (context, state) =>
            const Scaffold(body: Text('Current Transits destination')),
      ),
    ],
  );
  return MaterialApp.router(routerConfig: router);
}
