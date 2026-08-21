import 'package:flutter/material.dart';

import '../../../core/errors/api_failure.dart';
import '../../../l10n/app_localizations.dart';
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
        appBar: AppBar(title: Text(t.careerCalibration)),
        floatingActionButton: controller.state == CareerEventLoadState.loaded
            ? FloatingActionButton.extended(
                onPressed: controller.isMutating
                    ? null
                    : () => _openForm(context),
                icon: const Icon(Icons.add),
                label: Text(t.addMilestone),
              )
            : null,
        body: _body(context),
      ),
    );
  }

  Widget _body(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    if (controller.state == CareerEventLoadState.initial ||
        controller.state == CareerEventLoadState.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (controller.state == CareerEventLoadState.error) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_errorText(t, controller.error)),
            const SizedBox(height: 12),
            FilledButton(onPressed: controller.refresh, child: Text(t.retry)),
          ],
        ),
      );
    }
    final events = controller.events;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(t.careerCalibrationIntro),
        const SizedBox(height: 16),
        _Readiness(count: events.length),
        const SizedBox(height: 16),
        if (events.isEmpty)
          _EmptyState(onAdd: () => _openForm(context))
        else
          ...events.map(
            (event) => _EventTile(
              event: event,
              onEdit: () => _openForm(context, event: event),
              onDelete: () => _confirmDelete(context, event),
            ),
          ),
      ],
    );
  }

  Future<void> _openForm(BuildContext context, {CareerEvent? event}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            CareerEventFormScreen(controller: controller, event: event),
      ),
    );
    if (saved == true && context.mounted) {
      ScaffoldMessenger.of(context).clearSnackBars();
    }
  }

  Future<void> _confirmDelete(BuildContext context, CareerEvent event) async {
    final t = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(t.deleteCareerMilestone),
        content: Text(t.deleteCareerMilestoneBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(t.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(t.delete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final success = await controller.delete(event.careerEventId);
    if (!success && context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_errorText(t, controller.error))));
    }
  }

  String _errorText(AppLocalizations t, Object? error) {
    if (error is ApiFailure && error.code == 'CAREER_EVENT_DATE_IN_FUTURE') {
      return t.careerEventFuture;
    }
    return t.careerEventsUnavailable;
  }
}

class _Readiness extends StatelessWidget {
  const _Readiness({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final text = count == 0
        ? t.noCareerHistory
        : count == 1
        ? t.addAnotherMilestone
        : t.careerHistoryReady;
    return Semantics(
      liveRegion: true,
      child: Card(
        child: Padding(padding: const EdgeInsets.all(16), child: Text(text)),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onAdd});
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Center(
      child: Column(
        children: [
          Text(t.careerCalibrationIntro, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: Text(t.addMilestone),
          ),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  const _EventTile({
    required this.event,
    required this.onEdit,
    required this.onDelete,
  });
  final CareerEvent event;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Card(
      child: ListTile(
        title: Text(_eventTypeLabel(t, event.eventType)),
        subtitle: Text(
          [
            _dateLabel(event.eventDate),
            if (event.title?.isNotEmpty == true) event.title!,
            if (event.notes?.isNotEmpty == true) event.notes!,
          ].join('\n'),
        ),
        isThreeLine:
            event.title?.isNotEmpty == true || event.notes?.isNotEmpty == true,
        trailing: Wrap(
          children: [
            IconButton(
              tooltip: t.editMilestone,
              onPressed: onEdit,
              icon: const Icon(Icons.edit),
            ),
            IconButton(
              tooltip: t.deleteCareerMilestone,
              onPressed: onDelete,
              icon: const Icon(Icons.delete),
            ),
          ],
        ),
      ),
    );
  }
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

String _dateLabel(CareerEventDate date) => switch (date.precision) {
  CareerEventDatePrecision.day =>
    '${date.year}-${date.month!.toString().padLeft(2, '0')}-${date.day!.toString().padLeft(2, '0')}',
  CareerEventDatePrecision.month =>
    '${date.year}-${date.month!.toString().padLeft(2, '0')}',
  CareerEventDatePrecision.year => '${date.year}',
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
  late final TextEditingController _year;
  late final TextEditingController _month;
  late final TextEditingController _day;
  late final TextEditingController _title;
  late final TextEditingController _notes;

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
  }

  @override
  void dispose() {
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
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.event == null ? t.addMilestone : t.editMilestone),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField(
              initialValue: _type,
              decoration: InputDecoration(labelText: t.eventType),
              items: CareerEventType.values
                  .map(
                    (value) => DropdownMenuItem(
                      value: value,
                      child: Text(_eventTypeLabel(t, value)),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _type = value!),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField(
              initialValue: _precision,
              decoration: InputDecoration(labelText: t.datePrecision),
              items: CareerEventDatePrecision.values
                  .map(
                    (value) => DropdownMenuItem(
                      value: value,
                      child: Text(value.wireValue),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                _precision = value!;
                if (_precision == CareerEventDatePrecision.year) {
                  _month.clear();
                  _day.clear();
                } else if (_precision == CareerEventDatePrecision.month) {
                  _day.clear();
                }
              }),
            ),
            const SizedBox(height: 12),
            _numberField(_year, t.year),
            if (_precision != CareerEventDatePrecision.year)
              _numberField(_month, t.month),
            if (_precision == CareerEventDatePrecision.day)
              _numberField(_day, t.day),
            TextFormField(
              controller: _title,
              decoration: InputDecoration(labelText: t.titleOptional),
              maxLength: 160,
            ),
            TextFormField(
              controller: _notes,
              decoration: InputDecoration(labelText: t.notesOptional),
              maxLength: 2000,
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: widget.controller.isMutating ? null : _save,
              child: Text(
                widget.event == null ? t.addMilestone : t.saveChanges,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _numberField(TextEditingController controller, String label) =>
      TextFormField(
        controller: controller,
        decoration: InputDecoration(labelText: label),
        keyboardType: TextInputType.number,
        validator: (value) => int.tryParse(value ?? '') == null
            ? AppLocalizations.of(context)!.invalidCareerEvent
            : null,
      );

  Future<void> _save() async {
    if (!_form.currentState!.validate()) {
      return;
    }
    final year = int.parse(_year.text);
    final month = _precision == CareerEventDatePrecision.year
        ? null
        : int.tryParse(_month.text);
    final day = _precision == CareerEventDatePrecision.day
        ? int.tryParse(_day.text)
        : null;
    if ((_precision != CareerEventDatePrecision.year && month == null) ||
        (_precision == CareerEventDatePrecision.day && day == null)) {
      return;
    }
    final input = CareerEventInput(
      eventType: _type,
      eventDate: CareerEventDate(
        precision: _precision,
        year: year,
        month: month,
        day: day,
      ),
      title: _title.text,
      notes: _notes.text,
    );
    final success = widget.event == null
        ? await widget.controller.create(input)
        : await widget.controller.update(widget.event!.careerEventId, input);
    if (!mounted) return;
    if (success) {
      Navigator.pop(context, true);
      return;
    }
    final t = AppLocalizations.of(context)!;
    final error = widget.controller.error;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error is ApiFailure && error.code == 'CAREER_EVENT_DATE_IN_FUTURE'
              ? t.careerEventFuture
              : t.careerEventsUnavailable,
        ),
      ),
    );
  }
}
