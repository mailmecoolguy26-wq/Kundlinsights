import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../natal/domain/natal_summary.dart';
import '../natal/natal_summary_controller.dart';
import '../profiles/profile_controller.dart';
import '../profiles/domain/birth_profile.dart';
import '../divisional/divisional_chart_controller.dart';
import '../divisional/domain/divisional_chart.dart';
import '../readings/astrology_presentation_copy.dart';
import 'divisional_chart_panel.dart';
import 'north_indian_chart.dart';

class KundliScreen extends StatefulWidget {
  const KundliScreen({
    super.key,
    required this.profileController,
    required this.natalController,
    required this.divisionalController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;
  final DivisionalChartController divisionalController;

  @override
  State<KundliScreen> createState() => _KundliScreenState();
}

class _KundliScreenState extends State<KundliScreen> {
  DivisionalChartType? _selectedType;

  void _select(DivisionalChartType? type) {
    setState(() => _selectedType = type);
    if (type != null) widget.divisionalController.load(type);
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final baseTheme = Theme.of(context);
    return Theme(
      data: baseTheme.copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B071B),
        cardTheme: const CardThemeData(
          color: Color(0xFF120D29),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(16)),
            side: BorderSide(color: Color(0x335E4A87)),
          ),
        ),
        textTheme: baseTheme.textTheme.apply(
          bodyColor: const Color(0xFFFAF7F2),
          displayColor: const Color(0xFFFAF7F2),
        ),
      ),
      child: Scaffold(
        backgroundColor: const Color(0xFF0B071B),
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: SegmentedButton<DivisionalChartType?>(
                  segments: [
                    ButtonSegment(value: null, label: Text(t.d1)),
                    ButtonSegment(
                      value: DivisionalChartType.d9,
                      label: Text(t.d9),
                    ),
                    ButtonSegment(
                      value: DivisionalChartType.d10,
                      label: Text(t.d10),
                    ),
                  ],
                  selected: {_selectedType},
                  onSelectionChanged: (selection) => _select(selection.single),
                  style: ButtonStyle(
                    foregroundColor: const WidgetStatePropertyAll(
                      Color(0xFFFAF7F2),
                    ),
                    backgroundColor: const WidgetStatePropertyAll(
                      Color(0xFF1B1234),
                    ),
                    side: const WidgetStatePropertyAll(
                      BorderSide(color: Color(0x55C5A059)),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: _selectedType == null
                    ? _D1KundliContent(
                        profileController: widget.profileController,
                        natalController: widget.natalController,
                      )
                    : DivisionalChartPanel(
                        profileController: widget.profileController,
                        controller: widget.divisionalController,
                        type: _selectedType!,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _D1KundliContent extends StatelessWidget {
  const _D1KundliContent({
    required this.profileController,
    required this.natalController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: natalController,
    builder: (context, child) {
      final copy = AstrologyPresentationCopy.of(context);
      final summary = natalController.summary;
      return RefreshIndicator(
        onRefresh: natalController.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 112),
          children: [
            _KundliHero(profile: profileController.activeProfile),
            const SizedBox(height: 20),
            _ModuleGrid(
              onDasha: () => context.pushNamed('vimshottari-timeline'),
              onTransits: () => context.pushNamed('current-transits'),
              onAshtakavarga: () => context.push('/ashtakavarga'),
            ),
            const SizedBox(height: AppSpacing.md),
            if (natalController.state == NatalSummaryLoadState.loading ||
                natalController.state == NatalSummaryLoadState.initial)
              const _NatalLoading()
            else if (summary == null)
              _NatalError(onRetry: natalController.refresh)
            else ...[
              const Text('LAGNA CHART', style: _KundliStyle.eyebrow),
              const SizedBox(height: 8),
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: NorthIndianKundliChart(
                  houses: buildD1ChartHouses(summary),
                  onHouseTap: (house) => _showHouseDetails(context, house),
                  onPlanetTap: (planet) => context.goNamed(
                    'planet-detail',
                    pathParameters: {'planet': planet.body},
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              _HouseAccessibilityFallback(houses: buildD1ChartHouses(summary)),
              const SizedBox(height: AppSpacing.xl),
              _IdentityCards(summary: summary),
              const SizedBox(height: AppSpacing.xl),
              const Text('PLANETARY POSITIONS', style: _KundliStyle.eyebrow),
              const SizedBox(height: 10),
              ...summary.planets.map(
                (position) => _PlanetRow(position: position, copy: copy),
              ),
            ],
          ],
        ),
      );
    },
  );
}

class _ModuleGrid extends StatelessWidget {
  const _ModuleGrid({
    required this.onDasha,
    required this.onTransits,
    required this.onAshtakavarga,
  });
  final VoidCallback onDasha;
  final VoidCallback onTransits;
  final VoidCallback onAshtakavarga;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('EXPLORE YOUR KUNDLI', style: _KundliStyle.eyebrow),
      const SizedBox(height: 10),
      Row(
        children: [
          Expanded(
            child: _ModuleCard(
              icon: Icons.timeline_outlined,
              title: 'Dasha',
              subtitle: 'Vimshottari timeline',
              onTap: onDasha,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _ModuleCard(
              icon: Icons.public_outlined,
              title: 'Transits',
              subtitle: 'Current Gochar',
              onTap: onTransits,
            ),
          ),
        ],
      ),
      const SizedBox(height: 10),
      _ModuleCard(
        icon: Icons.grid_view_outlined,
        title: 'Ashtakavarga',
        subtitle: 'Sign-oriented scores',
        onTap: onAshtakavarga,
      ),
    ],
  );
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({
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
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF120D29),
    borderRadius: BorderRadius.circular(14),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        constraints: const BoxConstraints(minHeight: 74),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x335E4A87)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFFC5A059), size: 19),
            const SizedBox(height: 7),
            Text(
              title,
              style: const TextStyle(
                color: Color(0xFFFAF7F2),
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(color: Color(0xFF9E9AA9), fontSize: 11),
            ),
          ],
        ),
      ),
    ),
  );
}

class _KundliHero extends StatelessWidget {
  const _KundliHero({required this.profile});
  final BirthProfile? profile;

  @override
  Widget build(BuildContext context) {
    final label = profile?.label ?? 'Active profile';
    final data = profile?.birthData.value;
    final date = data?['localDate'] as String?;
    final time = data?['localTime'] as String?;
    final details = [date, time].nonNulls.join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text('VEDIC ASTROLOGY', style: _KundliStyle.eyebrow),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFF120D29),
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: const Color(0x55C5A059)),
              ),
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xFFFAF7F2), fontSize: 12),
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        const Text('My Kundli', style: _KundliStyle.title),
        if (details.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(details, style: _KundliStyle.body),
        ],
      ],
    );
  }
}

abstract final class _KundliStyle {
  static const eyebrow = TextStyle(
    color: Color(0xFFC5A059),
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.6,
  );
  static const title = TextStyle(
    color: Color(0xFFFAF7F2),
    fontFamily: 'EBGaramond',
    fontSize: 32,
    height: 1.08,
    fontWeight: FontWeight.w600,
  );
  static const body = TextStyle(
    color: Color(0xFF9E9AA9),
    fontSize: 13,
    height: 1.4,
  );
}

void _showHouseDetails(BuildContext context, D1ChartHouse house) {
  final t = AppLocalizations.of(context)!;
  final copy = AstrologyPresentationCopy.of(context);
  showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              copy.isHinglish
                  ? '${house.house}th Bhav'
                  : '${t.house} ${house.house}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('${t.sign}: ${house.sign.englishName}'),
            const SizedBox(height: AppSpacing.sm),
            Text(
              house.planets.isEmpty
                  ? t.noPlanets
                  : house.planets
                        .map(
                          (planet) =>
                              '${copy.planet(planet.body)}${planet.retrograde ? ' (${copy.retrograde})' : ''}',
                        )
                        .join(', '),
            ),
          ],
        ),
      ),
    ),
  );
}

class _HouseAccessibilityFallback extends StatelessWidget {
  const _HouseAccessibilityFallback({required this.houses});

  final List<D1ChartHouse> houses;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final copy = AstrologyPresentationCopy.of(context);
    return Material(
      color: const Color(0xFF120D29),
      borderRadius: BorderRadius.circular(16),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
        iconColor: const Color(0xFFC5A059),
        collapsedIconColor: const Color(0xFFC5A059),
        title: Text(
          t.chartAccessibleHouseList,
          style: const TextStyle(
            color: Color(0xFFFAF7F2),
            fontWeight: FontWeight.w600,
          ),
        ),
        children: houses
            .map(
              (house) => ListTile(
                dense: true,
                title: Text(
                  '${copy.isHinglish ? '${house.house}th Bhav' : '${t.house} ${house.house}'} — ${house.sign.englishName}',
                  style: const TextStyle(color: Color(0xFFFAF7F2)),
                ),
                subtitle: Text(
                  house.planets.isEmpty
                      ? t.noPlanets
                      : house.planets
                            .map(
                              (planet) =>
                                  '${copy.planet(planet.body)}${planet.retrograde ? ' (${copy.retrograde})' : ''}',
                            )
                            .join(', '),
                  style: const TextStyle(color: Color(0xFF9E9AA9)),
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

class _NatalLoading extends StatelessWidget {
  const _NatalLoading();
  @override
  Widget build(BuildContext context) => const AppCard(
    child: SizedBox(
      height: 220,
      child: Center(child: CircularProgressIndicator()),
    ),
  );
}

class _NatalError extends StatelessWidget {
  const _NatalError({required this.onRetry});
  final Future<void> Function() onRetry;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AppCard(
      child: Column(
        children: [
          Text(t.natalSummaryUnavailable, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.md),
          FilledButton(onPressed: onRetry, child: Text(t.retry)),
        ],
      ),
    );
  }
}

class _IdentityCards extends StatelessWidget {
  const _IdentityCards({required this.summary});
  final NatalSummary summary;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final copy = AstrologyPresentationCopy.of(context);
    final identity = summary.summary;
    return AppCard(
      child: Column(
        children: [
          _Value(
            label: copy.isHinglish ? copy.ascendant : t.ascendant,
            value: identity.ascendant.sign.englishName,
          ),
          _Value(label: t.moonSign, value: identity.moonSign.englishName),
          _Value(label: t.nakshatra, value: identity.moonNakshatra.name),
          _Value(label: t.pada, value: '${identity.moonPada}'),
          _Value(label: t.sunSign, value: identity.sunSign.englishName),
        ],
      ),
    );
  }
}

class _Value extends StatelessWidget {
  const _Value({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: Row(
      children: [
        Expanded(
          child: Text(label, style: const TextStyle(color: Color(0xFF9E9AA9))),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFFFAF7F2),
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _PlanetRow extends StatelessWidget {
  const _PlanetRow({required this.position, required this.copy});
  final NatalPosition position;
  final AstrologyPresentationCopy copy;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Semantics(
        label:
            '${copy.planet(position.body)}, ${position.sign.englishName}, ${copy.isHinglish ? '${position.house}th Bhav' : '${t.house} ${position.house}'}${position.retrograde ? ', ${copy.retrograde}' : ''}',
        button: true,
        child: AppCard(
          padding: EdgeInsets.zero,
          child: ListTile(
            title: Text(
              copy.planet(position.body),
              style: const TextStyle(
                color: Color(0xFFFAF7F2),
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Text(
              '${position.sign.englishName} · ${position.degreeWithinSign.toStringAsFixed(2)}° · ${copy.isHinglish ? '${position.house}th Bhav' : '${t.house} ${position.house}'}\n${position.nakshatra.name} · ${t.pada} ${position.pada}',
              style: const TextStyle(color: Color(0xFF9E9AA9), height: 1.35),
            ),
            trailing: position.retrograde
                ? Chip(
                    label: Text(
                      copy.retrograde,
                      style: const TextStyle(
                        color: Color(0xFFC5A059),
                        fontSize: 11,
                      ),
                    ),
                    backgroundColor: const Color(0xFF2A1B4C),
                    side: const BorderSide(color: Color(0x66C5A059)),
                  )
                : const Icon(Icons.chevron_right, color: Color(0xFFC5A059)),
            onTap: () => context.goNamed(
              'planet-detail',
              pathParameters: {'planet': position.body},
            ),
          ),
        ),
      ),
    );
  }
}
