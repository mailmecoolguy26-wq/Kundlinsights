import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

import '../domain/life_event.dart';
import '../life_event_controller.dart';

class LifeEventsScreen extends StatefulWidget {
  const LifeEventsScreen({
    super.key,
    required this.controller,
    this.initialCategory,
  });

  final LifeEventController controller;
  final LifeEventCategory? initialCategory;

  @override
  State<LifeEventsScreen> createState() => _LifeEventsScreenState();
}

class _LifeEventsScreenState extends State<LifeEventsScreen> {
  LifeEventCategory? _filter;

  @override
  void initState() {
    super.initState();
    _filter = widget.initialCategory;
  }

  @override
  void didUpdateWidget(covariant LifeEventsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialCategory != widget.initialCategory) {
      _filter = widget.initialCategory;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final events = widget.controller.events
            .where((event) => _filter == null || event.category == _filter)
            .toList(growable: false);
        final profileName =
            widget.controller.profiles.activeProfile?.label ?? '';

        return Scaffold(
          backgroundColor: const Color(0xFF061A1A),
          appBar: AppBar(
            backgroundColor: const Color(0xFF061A1A),
            foregroundColor: const Color(0xFFF7F4EC),
            title: Text(
              'LIFE EVENTS${profileName.isEmpty ? '' : ' — $profileName'}',
            ),
          ),
          floatingActionButton: FloatingActionButton.extended(
            key: const ValueKey('add-life-event'),
            onPressed: () => _openForm(),
            icon: const Icon(Icons.add),
            label: const Text('Add Life Event'),
          ),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _filterChip('All', null),
                  _filterChip('Career', LifeEventCategory.careerBusiness),
                  _filterChip('Property', LifeEventCategory.property),
                  _filterChip('Vehicle', LifeEventCategory.vehicle),
                  _filterChip('Family', LifeEventCategory.relationshipsFamily),
                ],
              ),
              const SizedBox(height: 18),
              if (widget.controller.loading)
                const Center(child: CircularProgressIndicator())
              else if (events.isEmpty)
                const _EmptyState()
              else
                ...events.map(
                  (event) => _EventCard(
                    event: event,
                    onEdit: () => _openForm(event),
                    onDelete: () => _confirmDelete(event),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _filterChip(String label, LifeEventCategory? value) {
    return ChoiceChip(
      label: Text(label),
      selected: _filter == value,
      selectedColor: const Color(0xFF0B6966),
      onSelected: (_) => setState(() => _filter = value),
    );
  }

  Future<void> _openForm([LifeEvent? event]) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _LifeEventForm(
          controller: widget.controller,
          event: event,
          initialCategory: event == null ? _filter : null,
        ),
      ),
    );
  }

  Future<void> _confirmDelete(LifeEvent event) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete Life Event?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true) await widget.controller.remove(event);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 52),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'No Life Events added yet.',
            style: TextStyle(
              color: Color(0xFFF7F4EC),
              fontSize: 23,
              fontWeight: FontWeight.w700,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Add important milestones to help TaraVerse understand your timeline better.',
            style: TextStyle(color: Color(0xFFA8B7B4), height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _EventCard extends StatelessWidget {
  const _EventCard({
    required this.event,
    required this.onEdit,
    required this.onDelete,
  });

  final LifeEvent event;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final note = event.note?.trim();
    return Card(
      color: const Color(0xFF082625),
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        title: Text(
          _eventTitle(event.type),
          style: const TextStyle(color: Color(0xFFF7F4EC)),
        ),
        subtitle: Text(
          '${_formatDate(event.date)} · ${_categoryLabel(event.category)}'
          '${note == null || note.isEmpty ? '' : '\n$note'}',
          style: const TextStyle(color: Color(0xFFA8B7B4)),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (value) => value == 'edit' ? onEdit() : onDelete(),
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'edit', child: Text('Edit')),
            PopupMenuItem(value: 'delete', child: Text('Delete')),
          ],
        ),
      ),
    );
  }
}

class _LifeEventForm extends StatefulWidget {
  const _LifeEventForm({
    required this.controller,
    this.event,
    this.initialCategory,
  });

  final LifeEventController controller;
  final LifeEvent? event;
  final LifeEventCategory? initialCategory;

  @override
  State<_LifeEventForm> createState() => _LifeEventFormState();
}

class _LifeEventFormState extends State<_LifeEventForm> {
  late LifeEventCategory category;
  late LifeEventType type;
  late LifeEventPrecision precision;
  late int year;
  late int month;
  late int day;
  final _note = TextEditingController();

  @override
  void initState() {
    super.initState();
    final event = widget.event;
    category =
        event?.category ??
        widget.initialCategory ??
        LifeEventCategory.careerBusiness;
    type = event?.type ?? lifeEventTypes[category]!.first;
    precision = event?.date.precision ?? LifeEventPrecision.year;
    year = event?.date.year ?? DateTime.now().year;
    month = event?.date.month ?? DateTime.now().month;
    day = event?.date.day ?? DateTime.now().day;
    _note.text = event?.note ?? '';
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.event == null ? 'Add Life Event' : 'Edit Life Event',
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          DropdownButtonFormField<LifeEventCategory>(
            initialValue: category,
            decoration: const InputDecoration(labelText: 'Area'),
            items: LifeEventCategory.values
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(_categoryLabel(value)),
                  ),
                )
                .toList(growable: false),
            onChanged: (value) => setState(() {
              category = value!;
              type = lifeEventTypes[category]!.first;
            }),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<LifeEventType>(
            initialValue: type,
            decoration: const InputDecoration(labelText: 'Event'),
            items: lifeEventTypes[category]!
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(_eventTitle(value)),
                  ),
                )
                .toList(growable: false),
            onChanged: (value) => setState(() => type = value!),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<LifeEventPrecision>(
            initialValue: precision,
            decoration: const InputDecoration(labelText: 'Date precision'),
            items: LifeEventPrecision.values
                .map(
                  (value) => DropdownMenuItem(
                    value: value,
                    child: Text(_precisionLabel(value)),
                  ),
                )
                .toList(growable: false),
            onChanged: (value) => setState(() => precision = value!),
          ),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: '$year',
            decoration: const InputDecoration(labelText: 'Year'),
            keyboardType: TextInputType.number,
            onChanged: (value) => year = int.tryParse(value) ?? year,
          ),
          if (precision != LifeEventPrecision.year) ...[
            const SizedBox(height: 12),
            TextFormField(
              initialValue: '$month',
              decoration: const InputDecoration(labelText: 'Month'),
              keyboardType: TextInputType.number,
              onChanged: (value) => month = int.tryParse(value) ?? month,
            ),
          ],
          if (precision == LifeEventPrecision.day) ...[
            const SizedBox(height: 12),
            TextFormField(
              initialValue: '$day',
              decoration: const InputDecoration(labelText: 'Day'),
              keyboardType: TextInputType.number,
              onChanged: (value) => day = int.tryParse(value) ?? day,
            ),
          ],
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: const InputDecoration(labelText: 'Optional note'),
          ),
          const SizedBox(height: 20),
          FilledButton(onPressed: _save, child: const Text('Save')),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final input = LifeEventInput(
      category: category,
      type: type,
      date: LifeEventDate(
        precision: precision,
        year: year,
        month: precision == LifeEventPrecision.year ? null : month,
        day: precision == LifeEventPrecision.day ? day : null,
      ),
      note: _note.text,
    );
    _log('LIFE_EVENT_SAVE_TAP', input);
    final validationError = _validationError(input.date);
    if (validationError != null) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(validationError)));
      }
      return;
    }
    _log('LIFE_EVENT_FORM_VALID', input);
    final saved = await widget.controller.save(input, editing: widget.event);
    if (!mounted) return;
    if (saved) {
      Navigator.of(context).pop();
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Life Event could not be saved. Please try again.'),
      ),
    );
  }

  String? _validationError(LifeEventDate date) {
    if (date.year < 1 || date.year > 9999) return 'Enter a valid year.';
    if (date.precision != LifeEventPrecision.year &&
        (date.month == null || date.month! < 1 || date.month! > 12)) {
      return 'Enter a valid month.';
    }
    if (date.precision == LifeEventPrecision.day &&
        (date.day == null || date.day! < 1 || date.day! > 31)) {
      return 'Enter a valid day.';
    }
    return null;
  }

  void _log(String stage, LifeEventInput input) {
    if (!kDebugMode) return;
    debugPrint(
      '$stage birthProfileId=${widget.controller.activeProfileId ?? 'none'}'
      ' category=${input.category.wire}'
      ' eventType=${input.type.wire}'
      ' datePrecision=${input.date.precision.wire}',
    );
  }
}

String _categoryLabel(LifeEventCategory category) => switch (category) {
  LifeEventCategory.careerBusiness => 'Career & Business',
  LifeEventCategory.property => 'Property',
  LifeEventCategory.vehicle => 'Vehicle',
  LifeEventCategory.relationshipsFamily => 'Relationships & Family',
};

String _precisionLabel(LifeEventPrecision precision) => switch (precision) {
  LifeEventPrecision.day => 'Exact date',
  LifeEventPrecision.month => 'Month',
  LifeEventPrecision.year => 'Year',
};

String _eventTitle(LifeEventType type) => switch (type) {
  LifeEventType.jobJoined => 'Job joined',
  LifeEventType.jobChanged => 'Job changed',
  LifeEventType.promotion => 'Promotion',
  LifeEventType.roleChanged => 'Role changed',
  LifeEventType.salaryChanged => 'Salary changed',
  LifeEventType.jobLoss => 'Job loss',
  LifeEventType.businessStarted => 'Business started',
  LifeEventType.careerBreakthrough => 'Career breakthrough',
  LifeEventType.careerSetback => 'Career setback',
  LifeEventType.other => 'Other',
  LifeEventType.propertyPurchase => 'Property purchased',
  LifeEventType.propertySale => 'Property sold',
  LifeEventType.vehiclePurchase => 'Vehicle purchased',
  LifeEventType.vehicleSale => 'Vehicle sold',
  LifeEventType.marriage => 'Marriage',
  LifeEventType.engagement => 'Engagement',
  LifeEventType.childBirth => 'Child birth',
};

String _formatDate(LifeEventDate date) => switch (date.precision) {
  LifeEventPrecision.year => '${date.year}',
  LifeEventPrecision.month => '${date.month}/${date.year}',
  LifeEventPrecision.day => '${date.day}/${date.month}/${date.year}',
};
