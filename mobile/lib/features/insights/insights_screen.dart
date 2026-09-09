import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../readings/career_reading_generation_controller.dart';

class InsightsScreen extends StatelessWidget {
  const InsightsScreen({super.key, required this.generation});
  final CareerReadingGenerationController generation;

  static const midnight = Color(0xFF0B071B);
  static const abyss = Color(0xFF120D29);
  static const violet = Color(0xFF1B1234);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const gold = Color(0xFFC5A059);

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: generation,
    builder: (context, child) => Scaffold(
      backgroundColor: midnight,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
          children: [
            const _Header(),
            const SizedBox(height: 28),
            const _SectionLabel('AVAILABLE NOW'),
            const SizedBox(height: 10),
            _TransitCard(onTap: () => context.pushNamed('current-transits')),
            const SizedBox(height: 12),
            _CareerInsightCard(
              eligibilityState: generation.eligibilityState,
              onUnlock: () => context.push('/career-premium'),
              onSeeCareerInsights: () => context.go('/readings'),
              onRetryEligibility: generation.refreshEligibility,
            ),
            const SizedBox(height: 28),
            const _SectionLabel('COMING NEXT'),
            const SizedBox(height: 10),
            const _InsightCard(
              icon: Icons.favorite_border,
              title: 'Marriage',
              subtitle: 'Relationship timing and compatibility insights',
            ),
            const SizedBox(height: 12),
            const _InsightCard(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Wealth & Property',
              subtitle: 'Financial cycles, assets, and property timing',
            ),
          ],
        ),
      ),
    ),
  );
}

class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('INSIGHTS', style: _Styles.eyebrow),
      SizedBox(height: 6),
      Text('Explore Your Insights', style: _Styles.title),
      SizedBox(height: 8),
      Text(
        'Discover what your chart reveals across timing, career, relationships, and wealth.',
        style: _Styles.body,
      ),
    ],
  );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Text(label, style: _Styles.eyebrow);
}

class _TransitCard extends StatelessWidget {
  const _TransitCard({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Current Transits, available',
    child: Material(
      color: InsightsScreen.violet,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0x88C5A059)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _IconTile(Icons.public_outlined, size: 46),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Pill('LIVE', gold: true),
                    SizedBox(height: 9),
                    Text('Current Transits', style: _Styles.cardTitle),
                    SizedBox(height: 2),
                    Text('Gochar', style: _Styles.goldSubheading),
                    SizedBox(height: 7),
                    Text(
                      'See how today’s planetary movements interact with your birth chart.',
                      style: _Styles.cardBody,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _Pill('AVAILABLE'),
                  SizedBox(height: 44),
                  Icon(Icons.chevron_right, color: InsightsScreen.gold),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _CareerInsightCard extends StatelessWidget {
  const _CareerInsightCard({
    required this.eligibilityState,
    required this.onUnlock,
    required this.onSeeCareerInsights,
    required this.onRetryEligibility,
  });
  final CareerEligibilityState eligibilityState;
  final VoidCallback onUnlock;
  final VoidCallback onSeeCareerInsights;
  final Future<void> Function() onRetryEligibility;

  @override
  Widget build(BuildContext context) {
    final state = switch (eligibilityState) {
      CareerEligibilityState.eligible => _CareerCardState(
        actionLabel: 'SEE CAREER INSIGHTS',
        onTap: onSeeCareerInsights,
        semanticLabel: 'Career, premium, see career insights',
      ),
      CareerEligibilityState.ineligible => _CareerCardState(
        actionLabel: 'UNLOCK',
        onTap: onUnlock,
        semanticLabel: 'Career, premium, unlock',
      ),
      CareerEligibilityState.error => _CareerCardState(
        actionLabel: 'CHECK AVAILABILITY',
        onTap: () => onRetryEligibility(),
        semanticLabel: 'Career, premium, check availability',
      ),
      CareerEligibilityState.initial ||
      CareerEligibilityState.loading => const _CareerCardState(
        actionLabel: 'CHECKING',
        semanticLabel: 'Career, premium, checking availability',
      ),
    };
    final actionable = state.onTap != null;
    return Semantics(
      button: actionable,
      enabled: actionable,
      label: state.semanticLabel,
      child: Opacity(
        opacity: actionable ? 1 : .78,
        child: Material(
          color: InsightsScreen.abyss,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: state.onTap,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: actionable
                      ? const Color(0x66C5A059)
                      : const Color(0x335E4A87),
                ),
              ),
              child: Row(
                children: [
                  const _IconTile(Icons.work_outline),
                  const SizedBox(width: 13),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Career', style: _Styles.cardTitle),
                        SizedBox(height: 3),
                        Text(
                          'Personalized career timing and future windows',
                          style: _Styles.cardBody,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const _Pill('PREMIUM', gold: true),
                      const SizedBox(height: 6),
                      _Pill(state.actionLabel, gold: actionable),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CareerCardState {
  const _CareerCardState({
    required this.actionLabel,
    required this.semanticLabel,
    this.onTap,
  });
  final String actionLabel;
  final String semanticLabel;
  final VoidCallback? onTap;
}

class _InsightCard extends StatelessWidget {
  const _InsightCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Semantics(
    label: '$title, coming soon',
    child: Opacity(
      opacity: .78,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: InsightsScreen.abyss,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x335E4A87)),
        ),
        child: Row(
          children: [
            _IconTile(icon),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: _Styles.cardTitle),
                  const SizedBox(height: 3),
                  Text(subtitle, style: _Styles.cardBody),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: const [_Pill('COMING SOON')],
            ),
          ],
        ),
      ),
    ),
  );
}

class _IconTile extends StatelessWidget {
  const _IconTile(this.icon, {this.size = 40});
  final IconData icon;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: const Color(0xFF2A1B4C),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Icon(icon, color: InsightsScreen.gold, size: size * .48),
  );
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, {this.gold = false});
  final String label;
  final bool gold;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      color: gold ? const Color(0x332F2413) : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(
        color: gold ? const Color(0x66C5A059) : const Color(0x335E4A87),
      ),
    ),
    child: Text(
      label,
      style: TextStyle(
        color: gold ? InsightsScreen.gold : InsightsScreen.slate,
        fontSize: 9,
        fontWeight: FontWeight.w700,
        letterSpacing: .8,
      ),
    ),
  );
}

abstract final class _Styles {
  static const eyebrow = TextStyle(
    color: InsightsScreen.gold,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.7,
  );
  static const title = TextStyle(
    color: InsightsScreen.alabaster,
    fontFamily: 'EBGaramond',
    fontSize: 32,
    height: 1.08,
    fontWeight: FontWeight.w600,
  );
  static const body = TextStyle(
    color: InsightsScreen.slate,
    fontSize: 14,
    height: 1.45,
  );
  static const cardTitle = TextStyle(
    color: InsightsScreen.alabaster,
    fontSize: 16,
    fontWeight: FontWeight.w600,
  );
  static const goldSubheading = TextStyle(
    color: InsightsScreen.gold,
    fontSize: 13,
    fontWeight: FontWeight.w600,
  );
  static const cardBody = TextStyle(
    color: InsightsScreen.slate,
    fontSize: 12.5,
    height: 1.32,
  );
}
