import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/app.dart';

void main() {
  testWidgets('boots to localized Home', (tester) async {
    await tester.pumpWidget(const KundlInsightsApp());
    await tester.pumpAndSettle();
    expect(find.text('Welcome to KundlInsights'), findsOneWidget);
    expect(find.text('Home'), findsWidgets);
  });
  testWidgets('switches all primary tabs', (tester) async {
    await tester.pumpWidget(const KundlInsightsApp());
    await tester.pumpAndSettle();
    for (final item in const [
      ('Kundli', 'My Kundli'),
      ('Insights', 'Career'),
      ('Readings', 'Detailed Readings'),
      ('Profile', 'Settings'),
    ]) {
      await tester.tap(find.text(item.$1).last);
      await tester.pumpAndSettle();
      expect(find.text(item.$2), findsOneWidget);
    }
  });
  testWidgets('Kundli reserved chart is semantic', (tester) async {
    await tester.pumpWidget(const KundlInsightsApp());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Kundli').last);
    await tester.pumpAndSettle();
    expect(
      find.bySemanticsLabel(
        'Reserved North Indian Kundli chart area. No astrology data is shown yet.',
      ),
      findsOneWidget,
    );
  });
}
