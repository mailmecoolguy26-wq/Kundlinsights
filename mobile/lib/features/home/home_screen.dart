import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../career_events/career_event_controller.dart';
import '../kundli/north_indian_chart.dart';
import '../natal/natal_summary_controller.dart';
import '../profiles/domain/birth_profile.dart';
import '../profiles/profile_controller.dart';
import '../readings/reading_controller.dart';
import '../vimshottari/vimshottari_controller.dart';

/// Home is presentation-only: every astrological value is supplied by the
/// profile, natal, Vimshottari, or career-event controllers already in scope.
class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.profileController,
    required this.natalController,
    required this.vimshottariController,
    required this.careerEventController,
    required this.readingController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;
  final VimshottariController vimshottariController;
  final CareerEventController careerEventController;
  final ReadingController readingController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([
      profileController,
      natalController,
      vimshottariController,
      careerEventController,
      readingController,
    ]),
    builder: (context, child) => Scaffold(
      backgroundColor: _HomeColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: _HomeColors.gold,
          onRefresh: () async {
            await Future.wait([
              natalController.refresh(),
              vimshottariController.refreshCurrent(),
              careerEventController.refresh(),
            ]);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
            children: [
              _HomeHeader(profile: profileController.activeProfile),
              const SizedBox(height: 22),
              _Greeting(profile: profileController.activeProfile),
              const SizedBox(height: 14),
              _ProfileSelector(profile: profileController.activeProfile),
              const SizedBox(height: 24),
              _CalibrationHero(
                careerEvents: careerEventController,
                readings: readingController,
              ),
              const SizedBox(height: 30),
              const _SectionTitle('Your Current Career Phase'),
              const SizedBox(height: 12),
              _CareerPhaseCard(controller: vimshottariController),
              const SizedBox(height: 30),
              const _SectionTitle('Your Kundli', subtitle: 'Lagna Chart'),
              const SizedBox(height: 12),
              _KundliPreview(controller: natalController),
            ],
          ),
        ),
      ),
    ),
  );
}

abstract final class _HomeColors {
  static const background = Color(0xFF0B071B);
  static const abyss = Color(0xFF120D29);
  static const surface = Color(0xFF211D32);
  static const violet = Color(0xFF181335);
  static const gold = Color(0xFFC5A059);
  static const champagne = Color(0xFFF4BF50);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Icon(Icons.auto_awesome, color: _HomeColors.gold, size: 20),
      const SizedBox(width: 8),
      RichText(
        text: TextSpan(
          style: GoogleFonts.ebGaramond(fontSize: 25, height: 1),
          children: const [
            TextSpan(
              text: 'Kundli',
              style: TextStyle(color: _HomeColors.alabaster),
            ),
            TextSpan(
              text: 'Insights',
              style: TextStyle(
                color: _HomeColors.gold,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
      const Spacer(),
      Semantics(
        button: true,
        label: 'Open profile',
        child: InkWell(
          key: const ValueKey('home-profile-avatar'),
          onTap: () => context.go('/profile'),
          borderRadius: BorderRadius.circular(999),
          child: Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: _HomeColors.violet,
              shape: BoxShape.circle,
              border: Border.all(
                color: _HomeColors.gold.withValues(alpha: .55),
              ),
            ),
            child: Text(
              _initials(profile?.label),
              style: GoogleFonts.inter(
                color: _HomeColors.champagne,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${_daypart()}, ${profile?.label ?? 'there'}',
        style: GoogleFonts.ebGaramond(
          color: _HomeColors.alabaster,
          fontSize: 34,
          height: .95,
          fontWeight: FontWeight.w500,
        ),
      ),
      const SizedBox(height: 8),
      Text(
        'Here’s what your chart indicates right now',
        style: GoogleFonts.inter(color: _HomeColors.slate, fontSize: 13),
      ),
    ],
  );
}

class _ProfileSelector extends StatelessWidget {
  const _ProfileSelector({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) {
    final date = _birthDate(profile);
    return Align(
      alignment: Alignment.centerLeft,
      child: InkWell(
        key: const ValueKey('home-profile-selector'),
        onTap: () => context.go('/profiles'),
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
          decoration: BoxDecoration(
            color: _HomeColors.violet,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: _HomeColors.gold.withValues(alpha: .25)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.person_outline,
                color: _HomeColors.gold,
                size: 16,
              ),
              const SizedBox(width: 7),
              Text(
                date == null
                    ? (profile?.label ?? 'Birth profile')
                    : '${profile!.label} · $date',
                style: GoogleFonts.inter(
                  color: _HomeColors.alabaster,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.expand_more,
                color: _HomeColors.champagne,
                size: 17,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CalibrationHero extends StatelessWidget {
  const _CalibrationHero({required this.careerEvents, required this.readings});
  final CareerEventController careerEvents;
  final ReadingController readings;

  @override
  Widget build(BuildContext context) {
    final state = _careerHeroState(careerEvents, readings);
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_HomeColors.surface, _HomeColors.violet],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: _HomeColors.gold.withValues(alpha: .27)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(state.eyebrow, style: _labelStyle(color: _HomeColors.champagne)),
          const SizedBox(height: 11),
          Text(state.headline, style: _headlineStyle(fontSize: 28)),
          const SizedBox(height: 10),
          Text(
            state.body,
            style: GoogleFonts.inter(
              color: _HomeColors.slate,
              fontSize: 12,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          if (!state.isLoading)
            TextButton(
              key: ValueKey(state.primaryKey),
              onPressed: () => state.primaryRoute == '/readings'
                  ? context.go('/readings')
                  : context.push('/career-calibration'),
              style: TextButton.styleFrom(
                foregroundColor: _HomeColors.abyss,
                backgroundColor: _HomeColors.gold,
                padding: const EdgeInsets.symmetric(
                  horizontal: 15,
                  vertical: 12,
                ),
              ),
              child: Text(
                state.primaryAction,
                style: _labelStyle(color: _HomeColors.abyss),
              ),
            ),
          if (state.showUpdateAction) ...[
            const SizedBox(height: 5),
            TextButton(
              key: const ValueKey('home-career-update-events'),
              onPressed: () => context.push('/career-calibration'),
              child: Text(
                'UPDATE CAREER EVENTS',
                style: _labelStyle(color: _HomeColors.gold),
              ),
            ),
          ],
          if (state.showDurationCaption) ...[
            const SizedBox(height: 9),
            Text(
              'Takes about 2 minutes',
              style: GoogleFonts.inter(color: _HomeColors.slate, fontSize: 10),
            ),
          ],
        ],
      ),
    );
  }
}

class _CareerHeroContent {
  const _CareerHeroContent({
    required this.eyebrow,
    required this.headline,
    required this.body,
    required this.primaryAction,
    required this.primaryRoute,
    required this.primaryKey,
    this.showDurationCaption = false,
    this.showUpdateAction = false,
    this.isLoading = false,
  });

  final String eyebrow;
  final String headline;
  final String body;
  final String primaryAction;
  final String primaryRoute;
  final String primaryKey;
  final bool showDurationCaption;
  final bool showUpdateAction;
  final bool isLoading;
}

_CareerHeroContent _careerHeroState(
  CareerEventController careerEvents,
  ReadingController readings,
) {
  // Both controllers clear their scoped data before fetching a newly selected
  // profile. Render neutral copy until both loads have completed so Profile A
  // can never briefly appear as Profile B with zero events or no reading.
  if (careerEvents.state != CareerEventLoadState.loaded ||
      readings.listState != ReadingListState.loaded) {
    return const _CareerHeroContent(
      eyebrow: 'PERSONALIZED CAREER FORECAST',
      headline: 'Preparing your career forecast',
      body: 'Loading your saved career history and readings.',
      primaryAction: 'OPEN CAREER READING  →',
      primaryRoute: '/readings',
      primaryKey: 'home-career-loading-cta',
      isLoading: true,
    );
  }
  final hasCareerReading = readings.readings.any(
    (reading) => reading.domain == 'CAREER',
  );
  if (hasCareerReading) {
    return const _CareerHeroContent(
      eyebrow: 'YOUR CAREER READING',
      headline: 'Your personalized Career Reading is ready',
      body: 'View your saved Career Reading and revisit your personalized timing insights.',
      primaryAction: 'VIEW CAREER READING  →',
      primaryRoute: '/readings',
      primaryKey: 'home-career-reading-cta',
      showUpdateAction: true,
    );
  }
  switch (careerEvents.events.length) {
    case 0:
      return const _CareerHeroContent(
        eyebrow: 'PERSONALIZED CAREER FORECAST',
        headline: 'Make your career forecast more personal',
        body: 'Add a few important career events from your past so KundliInsights can better personalize the timing of your future career windows.',
        primaryAction: 'CALIBRATE MY CAREER  →',
        primaryRoute: '/career-calibration',
        primaryKey: 'home-calibration-cta',
        showDurationCaption: true,
      );
    case 1:
      return const _CareerHeroContent(
        eyebrow: 'CAREER CALIBRATION',
        headline: 'Add one more career milestone',
        body: 'You’ve started your career history. Add another important event to give your Career Reading stronger real-life context.',
        primaryAction: 'UPDATE CAREER EVENTS  →',
        primaryRoute: '/career-calibration',
        primaryKey: 'home-calibration-cta',
      );
    default:
      return const _CareerHeroContent(
        eyebrow: 'CAREER CALIBRATION READY',
        headline: 'Your personalized Career Reading is ready to unlock',
        body: 'Your birth chart and saved career events will be used to personalize your Career Reading and upcoming career windows.',
        primaryAction: 'CONTINUE TO CAREER READING  →',
        primaryRoute: '/readings',
        primaryKey: 'home-career-reading-cta',
        showUpdateAction: true,
      );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {this.subtitle});
  final String title;
  final String? subtitle;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Text(title, style: _headlineStyle(fontSize: 26)),
      if (subtitle != null) ...[
        const SizedBox(width: 9),
        Text(
          subtitle!,
          style: _labelStyle(color: _HomeColors.gold, fontSize: 9),
        ),
      ],
    ],
  );
}

class _CareerPhaseCard extends StatelessWidget {
  const _CareerPhaseCard({required this.controller});
  final VimshottariController controller;
  @override
  Widget build(BuildContext context) {
    if (controller.currentState == VimshottariLoadState.initial ||
        controller.currentState == VimshottariLoadState.loading) {
      return const _StateCard(label: 'Loading your current dasha…');
    }
    final current = controller.current;
    if (controller.currentState == VimshottariLoadState.error ||
        current == null) {
      return _RetryCard(
        title: 'Current career phase unavailable',
        onRetry: controller.refreshCurrent,
      );
    }
    return _DarkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'CURRENT DASHA',
            style: _labelStyle(color: _HomeColors.champagne),
          ),
          const SizedBox(height: 11),
          Text(
            '${current.mahadasha.lord} → ${current.antardasha.lord}',
            style: _headlineStyle(fontSize: 28),
          ),
          const SizedBox(height: 7),
          Text(
            '${DateFormat.yMMMd().format(current.mahadasha.startUtc.toLocal())} – ${DateFormat.yMMMd().format(current.antardasha.endUtc.toLocal())}',
            style: GoogleFonts.inter(color: _HomeColors.slate, fontSize: 11),
          ),
          const SizedBox(height: 12),
          TextButton(
            key: const ValueKey('home-dasha-cta'),
            onPressed: () => context.push('/vimshottari'),
            child: Text(
              'UNDERSTAND THIS PHASE  →',
              style: _labelStyle(color: _HomeColors.gold),
            ),
          ),
        ],
      ),
    );
  }
}

class _KundliPreview extends StatelessWidget {
  const _KundliPreview({required this.controller});
  final NatalSummaryController controller;
  @override
  Widget build(BuildContext context) {
    if (controller.state == NatalSummaryLoadState.initial ||
        controller.state == NatalSummaryLoadState.loading) {
      return const _StateCard(label: 'Loading your Lagna chart…');
    }
    final natal = controller.summary;
    if (controller.state == NatalSummaryLoadState.error || natal == null) {
      return _RetryCard(
        title: 'Kundli preview unavailable',
        onRetry: controller.refresh,
      );
    }
    final summary = natal.summary;
    return _DarkCard(
      child: Column(
        children: [
          SizedBox(
            width: 250,
            child: FittedBox(
              child: SizedBox(
                width: 800,
                child: NorthIndianKundliChart(
                  houses: buildD1ChartHouses(natal),
                  onHouseTap: (_) {},
                  onPlanetTap: (_) {},
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _Identity(
                label: 'Lagna',
                value: summary.ascendant.sign.englishName,
              ),
              _Identity(label: 'Moon', value: summary.moonSign.englishName),
              _Identity(label: 'Nakshatra', value: summary.moonNakshatra.name),
            ],
          ),
          const SizedBox(height: 14),
          TextButton(
            key: const ValueKey('home-kundli-cta'),
            onPressed: () => context.go('/kundli'),
            child: Text(
              'OPEN MY KUNDLI  →',
              style: _labelStyle(color: _HomeColors.gold),
            ),
          ),
        ],
      ),
    );
  }
}

class _Identity extends StatelessWidget {
  const _Identity({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(label, style: _labelStyle(fontSize: 8, color: _HomeColors.slate)),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            color: _HomeColors.alabaster,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _DarkCard extends StatelessWidget {
  const _DarkCard({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: _HomeColors.abyss,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: _HomeColors.gold.withValues(alpha: .16)),
    ),
    child: child,
  );
}

class _StateCard extends StatelessWidget {
  const _StateCard({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => _DarkCard(
    child: SizedBox(
      height: 130,
      child: Center(
        child: Semantics(
          label: label,
          child: const CircularProgressIndicator(color: _HomeColors.gold),
        ),
      ),
    ),
  );
}

class _RetryCard extends StatelessWidget {
  const _RetryCard({required this.title, required this.onRetry});
  final String title;
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) => _DarkCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.inter(
            color: _HomeColors.alabaster,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Please try again.',
          style: GoogleFonts.inter(color: _HomeColors.slate, fontSize: 12),
        ),
        TextButton(
          onPressed: onRetry,
          child: Text('RETRY', style: _labelStyle(color: _HomeColors.gold)),
        ),
      ],
    ),
  );
}

String _daypart() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

String _initials(String? name) {
  final parts = (name ?? '')
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'KI';
  return parts.take(2).map((part) => part[0].toUpperCase()).join();
}

String? _birthDate(BirthProfile? profile) {
  final raw = profile?.birthData.localDate;
  final date = raw == null ? null : DateTime.tryParse(raw);
  return date == null ? null : DateFormat('dd MMM yyyy').format(date);
}

TextStyle _labelStyle({
  double fontSize = 10,
  Color color = _HomeColors.alabaster,
}) => GoogleFonts.inter(
  color: color,
  fontSize: fontSize,
  fontWeight: FontWeight.w700,
  letterSpacing: 1.0,
);

TextStyle _headlineStyle({double fontSize = 28}) => GoogleFonts.ebGaramond(
  color: _HomeColors.alabaster,
  fontSize: fontSize,
  height: .98,
  fontWeight: FontWeight.w500,
);
