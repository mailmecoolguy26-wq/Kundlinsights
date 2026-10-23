import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/formatters/customer_date.dart';
import '../../readings/career_explanation_language.dart';
import '../../readings/career_customer_copy.dart';
import '../../readings/domain/reading.dart';
import '../../readings/reading_controller.dart';

/// Customer-facing Career landing screen. It only summarizes saved,
/// server-authoritative reading content; it never derives timing or evidence.
class CareerHubScreen extends StatefulWidget {
  const CareerHubScreen({super.key, this.readings, this.language});

  final ReadingController? readings;
  final CareerExplanationLanguageController? language;

  @override
  State<CareerHubScreen> createState() => _CareerHubScreenState();
}

class _CareerHubScreenState extends State<CareerHubScreen> {
  String? _requestedReadingId;

  @override
  void initState() {
    super.initState();
    widget.readings?.addListener(_onReadingsChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCareerDetail());
  }

  @override
  void didUpdateWidget(covariant CareerHubScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.readings == widget.readings) return;
    oldWidget.readings?.removeListener(_onReadingsChanged);
    widget.readings?.addListener(_onReadingsChanged);
    _requestedReadingId = null;
    _loadCareerDetail();
  }

  @override
  void dispose() {
    widget.readings?.removeListener(_onReadingsChanged);
    super.dispose();
  }

  void _onReadingsChanged() => _loadCareerDetail();

  void _loadCareerDetail() {
    if (!mounted) return;
    final readings = widget.readings;
    final summary = _latestCareerReading(readings?.readings ?? const []);
    if (summary == null || summary.readingId == _requestedReadingId) return;
    _requestedReadingId = summary.readingId;
    readings?.loadDetail(summary.readingId);
  }

  @override
  Widget build(BuildContext context) {
    final listenables = <Listenable>[
      if (widget.readings != null) widget.readings!,
      if (widget.language != null) widget.language!,
    ];
    if (listenables.isEmpty) return _buildContent(context);
    return ListenableBuilder(
      listenable: Listenable.merge(listenables),
      builder: (context, _) => _buildContent(context),
    );
  }

  Widget _buildContent(BuildContext context) {
    final readings = widget.readings;
    final summary = _latestCareerReading(readings?.readings ?? const []);
    final detail =
        readings?.detailState == ReadingDetailState.loaded &&
            readings?.detail?.readingId == summary?.readingId &&
            readings?.detail?.domain == 'CAREER'
        ? readings!.detail
        : null;
    final isLoadingReading = summary != null && detail == null;

    void openTimeline() {
      final id = summary?.readingId;
      if (id != null) {
        // Keep the detail page in the Career route hierarchy. Pushing the
        // Reading Center's shell-child route from here can otherwise mount
        // the same detail route in two navigator stacks.
        context.push('/career/timeline/${Uri.encodeComponent(id)}');
      } else {
        context.go('/readings');
      }
    }

    return Scaffold(
      backgroundColor: _CareerHubColors.background,
      appBar: AppBar(
        backgroundColor: _CareerHubColors.background,
        foregroundColor: _CareerHubColors.ivory,
        elevation: 0,
        title: const Text('CAREER & BUSINESS'),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
        children: [
          const Text('Your Career Outlook', style: _CareerHubText.hero),
          const SizedBox(height: 8),
          const Text(
            'See your current Career context and the next meaningful period in one place.',
            style: _CareerHubText.body,
          ),
          const SizedBox(height: 18),
          _CareerOutlookCard(detail: detail, isLoading: isLoadingReading),
          const SizedBox(height: 26),
          const Text('ASK TARAVERSE', style: _CareerHubText.eyebrow),
          const SizedBox(height: 10),
          const _QuestionComingSoon(
            questions: [
              'Should I switch jobs?',
              'I have a job offer',
              'Compare two offers',
              'Promotion / growth',
              'Should I start a business?',
              'Career abroad',
            ],
          ),
          const SizedBox(height: 26),
          _NavigationCard(
            icon: Icons.timeline_outlined,
            title: 'Career Timeline',
            subtitle: summary == null
                ? 'Create or open your Career Reading to view upcoming Career periods.'
                : 'View your upcoming Career periods.',
            onTap: openTimeline,
          ),
          const SizedBox(height: 10),
          _NavigationCard(
            icon: Icons.history_outlined,
            title: 'Career Events',
            subtitle: 'Add important Career events so TaraVerse can compare future periods with patterns from your life.',
            onTap: () =>
                context.push('/life-events?initialCategory=CAREER_BUSINESS'),
          ),
          if (summary != null) ...[
            const SizedBox(height: 10),
            TextButton.icon(
              onPressed: openTimeline,
              icon: const Icon(Icons.expand_more_rounded),
              label: const Text('View Detailed Astrology'),
              style: TextButton.styleFrom(
                foregroundColor: _CareerHubColors.gold,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CareerOutlookCard extends StatelessWidget {
  const _CareerOutlookCard({required this.detail, required this.isLoading});

  final ReadingDetail? detail;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const _HubCard(
        child: Row(
          children: [
            Icon(
              Icons.hourglass_top_outlined,
              color: _CareerHubColors.turquoise,
            ),
            SizedBox(width: 12),
            Expanded(
              child: Text(
                'Preparing your saved Career outlook…',
                style: _CareerHubText.body,
              ),
            ),
          ],
        ),
      );
    }
    final savedDetail = detail;
    if (savedDetail == null) {
      return _HubCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your Career Reading is not available yet.',
              style: _CareerHubText.cardTitle,
            ),
            const SizedBox(height: 8),
            const Text(
              'Create a Career Reading to see your current context and upcoming Career periods here.',
              style: _CareerHubText.body,
            ),
          ],
        ),
      );
    }

    final phase = careerHubCustomerPhase(savedDetail);
    final window = _primaryWindow(savedDetail);
    return _HubCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (phase != null) ...[
            const Text('CURRENT PHASE', style: _CareerHubText.eyebrow),
            const SizedBox(height: 6),
            Text(phase, style: _CareerHubText.body),
          ],
          if (window != null) ...[
            if (phase != null) const SizedBox(height: 18),
            Text(
              _isActive(window, savedDetail.readingInstant)
                  ? 'CURRENT STRONGER CAREER WINDOW'
                  : 'NEXT STRONGER CAREER WINDOW',
              style: _CareerHubText.eyebrow,
            ),
            const SizedBox(height: 6),
            Text(
              '${formatCustomerLocalDate(_parse(window.startDate))} – ${formatCustomerLocalDate(_parse(window.endDate))}',
              style: _CareerHubText.cardTitle,
            ),
            const SizedBox(height: 6),
            if (careerHubCustomerMeaning(window) case final meaning?)
              Text(meaning, style: _CareerHubText.body),
          ],
        ],
      ),
    );
  }
}

class _QuestionComingSoon extends StatelessWidget {
  const _QuestionComingSoon({required this.questions});
  final List<String> questions;
  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: 'More Career questions coming soon',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'MORE QUESTIONS · COMING SOON',
          style: _CareerHubText.eyebrow,
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final question in questions)
              Chip(
                label: Text(question),
                labelStyle: const TextStyle(color: _CareerHubColors.slate),
                backgroundColor: _CareerHubColors.surfaceMuted,
                side: const BorderSide(color: _CareerHubColors.border),
                avatar: const Icon(
                  Icons.lock_outline_rounded,
                  size: 14,
                  color: _CareerHubColors.slate,
                ),
              ),
          ],
        ),
      ],
    ),
  );
}

class _NavigationCard extends StatelessWidget {
  const _NavigationCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _HubCard(
    onTap: onTap,
    child: Row(
      children: [
        Icon(icon, color: _CareerHubColors.gold),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: _CareerHubText.cardTitle),
              const SizedBox(height: 5),
              Text(subtitle, style: _CareerHubText.body),
            ],
          ),
        ),
        const Icon(Icons.chevron_right, color: _CareerHubColors.slate),
      ],
    ),
  );
}

class _HubCard extends StatelessWidget {
  const _HubCard({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: _CareerHubColors.surface,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(17),
        decoration: BoxDecoration(
          border: Border.all(color: _CareerHubColors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: child,
      ),
    ),
  );
}

ReadingSummary? _latestCareerReading(List<ReadingSummary> readings) {
  final career =
      readings.where((reading) => reading.domain == 'CAREER').toList()
        ..sort((left, right) => right.createdAt.compareTo(left.createdAt));
  return career.isEmpty ? null : career.first;
}

CareerTimingPeriod? _primaryWindow(ReadingDetail detail) {
  final anchor = DateTime.tryParse(detail.readingInstant)?.toUtc();
  final periods = [...?detail.careerTimingPeriods]
    ..sort((left, right) => left.startDate.compareTo(right.startDate));
  if (periods.isEmpty) return null;
  if (anchor == null) return periods.first;
  for (final period in periods) {
    if (_isActive(period, detail.readingInstant)) return period;
  }
  for (final period in periods) {
    if (_parse(period.startDate).isAfter(anchor)) return period;
  }
  return null;
}

bool _isActive(CareerTimingPeriod period, String readingInstant) {
  final anchor = DateTime.tryParse(readingInstant)?.toUtc();
  if (anchor == null) return false;
  final start = _parse(period.startDate);
  final end = _parse(period.endDate);
  return !anchor.isBefore(start) && !anchor.isAfter(end);
}

DateTime _parse(String value) => DateTime.parse(value).toUtc();

/// Returns existing saved wording only when it is suitable for the customer
/// summary. Technical evidence remains available exclusively in the detailed
/// reading; the Hub does not try to reinterpret or translate it.
String? careerHubCustomerPhase(ReadingDetail detail) {
  return customerFacingCareerPhase(detail.content);
}

/// Uses the server-provided interpretation before any timing-model summary.
/// A technical-only period is still shown with its authoritative dates, but
/// its mechanics are deliberately left for Detailed Astrology.
String? careerHubCustomerMeaning(CareerTimingPeriod period) {
  return customerFacingCareerPeriodMeaning(period);
}

abstract final class _CareerHubColors {
  static const background = Color(0xFF061A1A);
  static const surface = Color(0xFF114A46);
  static const surfaceMuted = Color(0xFF082625);
  static const border = Color(0xFF3F8179);
  static const ivory = Color(0xFFF7F4EC);
  static const slate = Color(0xFFA8B7B4);
  static const turquoise = Color(0xFF35B9AC);
  static const gold = Color(0xFFD6B15A);
}

abstract final class _CareerHubText {
  static const hero = TextStyle(
    color: _CareerHubColors.ivory,
    fontSize: 28,
    fontWeight: FontWeight.w700,
  );
  static const cardTitle = TextStyle(
    color: _CareerHubColors.ivory,
    fontSize: 17,
    fontWeight: FontWeight.w700,
  );
  static const body = TextStyle(color: _CareerHubColors.slate, height: 1.45);
  static const eyebrow = TextStyle(
    color: _CareerHubColors.gold,
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: 1.1,
  );
}
