import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../readings/career_reading_generation_controller.dart';
import '../readings/astrology_presentation_copy.dart';
import '../transits/transit_snapshot_controller.dart';

class InsightsScreen extends StatelessWidget {
  const InsightsScreen({
    super.key,
    required this.generation,
    this.onOpenCareer,
    this.onOpenCareerChat,
    this.onOpenVehicle,
    this.onOpenWealth,
    this.onOpenRelationships,
    this.transits,
  });
  final CareerReadingGenerationController generation;
  final VoidCallback? onOpenCareer;
  final VoidCallback? onOpenCareerChat;
  final VoidCallback? onOpenVehicle;
  final VoidCallback? onOpenWealth;
  final VoidCallback? onOpenRelationships;
  final TransitSnapshotController? transits;

  static const midnight = Color(0xFF061A1A);
  static const abyss = Color(0xFF082625);
  static const violet = Color(0xFF0D312F);
  static const alabaster = Color(0xFFF7F4EC);
  static const slate = Color(0xFFA8B7B4);
  static const gold = Color(0xFFD6B15A);

  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return ListenableBuilder(
      listenable: Listenable.merge([generation, ?transits]),
      builder: (context, child) => Scaffold(
        backgroundColor: midnight,
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
            children: [
              const _Header(),
              const SizedBox(height: 28),
              const _SectionLabel('WHAT IS CHANGING?'),
              const SizedBox(height: 10),
              _TransitCard(
                copy: copy,
                loadState: transits?.state,
                onTap: () => context.pushNamed('current-transits'),
              ),
              const SizedBox(height: 12),
              _AvailableInsightCard(
                icon: Icons.directions_car_outlined,
                title: 'Vehicle & Mobility',
                subtitle:
                    'See when vehicle-related factors are more supportive.',
                onTap: onOpenVehicle,
              ),
              const SizedBox(height: 12),
              _AvailableInsightCard(
                icon: Icons.favorite_border,
                title: 'Relationships & Family',
                subtitle:
                    'Relationship, commitment, and family timing insights.',
                onTap: onOpenRelationships,
              ),
              const SizedBox(height: 12),
              _AvailableInsightCard(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Wealth & Money',
                subtitle: 'Wealth timing and financial structure insights.',
                onTap: onOpenWealth,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) => const Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('INSIGHTS', style: _Styles.eyebrow),
      SizedBox(height: 6),
      Text('What is changing?', style: _Styles.title),
      SizedBox(height: 8),
      Text(
        'See calculated current transits and the changes they bring into focus.',
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
  const _TransitCard({required this.copy, required this.onTap, this.loadState});
  final AstrologyPresentationCopy copy;
  final VoidCallback onTap;
  final TransitSnapshotLoadState? loadState;

  String get _statusLabel => switch (loadState) {
    TransitSnapshotLoadState.error => 'UNAVAILABLE',
    TransitSnapshotLoadState.initial ||
    TransitSnapshotLoadState.loading ||
    TransitSnapshotLoadState.refreshing => 'CHECKING',
    TransitSnapshotLoadState.loaded || null => 'AVAILABLE',
  };

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: 'Current Transits, ${_statusLabel.toLowerCase()}',
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
            border: Border.all(color: const Color(0x88D6B15A)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _IconTile(Icons.public_outlined, size: 46),
              const SizedBox(width: 14),
              Expanded(
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
                      copy.insightsTransitDescription,
                      style: _Styles.cardBody,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  _Pill(_statusLabel),
                  const SizedBox(height: 44),
                  const Icon(Icons.chevron_right, color: InsightsScreen.gold),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _AvailableInsightCard extends StatelessWidget {
  const _AvailableInsightCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: InsightsScreen.violet,
    borderRadius: BorderRadius.circular(16),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x663F8179)),
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
            const Icon(Icons.chevron_right, color: InsightsScreen.gold),
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
      color: const Color(0xFF114A46),
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
      color: gold ? const Color(0x33173F3B) : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(
        color: gold ? const Color(0x66D6B15A) : const Color(0x33255C57),
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
