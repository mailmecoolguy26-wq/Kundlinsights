import 'career_reading_presentation_copy.dart';

/// Presentation-only normalization for server-owned Career evidence.
/// It never derives a date, classification, or astrology conclusion.
class CareerEvidenceFormatter {
  const CareerEvidenceFormatter(this.copy);

  final CareerReadingPresentationCopy copy;

  String evidenceState(String value) => switch (value) {
    'POSSIBLE_CAREER_ACTIVITY_SIGNAL' =>
      copy.isHinglish ? 'Career activity support' : 'Career activity signal',
    'ASTROLOGICALLY_SUPPORTIVE_PERIOD' =>
      copy.isHinglish ? 'Supportive Career period' : 'Supportive Career period',
    'MULTIPLE_TIMING_FACTORS_CONVERGE' =>
      copy.isHinglish
          ? 'Multiple timing factors aligned'
          : 'Multiple timing factors aligned',
    _ => copy.isHinglish ? 'Career timing context' : 'Career timing context',
  };

  String dashaLevel(String value) => switch (value) {
    'MD' || 'MAHADASHA' => 'Mahadasha',
    'AD' || 'ANTARDASHA' => 'Antardasha',
    'PD' || 'PRATYANTAR_DASHA' => 'Pratyantardasha',
    'MD_AD' => 'Mahadasha–Antardasha pattern',
    _ => 'Dasha context',
  };

  String mechanism(String value) => switch (value) {
    'MD' || 'DASHA_MD' => 'Mahadasha pattern',
    'AD' || 'DASHA_AD' => 'Antardasha pattern',
    'PD' || 'DASHA_PD' => 'Pratyantardasha pattern',
    'MD_AD' || 'DASHA_MD_AD' => 'Mahadasha–Antardasha pattern',
    'TRANSIT' ||
    'GOCHAR' => copy.isHinglish ? 'Gochar pattern' : 'Transit pattern',
    'ASHTAKAVARGA' => 'Ashtakavarga context',
    _ => 'Career timing pattern',
  };

  String customerText(String value) {
    var output = value
        .replaceAll(
          'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
          evidenceState('POSSIBLE_CAREER_ACTIVITY_SIGNAL'),
        )
        .replaceAll('MD_AD', 'Mahadasha–Antardasha pattern')
        .replaceAll(RegExp(r'\bMD\b'), 'Mahadasha')
        .replaceAll(RegExp(r'\bAD\b'), 'Antardasha')
        .replaceAll(RegExp(r'\bPD\b'), 'Pratyantardasha');
    if (RegExp(r'[A-Z][A-Z0-9_]+\|').hasMatch(output)) {
      return copy.isHinglish
          ? 'Aapki Career History mein similar timing pattern repeat hua.'
          : 'A similar timing pattern appeared in your Career history.';
    }
    const planets = {
      'SATURN': 'Saturn',
      'JUPITER': 'Jupiter',
      'MARS': 'Mars',
      'MERCURY': 'Mercury',
      'VENUS': 'Venus',
      'SUN': 'Sun',
      'MOON': 'Moon',
      'RAHU': 'Rahu',
      'KETU': 'Ketu',
    };
    output = output.replaceAllMapped(RegExp(r'\b[A-Z][A-Z0-9_]{2,}\b'), (
      match,
    ) {
      final token = match.group(0)!;
      if (token == 'D1' || token == 'D10') return token;
      if (planets[token] case final planet?) return copy.planet(planet);
      final words = token.toLowerCase().split('_');
      return '${words.first[0].toUpperCase()}${words.first.substring(1)}${words.length > 1 ? ' ${words.skip(1).join(' ')}' : ''}';
    });
    return output;
  }
}
