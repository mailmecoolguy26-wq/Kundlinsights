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

class KundliScreen extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF061A1A),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 112),
          children: [
            _KundliHero(profile: profileController.activeProfile),
            const SizedBox(height: AppSpacing.lg),
            const _KundliIntro(),
            const SizedBox(height: AppSpacing.lg),
            _KundliGroup(
              title: 'CHARTS',
              children: [
                _KundliLink(
                  icon: Icons.diamond_outlined,
                  title: 'Lagna Chart',
                  subtitle: 'Your D1 chart and core life structure',
                  onTap: () => context.push('/kundli/lagna'),
                ),
                _KundliLink(
                  icon: Icons.auto_awesome_outlined,
                  title: 'Navamsha Chart',
                  subtitle: 'D9 chart for deeper chart context',
                  onTap: () => context.push('/kundli/navamsha'),
                ),
                _KundliLink(
                  icon: Icons.nightlight_outlined,
                  title: 'Chandra Kundli',
                  subtitle: 'Your natal chart viewed from the Moon',
                  onTap: () => context.push('/kundli/chandra'),
                ),
                _KundliLink(
                  icon: Icons.grid_view_outlined,
                  title: 'Divisional Charts',
                  subtitle: 'Explore available D9 and D10 charts',
                  onTap: () => context.push('/kundli/divisional'),
                ),
              ],
            ),
            _KundliGroup(
              title: 'TIMING',
              children: [
                _KundliLink(
                  icon: Icons.timeline_outlined,
                  title: 'Vimshottari Dasha',
                  subtitle: 'Current Mahadasha, Antardasha and timeline',
                  onTap: () => context.pushNamed('vimshottari-timeline'),
                ),
                _KundliLink(
                  icon: Icons.public_outlined,
                  title: 'Current Transits',
                  subtitle: 'Current Gochar and activated natal houses',
                  onTap: () => context.pushNamed('current-transits'),
                ),
              ],
            ),
            _KundliGroup(
              title: 'PLANETARY ANALYSIS',
              children: [
                _KundliLink(
                  icon: Icons.list_alt_outlined,
                  title: 'Planet Positions',
                  subtitle: 'Sign, house, degree, Nakshatra and motion',
                  onTap: () => context.push('/kundli/planets'),
                ),
                _KundliLink(
                  icon: Icons.speed_outlined,
                  title: 'Planetary Status',
                  subtitle: 'Supported direct and retrograde states',
                  onTap: () => context.push('/kundli/planetary-status'),
                ),
                _KundliLink(
                  icon: Icons.apps_outlined,
                  title: 'Ashtakavarga',
                  subtitle: 'SAV and BAV sign-oriented support scores',
                  onTap: () => context.push('/ashtakavarga'),
                ),
              ],
            ),
            _KundliGroup(
              title: 'BIRTH DETAILS',
              children: [
                _KundliLink(
                  icon: Icons.person_outline,
                  title: 'Birth Details',
                  subtitle: 'Saved birth input and chart identity',
                  onTap: () => context.push('/kundli/birth-details'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class LagnaChartScreen extends StatelessWidget {
  const LagnaChartScreen({
    super.key,
    required this.profileController,
    required this.natalController,
  });

  final ProfileController profileController;
  final NatalSummaryController natalController;

  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: 'Lagna Chart',
    child: ListenableBuilder(
      listenable: natalController,
      builder: (context, child) {
        final summary = natalController.summary;
        return RefreshIndicator(
          onRefresh: natalController.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 112),
            children: [
              _ChartExplanation(
                title: 'Your main birth chart',
                body: 'The Lagna or D1 chart is the main view of your natal placements and houses. It provides the foundation used by TaraVerse calculations.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (natalController.state == NatalSummaryLoadState.loading ||
                  natalController.state == NatalSummaryLoadState.initial)
                const _NatalLoading()
              else if (summary == null)
                _NatalError(onRetry: natalController.refresh)
              else ...[
                Text(
                  profileController.activeProfile?.label ?? 'Birth profile',
                  style: _KundliStyle.eyebrow,
                ),
                const SizedBox(height: 8),
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: NorthIndianKundliChart(
                    houses: buildD1ChartHouses(summary),
                    onHouseTap: (house) => _showHouseDetails(context, house),
                    onPlanetTap: (planet) => context.pushNamed(
                      'planet-detail',
                      pathParameters: {'planet': planet.body},
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                _HouseAccessibilityFallback(
                  houses: buildD1ChartHouses(summary),
                ),
                const SizedBox(height: AppSpacing.xl),
                _IdentityCards(summary: summary),
              ],
            ],
          ),
        );
      },
    ),
  );
}

class _KundliIntro extends StatelessWidget {
  const _KundliIntro();
  @override
  Widget build(BuildContext context) => const AppCard(
    child: Text(
      'Your Kundli brings together the birth chart, timing cycles, current transits and supported planetary analysis. Open any section to explore the underlying chart facts.',
      style: _KundliStyle.body,
    ),
  );
}

class _KundliGroup extends StatelessWidget {
  const _KundliGroup({required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.lg),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: _KundliStyle.eyebrow),
        const SizedBox(height: AppSpacing.sm),
        ...children,
      ],
    ),
  );
}

class _KundliLink extends StatelessWidget {
  const _KundliLink({
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
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
    child: AppCard(
      padding: EdgeInsets.zero,
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: const Color(0xFFD6B15A)),
        title: Text(
          title,
          style: const TextStyle(
            color: Color(0xFFF7F4EC),
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: Text(subtitle, style: _KundliStyle.body),
        trailing: const Icon(Icons.chevron_right, color: Color(0xFF35B9AC)),
      ),
    ),
  );
}

class KundliDivisionalChartScreen extends StatefulWidget {
  const KundliDivisionalChartScreen({
    super.key,
    required this.profileController,
    required this.controller,
    required this.type,
  });
  final ProfileController profileController;
  final DivisionalChartController controller;
  final DivisionalChartType type;

  @override
  State<KundliDivisionalChartScreen> createState() =>
      _KundliDivisionalChartScreenState();
}

class _KundliDivisionalChartScreenState
    extends State<KundliDivisionalChartScreen> {
  @override
  void initState() {
    super.initState();
    widget.controller.load(widget.type);
  }

  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: widget.type == DivisionalChartType.d9
        ? 'Navamsha Chart'
        : 'D10 Career Chart',
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: _ChartExplanation(
            title: widget.type == DivisionalChartType.d9
                ? 'What Navamsha represents'
                : 'What D10 represents',
            body: widget.type == DivisionalChartType.d9
                ? 'Navamsha is a supporting divisional chart used to examine deeper planetary context and relationship themes. It is not a prediction by itself.'
                : 'D10 is a supporting divisional chart used for profession, responsibility and career development. It should be read with the main chart and timing evidence.',
          ),
        ),
        Expanded(
          child: DivisionalChartPanel(
            profileController: widget.profileController,
            controller: widget.controller,
            type: widget.type,
          ),
        ),
      ],
    ),
  );
}

class DivisionalChartsScreen extends StatelessWidget {
  const DivisionalChartsScreen({super.key});
  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: 'Divisional Charts',
    child: ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
      children: [
        const _ChartExplanation(
          title: 'Focused chart views',
          body: 'Divisional charts provide focused views derived by the TaraVerse astrology engine. Only charts currently available through the verified customer API are shown here.',
        ),
        const SizedBox(height: AppSpacing.md),
        _KundliLink(
          icon: Icons.auto_awesome_outlined,
          title: 'Navamsha (D9)',
          subtitle: 'A deeper view of planetary placement context',
          onTap: () => context.push('/kundli/navamsha'),
        ),
        _KundliLink(
          icon: Icons.work_outline,
          title: 'Dashamsha (D10)',
          subtitle: 'A focused chart used in grounded career analysis',
          onTap: () => context.push('/kundli/divisional/d10'),
        ),
      ],
    ),
  );
}

class ChandraChartScreen extends StatelessWidget {
  const ChandraChartScreen({
    super.key,
    required this.profileController,
    required this.natalController,
  });
  final ProfileController profileController;
  final NatalSummaryController natalController;

  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: 'Chandra Kundli',
    child: ListenableBuilder(
      listenable: natalController,
      builder: (context, child) {
        final summary = natalController.summary;
        return RefreshIndicator(
          onRefresh: natalController.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              const _ChartExplanation(
                title: 'The chart viewed from your Moon',
                body: 'Chandra Kundli keeps the same natal signs and planets, with your Moon sign shown as the first house. It helps you inspect the chart from the Moon perspective.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (natalController.state == NatalSummaryLoadState.loading ||
                  natalController.state == NatalSummaryLoadState.initial)
                const _NatalLoading()
              else if (summary == null)
                _NatalError(onRetry: natalController.refresh)
              else ...[
                Text(
                  profileController.activeProfile?.label ?? 'Birth profile',
                  style: _KundliStyle.eyebrow,
                ),
                const SizedBox(height: AppSpacing.sm),
                AppCard(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: NorthIndianKundliChart(
                    houses: buildChandraChartHouses(summary),
                    onHouseTap: (house) => _showHouseDetails(context, house),
                    onPlanetTap: (planet) => context.pushNamed(
                      'planet-detail',
                      pathParameters: {'planet': planet.body},
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                _HouseAccessibilityFallback(
                  houses: buildChandraChartHouses(summary),
                ),
              ],
            ],
          ),
        );
      },
    ),
  );
}

class PlanetPositionsScreen extends StatelessWidget {
  const PlanetPositionsScreen({super.key, required this.natalController});
  final NatalSummaryController natalController;
  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: 'Planet Positions',
    child: ListenableBuilder(
      listenable: natalController,
      builder: (context, child) {
        final summary = natalController.summary;
        final copy = AstrologyPresentationCopy.of(context);
        return RefreshIndicator(
          onRefresh: natalController.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              const _ChartExplanation(
                title: 'Authoritative natal placements',
                body: 'These positions show each Graha by sign, house, degree, Nakshatra, Pada and supported motion state.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (summary == null)
                _NatalError(onRetry: natalController.refresh)
              else
                ...summary.planets.map(
                  (position) => _PlanetRow(position: position, copy: copy),
                ),
            ],
          ),
        );
      },
    ),
  );
}

class PlanetaryStatusScreen extends StatelessWidget {
  const PlanetaryStatusScreen({super.key, required this.natalController});
  final NatalSummaryController natalController;
  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: 'Planetary Status',
    child: ListenableBuilder(
      listenable: natalController,
      builder: (context, child) {
        final summary = natalController.summary;
        final copy = AstrologyPresentationCopy.of(context);
        return RefreshIndicator(
          onRefresh: natalController.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
            children: [
              const _ChartExplanation(
                title: 'Supported motion status',
                body: 'Retrograde describes apparent planetary motion; it is not a simple good-or-bad score. TaraVerse does not display unsupported Shadbala or dignity claims here.',
              ),
              const SizedBox(height: AppSpacing.md),
              if (summary == null)
                _NatalError(onRetry: natalController.refresh)
              else
                ...summary.planets.map(
                  (planet) => AppCard(
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            copy.planet(planet.body),
                            style: const TextStyle(
                              color: Color(0xFFF7F4EC),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          planet.retrograde ? copy.retrograde : 'Direct',
                          style: TextStyle(
                            color: planet.retrograde
                                ? const Color(0xFFD6B15A)
                                : const Color(0xFF35B9AC),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    ),
  );
}

class BirthDetailsScreen extends StatelessWidget {
  const BirthDetailsScreen({
    super.key,
    required this.profileController,
    required this.natalController,
  });
  final ProfileController profileController;
  final NatalSummaryController natalController;
  @override
  Widget build(BuildContext context) => _KundliDetailScaffold(
    title: 'Birth Details',
    child: ListenableBuilder(
      listenable: Listenable.merge([profileController, natalController]),
      builder: (context, child) {
        final profile = profileController.activeProfile;
        final summary = natalController.summary;
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
          children: [
            const _ChartExplanation(
              title: 'Saved birth input',
              body: 'These profile details identify the birth input used by TaraVerse. Coordinates and other sensitive technical fields are not displayed.',
            ),
            const SizedBox(height: AppSpacing.md),
            AppCard(
              child: Column(
                children: [
                  _Value(label: 'Profile', value: profile?.label ?? '—'),
                  _Value(
                    label: 'Birth date',
                    value:
                        profile?.birthData.value['localDate'] as String? ?? '—',
                  ),
                  _Value(
                    label: 'Birth time',
                    value:
                        profile?.birthData.value['localTime'] as String? ?? '—',
                  ),
                  _Value(
                    label: 'Birth place',
                    value:
                        profile?.birthData.displayLocation ?? 'Not available',
                  ),
                  if (summary != null) ...[
                    _Value(
                      label: 'Ascendant',
                      value: summary.summary.ascendant.sign.englishName,
                    ),
                    _Value(
                      label: 'Moon sign',
                      value: summary.summary.moonSign.englishName,
                    ),
                    _Value(
                      label: 'Sun sign',
                      value: summary.summary.sunSign.englishName,
                    ),
                    _Value(
                      label: 'Moon Nakshatra',
                      value: summary.summary.moonNakshatra.name,
                    ),
                    _Value(
                      label: 'Moon Pada',
                      value: '${summary.summary.moonPada}',
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    ),
  );
}

class _KundliDetailScaffold extends StatelessWidget {
  const _KundliDetailScaffold({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF061A1A),
    appBar: AppBar(
      title: Text(title),
      backgroundColor: const Color(0xFF061A1A),
      foregroundColor: const Color(0xFFF7F4EC),
    ),
    body: SafeArea(top: false, child: child),
  );
}

class _ChartExplanation extends StatelessWidget {
  const _ChartExplanation({required this.title, required this.body});
  final String title;
  final String body;
  @override
  Widget build(BuildContext context) => AppCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: Color(0xFFF7F4EC),
            fontFamily: 'EBGaramond',
            fontSize: 21,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(body, style: _KundliStyle.body),
      ],
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
                color: const Color(0xFF082625),
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: const Color(0x55D6B15A)),
              ),
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xFFF7F4EC), fontSize: 12),
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
    color: Color(0xFFD6B15A),
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.6,
  );
  static const title = TextStyle(
    color: Color(0xFFF7F4EC),
    fontFamily: 'EBGaramond',
    fontSize: 32,
    height: 1.08,
    fontWeight: FontWeight.w600,
  );
  static const body = TextStyle(
    color: Color(0xFFA8B7B4),
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
    backgroundColor: const Color(0xFF082625),
    builder: (context) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              copy.isHinglish
                  ? '${house.house}th Bhav'
                  : '${t.house} ${house.house}',
              style: const TextStyle(
                color: Color(0xFFF7F4EC),
                fontFamily: 'EBGaramond',
                fontSize: 25,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            _SheetFact(
              label: t.sign,
              value: copy.sign(
                sanskritName: house.sign.sanskritName,
                englishName: house.sign.englishName,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            _SheetFact(
              label: t.planetaryPositions,
              value: house.planets.isEmpty
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

class _SheetFact extends StatelessWidget {
  const _SheetFact({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Text(label, style: const TextStyle(color: Color(0xFFA8B7B4))),
      ),
      const SizedBox(width: 16),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.end,
          style: const TextStyle(
            color: Color(0xFFF7F4EC),
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ],
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
      color: const Color(0xFF082625),
      borderRadius: BorderRadius.circular(16),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
        iconColor: const Color(0xFFD6B15A),
        collapsedIconColor: const Color(0xFFD6B15A),
        title: Text(
          t.chartAccessibleHouseList,
          style: const TextStyle(
            color: Color(0xFFF7F4EC),
            fontWeight: FontWeight.w600,
          ),
        ),
        children: houses
            .map(
              (house) => ListTile(
                dense: true,
                title: Text(
                  '${copy.isHinglish ? '${house.house}th Bhav' : '${t.house} ${house.house}'} — ${house.sign.englishName}',
                  style: const TextStyle(color: Color(0xFFF7F4EC)),
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
                  style: const TextStyle(color: Color(0xFFA8B7B4)),
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
          child: Text(label, style: const TextStyle(color: Color(0xFFA8B7B4))),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Color(0xFFF7F4EC),
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
                color: Color(0xFFF7F4EC),
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Text(
              '${position.sign.englishName} · ${position.degreeWithinSign.toStringAsFixed(2)}° · ${copy.isHinglish ? '${position.house}th Bhav' : '${t.house} ${position.house}'}\n${position.nakshatra.name} · ${t.pada} ${position.pada}',
              style: const TextStyle(color: Color(0xFFA8B7B4), height: 1.35),
            ),
            trailing: position.retrograde
                ? Chip(
                    label: Text(
                      copy.retrograde,
                      style: const TextStyle(
                        color: Color(0xFFD6B15A),
                        fontSize: 11,
                      ),
                    ),
                    backgroundColor: const Color(0xFF114A46),
                    side: const BorderSide(color: Color(0x66D6B15A)),
                  )
                : const Icon(Icons.chevron_right, color: Color(0xFFD6B15A)),
            onTap: () => context.pushNamed(
              'planet-detail',
              pathParameters: {'planet': position.body},
            ),
          ),
        ),
      ),
    );
  }
}
