import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/errors/api_failure.dart';
import '../../../l10n/app_localizations.dart';
import '../domain/birth_profile.dart';
import '../profile_controller.dart';

/// A presentation shell around the existing authoritative birth-profile flow.
/// The backend-authored [ResolvedBirthData] is passed to creation unchanged.
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
  static const _background = Color(0xFF0B071B);
  static const _abyss = Color(0xFF120D29);
  static const _violet = Color(0xFF181335);
  static const _gold = Color(0xFFC5A059);
  static const _champagne = Color(0xFFF4BF50);
  static const _alabaster = Color(0xFFFAF7F2);
  static const _slate = Color(0xFF9E9AA9);

  final _label = TextEditingController();
  final _place = TextEditingController();
  Timer? _debounce;
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

  bool get _canCreate =>
      _date != null &&
      _time != null &&
      _selected != null &&
      _resolved != null &&
      !_resolving &&
      !_submitting;

  @override
  void dispose() {
    _debounce?.cancel();
    _label.dispose();
    _place.dispose();
    super.dispose();
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

  void _invalidateResolution() {
    _resolutionGeneration++;
    _resolved = null;
    _resolving = false;
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
      if (!mounted) return;
      setState(() {
        _searching = true;
        _error = null;
      });
      try {
        final results = await widget.controller.repository.searchPlaces(
          value.trim(),
        );
        if (!mounted || generation != _searchGeneration) return;
        setState(() {
          _results = results;
          _searching = false;
        });
      } catch (error) {
        if (!mounted || generation != _searchGeneration) return;
        setState(() {
          _searching = false;
          _error = _message(error);
        });
      }
    });
  }

  Future<void> _pickDate() async {
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      initialDate:
          _date ?? DateTime.now().subtract(const Duration(days: 365 * 25)),
    );
    if (selected == null) return;
    setState(() {
      _date = selected;
      _invalidateResolution();
      _error = null;
    });
    _resolveWhenReady();
  }

  Future<void> _pickTime() async {
    final selected = await showTimePicker(
      context: context,
      initialTime: _time ?? const TimeOfDay(hour: 12, minute: 0),
    );
    if (selected == null) return;
    setState(() {
      _time = selected;
      _invalidateResolution();
      _error = null;
    });
    _resolveWhenReady();
  }

  void _setPeriod(bool morning) {
    if (_time == null) return;
    final hour = _time!.hour;
    final nextHour = morning
        ? (hour >= 12 ? hour - 12 : hour)
        : (hour < 12 ? hour + 12 : hour);
    if (nextHour == hour) return;
    setState(() {
      _time = TimeOfDay(hour: nextHour, minute: _time!.minute);
      _invalidateResolution();
    });
    _resolveWhenReady();
  }

  Future<void> _resolveWhenReady() async {
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
      });
    } catch (error) {
      if (!mounted || generation != _resolutionGeneration) return;
      setState(() {
        _resolving = false;
        _error = _message(error);
      });
    }
  }

  Future<void> _create() async {
    if (!_canCreate) {
      setState(
        () => _error = AppLocalizations.of(context)!.completeRequiredFields,
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.controller.create(
        displayLabel: _label.text.trim().isEmpty ? null : _label.text.trim(),
        birthData: _resolved!,
      );
      if (mounted) context.go('/home');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = _message(error);
      });
    }
  }

  String _formattedDate() {
    final value = _date;
    if (value == null) return 'DD / MM / YYYY';
    return '${value.day.toString().padLeft(2, '0')} / ${value.month.toString().padLeft(2, '0')} / ${value.year}';
  }

  String _formattedTime() {
    final value = _time;
    if (value == null) return 'Select time';
    final hour = value.hourOfPeriod == 0 ? 12 : value.hourOfPeriod;
    return '${hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  }

  String _coordinates() {
    final data = _resolved?.value;
    if (data == null) return '';
    final latitude = data['latitude'] as num?;
    final longitude = data['longitude'] as num?;
    if (latitude == null || longitude == null) return '';
    final ns = latitude >= 0 ? 'N' : 'S';
    final ew = longitude >= 0 ? 'E' : 'W';
    return '${latitude.abs().toStringAsFixed(4)}° $ns  ·  ${longitude.abs().toStringAsFixed(4)}° $ew';
  }

  String _timezoneDisplay() {
    final data = _resolved;
    if (data == null) return '';
    final utc = data.value['utc'] as String?;
    if (utc != null) {
      final localParts = DateTime.tryParse(
        '${data.localDate}T${data.localTime}',
      );
      final instant = DateTime.tryParse(utc)?.toUtc();
      if (localParts != null && instant != null) {
        final local = DateTime.utc(
          localParts.year,
          localParts.month,
          localParts.day,
          localParts.hour,
          localParts.minute,
          localParts.second,
        );
        final offset = local.difference(instant).inMinutes;
        final sign = offset < 0 ? '-' : '+';
        final absolute = offset.abs();
        return 'UTC $sign${(absolute ~/ 60).toString().padLeft(2, '0')}:${(absolute % 60).toString().padLeft(2, '0')}';
      }
    }
    return data.timezone;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _background,
    resizeToAvoidBottomInset: true,
    body: SafeArea(
      child: Column(
        children: [
          _Header(adding: widget.adding),
          const Divider(height: 1, thickness: 1, color: _gold),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                24,
                28,
                24,
                28 + MediaQuery.viewInsetsOf(context).bottom,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _intro(),
                  const SizedBox(height: 30),
                  _labelField(),
                  const SizedBox(height: 22),
                  _dateField(),
                  const SizedBox(height: 22),
                  _timeField(),
                  const SizedBox(height: 22),
                  _placeField(),
                  if (_resolved != null) ...[
                    const SizedBox(height: 12),
                    _resolvedRow(),
                  ],
                  const SizedBox(height: 24),
                  const _PrecisionCard(),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Semantics(
                      liveRegion: true,
                      child: Text(
                        _error!,
                        style: GoogleFonts.inter(
                          color: const Color(0xFFF3A4A4),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),
                  _createButton(),
                  const SizedBox(height: 19),
                  const _PrivacyFooter(),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _intro() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('✦  NATAL CHART GENERATION', style: _labelStyle(color: _champagne)),
      const SizedBox(height: 12),
      Text('Create your birth profile', style: _headingStyle()),
      const SizedBox(height: 12),
      Text(
        'Your celestial coordinates align the Vedic houses.\nPrecise details ensure true planetary degrees and\naccurate Lagna calculation.',
        style: GoogleFonts.inter(color: _slate, fontSize: 13, height: 1.55),
      ),
    ],
  );

  Widget _labelField() => _FieldGroup(
    label: 'FULL NAME',
    helper: 'As in official documents',
    child: TextField(
      key: const ValueKey('birth-profile-name'),
      controller: _label,
      textCapitalization: TextCapitalization.words,
      style: GoogleFonts.inter(color: _alabaster),
      decoration: _inputDecoration(
        hint: 'Enter your full name',
        icon: Icons.person_outline,
      ),
    ),
  );

  Widget _dateField() => _FieldGroup(
    label: 'DATE OF BIRTH',
    helper: 'DD / MM / YYYY',
    child: _PickerField(
      key: const ValueKey('birth-profile-date'),
      icon: Icons.calendar_today_outlined,
      value: _formattedDate(),
      empty: _date == null,
      onTap: _pickDate,
    ),
  );

  Widget _timeField() => _FieldGroup(
    label: 'TIME OF BIRTH',
    helper: 'Ascendant precision',
    child: Row(
      children: [
        Expanded(
          flex: 2,
          child: _PickerField(
            key: const ValueKey('birth-profile-time'),
            icon: Icons.access_time_outlined,
            value: _formattedTime(),
            empty: _time == null,
            onTap: _pickTime,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _PeriodSelector(
            selectedMorning: (_time?.hour ?? 0) < 12,
            enabled: _time != null,
            onMorning: () => _setPeriod(true),
            onEvening: () => _setPeriod(false),
          ),
        ),
      ],
    ),
  );

  Widget _placeField() => _FieldGroup(
    label: 'PLACE OF BIRTH',
    helper: 'Auto Geo-Coordinates',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: const ValueKey('birth-profile-place'),
          controller: _place,
          onChanged: _search,
          textInputAction: TextInputAction.search,
          style: GoogleFonts.inter(color: _alabaster),
          decoration: _inputDecoration(
            hint: 'Search city, district or state',
            icon: Icons.location_on_outlined,
            trailing: _searching
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: _gold,
                    ),
                  )
                : _selected == null
                ? null
                : const Icon(Icons.check_circle, color: _gold),
          ),
        ),
        if (!_searching &&
            _selected == null &&
            _resolved == null &&
            _place.text.trim().length >= 3 &&
            _results.isEmpty &&
            _error == null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              'No matching places found.',
              style: GoogleFonts.inter(color: _slate, fontSize: 12),
            ),
          ),
        ..._results.map(
          (place) => Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Material(
              color: _violet,
              borderRadius: BorderRadius.circular(13),
              child: ListTile(
                title: Text(
                  place.label,
                  style: GoogleFonts.inter(color: _alabaster, fontSize: 13),
                ),
                trailing: _selected?.id == place.id
                    ? const Icon(Icons.check_circle, color: _gold)
                    : const Icon(Icons.chevron_right, color: _slate),
                onTap: () {
                  setState(() {
                    _selected = place;
                    _place.text = place.label;
                    _results = const [];
                    _invalidateResolution();
                    _error = null;
                  });
                  _resolveWhenReady();
                },
              ),
            ),
          ),
        ),
      ],
    ),
  );

  Widget _resolvedRow() => Container(
    key: const ValueKey('resolved-birth-details'),
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
    decoration: BoxDecoration(
      color: _violet,
      borderRadius: BorderRadius.circular(13),
      border: Border.all(color: _gold.withValues(alpha: .24)),
    ),
    child: Row(
      children: [
        const Icon(Icons.gps_fixed, color: _gold, size: 17),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            _coordinates(),
            style: GoogleFonts.inter(color: _alabaster, fontSize: 11),
          ),
        ),
        Text(
          'TIMEZONE: ${_timezoneDisplay()}',
          style: _labelStyle(fontSize: 8, color: _champagne),
        ),
      ],
    ),
  );

  Widget _createButton() => SizedBox(
    height: 54,
    child: FilledButton(
      key: const ValueKey('generate-vedic-horoscope'),
      onPressed: _canCreate ? _create : null,
      style: FilledButton.styleFrom(
        backgroundColor: _gold,
        disabledBackgroundColor: _gold.withValues(alpha: .28),
        foregroundColor: _abyss,
        disabledForegroundColor: _abyss.withValues(alpha: .4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      child: _submitting
          ? const SizedBox.square(
              dimension: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: _abyss),
            )
          : Text(
              'GENERATE VEDIC HOROSCOPE  →',
              style: _labelStyle(color: _abyss),
            ),
    ),
  );

  InputDecoration _inputDecoration({
    required String hint,
    required IconData icon,
    Widget? trailing,
  }) => InputDecoration(
    hintText: hint,
    hintStyle: GoogleFonts.inter(color: _slate, fontSize: 13),
    prefixIcon: Icon(icon, color: _gold, size: 20),
    suffixIcon: trailing == null
        ? null
        : Padding(padding: const EdgeInsets.all(13), child: trailing),
    filled: true,
    fillColor: _abyss,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 17),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(15),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(15),
      borderSide: const BorderSide(color: _gold, width: 1.2),
    ),
  );
}

class _Header extends StatelessWidget {
  const _Header({required this.adding});
  final bool adding;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
    child: Row(
      children: [
        SizedBox(
          width: 42,
          height: 42,
          child: adding
              ? IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back, color: Color(0xFFFAF7F2)),
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFF181335),
                  ),
                )
              : null,
        ),
        const Spacer(),
        const Icon(Icons.auto_awesome, color: Color(0xFFC5A059), size: 17),
        const SizedBox(width: 7),
        RichText(
          text: TextSpan(
            style: GoogleFonts.ebGaramond(fontSize: 23, height: 1),
            children: const [
              TextSpan(
                text: 'Kundli',
                style: TextStyle(color: Color(0xFFFAF7F2)),
              ),
              TextSpan(
                text: 'Insights',
                style: TextStyle(
                  color: Color(0xFFC5A059),
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xFF181335),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '●  STEP 1/1',
            style: _labelStyle(fontSize: 8, color: const Color(0xFFF4BF50)),
          ),
        ),
      ],
    ),
  );
}

class _FieldGroup extends StatelessWidget {
  const _FieldGroup({
    required this.label,
    required this.helper,
    required this.child,
  });
  final String label;
  final String helper;
  final Widget child;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          Text(label, style: _labelStyle()),
          const Spacer(),
          Text(
            helper,
            style: GoogleFonts.inter(
              color: const Color(0xFF9E9AA9),
              fontSize: 10,
            ),
          ),
        ],
      ),
      const SizedBox(height: 9),
      child,
    ],
  );
}

class _PickerField extends StatelessWidget {
  const _PickerField({
    super.key,
    required this.icon,
    required this.value,
    required this.empty,
    required this.onTap,
  });
  final IconData icon;
  final String value;
  final bool empty;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: value,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(15),
      child: Container(
        height: 54,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: const Color(0xFF120D29),
          borderRadius: BorderRadius.circular(15),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFFC5A059), size: 20),
            const SizedBox(width: 12),
            Text(
              value,
              style: GoogleFonts.inter(
                color: empty
                    ? const Color(0xFF9E9AA9)
                    : const Color(0xFFFAF7F2),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _PeriodSelector extends StatelessWidget {
  const _PeriodSelector({
    required this.selectedMorning,
    required this.enabled,
    required this.onMorning,
    required this.onEvening,
  });
  final bool selectedMorning;
  final bool enabled;
  final VoidCallback onMorning;
  final VoidCallback onEvening;

  @override
  Widget build(BuildContext context) => Container(
    height: 54,
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: const Color(0xFF120D29),
      borderRadius: BorderRadius.circular(15),
    ),
    child: Row(
      children: [
        _PeriodButton(
          label: 'AM',
          selected: selectedMorning,
          enabled: enabled,
          onTap: onMorning,
        ),
        _PeriodButton(
          label: 'PM',
          selected: !selectedMorning,
          enabled: enabled,
          onTap: onEvening,
        ),
      ],
    ),
  );
}

class _PeriodButton extends StatelessWidget {
  const _PeriodButton({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(11),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected && enabled ? const Color(0xFFC5A059) : null,
          borderRadius: BorderRadius.circular(11),
        ),
        child: Text(
          label,
          style: _labelStyle(
            color: selected && enabled
                ? const Color(0xFF120D29)
                : const Color(0xFF9E9AA9),
            fontSize: 9,
          ),
        ),
      ),
    ),
  );
}

class _PrecisionCard extends StatelessWidget {
  const _PrecisionCard();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF181335),
      borderRadius: BorderRadius.circular(17),
      border: Border.all(color: const Color(0xFFC5A059).withValues(alpha: .15)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: const BoxDecoration(
            color: Color(0xFF251735),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.info_outline,
            color: Color(0xFFC5A059),
            size: 19,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Vedic Time Precision',
                style: GoogleFonts.inter(
                  color: const Color(0xFFFAF7F2),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                'Accurate birth time defines the Ascendant (Lagna) sign which shifts every two hours, unlocking exact Bhavas and planetary periods.',
                style: GoogleFonts.inter(
                  color: const Color(0xFF9E9AA9),
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

class _PrivacyFooter extends StatelessWidget {
  const _PrivacyFooter();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.lock_outline, color: Color(0xFFC5A059), size: 14),
          const SizedBox(width: 7),
          Text(
            '256-BIT VEDIC PRIVACY PROTECTED',
            style: _labelStyle(fontSize: 8, color: const Color(0xFFC5A059)),
          ),
        ],
      ),
      const SizedBox(height: 10),
      Text(
        'You can update your birth details later from your profile.',
        textAlign: TextAlign.center,
        style: GoogleFonts.inter(
          color: const Color(0xFF9E9AA9),
          fontSize: 10,
          height: 1.4,
        ),
      ),
    ],
  );
}

TextStyle _labelStyle({
  double fontSize = 10,
  Color color = const Color(0xFFFAF7F2),
}) => GoogleFonts.inter(
  color: color,
  fontSize: fontSize,
  fontWeight: FontWeight.w700,
  letterSpacing: 1.05,
);

TextStyle _headingStyle() => GoogleFonts.ebGaramond(
  color: const Color(0xFFFAF7F2),
  fontSize: 37,
  height: .98,
  fontWeight: FontWeight.w500,
);
