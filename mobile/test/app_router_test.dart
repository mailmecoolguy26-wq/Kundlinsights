import 'package:flutter_test/flutter_test.dart';
import 'package:kundlinsights_mobile/app/router/app_router.dart';

void main() {
  test('Career Reading detail pages have stable distinct keys per reading', () {
    final first = careerReadingDetailPageKey('reading-a');
    final second = careerReadingDetailPageKey('reading-b');

    expect(first, careerReadingDetailPageKey('reading-a'));
    expect(second, careerReadingDetailPageKey('reading-b'));
    expect(first, isNot(second));
    expect(first.value, 'reading-detail:reading-a');
    expect(second.value, 'reading-detail:reading-b');
  });
}
