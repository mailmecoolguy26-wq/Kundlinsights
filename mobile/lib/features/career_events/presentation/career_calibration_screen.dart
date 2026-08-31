import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

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
    final t = AppLocalizations.of(context)!;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) => Scaffold(
        appBar: AppBar(
          leading: BackButton(onPressed: () => _goBack(context)),
          title: Text(t.careerCalibration),
        ),
        floatingActionButton:
            controller.state == CareerEventLoadState.loaded &&
                controller.events.isNotEmpty
            ? FloatingActionButton.extended(
                onPressed: controller.isMutating
                    ? null
                    : () => _openForm(context),
                icon: const Icon(Icons.add),
                label: Text(t.addCareerEvent),
              )
            : null,
        body: _body(context),
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
      return EmptyState(
        icon: Icons.work_outline,
        title: t.noCareerHistory,
        body: t.careerHistoryEmptyBody,
        actionLabel: t.addCareerEvent,
        onAction: controller.isMutating ? null : () => _openForm(context),
      );
    }
    return Column(
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
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(t.careerCalibrationIntro),
              const SizedBox(height: 16),
              _Readiness(count: controller.events.length),
              const SizedBox(height: 16),
              ...controller.events.map(
                (event) => _EventTile(
                  event: event,
                  busy: controller.isMutating,
                  onEdit: () => _openForm(context, event: event),
                  onDelete: () => _confirmDelete(context, event),
                ),
              ),
            ],
          ),
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

class _Readiness extends StatelessWidget {
  const _Readiness({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Semantics(
      liveRegion: true,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            count == 1 ? t.addAnotherMilestone : t.careerHistoryReady,
          ),
        ),
      ),
    );
  }
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
    return Card(
      child: ListTile(
        title: Text(_eventTypeLabel(t, event.eventType)),
        subtitle: Text(
          [
            _dateLabel(context, event.eventDate),
            if (event.title?.isNotEmpty == true) event.title!,
            if (event.notes?.isNotEmpty == true) event.notes!,
          ].join('\n'),
        ),
        isThreeLine:
            event.title?.isNotEmpty == true || event.notes?.isNotEmpty == true,
        trailing: Wrap(
          children: [
            IconButton(
              tooltip: t.editCareerEvent,
              onPressed: busy ? null : onEdit,
              icon: const Icon(Icons.edit),
            ),
            IconButton(
              tooltip: t.deleteCareerEvent,
              onPressed: busy ? null : onDelete,
              icon: const Icon(Icons.delete),
            ),
          ],
        ),
      ),
    );
  }
}

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
