import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Temporary debug-only presentation prototype. This is not a production
/// Career-timing API/domain contract and must not be wired to private artifacts.
enum CareerTimingEvidenceState {
  possibleCareerActivitySignal('POSSIBLE CAREER ACTIVITY SIGNAL'),
  astrologicallySupportivePeriod('ASTROLOGICALLY SUPPORTIVE PERIOD'),
  multipleTimingFactorsConverge('MULTIPLE TIMING FACTORS CONVERGE'),
  limitedSupport('LIMITED SUPPORT'),
  noConcentratedSignal('NO CONCENTRATED SIGNAL');

  const CareerTimingEvidenceState(this.label);

  final String label;
}

/// Debug-only data seam which keeps generated timing signals separate from
/// independently validated favourable periods. It is never constructed from a
/// production future-projection response.
class CareerFuturePeriodDisplayContract {
  const CareerFuturePeriodDisplayContract({
    this.possibleCareerActivitySignals = const [],
    this.favourableCareerPeriods = const [],
    this.productionProjectionEnabled = false,
  });

  final List<CareerActivityWindowViewModel> possibleCareerActivitySignals;
  final List<CareerActivityWindowViewModel> favourableCareerPeriods;
  final bool productionProjectionEnabled;
}

/// Private/debug evidence fields retained with a signal without making that
/// signal eligible for the favourable-period presentation list.
class CareerActivityWindowEvidence {
  const CareerActivityWindowEvidence({
    required this.dashaEvidence,
    required this.gocharEvidence,
    required this.moonSupport,
    required this.d10Support,
    required this.savBavContext,
    required this.recurrenceAvailable,
    required this.recurrencePresent,
    required this.historicalSimilarity,
    required this.controlSimilarity,
  });

  final List<String> dashaEvidence;
  final List<String> gocharEvidence;
  final bool moonSupport;
  final List<String> d10Support;
  final String savBavContext;
  final bool recurrenceAvailable;
  final bool recurrencePresent;
  final String historicalSimilarity;
  final String controlSimilarity;
}

class CareerActivityWindowViewModel {
  const CareerActivityWindowViewModel.activity({
    required this.dateRange,
    this.evidenceState =
        CareerTimingEvidenceState.astrologicallySupportivePeriod,
    this.customerFacingSummary,
    this.evidence,
    this.hasRecurrence = false,
    this.longWindow = false,
    this.expanded = false,
  }) : noWindow = false;

  const CareerActivityWindowViewModel.noWindow()
    : dateRange = null,
      evidenceState = CareerTimingEvidenceState.noConcentratedSignal,
      customerFacingSummary = null,
      evidence = null,
      hasRecurrence = false,
      longWindow = false,
      expanded = false,
      noWindow = true;

  final String? dateRange;
  final CareerTimingEvidenceState evidenceState;
  final String? customerFacingSummary;
  final CareerActivityWindowEvidence? evidence;
  final bool hasRecurrence;
  final bool longWindow;
  final bool expanded;
  final bool noWindow;
}

class CareerActivityWindowDevFixtures {
  static CareerActivityWindowViewModel? get supportive =>
      _forDebugMode(kDebugMode, _supportive);
  static CareerActivityWindowViewModel? get recurrence =>
      _forDebugMode(kDebugMode, _recurrence);
  static CareerActivityWindowViewModel? get noWindow =>
      _forDebugMode(kDebugMode, _noWindow);
  static CareerActivityWindowViewModel? get expanded =>
      _forDebugMode(kDebugMode, _expanded);
  static CareerActivityWindowViewModel? get longWindow =>
      _forDebugMode(kDebugMode, _longWindow);

  static const _supportive = CareerActivityWindowViewModel.activity(
    dateRange: 'Feb 2024 – Apr 2024',
  );
  static const _recurrence = CareerActivityWindowViewModel.activity(
    dateRange: 'Jul 2023 – Sep 2023',
    hasRecurrence: true,
  );
  static const _noWindow = CareerActivityWindowViewModel.noWindow();
  static const _expanded = CareerActivityWindowViewModel.activity(
    dateRange: 'Oct 2023 – Dec 2023',
    expanded: true,
  );
  static const _longWindow = CareerActivityWindowViewModel.activity(
    dateRange: 'May 2022 – Nov 2022',
    longWindow: true,
  );

  @visibleForTesting
  static CareerActivityWindowViewModel? forDebugMode(
    bool debugMode,
    CareerActivityWindowViewModel fixture,
  ) => _forDebugMode(debugMode, fixture);

  static CareerActivityWindowViewModel? _forDebugMode(
    bool debugMode,
    CareerActivityWindowViewModel fixture,
  ) => debugMode ? fixture : null;
}

/// A debug-only fixture switcher for visual owner review. The reading screen
/// builds this widget only under [kDebugMode], and this second gate makes the
/// widget inert in profile and release builds if it is ever embedded elsewhere.
class CareerActivityWindowDevPreviewPanel extends StatefulWidget {
  const CareerActivityWindowDevPreviewPanel({super.key, this.windows});

  /// Presentation seam for owner review. Production integration can provide
  /// chronologically ordered real windows without changing the card layout.
  final List<CareerActivityWindowViewModel>? windows;

  @visibleForTesting
  static bool isAvailableFor(bool debugMode) => debugMode;

  @override
  State<CareerActivityWindowDevPreviewPanel> createState() =>
      _CareerActivityWindowDevPreviewPanelState();
}

class _CareerActivityWindowDevPreviewPanelState
    extends State<CareerActivityWindowDevPreviewPanel> {
  CareerActivityWindowViewModel? _selected =
      CareerActivityWindowDevFixtures.supportive;

  @override
  Widget build(BuildContext context) {
    if (!CareerActivityWindowDevPreviewPanel.isAvailableFor(kDebugMode)) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'FAVOURABLE CAREER PERIODS',
          style: _CareerActivityWindowText.sectionTitle,
        ),
        const SizedBox(height: 8),
        const Text(
          'DEV SAMPLE DATA',
          style: _CareerActivityWindowText.debugLabel,
        ),
        if (_displayedWindows.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final window in _displayedWindows) ...[
            CareerActivityWindowCard(model: window),
            if (window != _displayedWindows.last) const SizedBox(height: 12),
          ],
        ],
        const SizedBox(height: 16),
        const Text(
          'DEV SAMPLE CONTROLS',
          style: _CareerActivityWindowText.debugLabel,
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _CareerActivityWindowColors.selectorSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _CareerActivityWindowColors.cardBorder),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _fixtureButton(
                'Supportive Activity Window',
                CareerActivityWindowDevFixtures.supportive,
              ),
              _fixtureButton(
                'Activity Window + Past Pattern',
                CareerActivityWindowDevFixtures.recurrence,
              ),
              _fixtureButton(
                'No Concentrated Window',
                CareerActivityWindowDevFixtures.noWindow,
              ),
              _fixtureButton(
                'Expanded Technical Details',
                CareerActivityWindowDevFixtures.expanded,
              ),
              _fixtureButton(
                'Long Window',
                CareerActivityWindowDevFixtures.longWindow,
              ),
            ],
          ),
        ),
      ],
    );
  }

  List<CareerActivityWindowViewModel> get _displayedWindows =>
      (widget.windows ?? (_selected == null ? const [] : [_selected!]))
          .where(
            (window) =>
                window.noWindow ||
                window.evidenceState ==
                    CareerTimingEvidenceState.astrologicallySupportivePeriod ||
                window.evidenceState ==
                    CareerTimingEvidenceState.multipleTimingFactorsConverge,
          )
          .toList(growable: false);

  Widget _fixtureButton(String label, CareerActivityWindowViewModel? fixture) {
    return OutlinedButton(
      onPressed: fixture == null
          ? null
          : () => setState(() => _selected = fixture),
      style: OutlinedButton.styleFrom(
        foregroundColor: _CareerActivityWindowColors.alabaster,
        side: const BorderSide(color: _CareerActivityWindowColors.goldBorder),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        textStyle: _CareerActivityWindowText.selector,
      ),
      child: Text(label, textAlign: TextAlign.center),
    );
  }
}

class CareerActivityWindowCard extends StatelessWidget {
  const CareerActivityWindowCard({super.key, required this.model});
  final CareerActivityWindowViewModel model;
  @override
  Widget build(BuildContext context) {
    if (model.noWindow) {
      return Container(
        key: ValueKey('career-activity-no-window-card'),
        width: double.infinity,
        decoration: BoxDecoration(
          color: _CareerActivityWindowColors.surface,
          borderRadius: BorderRadius.all(Radius.circular(16)),
          border: Border.fromBorderSide(
            BorderSide(color: _CareerActivityWindowColors.cardBorder),
          ),
        ),
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'FAVOURABLE CAREER PERIODS',
                style: _CareerActivityWindowText.eyebrow,
              ),
              SizedBox(height: 6),
              Text(
                'Current timing model abhi kisi concentrated supportive Career '
                'period ko identify nahi kar raha.',
                style: _CareerActivityWindowText.body,
              ),
            ],
          ),
        ),
      );
    }
    return Container(
      key: const ValueKey('career-activity-window-card'),
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _CareerActivityWindowColors.goldBorder),
      ),
      child: Material(
        color: _CareerActivityWindowColors.surface,
        borderRadius: BorderRadius.circular(15),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'FAVOURABLE CAREER PERIOD',
                style: _CareerActivityWindowText.eyebrow,
              ),
              const SizedBox(height: 8),
              Text(
                model.dateRange!,
                style: _CareerActivityWindowText.dateRange,
              ),
              const SizedBox(height: 12),
              _StatusLabel(model.evidenceState.label),
              const SizedBox(height: 12),
              Text(
                model.customerFacingSummary ??
                    'TaraVerse ke current timing model ke according, is period '
                        'mein Career se jude important Dasha aur Gochar factors '
                        'active hain.',
                style: _CareerActivityWindowText.headline,
              ),
              const SizedBox(height: 6),
              const Text(
                'Yeh kisi specific event ki guarantee nahi hai. Is period ko '
                'interviews, networking, Career conversations aur opportunities '
                'explore karne ke liye supportive timing ke roop mein dekhein.',
                style: _CareerActivityWindowText.body,
              ),
              const SizedBox(height: 20),
              const Text(
                'WHY THIS PERIOD STANDS OUT',
                style: _CareerActivityWindowText.eyebrow,
              ),
              const SizedBox(height: 10),
              const _EvidenceRow(
                'Shani Dev aapki Career-linked Dasha mein active hain',
              ),
              const _EvidenceRow(
                'Ek major Gochar bhi isi Career factor ko activate kar raha hai',
              ),
              const _EvidenceRow(
                'Aapka D10 chart bhi Janam Kundli mein dikh rahe '
                'professional theme ko support karta hai',
              ),
              const SizedBox(height: 20),
              const Text(
                'WHAT THIS CAN MEAN',
                style: _CareerActivityWindowText.eyebrow,
              ),
              const SizedBox(height: 8),
              const Text(
                'Is dauran professional movement, important decisions, naye '
                'opportunities ya responsibilities mein changes zyada active ho '
                'sakte hain.',
                style: _CareerActivityWindowText.body,
              ),
              if (model.hasRecurrence) ...[
                const SizedBox(height: 18),
                const _PastPatternCallout(),
              ],
              const SizedBox(height: 14),
              _TechnicalDetails(initiallyExpanded: model.expanded),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusLabel extends StatelessWidget {
  const _StatusLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: _CareerActivityWindowColors.midnight,
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: _CareerActivityWindowColors.goldBorder),
    ),
    child: Text(label, style: _CareerActivityWindowText.status),
  );
}

class _EvidenceRow extends StatelessWidget {
  const _EvidenceRow(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(
            Icons.check_circle_outline_rounded,
            color: _CareerActivityWindowColors.gold,
            size: 17,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: _CareerActivityWindowText.body)),
      ],
    ),
  );
}

class _PastPatternCallout extends StatelessWidget {
  const _PastPatternCallout();

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: _CareerActivityWindowColors.midnight,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: _CareerActivityWindowColors.cardBorder),
    ),
    child: const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('PAST PATTERN', style: _CareerActivityWindowText.eyebrow),
        SizedBox(height: 5),
        Text(
          'Is period ka kuch astrological pattern aapke ek pehle confirmed '
          'Career transition se similar hai.',
          style: _CareerActivityWindowText.body,
        ),
      ],
    ),
  );
}

class _TechnicalDetails extends StatelessWidget {
  const _TechnicalDetails({required this.initiallyExpanded});
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) => Theme(
    data: Theme.of(context).copyWith(
      dividerColor: Colors.transparent,
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
    ),
    child: ExpansionTile(
      initiallyExpanded: initiallyExpanded,
      iconColor: _CareerActivityWindowColors.gold,
      collapsedIconColor: _CareerActivityWindowColors.slate,
      tilePadding: EdgeInsets.zero,
      title: const Text(
        'See the astrology behind this',
        style: _CareerActivityWindowText.technicalTitle,
      ),
      children: const [
        Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _TechnicalRow('D1', '10th house Career structure'),
              _TechnicalRow('Dasha', 'MD / AD / PD'),
              _TechnicalRow('Gochar', 'major transit activation'),
              _TechnicalRow('D10', 'professional structural confirmation'),
              _TechnicalRow('Moon', 'support state'),
              _TechnicalRow('SAV/BAV', 'factual H10 SAV'),
              SizedBox(height: 8),
              Text(
                'Your professional chart reinforces the Career structure already '
                'visible in your birth chart.',
                style: _CareerActivityWindowText.body,
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _TechnicalRow extends StatelessWidget {
  const _TechnicalRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: RichText(
      text: TextSpan(
        style: _CareerActivityWindowText.body,
        children: [
          TextSpan(
            text: '$label: ',
            style: _CareerActivityWindowText.technicalLabel,
          ),
          TextSpan(text: value),
        ],
      ),
    ),
  );
}

abstract final class _CareerActivityWindowColors {
  static const midnight = Color(0xFF0B071B);
  static const surface = Color(0xFF17112F);
  static const selectorSurface = Color(0xFF120C27);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const gold = Color(0xFFC5A059);
  static const goldBorder = Color(0x66C5A059);
  static const cardBorder = Color(0x665E4A87);
}

abstract final class _CareerActivityWindowText {
  static const debugLabel = TextStyle(
    color: _CareerActivityWindowColors.gold,
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
  );
  static const sectionTitle = TextStyle(
    color: _CareerActivityWindowColors.gold,
    fontSize: 12,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.2,
  );
  static const selector = TextStyle(fontSize: 11, fontWeight: FontWeight.w600);
  static const eyebrow = TextStyle(
    color: _CareerActivityWindowColors.gold,
    fontSize: 11,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
  );
  static const dateRange = TextStyle(
    color: _CareerActivityWindowColors.alabaster,
    fontFamily: 'EBGaramond',
    fontSize: 27,
    fontWeight: FontWeight.w600,
    height: 1.05,
  );
  static const status = TextStyle(
    color: _CareerActivityWindowColors.gold,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: .7,
  );
  static const headline = TextStyle(
    color: _CareerActivityWindowColors.alabaster,
    fontSize: 17,
    fontWeight: FontWeight.w600,
    height: 1.3,
  );
  static const body = TextStyle(
    color: _CareerActivityWindowColors.slate,
    fontSize: 14,
    height: 1.45,
  );
  static const technicalTitle = TextStyle(
    color: _CareerActivityWindowColors.alabaster,
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );
  static const technicalLabel = TextStyle(
    color: _CareerActivityWindowColors.gold,
    fontSize: 14,
    height: 1.45,
    fontWeight: FontWeight.w600,
  );
}
