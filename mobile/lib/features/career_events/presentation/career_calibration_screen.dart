import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/errors/api_failure.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/states.dart';
import '../career_event_controller.dart';
import '../domain/career_event.dart';

class CareerCalibrationScreen extends StatelessWidget {
  const CareerCalibrationScreen({super.key, required this.controller});
  final CareerEventController controller;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Scaffold(
        backgroundColor: _CalibrationColors.background,
        body: SafeArea(
          child: Column(
            children: [
              _CalibrationTopBar(onExit: () => _goBack(context)),
              const _ProgressHeader(),
              Expanded(child: _body(context)),
            ],
          ),
        ),
      ),
    );
  }

  void _goBack(BuildContext context) {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    context.go('/profile');
  }

  Widget _body(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.state == CareerEventLoadState.initial ||
        controller.state == CareerEventLoadState.loading) {
      return LoadingState(label: t.careerHistoryLoading);
    }
    if (controller.state == CareerEventLoadState.error) {
      return ErrorState(
        message: _errorText(t, controller.error),
        onRetry: controller.refresh,
        retryLabel: t.retry,
      );
    }
    if (controller.events.isEmpty) {
      return _CalibrationIntro(
        busy: controller.isMutating,
        onStart: () => _openForm(context),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
      children: [
        if (controller.mutationState == CareerEventMutationState.error)
          MaterialBanner(
            content: Text(_errorText(t, controller.mutationError)),
            actions: [
              TextButton(
                onPressed: controller.clearMutationError,
                child: Text(t.dismiss),
              ),
            ],
          ),
        Row(
          children: [
            Expanded(
              child: Text(
                'Your Career Events',
                style: _calibrationHeading(fontSize: 31),
              ),
            ),
            _SavedEventBadge(count: controller.events.length),
          ],
        ),
        const SizedBox(height: 9),
        Text(
          'Review or add the events used for your personalized career timing.',
          style: GoogleFonts.inter(
            color: _CalibrationColors.slate,
            fontSize: 13,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 12),
        ...controller.events.map(
          (event) => _EventTile(
            event: event,
            busy: controller.isMutating,
            onEdit: () => _openForm(context, event: event),
            onDelete: () => _confirmDelete(context, event),
          ),
        ),
        const SizedBox(height: 14),
        _GoldAction(
          key: const ValueKey('add-career-event'),
          label: 'ADD CAREER EVENT  →',
          enabled: !controller.isMutating,
          onPressed: () => _openForm(context),
        ),
      ],
    );
  }

  Future<void> _openForm(BuildContext context, {CareerEvent? event}) =>
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) =>
              CareerEventFormScreen(controller: controller, event: event),
        ),
      );

  Future<void> _confirmDelete(BuildContext context, CareerEvent event) async {
    final t = AppLocalizations.of(context)!;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => ListenableBuilder(
        listenable: controller,
        builder: (context, _) {
          final pending =
              controller.mutationState == CareerEventMutationState.deleting;
          final failed =
              controller.mutationState == CareerEventMutationState.error;
          return AlertDialog(
            title: Text(t.deleteCareerEvent),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(t.deleteCareerMilestoneBody),
                if (pending) ...[
                  const SizedBox(height: 16),
                  Semantics(
                    liveRegion: true,
                    label: t.deletingCareerEvent,
                    child: const LinearProgressIndicator(),
                  ),
                ],
                if (failed) ...[
                  const SizedBox(height: 12),
                  Text(_errorText(t, controller.mutationError)),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: pending ? null : () => Navigator.pop(dialogContext),
                child: Text(t.cancel),
              ),
              FilledButton(
                onPressed: pending
                    ? null
                    : () async {
                        final success = await controller.delete(
                          event.careerEventId,
                        );
                        if (success && dialogContext.mounted) {
                          Navigator.pop(dialogContext);
                        }
                      },
                child: Text(pending ? t.deletingCareerEvent : t.delete),
              ),
            ],
          );
        },
      ),
    );
  }
}

abstract final class _CalibrationColors {
  static const background = Color(0xFF0B071B);
  static const abyss = Color(0xFF120D29);
  static const violet = Color(0xFF181335);
  static const gold = Color(0xFFC5A059);
  static const champagne = Color(0xFFF4BF50);
  static const alabaster = Color(0xFFFAF7F2);
  static const slate = Color(0xFF9E9AA9);
  static const mutedError = Color(0xFFC88989);
}

class _CalibrationTopBar extends StatelessWidget {
  const _CalibrationTopBar({required this.onExit});
  final VoidCallback onExit;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
    child: Row(
      children: [
        Container(
          decoration: const BoxDecoration(
            color: _CalibrationColors.violet,
            shape: BoxShape.circle,
          ),
          child: BackButton(
            onPressed: onExit,
            color: _CalibrationColors.alabaster,
          ),
        ),
        const Spacer(),
        Column(
          children: [
            Text(
              'CALIBRATION',
              style: _calibrationLabel(color: _CalibrationColors.champagne),
            ),
            const SizedBox(height: 2),
            Text(
              'Career Calibration',
              style: _calibrationHeading(fontSize: 23),
            ),
          ],
        ),
        const Spacer(),
        IconButton(
          key: const ValueKey('calibration-close'),
          onPressed: onExit,
          icon: const Icon(Icons.close, color: _CalibrationColors.alabaster),
          style: IconButton.styleFrom(
            backgroundColor: _CalibrationColors.violet,
          ),
        ),
        const SizedBox(width: 4),
        const CircleAvatar(
          radius: 15,
          backgroundColor: _CalibrationColors.abyss,
          child: Icon(
            Icons.person_outline,
            size: 17,
            color: _CalibrationColors.gold,
          ),
        ),
      ],
    ),
  );
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(20, 11, 20, 13),
    decoration: const BoxDecoration(
      border: Border(
        bottom: BorderSide(color: _CalibrationColors.gold, width: .7),
      ),
    ),
    child: Column(
      children: [
        Row(
          children: [
            Text(
              '●  CAREER CALIBRATION',
              style: _calibrationLabel(color: _CalibrationColors.champagne),
            ),
            const Spacer(),
            Text(
              'Step 1 of 1',
              style: GoogleFonts.inter(
                color: _CalibrationColors.slate,
                fontSize: 11,
              ),
            ),
          ],
        ),
        const SizedBox(height: 9),
        Container(
          height: 3,
          decoration: BoxDecoration(
            color: _CalibrationColors.gold,
            borderRadius: BorderRadius.circular(99),
          ),
        ),
      ],
    ),
  );
}

class _CalibrationIntro extends StatelessWidget {
  const _CalibrationIntro({required this.busy, required this.onStart});
  final bool busy;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(20, 30, 20, 28),
    children: [
      Text(
        'Help us learn from your career journey',
        style: _calibrationHeading(fontSize: 36),
      ),
      const SizedBox(height: 13),
      Text(
        'Add a few important career events from your past. We’ll use them to better calibrate your chart and personalize your upcoming career windows.',
        style: GoogleFonts.inter(
          color: _CalibrationColors.slate,
          fontSize: 13,
          height: 1.55,
        ),
      ),
      const SizedBox(height: 28),
      const _ExplainerCard(),
      const SizedBox(height: 15),
      const _TrustCard(),
      const SizedBox(height: 28),
      _GoldAction(
        key: const ValueKey('start-calibration'),
        label: 'START CALIBRATION  →',
        enabled: !busy,
        onPressed: onStart,
      ),
      const SizedBox(height: 11),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.schedule_outlined,
            color: _CalibrationColors.gold,
            size: 14,
          ),
          const SizedBox(width: 7),
          Text(
            'Takes about 2 minutes',
            style: GoogleFonts.inter(
              color: _CalibrationColors.slate,
              fontSize: 11,
            ),
          ),
        ],
      ),
    ],
  );
}

class _ExplainerCard extends StatelessWidget {
  const _ExplainerCard();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: _CalibrationColors.abyss,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      children: [
        const _ExplainerRow(
          icon: Icons.auto_awesome_outlined,
          label: 'Your Birth Chart',
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 7),
          child: Icon(Icons.add, color: _CalibrationColors.champagne, size: 18),
        ),
        const _ExplainerRow(
          icon: Icons.work_outline,
          label: 'Your Career History',
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 7),
          child: Icon(
            Icons.arrow_downward,
            color: _CalibrationColors.champagne,
            size: 18,
          ),
        ),
        const _ExplainerRow(
          icon: Icons.timelapse_outlined,
          label: 'Personalized Career Timing',
          highlighted: true,
        ),
      ],
    ),
  );
}

class _ExplainerRow extends StatelessWidget {
  const _ExplainerRow({
    required this.icon,
    required this.label,
    this.highlighted = false,
  });
  final IconData icon;
  final String label;
  final bool highlighted;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
    decoration: BoxDecoration(
      color: _CalibrationColors.violet,
      borderRadius: BorderRadius.circular(12),
      border: highlighted
          ? Border.all(color: _CalibrationColors.gold.withValues(alpha: .7))
          : null,
    ),
    child: Row(
      children: [
        Icon(icon, color: _CalibrationColors.gold, size: 18),
        const SizedBox(width: 10),
        Text(
          label,
          style: GoogleFonts.inter(
            color: _CalibrationColors.alabaster,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class _TrustCard extends StatelessWidget {
  const _TrustCard();
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _CalibrationColors.violet,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: _CalibrationColors.gold.withValues(alpha: .18)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(
          Icons.verified_user_outlined,
          color: _CalibrationColors.gold,
          size: 20,
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Effortless Calibration',
                style: GoogleFonts.inter(
                  color: _CalibrationColors.alabaster,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Add the important events you remember. Year or month precision is supported when an exact date is unavailable.',
                style: GoogleFonts.inter(
                  color: _CalibrationColors.slate,
                  fontSize: 11,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _GoldAction extends StatelessWidget {
  const _GoldAction({
    super.key,
    required this.label,
    required this.enabled,
    required this.onPressed,
  });
  final String label;
  final bool enabled;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 53,
    child: FilledButton(
      onPressed: enabled ? onPressed : null,
      style: FilledButton.styleFrom(
        backgroundColor: _CalibrationColors.gold,
        disabledBackgroundColor: _CalibrationColors.gold.withValues(alpha: .3),
        foregroundColor: _CalibrationColors.abyss,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      ),
      child: Text(
        label,
        style: _calibrationLabel(color: _CalibrationColors.abyss),
      ),
    ),
  );
}

TextStyle _calibrationLabel({Color color = _CalibrationColors.alabaster}) =>
    GoogleFonts.inter(
      color: color,
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: FontWeight.w700,
    );
TextStyle _calibrationHeading({double fontSize = 30}) => GoogleFonts.ebGaramond(
  color: _CalibrationColors.alabaster,
  fontSize: fontSize,
  height: .98,
  fontWeight: FontWeight.w500,
);

class _SavedEventBadge extends StatelessWidget {
  const _SavedEventBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) => Semantics(
    label: '$count career events saved',
    child: Container(
      key: const ValueKey('saved-event-count'),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: _CalibrationColors.violet,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(
          color: _CalibrationColors.gold.withValues(alpha: .35),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.check_circle_outline,
            color: _CalibrationColors.gold,
            size: 13,
          ),
          const SizedBox(width: 5),
          Text(
            '$count ${count == 1 ? 'event' : 'events'} saved',
            style: GoogleFonts.inter(
              color: _CalibrationColors.champagne,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}

class _EventTile extends StatelessWidget {
  const _EventTile({
    required this.event,
    required this.busy,
    required this.onEdit,
    required this.onDelete,
  });
  final CareerEvent event;
  final bool busy;
  final VoidCallback onEdit, onDelete;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Container(
      key: ValueKey('career-event-${event.careerEventId}'),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: _CalibrationColors.abyss,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _CalibrationColors.gold.withValues(alpha: .2),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 76,
            decoration: const BoxDecoration(
              color: _CalibrationColors.gold,
              borderRadius: BorderRadius.horizontal(left: Radius.circular(16)),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(
                      color: _CalibrationColors.violet,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _eventIcon(event.eventType),
                      color: _CalibrationColors.gold,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _eventTypeLabel(t, event.eventType),
                          style: GoogleFonts.inter(
                            color: _CalibrationColors.alabaster,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _dateLabel(context, event.eventDate),
                          style: GoogleFonts.inter(
                            color: _CalibrationColors.slate,
                            fontSize: 12,
                          ),
                        ),
                        if (event.title?.isNotEmpty == true) ...[
                          const SizedBox(height: 6),
                          Text(
                            event.title!,
                            style: GoogleFonts.inter(
                              color: _CalibrationColors.alabaster.withValues(
                                alpha: .82,
                              ),
                              fontSize: 12,
                            ),
                          ),
                        ],
                        if (event.notes?.isNotEmpty == true) ...[
                          const SizedBox(height: 3),
                          Text(
                            event.notes!,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(
                              color: _CalibrationColors.slate,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        key: ValueKey(
                          'edit-career-event-${event.careerEventId}',
                        ),
                        tooltip: t.editCareerEvent,
                        onPressed: busy ? null : onEdit,
                        icon: const Icon(
                          Icons.edit_outlined,
                          color: _CalibrationColors.gold,
                        ),
                      ),
                      IconButton(
                        key: ValueKey(
                          'delete-career-event-${event.careerEventId}',
                        ),
                        tooltip: t.deleteCareerEvent,
                        onPressed: busy ? null : onDelete,
                        icon: const Icon(
                          Icons.delete_outline,
                          color: _CalibrationColors.mutedError,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

IconData _eventIcon(CareerEventType type) => switch (type) {
  CareerEventType.firstJob => Icons.badge_outlined,
  CareerEventType.jobSwitch => Icons.swap_horiz_rounded,
  CareerEventType.promotion => Icons.trending_up_rounded,
  CareerEventType.roleChange => Icons.person_outline,
  CareerEventType.salaryGrowth => Icons.savings_outlined,
  CareerEventType.jobLoss => Icons.work_off_outlined,
  CareerEventType.businessStarted => Icons.storefront_outlined,
  CareerEventType.careerBreakthrough => Icons.auto_awesome_outlined,
  CareerEventType.careerSetback => Icons.flag_outlined,
  CareerEventType.other => Icons.work_outline,
};

String _errorText(AppLocalizations t, Object? error) {
  if (error is ApiFailure && error.code == 'CAREER_EVENT_DATE_IN_FUTURE') {
    return t.careerEventFuture;
  }
  if (error is ApiFailure && error.kind == ApiFailureKind.validation) {
    return t.invalidCareerEvent;
  }
  return t.careerEventsUnavailable;
}

String _eventTypeLabel(AppLocalizations t, CareerEventType type) =>
    switch (type) {
      CareerEventType.firstJob => t.firstJob,
      CareerEventType.jobSwitch => t.jobSwitch,
      CareerEventType.promotion => t.promotion,
      CareerEventType.roleChange => t.roleChange,
      CareerEventType.salaryGrowth => t.salaryGrowth,
      CareerEventType.jobLoss => t.jobLoss,
      CareerEventType.businessStarted => t.businessStarted,
      CareerEventType.careerBreakthrough => t.careerBreakthrough,
      CareerEventType.careerSetback => t.careerSetback,
      CareerEventType.other => t.other,
    };

String _precisionLabel(AppLocalizations t, CareerEventDatePrecision value) =>
    switch (value) {
      CareerEventDatePrecision.day => t.exactDate,
      CareerEventDatePrecision.month => t.monthAndYear,
      CareerEventDatePrecision.year => t.yearOnly,
    };

String _dateLabel(BuildContext context, CareerEventDate value) =>
    switch (value.precision) {
      CareerEventDatePrecision.day => MaterialLocalizations.of(
        context,
      ).formatMediumDate(DateTime(value.year, value.month!, value.day!)),
      CareerEventDatePrecision.month => MaterialLocalizations.of(
        context,
      ).formatMonthYear(DateTime(value.year, value.month!)),
      CareerEventDatePrecision.year => '${value.year}',
    };

class CareerEventFormScreen extends StatefulWidget {
  const CareerEventFormScreen({
    super.key,
    required this.controller,
    this.event,
  });
  final CareerEventController controller;
  final CareerEvent? event;
  @override
  State<CareerEventFormScreen> createState() => _CareerEventFormScreenState();
}

class _CareerEventFormScreenState extends State<CareerEventFormScreen> {
  final _form = GlobalKey<FormState>();
  late CareerEventType _type;
  late CareerEventDatePrecision _precision;
  late final TextEditingController _year, _month, _day, _title, _notes;
  late final _FormSnapshot _initial;
  late final int _scopeGeneration;
  bool _scopeChanged = false;
  bool _allowPop = false;
  String? _dateError;

  @override
  void initState() {
    super.initState();
    final event = widget.event;
    _type = event?.eventType ?? CareerEventType.firstJob;
    _precision = event?.eventDate.precision ?? CareerEventDatePrecision.day;
    _year = TextEditingController(text: event?.eventDate.year.toString() ?? '');
    _month = TextEditingController(
      text: event?.eventDate.month?.toString() ?? '',
    );
    _day = TextEditingController(text: event?.eventDate.day?.toString() ?? '');
    _title = TextEditingController(text: event?.title ?? '');
    _notes = TextEditingController(text: event?.notes ?? '');
    _initial = _snapshot;
    _scopeGeneration = widget.controller.scopeGeneration;
    widget.controller.addListener(_onControllerChanged);
  }

  void _onControllerChanged() {
    if (mounted &&
        widget.controller.scopeGeneration != _scopeGeneration &&
        !_scopeChanged) {
      setState(() => _scopeChanged = true);
    }
  }

  _FormSnapshot get _snapshot => _FormSnapshot(
    _type,
    _precision,
    _year.text,
    _month.text,
    _day.text,
    _title.text,
    _notes.text,
  );
  bool get _hasChanges => _snapshot != _initial;

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    _year.dispose();
    _month.dispose();
    _day.dispose();
    _title.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final pending = widget.controller.isMutating;
    return PopScope<void>(
      canPop: _allowPop,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop || !await _confirmDiscard()) return;
        if (!mounted) return;
        setState(() => _allowPop = true);
        Navigator.of(this.context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.event == null ? t.addCareerEvent : t.editCareerEvent,
          ),
        ),
        body: SafeArea(
          child: Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_scopeChanged)
                  Card(
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(t.careerProfileChanged),
                      ),
                    ),
                  ),
                _dropdown<CareerEventType>(
                  value: _type,
                  label: t.eventType,
                  items: CareerEventType.values,
                  text: (value) => _eventTypeLabel(t, value),
                  onChanged: (value) => setState(() => _type = value),
                ),
                const SizedBox(height: 12),
                _dropdown<CareerEventDatePrecision>(
                  value: _precision,
                  label: t.datePrecision,
                  items: CareerEventDatePrecision.values,
                  text: (value) => _precisionLabel(t, value),
                  onChanged: (value) => setState(() {
                    _precision = value;
                    if (value == CareerEventDatePrecision.year) {
                      _month.clear();
                      _day.clear();
                    }
                    if (value == CareerEventDatePrecision.month) _day.clear();
                    _dateError = null;
                  }),
                ),
                const SizedBox(height: 12),
                _numberField(
                  _year,
                  t.year,
                  enabled: !_scopeChanged && !pending,
                ),
                if (_precision != CareerEventDatePrecision.year)
                  _numberField(
                    _month,
                    t.month,
                    enabled: !_scopeChanged && !pending,
                  ),
                if (_precision == CareerEventDatePrecision.day)
                  _numberField(
                    _day,
                    t.day,
                    enabled: !_scopeChanged && !pending,
                  ),
                if (_dateError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Semantics(
                      liveRegion: true,
                      child: Text(
                        _dateError!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  ),
                TextFormField(
                  controller: _title,
                  enabled: !_scopeChanged && !pending,
                  decoration: InputDecoration(labelText: t.titleOptional),
                  maxLength: 160,
                ),
                TextFormField(
                  controller: _notes,
                  enabled: !_scopeChanged && !pending,
                  decoration: InputDecoration(labelText: t.notesOptional),
                  maxLength: 2000,
                  minLines: 3,
                  maxLines: 6,
                ),
                const SizedBox(height: 16),
                if (pending) ...[
                  Semantics(
                    liveRegion: true,
                    label: widget.event == null
                        ? t.creatingCareerEvent
                        : t.savingCareerEvent,
                    child: const LinearProgressIndicator(),
                  ),
                  const SizedBox(height: 12),
                ],
                FilledButton(
                  onPressed: _scopeChanged || pending ? null : _save,
                  child: Text(
                    pending
                        ? (widget.event == null
                              ? t.creatingCareerEvent
                              : t.savingCareerEvent)
                        : (widget.event == null
                              ? t.addCareerEvent
                              : t.saveChanges),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _dropdown<T>({
    required T value,
    required String label,
    required List<T> items,
    required String Function(T) text,
    required ValueChanged<T> onChanged,
  }) => DropdownButtonFormField<T>(
    initialValue: value,
    decoration: InputDecoration(labelText: label),
    items: items
        .map((item) => DropdownMenuItem(value: item, child: Text(text(item))))
        .toList(),
    onChanged: _scopeChanged || widget.controller.isMutating
        ? null
        : (value) {
            if (value != null) onChanged(value);
          },
  );

  Widget _numberField(
    TextEditingController controller,
    String label, {
    required bool enabled,
  }) => TextFormField(
    controller: controller,
    enabled: enabled,
    decoration: InputDecoration(labelText: label),
    keyboardType: TextInputType.number,
    validator: (value) => int.tryParse(value ?? '') == null
        ? AppLocalizations.of(context)!.invalidCareerEvent
        : null,
  );

  String? _validateDate() {
    final t = AppLocalizations.of(context)!;
    final year = int.tryParse(_year.text),
        month = int.tryParse(_month.text),
        day = int.tryParse(_day.text);
    if (year == null || year < 1 || year > 9999) {
      return t.careerEventInvalidDate;
    }
    if (_precision != CareerEventDatePrecision.year &&
        (month == null || month < 1 || month > 12)) {
      return t.careerEventInvalidDate;
    }
    if (_precision == CareerEventDatePrecision.day) {
      if (day == null || day < 1 || day > 31) return t.careerEventInvalidDate;
      final date = DateTime.utc(year, month!, day);
      if (date.year != year || date.month != month || date.day != day) {
        return t.careerEventInvalidDate;
      }
    }
    final candidate = _precision == CareerEventDatePrecision.year
        ? [year]
        : _precision == CareerEventDatePrecision.month
        ? [year, month!]
        : [year, month!, day!];
    final now = DateTime.now().toUtc();
    final today = [now.year, now.month, now.day];
    for (var index = 0; index < candidate.length; index++) {
      if (candidate[index] > today[index]) return t.careerEventFuture;
      if (candidate[index] < today[index]) break;
    }
    return null;
  }

  Future<void> _save() async {
    if (_scopeChanged || !_form.currentState!.validate()) return;
    final dateError = _validateDate();
    setState(() => _dateError = dateError);
    if (dateError != null) return;
    final input = CareerEventInput(
      eventType: _type,
      eventDate: CareerEventDate(
        precision: _precision,
        year: int.parse(_year.text),
        month: _precision == CareerEventDatePrecision.year
            ? null
            : int.parse(_month.text),
        day: _precision == CareerEventDatePrecision.day
            ? int.parse(_day.text)
            : null,
      ),
      title: _title.text,
      notes: _notes.text,
    );
    final success = widget.event == null
        ? await widget.controller.create(input)
        : await widget.controller.update(widget.event!.careerEventId, input);
    if (!mounted) return;
    if (success) {
      Navigator.pop(context);
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _errorText(
            AppLocalizations.of(context)!,
            widget.controller.mutationError,
          ),
        ),
      ),
    );
  }

  Future<bool> _confirmDiscard() async {
    if (!_hasChanges) return true;
    final t = AppLocalizations.of(context)!;
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(t.discardCareerChanges),
            content: Text(t.discardCareerChangesBody),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(t.keepEditing),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(t.discard),
              ),
            ],
          ),
        ) ??
        false;
  }
}

class _FormSnapshot {
  const _FormSnapshot(
    this.type,
    this.precision,
    this.year,
    this.month,
    this.day,
    this.title,
    this.notes,
  );
  final CareerEventType type;
  final CareerEventDatePrecision precision;
  final String year, month, day, title, notes;
  @override
  bool operator ==(Object other) =>
      other is _FormSnapshot &&
      type == other.type &&
      precision == other.precision &&
      year == other.year &&
      month == other.month &&
      day == other.day &&
      title == other.title &&
      notes == other.notes;
  @override
  int get hashCode =>
      Object.hash(type, precision, year, month, day, title, notes);
}
