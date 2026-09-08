import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/features/splash/presentation/stitch_splash_screen.dart';

void main() {
  testWidgets('renders the Stitch splash visual within the device safe area', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(375, 667));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(const MaterialApp(home: StitchSplashScreen()));

    expect(find.byType(SafeArea), findsOneWidget);
    expect(find.text('KundliInsights'), findsOneWidget);
    expect(find.text('ANCIENT WISDOM. MODERN PRECISION.'), findsOneWidget);
    expect(find.text('JYOTISH SHASTRA'), findsOneWidget);
    expect(find.text('NIRAYANA 23° 51\''), findsOneWidget);
    expect(find.text('VEDIC EPHEMERIS SYNCHRONIZED'), findsOneWidget);
    expect(find.byType(CustomPaint), findsAtLeastNWidgets(2));
    expect(find.byType(CircularProgressIndicator), findsNothing);

    final emblem = tester.getRect(find.byKey(const ValueKey('splash-emblem')));
    final title = tester.getRect(
      find.byKey(const ValueKey('splash-brand-lockup')),
    );
    expect(emblem.bottom, lessThan(title.top));

    final header = tester.getRect(
      find.byKey(const ValueKey('splash-header-labels')),
    );
    final lockup = tester.getRect(
      find.byKey(const ValueKey('splash-central-lockup')),
    );
    expect(header.bottom, lessThan(lockup.top));
  });
}
