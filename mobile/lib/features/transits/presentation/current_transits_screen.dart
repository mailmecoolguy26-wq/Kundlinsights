import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../profiles/profile_controller.dart';
import '../../readings/astrology_presentation_copy.dart';
import '../domain/transit_snapshot.dart';
import '../transit_snapshot_controller.dart';

class CurrentTransitsScreen extends StatelessWidget {
  const CurrentTransitsScreen({
    super.key,
    required this.profileController,
    required this.controller,
  });
  final ProfileController profileController;
  final TransitSnapshotController controller;

  static const midnight = Color(0xFF0B071B);
  static const abyss = Color(0xFF120D29);
  static const violet = Color(0xFF1B1234);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const gold = Color(0xFFC5A059);

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: Listenable.merge([profileController, controller]),
    builder: (context, child) => Scaffold(
      backgroundColor: midnight,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
            children: [
              _TopBar(
                profileLabel: profileController.activeProfile?.label,
                onBack: () => Navigator.of(context).maybePop(),
                onRefresh: controller.refresh,
              ),
              const SizedBox(height: 24),
              const Text('GOCHAR', style: _Styles.eyebrow),
              const SizedBox(height: 5),
              const Text('Current Transits', style: _Styles.title),
              const SizedBox(height: 18),
              _TransitBody(controller: controller),
            ],
          ),
        ),
      ),
    ),
  );
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.profileLabel,
    required this.onBack,
    required this.onRefresh,
  });
  final String? profileLabel;
  final VoidCallback onBack;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Material(
        color: CurrentTransitsScreen.violet,
        shape: const CircleBorder(),
        child: IconButton(
          tooltip: MaterialLocalizations.of(context).backButtonTooltip,
          onPressed: onBack,
          icon: const Icon(
            Icons.arrow_back,
            color: CurrentTransitsScreen.alabaster,
          ),
        ),
      ),
      const Spacer(),
      if (profileLabel != null) _ProfilePill(profileLabel!),
      const SizedBox(width: 8),
      Material(
        color: CurrentTransitsScreen.violet,
        shape: const CircleBorder(),
        child: IconButton(
          tooltip: 'Refresh',
          onPressed: onRefresh,
          icon: const Icon(Icons.refresh, color: CurrentTransitsScreen.gold),
        ),
      ),
    ],
  );
}

class _ProfilePill extends StatelessWidget {
  const _ProfilePill(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(maxWidth: 140, minHeight: 38),
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
    decoration: BoxDecoration(
      color: CurrentTransitsScreen.abyss,
      borderRadius: BorderRadius.circular(999),
      border: Border.all(color: const Color(0x55C5A059)),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.circle, size: 7, color: CurrentTransitsScreen.gold),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            label,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: CurrentTransitsScreen.alabaster,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

class _TransitBody extends StatelessWidget {
  const _TransitBody({required this.controller});
  final TransitSnapshotController controller;

  @override
  Widget build(BuildContext context) {
    if (controller.state == TransitSnapshotLoadState.loading ||
        controller.state == TransitSnapshotLoadState.initial) {
      return const Padding(
        padding: EdgeInsets.all(36),
        child: Center(
          child: CircularProgressIndicator(color: CurrentTransitsScreen.gold),
        ),
      );
    }
    if (controller.state == TransitSnapshotLoadState.error ||
        controller.snapshot == null) {
      return _DarkCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Current transits are unavailable right now.',
              style: _Styles.cardBody,
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: controller.refresh,
              style: OutlinedButton.styleFrom(
                foregroundColor: CurrentTransitsScreen.alabaster,
                side: const BorderSide(color: CurrentTransitsScreen.gold),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }
    final snapshot = controller.snapshot!;
    final timestamp = DateFormat('d MMM yyyy · h:mm a')
        .format(DateTime.parse(snapshot.at).toLocal());
    final houses = <int, List<TransitPlanet>>{};
    for (final planet in snapshot.planets) {
      houses.putIfAbsent(planet.natalHouse, () => []).add(planet);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SnapshotCard(timestamp: timestamp),
        const SizedBox(height: 26),
        const _Section('HOUSES ACTIVATED'),
        const SizedBox(height: 10),
        _HousesCard(houses: houses),
        const SizedBox(height: 26),
        const _Section('ALL CURRENT TRANSITS'),
        const SizedBox(height: 10),
        _AllTransitsCard(planets: snapshot.planets),
        const SizedBox(height: 26),
        if (snapshot.sadeSati.active) ...[
          const _Section('SPECIAL TRANSIT STATUS'),
          const SizedBox(height: 10),
          _SadeSatiCard(status: snapshot.sadeSati),
          const SizedBox(height: 26),
        ],
        _TechnicalDetails(snapshot: snapshot, timestamp: timestamp),
      ],
    );
  }
}

class _SnapshotCard extends StatelessWidget {
  const _SnapshotCard({required this.timestamp});
  final String timestamp;
  @override
  Widget build(BuildContext context) => _DarkCard(
    emphasized: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('TRANSIT SNAPSHOT', style: _Styles.eyebrow),
        const SizedBox(height: 8),
        const Text('Your Transit Snapshot', style: _Styles.cardTitle),
        const SizedBox(height: 5),
        Text(
          AstrologyPresentationCopy.of(context).transitSnapshotDescription,
          style: _Styles.cardBody,
        ),
        const SizedBox(height: 14),
        Text(timestamp, style: _Styles.goldText),
      ],
    ),
  );
}

class _HousesCard extends StatelessWidget {
  const _HousesCard({required this.houses});
  final Map<int, List<TransitPlanet>> houses;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return _DarkCard(
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: houses.entries.map((entry) {
          final names = entry.value
              .map((planet) => copy.planet(planet.planet))
              .join(', ');
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: CurrentTransitsScreen.violet,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '${copy.houseContext(entry.key)} · $names',
              style: const TextStyle(
                color: CurrentTransitsScreen.alabaster,
                fontSize: 12,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _AllTransitsCard extends StatelessWidget {
  const _AllTransitsCard({required this.planets});
  final List<TransitPlanet> planets;
  @override
  Widget build(BuildContext context) => _DarkCard(
    padding: EdgeInsets.zero,
    child: Column(
      children: [
        for (var index = 0; index < planets.length; index++) ...[
          _TransitRow(planet: planets[index]),
          if (index < planets.length - 1)
            const Divider(height: 1, color: Color(0x335E4A87)),
        ],
      ],
    ),
  );
}

class _TransitRow extends StatelessWidget {
  const _TransitRow({required this.planet});
  final TransitPlanet planet;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    final degree = '${planet.degreeWithinSign.toStringAsFixed(2)}°';
    final motion = planet.retrograde
        ? copy.retrograde
        : planet.motion == 'direct'
        ? 'Direct'
        : planet.motion;
    return Semantics(
      button: true,
      label:
          '${copy.planet(planet.planet)}, ${planet.sign.englishName}, $degree, ${copy.house(planet.natalHouse)}, $motion',
      child: InkWell(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => TransitPlanetDetailScreen(planet: planet),
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              _PlanetGlyph(planet.planet),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(copy.planet(planet.planet), style: _Styles.cardTitle),
                    const SizedBox(height: 2),
                    Text(
                      '${planet.sign.englishName} · $degree · ${copy.house(planet.natalHouse)}',
                      style: _Styles.cardBody,
                    ),
                  ],
                ),
              ),
              _MotionPill(motion),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanetGlyph extends StatelessWidget {
  const _PlanetGlyph(this.planet);
  final String planet;
  @override
  Widget build(BuildContext context) => Container(
    width: 34,
    height: 34,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: CurrentTransitsScreen.violet,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      planet.substring(0, 1),
      style: const TextStyle(
        color: CurrentTransitsScreen.gold,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

class _MotionPill extends StatelessWidget {
  const _MotionPill(this.motion);
  final String motion;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
    decoration: BoxDecoration(
      border: Border.all(color: const Color(0x335E4A87)),
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      motion,
      style: const TextStyle(
        color: CurrentTransitsScreen.slate,
        fontSize: 10,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _SadeSatiCard extends StatelessWidget {
  const _SadeSatiCard({required this.status});
  final SadeSatiStatus status;
  @override
  Widget build(BuildContext context) => _DarkCard(
    child: Text(
      'Sade Sati · ${status.phase} phase · House ${status.houseFromNatalMoon} from natal Moon',
      style: _Styles.cardBody,
    ),
  );
}

class _TechnicalDetails extends StatelessWidget {
  const _TechnicalDetails({required this.snapshot, required this.timestamp});
  final TransitSnapshot snapshot;
  final String timestamp;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: _DarkCard(
        child: Material(
          color: Colors.transparent,
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: const EdgeInsets.only(bottom: 4),
            iconColor: CurrentTransitsScreen.gold,
            collapsedIconColor: CurrentTransitsScreen.gold,
            title: const Text(
              'View Technical Transit Details',
              style: _Styles.cardTitle,
            ),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Snapshot: $timestamp', style: _Styles.cardBody),
                    const SizedBox(height: 8),
                    for (final planet in snapshot.planets)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          '${copy.planet(planet.planet)}: ${planet.longitude.toStringAsFixed(2)}° · ${planet.sign.englishName} · ${copy.house(planet.natalHouse)} · ${planet.retrograde ? copy.retrograde : planet.motion}',
                          style: _Styles.cardBody,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DarkCard extends StatelessWidget {
  const _DarkCard({
    required this.child,
    this.emphasized = false,
    this.padding = const EdgeInsets.all(16),
  });
  final Widget child;
  final bool emphasized;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: emphasized
          ? CurrentTransitsScreen.violet
          : CurrentTransitsScreen.abyss,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: emphasized ? const Color(0x77C5A059) : const Color(0x335E4A87),
      ),
    ),
    child: child,
  );
}

class _Section extends StatelessWidget {
  const _Section(this.value);
  final String value;
  @override
  Widget build(BuildContext context) => Text(value, style: _Styles.eyebrow);
}

abstract final class _Styles {
  static const eyebrow = TextStyle(
    color: CurrentTransitsScreen.gold,
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.7,
  );
  static const title = TextStyle(
    color: CurrentTransitsScreen.alabaster,
    fontFamily: 'EBGaramond',
    fontSize: 32,
    height: 1.08,
    fontWeight: FontWeight.w600,
  );
  static const cardTitle = TextStyle(
    color: CurrentTransitsScreen.alabaster,
    fontSize: 16,
    fontWeight: FontWeight.w600,
  );
  static const cardBody = TextStyle(
    color: CurrentTransitsScreen.slate,
    fontSize: 13,
    height: 1.38,
  );
  static const goldText = TextStyle(
    color: CurrentTransitsScreen.gold,
    fontSize: 12,
    fontWeight: FontWeight.w600,
  );
}

class TransitPlanetDetailScreen extends StatelessWidget {
  const TransitPlanetDetailScreen({super.key, required this.planet});
  final TransitPlanet planet;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Scaffold(
      backgroundColor: CurrentTransitsScreen.midnight,
      appBar: AppBar(title: Text(copy.planet(planet.planet))),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _DarkCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Transit sign: ${planet.sign.englishName}',
                  style: _Styles.cardBody,
                ),
                Text(
                  'Degree in sign: ${planet.degreeWithinSign.toStringAsFixed(2)}°',
                  style: _Styles.cardBody,
                ),
                Text(
                  'Natal ${copy.house(planet.natalHouse)}',
                  style: _Styles.cardBody,
                ),
                Text(
                  'Motion: ${planet.retrograde ? copy.retrograde : planet.motion}',
                  style: _Styles.cardBody,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
