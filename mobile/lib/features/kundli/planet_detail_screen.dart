import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/states.dart';
import '../natal/domain/natal_summary.dart';
import '../natal/natal_summary_controller.dart';
import '../readings/astrology_presentation_copy.dart';

class PlanetDetailScreen extends StatelessWidget {
  const PlanetDetailScreen({
    super.key,
    required this.natalController,
    required this.planetName,
  });

  final NatalSummaryController natalController;
  final String planetName;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: natalController,
    builder: (context, child) {
      final position = natalController.summary?.planets
          .where((item) => item.body == planetName)
          .cast<NatalPosition?>()
          .firstOrNull;
      if (position == null) {
        return Scaffold(
          backgroundColor: const Color(0xFF0B071B),
          appBar: AppBar(
            backgroundColor: const Color(0xFF0B071B),
            foregroundColor: const Color(0xFFFAF7F2),
            title: Text(AppLocalizations.of(context)!.planetDetail),
          ),
          body: const LoadingState(label: 'Loading planet facts'),
        );
      }
      return _PlanetFacts(position: position);
    },
  );
}

class _PlanetFacts extends StatelessWidget {
  const _PlanetFacts({required this.position});
  final NatalPosition position;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final copy = AstrologyPresentationCopy.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFF0B071B),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B071B),
        foregroundColor: const Color(0xFFFAF7F2),
        title: Text(copy.planet(position.body)),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 112),
          children: [
            const Text('PLANET FACTS', style: _PlanetStyle.eyebrow),
            const SizedBox(height: 8),
            Text(copy.planet(position.body), style: _PlanetStyle.title),
            const SizedBox(height: 16),
            _PlanetFactsCard(
              child: Column(
                children: [
                  _Fact(
                    label: t.sign,
                    value: copy.sign(
                      sanskritName: position.sign.sanskritName,
                      englishName: position.sign.englishName,
                    ),
                  ),
                  _Fact(label: t.house, value: copy.house(position.house)),
                  _Fact(
                    label: t.longitude,
                    value: '${position.longitude.toStringAsFixed(4)}°',
                  ),
                  _Fact(
                    label: t.degreeInSign,
                    value: '${position.degreeWithinSign.toStringAsFixed(4)}°',
                  ),
                  _Fact(label: t.nakshatra, value: position.nakshatra.name),
                  _Fact(label: t.pada, value: '${position.pada}'),
                  _Fact(
                    label: t.motion,
                    value: copy.state(position.motion ?? '—'),
                  ),
                  _Fact(
                    label: t.retrograde,
                    value: position.retrograde ? copy.retrograde : '—',
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(t.astronomicalDetails, style: _PlanetStyle.section),
            const SizedBox(height: AppSpacing.sm),
            _PlanetFactsCard(
              child: _Fact(
                label: t.speed,
                value: position.speed == null
                    ? '—'
                    : t.speedDegreesPerDay(position.speed!.toStringAsFixed(6)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: _PlanetStyle.label)),
        const SizedBox(width: 16),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: _PlanetStyle.value,
          ),
        ),
      ],
    ),
  );
}

class _PlanetFactsCard extends StatelessWidget {
  const _PlanetFactsCard({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpacing.md),
    decoration: BoxDecoration(
      color: const Color(0xFF120D29),
      borderRadius: AppRadius.medium,
      border: Border.all(color: const Color(0x335E4A87)),
    ),
    child: child,
  );
}

abstract final class _PlanetStyle {
  static const eyebrow = TextStyle(
    color: Color(0xFFC5A059),
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.5,
  );
  static const title = TextStyle(
    color: Color(0xFFFAF7F2),
    fontFamily: 'EBGaramond',
    fontSize: 30,
    fontWeight: FontWeight.w600,
  );
  static const section = TextStyle(
    color: Color(0xFFFAF7F2),
    fontFamily: 'EBGaramond',
    fontSize: 23,
    fontWeight: FontWeight.w600,
  );
  static const label = TextStyle(color: Color(0xFF9E9AA9), fontSize: 13);
  static const value = TextStyle(
    color: Color(0xFFFAF7F2),
    fontSize: 13,
    fontWeight: FontWeight.w600,
  );
}
