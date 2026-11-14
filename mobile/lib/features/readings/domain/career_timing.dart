import 'dart:collection';

const supportedCareerTimingContractVersion = 'career-timing-production-v1';

enum CareerTimingSource { legacy, canonical }

final class CareerTimingDto {
  CareerTimingDto._({
    required this.contractVersion,
    required this.timingEngineVersion,
    required this.eligibilityRuleset,
    required this.refinementRuleset,
    required this.authority,
    required this.intervalSemantics,
    required List<CareerTimingPeriodDto> periods,
    required this.current,
    required this.next,
    required this.explanationPolicy,
  }) : periods = UnmodifiableListView(periods);

  final String contractVersion;
  final String timingEngineVersion;
  final String eligibilityRuleset;
  final String refinementRuleset;
  final String authority;
  final String intervalSemantics;
  final List<CareerTimingPeriodDto> periods;
  final CareerTimingSelectionDto? current;
  final CareerTimingSelectionDto? next;
  final CareerTimingEvidenceSummaryDto explanationPolicy;

  bool get isSupportedCanonical =>
      contractVersion == supportedCareerTimingContractVersion &&
      authority == 'CANONICAL' &&
      intervalSemantics == 'HALF_OPEN';

  static CareerTimingDto? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic> ||
        raw['contractVersion'] != supportedCareerTimingContractVersion ||
        !const {'SHADOW', 'CANONICAL'}.contains(raw['authority']) ||
        raw['intervalSemantics'] != 'HALF_OPEN' ||
        raw['timingEngineVersion'] is! String ||
        raw['eligibilityRuleset'] is! String ||
        raw['refinementRuleset'] is! String ||
        raw['periods'] is! List) {
      return null;
    }
    final periods = <CareerTimingPeriodDto>[];
    for (final item in raw['periods'] as List) {
      final parsed = CareerTimingPeriodDto.tryFromJson(item);
      if (parsed == null) return null;
      periods.add(parsed);
    }
    periods.sort((a, b) => a.start.compareTo(b.start));
    for (var index = 1; index < periods.length; index++) {
      if (periods[index - 1].end.isAfter(periods[index].start)) return null;
    }
    final current = CareerTimingSelectionDto.tryFromJson(
      raw['current'],
      periods,
      refinementKey: 'activeRefinement',
    );
    final next = CareerTimingSelectionDto.tryFromJson(
      raw['next'],
      periods,
      refinementKey: 'strongestWindow',
    );
    if (raw['current'] != null && current == null ||
        raw['next'] != null && next == null) {
      return null;
    }
    final policy = CareerTimingEvidenceSummaryDto.tryFromJson(
      raw['explanationPolicy'],
    );
    if (policy == null) return null;
    return CareerTimingDto._(
      contractVersion: raw['contractVersion'] as String,
      timingEngineVersion: raw['timingEngineVersion'] as String,
      eligibilityRuleset: raw['eligibilityRuleset'] as String,
      refinementRuleset: raw['refinementRuleset'] as String,
      authority: raw['authority'] as String,
      intervalSemantics: raw['intervalSemantics'] as String,
      periods: periods,
      current: current,
      next: next,
      explanationPolicy: policy,
    );
  }
}

final class CareerTimingPeriodDto {
  CareerTimingPeriodDto._({
    required this.periodId,
    required this.start,
    required this.end,
    required this.internalState,
    required this.label,
    required this.convergence,
    required this.strongestWindow,
    required List<CareerRefinementWindowDto> refinementWindows,
  }) : refinementWindows = UnmodifiableListView(refinementWindows);

  final String periodId;
  final DateTime start;
  final DateTime end;
  final String internalState;
  final String label;
  final String convergence;
  final CareerRefinementWindowDto? strongestWindow;
  final List<CareerRefinementWindowDto> refinementWindows;

  static CareerTimingPeriodDto? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final start = _instant(raw['start']);
    final end = _instant(raw['end']);
    final id = raw['periodId'];
    final state = raw['internalState'];
    final label = raw['label'];
    final convergence = raw['convergence'];
    const labels = {
      'SUPPORTIVE': 'Supportive period',
      'SUPPORTIVE_WITH_CONDITIONS': 'Supportive with conditions',
      'MIXED': 'Mixed signals',
      'CAUTIOUS': 'Caution advised',
    };
    if (id is! String ||
        id.isEmpty ||
        start == null ||
        end == null ||
        !start.isBefore(end) ||
        state is! String ||
        label is! String ||
        labels[state] != label ||
        convergence is! String ||
        raw['refinementWindows'] is! List) {
      return null;
    }
    final refinements = <CareerRefinementWindowDto>[];
    for (final item in raw['refinementWindows'] as List) {
      final parsed = CareerRefinementWindowDto.tryFromJson(item);
      if (parsed == null ||
          parsed.start.isBefore(start) ||
          parsed.end.isAfter(end)) {
        return null;
      }
      refinements.add(parsed);
    }
    refinements.sort((a, b) => a.start.compareTo(b.start));
    final strongest = raw['strongestWindow'] == null
        ? null
        : CareerRefinementWindowDto.tryFromJson(raw['strongestWindow']);
    if (raw['strongestWindow'] != null &&
        (strongest == null ||
            !refinements.any((item) => _sameRefinement(item, strongest)))) {
      return null;
    }
    return CareerTimingPeriodDto._(
      periodId: id,
      start: start,
      end: end,
      internalState: state,
      label: label,
      convergence: convergence,
      strongestWindow: strongest,
      refinementWindows: refinements,
    );
  }
}

final class CareerRefinementWindowDto {
  CareerRefinementWindowDto._({
    required this.windowId,
    required this.start,
    required this.end,
    required this.internalTier,
    required this.label,
    required this.reasonSummary,
    required this.evidence,
  });

  final String windowId;
  final DateTime start;
  final DateTime end;
  final String internalTier;
  final String label;
  final CareerTimingEvidenceSummaryDto reasonSummary;
  final CareerTimingEvidenceSummaryDto evidence;

  static CareerRefinementWindowDto? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final start = _instant(raw['start']);
    final end = _instant(raw['end']);
    final id = raw['windowId'];
    final tier = raw['internalTier'];
    final label = raw['label'];
    const labels = {
      'PEAK': 'Strongest window',
      'STRONG': 'Strong support',
      'MODERATE': 'Supportive timing',
      'BASE': 'Background support',
    };
    final reason = CareerTimingEvidenceSummaryDto.tryFromJson(
      raw['reasonSummary'],
    );
    final evidence = CareerTimingEvidenceSummaryDto.tryFromJson(
      raw['evidence'],
    );
    if (id is! String ||
        id.isEmpty ||
        start == null ||
        end == null ||
        !start.isBefore(end) ||
        tier is! String ||
        label is! String ||
        labels[tier] != label ||
        reason == null ||
        evidence == null) {
      return null;
    }
    return CareerRefinementWindowDto._(
      windowId: id,
      start: start,
      end: end,
      internalTier: tier,
      label: label,
      reasonSummary: reason,
      evidence: evidence,
    );
  }
}

final class CareerTimingSelectionDto {
  const CareerTimingSelectionDto._({
    required this.eligiblePeriod,
    required this.refinement,
  });
  final CareerTimingPeriodDto? eligiblePeriod;
  final CareerRefinementWindowDto? refinement;

  static CareerTimingSelectionDto? tryFromJson(
    Object? raw,
    List<CareerTimingPeriodDto> periods, {
    required String refinementKey,
  }) {
    if (raw == null) return null;
    if (raw is! Map<String, dynamic>) return null;
    CareerTimingPeriodDto? period;
    final rawPeriod = raw['eligiblePeriod'];
    if (rawPeriod != null) {
      final parsed = CareerTimingPeriodDto.tryFromJson(rawPeriod);
      if (parsed == null) return null;
      period = periods.where((item) => _samePeriod(item, parsed)).firstOrNull;
      if (period == null) return null;
    }
    CareerRefinementWindowDto? refinement;
    if (raw[refinementKey] != null) {
      refinement = CareerRefinementWindowDto.tryFromJson(raw[refinementKey]);
      if (refinement == null ||
          period == null ||
          !period.refinementWindows.any(
            (item) => _sameRefinement(item, refinement!),
          )) {
        return null;
      }
    }
    return CareerTimingSelectionDto._(
      eligiblePeriod: period,
      refinement: refinement,
    );
  }
}

bool _samePeriod(CareerTimingPeriodDto left, CareerTimingPeriodDto right) =>
    left.periodId == right.periodId &&
    left.start == right.start &&
    left.end == right.end &&
    left.internalState == right.internalState &&
    left.label == right.label &&
    left.convergence == right.convergence;

bool _sameRefinement(
  CareerRefinementWindowDto left,
  CareerRefinementWindowDto right,
) =>
    left.windowId == right.windowId &&
    left.start == right.start &&
    left.end == right.end &&
    left.internalTier == right.internalTier &&
    left.label == right.label;

final class CareerTimingEvidenceSummaryDto {
  CareerTimingEvidenceSummaryDto._(Map<String, Object?> values)
    : values = UnmodifiableMapView(values);
  final Map<String, Object?> values;

  static CareerTimingEvidenceSummaryDto? tryFromJson(Object? raw) {
    if (raw is! Map<String, dynamic>) return null;
    final safe = <String, Object?>{};
    for (final entry in raw.entries) {
      final value = entry.value;
      if (value == null || value is String || value is bool || value is num) {
        safe[entry.key] = value;
      } else {
        return null;
      }
    }
    return CareerTimingEvidenceSummaryDto._(safe);
  }
}

final class ResolvedCareerTiming {
  const ResolvedCareerTiming._({required this.source, this.canonical});
  final CareerTimingSource source;
  final CareerTimingDto? canonical;
  bool get isCanonical => source == CareerTimingSource.canonical;
}

ResolvedCareerTiming resolveCareerTiming(CareerTimingDto? timing) =>
    timing?.isSupportedCanonical == true
    ? ResolvedCareerTiming._(
        source: CareerTimingSource.canonical,
        canonical: timing,
      )
    : const ResolvedCareerTiming._(source: CareerTimingSource.legacy);

DateTime? _instant(Object? raw) {
  if (raw is! String || !raw.endsWith('Z')) return null;
  return DateTime.tryParse(raw)?.toUtc();
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
