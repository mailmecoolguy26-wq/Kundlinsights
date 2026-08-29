import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_theme.dart';
import '../../../core/errors/api_failure.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_card.dart';
import '../domain/birth_profile.dart';
import '../profile_controller.dart';

class BirthProfileOnboardingScreen extends StatefulWidget {
  const BirthProfileOnboardingScreen({
    super.key,
    required this.controller,
    this.adding = false,
  });
  final ProfileController controller;
  final bool adding;

  @override
  State<BirthProfileOnboardingScreen> createState() =>
      _BirthProfileOnboardingScreenState();
}

class _BirthProfileOnboardingScreenState
    extends State<BirthProfileOnboardingScreen> {
  final _label = TextEditingController();
  final _place = TextEditingController();
  Timer? _debounce;
  int _step = 0;
  DateTime? _date;
  TimeOfDay? _time;
  PlaceCandidate? _selected;
  ResolvedBirthData? _resolved;
  List<PlaceCandidate> _results = const [];
  bool _searching = false;
  bool _resolving = false;
  bool _submitting = false;
  String? _error;
  int _searchGeneration = 0;
  int _resolutionGeneration = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _label.dispose();
    _place.dispose();
    super.dispose();
  }

  void _search(String value) {
    _debounce?.cancel();
    final generation = ++_searchGeneration;
    if (_selected != null && value.trim() != _selected!.label) {
      setState(() {
        _selected = null;
        _invalidateResolution();
      });
    }
    if (value.trim().length < 3) {
      setState(() {
        _results = const [];
        _searching = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() {
        _searching = true;
        _error = null;
      });
      try {
        final results = await widget.controller.repository.searchPlaces(
          value.trim(),
        );
        if (mounted && generation == _searchGeneration) {
          setState(() {
            _results = results;
            _searching = false;
          });
        }
      } catch (error) {
        if (mounted && generation == _searchGeneration) {
          setState(() {
            _searching = false;
            _error = _message(error);
          });
        }
      }
    });
  }

  String _message(Object error) {
    if (error is ApiFailure) {
      return switch (error.code) {
        'LOCAL_TIME_AMBIGUOUS' => AppLocalizations.of(
          context,
        )!.ambiguousBirthTime,
        'LOCAL_TIME_NONEXISTENT' => AppLocalizations.of(
          context,
        )!.nonexistentBirthTime,
        _ => AppLocalizations.of(context)!.profileRequestFailed,
      };
    }
    return AppLocalizations.of(context)!.profileRequestFailed;
  }

  String _dateValue() =>
      '${_date!.year.toString().padLeft(4, '0')}-${_date!.month.toString().padLeft(2, '0')}-${_date!.day.toString().padLeft(2, '0')}';
  String _timeValue() =>
      '${_time!.hour.toString().padLeft(2, '0')}:${_time!.minute.toString().padLeft(2, '0')}:00';

  Future<void> _pickDate() async {
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      initialDate:
          _date ?? DateTime.now().subtract(const Duration(days: 365 * 25)),
    );
    if (selected != null) {
      setState(() {
        _date = selected;
        _invalidateResolution();
        _error = null;
      });
    }
  }

  Future<void> _pickTime() async {
    final selected = await showTimePicker(
      context: context,
      initialTime: _time ?? const TimeOfDay(hour: 12, minute: 0),
    );
    if (selected != null) {
      setState(() {
        _time = selected;
        _invalidateResolution();
        _error = null;
      });
    }
  }

  Future<void> _create() async {
    if (_resolved == null || _submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.controller.create(
        displayLabel: _label.text.trim().isEmpty ? null : _label.text.trim(),
        birthData: _resolved!,
      );
      if (mounted) {
        context.go('/home');
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = _message(error);
        });
      }
    }
  }

  Future<void> _next() async {
    final valid = switch (_step) {
      0 => true,
      1 => _date != null,
      2 => _time != null,
      3 => _selected != null,
      _ => true,
    };
    if (!valid) {
      setState(
        () => _error = AppLocalizations.of(context)!.completeRequiredFields,
      );
      return;
    }
    if (_step == 3) {
      await _resolveAndAdvance();
      return;
    }
    setState(() {
      _error = null;
      _step++;
    });
  }

  void _invalidateResolution() {
    _resolutionGeneration++;
    _resolved = null;
    _resolving = false;
  }

  Future<void> _resolveAndAdvance() async {
    final place = _selected;
    if (place == null || _date == null || _time == null || _resolving) return;
    final generation = ++_resolutionGeneration;
    setState(() {
      _resolving = true;
      _error = null;
    });
    try {
      final resolved = await widget.controller.repository.resolveBirthTime(
        placeId: place.id,
        localDate: _dateValue(),
        localTime: _timeValue(),
      );
      if (!mounted ||
          generation != _resolutionGeneration ||
          place != _selected) {
        return;
      }
      setState(() {
        _resolved = resolved;
        _resolving = false;
        _step = 4;
      });
    } catch (error) {
      if (!mounted || generation != _resolutionGeneration) return;
      setState(() {
        _resolving = false;
        _error = _message(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.adding ? t.addProfile : t.createBirthProfile),
        automaticallyImplyLeading: widget.adding,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Text(
              '${t.step} ${_step + 1} ${t.stepOf} 5',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const SizedBox(height: AppSpacing.md),
            if (!widget.adding && _step == 0) ...[
              Text(
                t.onboardingIntro,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            _body(t),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.lg),
            if (_step < 4)
              FilledButton(
                onPressed: _resolving ? null : _next,
                child: _resolving
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(t.resolvingBirthDetails),
                        ],
                      )
                    : Text(t.continueLabel),
              )
            else
              FilledButton(
                onPressed: _submitting ? null : _create,
                child: _submitting
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(t.creatingProfile),
                        ],
                      )
                    : Text(t.createProfile),
              ),
          ],
        ),
      ),
    );
  }

  Widget _body(AppLocalizations t) => switch (_step) {
    0 => TextField(
      controller: _label,
      decoration: InputDecoration(
        labelText: t.profileLabel,
        hintText: t.profileLabelHint,
      ),
      textInputAction: TextInputAction.next,
    ),
    1 => _PickerCard(
      label: t.dateOfBirth,
      value: _date == null
          ? t.selectDate
          : MaterialLocalizations.of(context).formatMediumDate(_date!),
      icon: Icons.calendar_today_outlined,
      onTap: _pickDate,
    ),
    2 => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _PickerCard(
          label: t.birthTime,
          value: _time == null ? t.selectTime : _time!.format(context),
          icon: Icons.access_time,
          onTap: _pickTime,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(t.birthTimeHelp),
      ],
    ),
    3 => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _place,
          onChanged: _search,
          decoration: InputDecoration(
            labelText: t.placeOfBirth,
            hintText: t.placeSearchHint,
          ),
          textInputAction: TextInputAction.search,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (_searching) const Center(child: CircularProgressIndicator()),
        if (!_searching &&
            _place.text.trim().length >= 3 &&
            _results.isEmpty &&
            _error == null)
          Text(t.noPlaceResults),
        ..._results.map(
          (place) => Semantics(
            button: true,
            label: '${t.placeOfBirth}: ${place.label}',
            child: ListTile(
              title: Text(place.label),
              trailing: _selected?.id == place.id
                  ? const Icon(Icons.check_circle)
                  : const Icon(Icons.chevron_right),
              onTap: () => setState(() {
                _selected = place;
                _place.text = place.label;
                _invalidateResolution();
                _error = null;
              }),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Semantics(
          label: t.googleMapsAttribution,
          child: Text(
            t.googleMapsAttribution,
            textAlign: TextAlign.end,
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ),
      ],
    ),
    _ => AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t.reviewProfile,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: AppSpacing.md),
          _ReviewRow(
            label: t.profileLabel,
            value: _label.text.trim().isEmpty
                ? t.defaultProfileLabel
                : _label.text.trim(),
            onEdit: () => setState(() => _step = 0),
          ),
          _ReviewRow(
            label: t.dateOfBirth,
            value: MaterialLocalizations.of(context).formatMediumDate(_date!),
            onEdit: () => setState(() => _step = 1),
          ),
          _ReviewRow(
            label: t.birthTime,
            value: _time!.format(context),
            onEdit: () => setState(() => _step = 2),
          ),
          _ReviewRow(
            label: t.placeOfBirth,
            value: _selected!.label,
            onEdit: () => setState(() => _step = 3),
          ),
          Semantics(
            label: '${t.selectedBirthplace}: ${_selected!.label}',
            child: Text(
              '${t.selectedBirthplace}: ${_selected!.label}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    ),
  };
}

class _PickerCard extends StatelessWidget {
  const _PickerCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
  });
  final String label, value;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: '$label: $value',
    child: ListTile(
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.medium),
      tileColor: Theme.of(context).colorScheme.surfaceContainerHighest,
      title: Text(label),
      subtitle: Text(value),
      leading: Icon(icon),
      onTap: onTap,
    ),
  );
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.label,
    required this.value,
    required this.onEdit,
  });
  final String label, value;
  final VoidCallback onEdit;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label),
    subtitle: Text(value),
    trailing: TextButton(
      onPressed: onEdit,
      child: Text(AppLocalizations.of(context)!.edit),
    ),
  );
}
