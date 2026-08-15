import 'package:flutter/material.dart';

import '../../../app/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/section_header.dart';
import '../../profiles/profile_controller.dart';
import '../ashtakavarga_controller.dart';
import '../domain/ashtakavarga.dart';

class AshtakavargaScreen extends StatefulWidget {
  const AshtakavargaScreen({
    super.key,
    required this.profileController,
    required this.controller,
  });

  final ProfileController profileController;
  final AshtakavargaController controller;

  @override
  State<AshtakavargaScreen> createState() => _AshtakavargaScreenState();
}

class _AshtakavargaScreenState extends State<AshtakavargaScreen> {
  String _selectedBody = 'Sun';

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, child) {
      final t = AppLocalizations.of(context)!;
      return Scaffold(
        appBar: AppBar(
          title: Text(t.ashtakavarga),
          actions: [
            Semantics(
              label: t.refresh,
              button: true,
              child: IconButton(
                onPressed: widget.controller.refresh,
                icon: const Icon(Icons.refresh),
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: RefreshIndicator(
            onRefresh: () async => widget.controller.refresh(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  widget.profileController.activeProfile?.label ??
                      t.activeProfile,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                _Body(
                  controller: widget.controller,
                  selectedBody: _selectedBody,
                  onBodySelected: (body) =>
                      setState(() => _selectedBody = body),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

class _Body extends StatelessWidget {
  const _Body({
    required this.controller,
    required this.selectedBody,
    required this.onBodySelected,
  });

  final AshtakavargaController controller;
  final String selectedBody;
  final ValueChanged<String> onBodySelected;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.state == AshtakavargaLoadState.loading) {
      return Semantics(
        label: t.loading,
        child: const Padding(
          padding: EdgeInsets.all(AppSpacing.xl),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }
    final data = controller.data;
    if (controller.state == AshtakavargaLoadState.error || data == null) {
      return AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(t.ashtakavargaUnavailable),
            const SizedBox(height: AppSpacing.sm),
            Semantics(
              label: t.retry,
              button: true,
              child: TextButton(
                onPressed: controller.refresh,
                child: Text(t.retry),
              ),
            ),
          ],
        ),
      );
    }
    final selected = data.bav.firstWhere((entry) => entry.body == selectedBody);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: t.sarvashtakavarga, subtitle: t.sav),
        _ScoreList(scores: data.sav),
        const SizedBox(height: AppSpacing.xl),
        SectionHeader(title: t.bhinnashtakavarga, subtitle: t.bav),
        Semantics(
          label: '${t.bav}: $selectedBody',
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SegmentedButton<String>(
              segments: data.bav
                  .map(
                    (entry) => ButtonSegment(
                      value: entry.body,
                      label: Text(_bodyLabel(t, entry.body)),
                    ),
                  )
                  .toList(growable: false),
              selected: {selected.body},
              onSelectionChanged: (selection) =>
                  onBodySelected(selection.single),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _ScoreList(scores: selected.signScores),
        const SizedBox(height: AppSpacing.xl),
        SectionHeader(title: t.lagnaBav),
        _ScoreList(scores: data.lagnaBav.signScores),
      ],
    );
  }
}

class _ScoreList extends StatelessWidget {
  const _ScoreList({required this.scores});
  final List<SignScore> scores;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return AppCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (final score in scores)
            Semantics(
              label:
                  '${t.sign}: ${score.sanskritName}, ${t.score}: ${score.score}',
              child: ListTile(
                title: Text(score.sanskritName),
                trailing: Text('${score.score}'),
              ),
            ),
        ],
      ),
    );
  }
}

String _bodyLabel(AppLocalizations t, String body) => switch (body) {
  'Sun' => t.sun,
  'Moon' => t.moon,
  'Mars' => t.mars,
  'Mercury' => t.mercury,
  'Jupiter' => t.jupiter,
  'Venus' => t.venus,
  'Saturn' => t.saturn,
  _ => body,
};
