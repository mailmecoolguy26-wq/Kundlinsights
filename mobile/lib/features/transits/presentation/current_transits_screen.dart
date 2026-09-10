import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
    final insight = snapshot.insightContext;
    final houses = insight?.activatedHouses.isNotEmpty == true
        ? insight!.activatedHouses
        : _legacyHouses(snapshot.planets);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SnapshotCard(timestamp: timestamp),
        if (insight?.careerRelevance.isNotEmpty == true) ...[
          const SizedBox(height: 26),
          const _Section('CAREER-RELEVANT TRANSITS'),
          const SizedBox(height: 10),
          _CareerRelevanceCard(items: insight!.careerRelevance),
          const SizedBox(height: 4),
          TextButton.icon(
            onPressed: () => context.go('/readings'),
            icon: const Icon(Icons.arrow_forward, size: 16),
            label: const Text('See Career Timing'),
            style: TextButton.styleFrom(
              foregroundColor: CurrentTransitsScreen.gold,
            ),
          ),
        ],
        if (insight?.upcomingTransitions.isNotEmpty == true) ...[
          const SizedBox(height: 22),
          const _Section('UPCOMING TRANSIT CHANGES'),
          const SizedBox(height: 10),
          _UpcomingTransitionsCard(
            items: insight!.upcomingTransitions,
            horizon: insight.horizon,
          ),
        ],
        const SizedBox(height: 26),
        const _Section('HOUSES ACTIVATED'),
        const SizedBox(height: 10),
        _HousesCard(houses: houses),
        const SizedBox(height: 26),
        const _Section('ALL CURRENT TRANSITS'),
        const SizedBox(height: 10),
        _AllTransitsCard(planets: snapshot.planets),
        const SizedBox(height: 26),
        if (_hasAdditiveSpecialState(
          insight?.specialStates ?? const [],
          snapshot.sadeSati,
        )) ...[
          const _Section('SPECIAL TRANSIT STATUS'),
          const SizedBox(height: 10),
          _SpecialStatesCard(
            states: insight?.specialStates ?? const [],
            fallbackSadeSati: snapshot.sadeSati,
          ),
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
  final List<TransitActivatedHouse> houses;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return _DarkCard(
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: houses.map((entry) {
          final names = entry.planets.map(copy.planet).join(', ');
          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: CurrentTransitsScreen.violet,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '${copy.houseContext(entry.house)} · $names',
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

class _CareerRelevanceCard extends StatelessWidget {
  const _CareerRelevanceCard({required this.items});
  final List<TransitCareerRelevance> items;
  @override
  Widget build(BuildContext context) => _DarkCard(
    padding: EdgeInsets.zero,
    child: Column(
      children: [
        for (var index = 0; index < items.length; index++) ...[
          _CareerRelevanceRow(item: items[index]),
          if (index < items.length - 1)
            const Divider(height: 1, color: Color(0x335E4A87)),
        ],
      ],
    ),
  );
}

class _CareerRelevanceRow extends StatelessWidget {
  const _CareerRelevanceRow({required this.item});
  final TransitCareerRelevance item;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(copy.planet(item.planet), style: _Styles.cardTitle),
              ),
              _StatusChip(_statusLabel(item.status)),
            ],
          ),
          if (item.instant != null) ...[
            const SizedBox(height: 3),
            Text(_pointDate(item.instant!), style: _Styles.goldText),
          ],
          const SizedBox(height: 6),
          Text(
            _presentation(context, item.presentation),
            style: _Styles.cardBody,
          ),
        ],
      ),
    );
  }
}

class _UpcomingTransitionsCard extends StatefulWidget {
  const _UpcomingTransitionsCard({required this.items, required this.horizon});
  final List<UpcomingTransitTransition> items;
  final TransitHorizon? horizon;
  @override
  State<_UpcomingTransitionsCard> createState() =>
      _UpcomingTransitionsCardState();
}

class _UpcomingTransitionsCardState extends State<_UpcomingTransitionsCard> {
  static const _initialLimit = 12;
  var _globallyExpanded = false;
  final _expandedDates = <String>{};
  @override
  Widget build(BuildContext context) {
    final all = _displayTransitions(widget.items);
    final dateGroups = _timelineDateGroups(all);
    final compact = _visibleCompactGroups(
      dateGroups,
      expandedDates: _expandedDates,
      limit: _initialLimit,
    );
    final groups = _globallyExpanded
        ? _expandedTimelineGroups(dateGroups)
        : compact;
    final compactRowCount = _visibleCompactGroups(
      dateGroups,
      expandedDates: const {},
      limit: _initialLimit,
    ).fold<int>(0, (count, group) => count + group.items.length);
    return _DarkCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.horizon != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
              child: Text(
                _horizonText(widget.horizon!),
                style: _Styles.cardBody,
              ),
            ),
          for (final entry in groups) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 2),
              child: Text(_dateHeading(entry.date), style: _Styles.eyebrow),
            ),
            for (final item in entry.items)
              _UpcomingTransitionRow(item: item, showDate: false),
            if (!_globallyExpanded && entry.hiddenCount > 0)
              Semantics(
                button: true,
                label: entry.isDateExpanded
                    ? 'Show fewer transit changes for ${_dateHeading(entry.date)}'
                    : 'Show ${entry.hiddenCount} more transit changes for ${_dateHeading(entry.date)}',
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(35, 0, 8, 6),
                  child: TextButton.icon(
                    onPressed: () => setState(() {
                      if (!_expandedDates.add(entry.date)) {
                        _expandedDates.remove(entry.date);
                      }
                    }),
                    icon: Icon(
                      entry.isDateExpanded
                          ? Icons.keyboard_arrow_up
                          : Icons.keyboard_arrow_down,
                      size: 16,
                    ),
                    label: Text(
                      entry.isDateExpanded
                          ? 'Show less'
                          : '+${entry.hiddenCount} more ${entry.hiddenCount == 1 ? 'change' : 'changes'}',
                    ),
                    style: TextButton.styleFrom(
                      foregroundColor: CurrentTransitsScreen.gold,
                      minimumSize: const Size(44, 40),
                      alignment: Alignment.centerLeft,
                    ),
                  ),
                ),
              ),
          ],
          if (all.length > compactRowCount)
            TextButton(
              onPressed: () => setState(() {
                if (_globallyExpanded) _expandedDates.clear();
                _globallyExpanded = !_globallyExpanded;
              }),
              style: TextButton.styleFrom(
                foregroundColor: CurrentTransitsScreen.gold,
              ),
              child: Text(
                _globallyExpanded ? 'Show Less' : 'View More Transit Changes',
              ),
            ),
        ],
      ),
    );
  }
}

class _UpcomingTransitionRow extends StatelessWidget {
  const _UpcomingTransitionRow({required this.item, required this.showDate});
  final UpcomingTransitTransition item;
  final bool showDate;
  @override
  Widget build(BuildContext context) {
    final copy = AstrologyPresentationCopy.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.schedule_outlined,
            color: CurrentTransitsScreen.gold,
            size: 19,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_transitionLabel(copy, item), style: _Styles.cardTitle),
                if (showDate) ...[
                  const SizedBox(height: 3),
                  Text(_pointDate(item.at), style: _Styles.cardBody),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SpecialStatesCard extends StatelessWidget {
  const _SpecialStatesCard({
    required this.states,
    required this.fallbackSadeSati,
  });
  final List<TransitSpecialState> states;
  final SadeSatiStatus fallbackSadeSati;
  @override
  Widget build(BuildContext context) {
    final values = states.where((state) => state.type != 'RETROGRADE').toList()
      ..sort((left, right) => left.type.compareTo(right.type));
    final resolved = values.isNotEmpty
        ? values
        : [
            TransitSpecialState(
              type: 'SADE_SATI',
              planet: 'Saturn',
              status: 'ACTIVE',
              phase: fallbackSadeSati.phase,
              presentation: const TransitPresentationCopy(
                english: 'Sade Sati is currently active.',
                hinglish: 'Sade Sati abhi active hai.',
              ),
            ),
          ];
    return _DarkCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var index = 0; index < resolved.length; index++) ...[
            Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.info_outline,
                    color: CurrentTransitsScreen.gold,
                    size: 19,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          resolved[index].type == 'SADE_SATI'
                              ? 'Sade Sati'
                              : '${AstrologyPresentationCopy.of(context).planet(resolved[index].planet)} · Retrograde',
                          style: _Styles.cardTitle,
                        ),
                        if (resolved[index].phase != null)
                          Text(
                            'Phase ${resolved[index].phase} active',
                            style: _Styles.goldText,
                          ),
                        const SizedBox(height: 5),
                        Text(
                          _presentation(context, resolved[index].presentation),
                          style: _Styles.cardBody,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (index < resolved.length - 1)
              const Divider(height: 1, color: Color(0x335E4A87)),
          ],
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
    decoration: BoxDecoration(
      border: Border.all(color: const Color(0x66C5A059)),
      borderRadius: BorderRadius.circular(99),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: CurrentTransitsScreen.gold,
        fontSize: 9,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

List<TransitActivatedHouse> _legacyHouses(List<TransitPlanet> planets) {
  final groups = <int, List<String>>{};
  for (final planet in planets) {
    groups.putIfAbsent(planet.natalHouse, () => []).add(planet.planet);
  }
  return groups.entries
      .map(
        (entry) => TransitActivatedHouse(
          house: entry.key,
          planets: List.unmodifiable(entry.value),
        ),
      )
      .toList()
    ..sort((a, b) => a.house.compareTo(b.house));
}

String _presentation(BuildContext context, TransitPresentationCopy copy) =>
    AstrologyPresentationCopy.of(context).isHinglish
    ? copy.hinglish
    : copy.english;
String _statusLabel(String status) => switch (status) {
  'SUPPORTED' => 'Supported',
  'MIXED' => 'Mixed evidence',
  'CONTRADICTED' => 'Not consistently supported',
  'INSUFFICIENT_EVIDENCE' => 'Limited evidence',
  _ => 'Status unavailable',
};
String _pointDate(String instant) =>
    DateFormat('d MMM yyyy').format(DateTime.parse(instant).toLocal());
String _dateKey(String instant) =>
    DateFormat('yyyy-MM-dd').format(DateTime.parse(instant).toLocal());
String _dateHeading(String date) =>
    DateFormat('d MMM yyyy')
        .format(DateTime.parse('${date}T00:00:00.000Z').toLocal())
        .toUpperCase();
String _horizonText(TransitHorizon value) =>
    'Upcoming changes through ${_pointDate(value.to)}';
bool _hasAdditiveSpecialState(
  List<TransitSpecialState> states,
  SadeSatiStatus fallback,
) => states.any((state) => state.type != 'RETROGRADE') || fallback.active;

List<UpcomingTransitTransition> _displayTransitions(
  List<UpcomingTransitTransition> source,
) {
  final sorted = [...source]
    ..sort((left, right) {
      final at = left.at.compareTo(right.at);
      if (at != 0) return at;
      final type = _transitionOrder(left.type)
          .compareTo(_transitionOrder(right.type));
      if (type != 0) return type;
      final planet = left.planet.compareTo(right.planet);
      return planet != 0
          ? planet
          : (left.targetPlanet ?? '').compareTo(right.targetPlanet ?? '');
    });
  final seen = <String>{};
  var moonIngresses = 0;
  return List.unmodifiable(
    sorted.where((item) {
      if (item.targetPlanet == item.planet) return false;
      if (item.planet == 'Moon' &&
          (item.type == 'ASSOCIATION_CHANGE' ||
              item.type == 'DRISHTI_CHANGE')) {
        return false;
      }
      if ((item.type == 'ASSOCIATION_CHANGE' ||
              item.type == 'DRISHTI_CHANGE') &&
          item.targetPlanet == null) {
        return false;
      }
      final key = [
        item.type,
        item.planet,
        item.at,
        item.targetPlanet ?? '',
        item.fromSign ?? '',
        item.toSign ?? '',
        item.motionBefore ?? '',
        item.motionAfter ?? '',
        item.change ?? '',
        item.house?.toString() ?? '',
      ].join('|');
      if (!seen.add(key)) return false;
      if (item.planet == 'Moon' &&
          item.type == 'INGRESS' &&
          ++moonIngresses > 3) {
        return false;
      }
      return true;
    }),
  );
}

class _TimelineDateGroup {
  const _TimelineDateGroup({
    required this.date,
    required this.items,
    required this.hiddenCount,
    this.isDateExpanded = false,
  });
  final String date;
  final List<UpcomingTransitTransition> items;
  final int hiddenCount;
  final bool isDateExpanded;
}

class _TimelineDateSourceGroup {
  const _TimelineDateSourceGroup({
    required this.date,
    required this.items,
    required this.compactItems,
    required this.hiddenCount,
  });
  final String date;
  final List<UpcomingTransitTransition> items;
  final List<UpcomingTransitTransition> compactItems;
  final int hiddenCount;
}

List<_TimelineDateSourceGroup> _timelineDateGroups(
  List<UpcomingTransitTransition> items,
) {
  final groups = <String, List<UpcomingTransitTransition>>{};
  for (final item in items) {
    (groups[_dateKey(item.at)] ??= []).add(item);
  }
  return List.unmodifiable(
    groups.entries.map((entry) {
      final relationKeys = <String>{};
      final compact = <UpcomingTransitTransition>[];
      var hiddenCount = 0;
      for (final item in entry.value) {
        final isRelation =
            item.type == 'ASSOCIATION_CHANGE' || item.type == 'DRISHTI_CHANGE';
        if (isRelation && !relationKeys.add('${item.type}|${item.planet}')) {
          hiddenCount++;
          continue;
        }
        compact.add(item);
      }
      return _TimelineDateSourceGroup(
        date: entry.key,
        items: List.unmodifiable(entry.value),
        compactItems: List.unmodifiable(compact),
        hiddenCount: hiddenCount,
      );
    }).toList(),
  );
}

List<_TimelineDateGroup> _expandedTimelineGroups(
  List<_TimelineDateSourceGroup> groups,
) => List.unmodifiable(
  groups
      .map(
        (group) => _TimelineDateGroup(
          date: group.date,
          items: group.items,
          hiddenCount: 0,
        ),
      )
      .toList(),
);

List<_TimelineDateGroup> _visibleCompactGroups(
  List<_TimelineDateSourceGroup> groups, {
  required Set<String> expandedDates,
  required int limit,
}) {
  final visible = <_TimelineDateGroup>[];
  var remaining = limit;
  for (final group in groups) {
    final baseCount = remaining < group.compactItems.length
        ? remaining
        : group.compactItems.length;
    if (baseCount == 0) break;
    remaining -= baseCount;
    final isExpanded = expandedDates.contains(group.date);
    visible.add(
      _TimelineDateGroup(
        date: group.date,
        items: isExpanded
            ? group.items
            : List.unmodifiable(group.compactItems.take(baseCount)),
        hiddenCount: group.hiddenCount,
        isDateExpanded: isExpanded,
      ),
    );
  }
  return List.unmodifiable(visible);
}

int _transitionOrder(String type) => switch (type) {
  'INGRESS' => 0,
  'STATION_RETROGRADE' => 1,
  'STATION_DIRECT' => 2,
  'SADE_SATI_PHASE_CHANGE' => 3,
  'ASSOCIATION_CHANGE' => 4,
  'DRISHTI_CHANGE' => 5,
  _ => 99,
};
String _transitionLabel(
  AstrologyPresentationCopy copy,
  UpcomingTransitTransition item,
) {
  final planet = copy.planet(item.planet);
  return switch (item.type) {
    'INGRESS' => '$planet enters ${item.toSign ?? 'a new sign'}',
    'STATION_RETROGRADE' =>
      copy.isHinglish ? '$planet Vakri hote hain' : '$planet turns retrograde',
    'STATION_DIRECT' =>
      copy.isHinglish ? '$planet direct hote hain' : '$planet turns direct',
    'DRISHTI_CHANGE' =>
      '$planet ${copy.isHinglish ? 'Drishti' : 'aspect'} ${item.change == 'start'
          ? 'begins'
          : item.change == 'end'
          ? 'ends'
          : 'changes'} with ${copy.planet(item.targetPlanet!)}',
    'ASSOCIATION_CHANGE' =>
      '$planet association ${item.change == 'start'
          ? 'begins'
          : item.change == 'end'
          ? 'ends'
          : 'changes'} with ${copy.planet(item.targetPlanet!)}',
    'SADE_SATI_PHASE_CHANGE' => 'Sade Sati phase changes',
    _ => item.type,
  };
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
