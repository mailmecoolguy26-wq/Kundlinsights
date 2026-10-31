/// A deliberately narrow, server-owned calibration projection.
///
/// The app renders this text but never infers a historical pattern from life
/// events or technical astrology data locally.
class HistoricalContext {
  const HistoricalContext({
    required this.summary,
    this.matchedEventCount,
    this.comparableEventCount,
  });

  final String summary;
  final int? matchedEventCount;
  final int? comparableEventCount;

  static HistoricalContext? tryFromJson(Object? value) {
    if (value is! Map || value['available'] != true) return null;
    final summary = value['summary'] as String?;
    if (summary == null || summary.trim().isEmpty) return null;
    return HistoricalContext(
      summary: summary.trim(),
      matchedEventCount: value['matchedEventCount'] as int?,
      comparableEventCount: value['comparableEventCount'] as int?,
    );
  }
}
