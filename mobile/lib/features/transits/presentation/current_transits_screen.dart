import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_card.dart';
import '../../profiles/profile_controller.dart';
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
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      return Scaffold(
        appBar: AppBar(
          title: Text(t.currentTransits),
          actions: [
            Semantics(
              label: t.refresh,
              button: true,
              child: IconButton(
                onPressed: controller.refresh,
                icon: const Icon(Icons.refresh),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: controller.refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  profileController.activeProfile?.label ?? t.activeProfile,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                _Body(controller: controller),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class _Body extends StatelessWidget {
  const _Body({required this.controller});
  final TransitSnapshotController controller;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.state == TransitSnapshotLoadState.loading ||
        controller.state == TransitSnapshotLoadState.initial) {
      return Semantics(
        label: t.currentTransitsLoading,
        child: const Padding(
          padding: EdgeInsets.all(AppSpacing.xl),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    if (controller.state == TransitSnapshotLoadState.error ||
        controller.snapshot == null) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.currentTransitsUnavailable),
            const SizedBox(height: AppSpacing.sm),
            TextButton(onPressed: controller.refresh, child: Text(t.retry)),
          ],
        ),
      );
    }
    final snapshot = controller.snapshot!;
    final time = DateFormat.yMMMd().add_jm().format(
      DateTime.parse(snapshot.at).toLocal(),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${t.snapshotTime}: $time',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          t.planetaryTransits,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final planet in snapshot.planets) _PlanetCard(planet: planet),
        const SizedBox(height: AppSpacing.lg),
        Text(t.sadeSati, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.sm),
        _SadeSatiCard(status: snapshot.sadeSati),
      ],
    );
  }
}

class _PlanetCard extends StatelessWidget {
  const _PlanetCard({required this.planet});
  final TransitPlanet planet;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final degree = '${planet.degreeWithinSign.toStringAsFixed(2)}°';
    final motion = planet.retrograde
        ? t.retrograde
        : planet.motion == 'direct'
        ? t.direct
        : planet.motion;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Semantics(
        label:
            '${planet.planet}, ${t.transitSign}: ${planet.sign.englishName}, $degree, ${t.natalHouse}: ${planet.natalHouse}, $motion',
        button: true,
        child: AppCard(
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(planet.planet),
            subtitle: Text(
              '${t.transitSign}: ${planet.sign.englishName} · $degree\n${t.natalHouse}: ${planet.natalHouse}',
            ),
            trailing: Text(planet.retrograde ? '${t.retrograde} (R)' : motion),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => TransitPlanetDetailScreen(planet: planet),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class TransitPlanetDetailScreen extends StatelessWidget {
  const TransitPlanetDetailScreen({super.key, required this.planet});
  final TransitPlanet planet;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(planet.planet)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('${t.transitSign}: ${planet.sign.englishName}'),
                Text(
                  '${t.degreeInSign}: ${planet.degreeWithinSign.toStringAsFixed(2)}°',
                ),
                Text('${t.natalHouse}: ${planet.natalHouse}'),
                Text(
                  '${t.motion}: ${planet.retrograde
                      ? t.retrograde
                      : planet.motion == 'direct'
                      ? t.direct
                      : planet.motion}',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SadeSatiCard extends StatelessWidget {
  const _SadeSatiCard({required this.status});
  final SadeSatiStatus status;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Semantics(
      label:
          '${t.sadeSati}: ${status.active ? t.active : t.notActive}, ${t.phase}: ${status.phase}',
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${t.status}: ${status.active ? t.active : t.notActive}'),
            Text('${t.phase}: ${status.phase}'),
          ],
        ),
      ),
    );
  }
}
