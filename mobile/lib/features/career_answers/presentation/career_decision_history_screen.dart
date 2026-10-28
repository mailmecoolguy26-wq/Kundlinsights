import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../career_decision_history_controller.dart';
import '../domain/career_decision.dart';
import 'career_decision_screen.dart';

class CareerDecisionHistoryScreen extends StatefulWidget {
  const CareerDecisionHistoryScreen({super.key, required this.controller});
  final CareerDecisionHistoryController controller;

  @override
  State<CareerDecisionHistoryScreen> createState() =>
      _CareerDecisionHistoryScreenState();
}

class _CareerDecisionHistoryScreenState
    extends State<CareerDecisionHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.load(),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final state = widget.controller.listState;
      return Scaffold(
        appBar: AppBar(title: const Text('CAREER DECISION HISTORY')),
        body: switch (state) {
          CareerDecisionHistoryState.initial ||
          CareerDecisionHistoryState.loading => const Center(
            child: CircularProgressIndicator(),
          ),
          CareerDecisionHistoryState.error => _RetryState(
            message: 'We could not load your saved Career Decisions.',
            onRetry: widget.controller.load,
          ),
          CareerDecisionHistoryState.loaded =>
            widget.controller.decisions.isEmpty
                ? const _EmptyHistory()
                : ListView.separated(
                    padding: const EdgeInsets.all(20),
                    itemCount: widget.controller.decisions.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = widget.controller.decisions[index];
                      return _DecisionHistoryTile(
                        item: item,
                        onTap: () => context.push(
                          '/career/decisions/${Uri.encodeComponent(item.decisionId)}',
                        ),
                      );
                    },
                  ),
        },
      );
    },
  );
}

class CareerDecisionSavedScreen extends StatefulWidget {
  const CareerDecisionSavedScreen({
    super.key,
    required this.controller,
    required this.decisionId,
  });
  final CareerDecisionHistoryController controller;
  final String decisionId;

  @override
  State<CareerDecisionSavedScreen> createState() =>
      _CareerDecisionSavedScreenState();
}

class _CareerDecisionSavedScreenState extends State<CareerDecisionSavedScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => widget.controller.open(widget.decisionId),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      switch (widget.controller.detailState) {
        case CareerDecisionHistoryState.initial:
        case CareerDecisionHistoryState.loading:
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        case CareerDecisionHistoryState.error:
          return Scaffold(
            appBar: AppBar(title: const Text('SAVED CAREER DECISION')),
            body: _RetryState(
              message: 'We could not open this saved Career Decision.',
              onRetry: widget.controller.retryDetail,
            ),
          );
        case CareerDecisionHistoryState.loaded:
          final decision = widget.controller.selectedDecision;
          if (decision == null || decision.decisionId != widget.decisionId) {
            return Scaffold(
              appBar: AppBar(title: const Text('SAVED CAREER DECISION')),
              body: _RetryState(
                message: 'This saved Career Decision is unavailable.',
                onRetry: widget.controller.retryDetail,
              ),
            );
          }
          return CareerDecisionResultScreen(
            decision: decision,
            savedCreatedAt: decision.createdAt,
          );
      }
    },
  );
}

class CareerDecisionRecentSection extends StatelessWidget {
  const CareerDecisionRecentSection({super.key, required this.controller});
  final CareerDecisionHistoryController controller;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) {
      if (controller.listState == CareerDecisionHistoryState.initial) {
        WidgetsBinding.instance.addPostFrameCallback((_) => controller.load());
        return const SizedBox.shrink();
      }
      if (controller.listState != CareerDecisionHistoryState.loaded ||
          controller.decisions.isEmpty) {
        return const SizedBox.shrink();
      }
      final items = controller.decisions.take(3).toList(growable: false);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'RECENT CAREER DECISIONS',
            style: TextStyle(fontWeight: FontWeight.w700, letterSpacing: 1.1),
          ),
          const SizedBox(height: 10),
          for (final item in items) ...[
            _DecisionHistoryTile(
              item: item,
              compact: true,
              onTap: () => context.push(
                '/career/decisions/${Uri.encodeComponent(item.decisionId)}',
              ),
            ),
            const SizedBox(height: 8),
          ],
          if (controller.decisions.length > 3)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => context.push('/career/decisions'),
                child: const Text('View all Career Decisions'),
              ),
            ),
        ],
      );
    },
  );
}

class _DecisionHistoryTile extends StatelessWidget {
  const _DecisionHistoryTile({
    required this.item,
    required this.onTap,
    this.compact = false,
  });
  final CareerDecisionSummary item;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      onTap: onTap,
      title: Text(careerDecisionTypeLabel(item.decisionType)),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${DateFormat('d MMM y').format(item.createdAt)} · ${careerDecisionStateLabel(item.state)}',
          ),
          if (careerDecisionContextLabel(item) case final label?)
            Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                label,
                maxLines: compact ? 1 : 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
      ),
      trailing: const Icon(Icons.chevron_right),
    ),
  );
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();
  @override
  Widget build(BuildContext context) => const Center(
    child: Padding(
      padding: EdgeInsets.all(32),
      child: Text(
        'No Career Decisions saved yet.',
        textAlign: TextAlign.center,
      ),
    ),
  );
}

class _RetryState extends StatelessWidget {
  const _RetryState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    ),
  );
}

String careerDecisionTypeLabel(String type) => switch (type) {
  'JOB_OFFER' => 'Job Offer',
  'SWITCH_JOB' => 'Switch Job',
  'COMPARE_OFFERS' => 'Compare Two Offers',
  'PROMOTION_GROWTH' => 'Promotion / Growth',
  'START_BUSINESS' => 'Start a Business',
  'CAREER_ABROAD' => 'Career Abroad',
  _ => 'Career Decision',
};

String careerDecisionStateLabel(String state) => switch (state) {
  'MORE_SUPPORTIVE' => 'More Supportive',
  'SUPPORTIVE_WITH_CONDITIONS' => 'Supportive With Conditions',
  'OFFER_A_MORE_ALIGNED' => 'Offer A More Aligned',
  'OFFER_B_MORE_ALIGNED' => 'Offer B More Aligned',
  'SIMILAR_ALIGNMENT' => 'Similar Alignment',
  'MIXED' => 'Mixed',
  'CAUTIOUS' => 'Cautious',
  _ => 'Insufficient Evidence',
};

String? careerDecisionContextLabel(CareerDecisionSummary item) {
  final c = item.context;
  if (c == null) return null;
  String join(List<String> values) => values.take(2).join(' + ');
  switch (item.decisionType) {
    case 'JOB_OFFER':
      return c.role ?? c.currentRole;
    case 'SWITCH_JOB':
      return c.reasons.isEmpty ? null : join(c.reasons);
    case 'COMPARE_OFFERS':
      final a = c.offerA?.companyLabel ?? c.offerA?.role;
      final b = c.offerB?.companyLabel ?? c.offerB?.role;
      return a != null && b != null ? '$a vs $b' : a ?? b;
    case 'PROMOTION_GROWTH':
      return c.growthTypes.isEmpty ? null : join(c.growthTypes);
    case 'START_BUSINESS':
      final stage = c.businessStage;
      final mode = c.startMode;
      return stage != null && mode != null
          ? '${_label(stage)} · ${_label(mode)}'
          : stage == null
          ? (mode == null ? null : _label(mode))
          : _label(stage);
    case 'CAREER_ABROAD':
      return c.targetRegion == null
          ? (c.abroadPath == null ? null : _label(c.abroadPath!))
          : '${c.abroadPath == null ? 'International move' : _label(c.abroadPath!)} · ${c.targetRegion}';
    default:
      return null;
  }
}

String _label(String value) => value
    .split('_')
    .where((part) => part.isNotEmpty)
    .map((part) => '${part[0]}${part.substring(1).toLowerCase()}')
    .join(' ');
