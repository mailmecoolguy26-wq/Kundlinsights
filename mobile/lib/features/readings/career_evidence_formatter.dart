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
        .replaceAll(RegExp(r'Guru Dev', caseSensitive: false), 'Jupiter')
        .replaceAll(RegExp(r'Shani Dev', caseSensitive: false), 'Saturn')
        .replaceAll(RegExp(r'\bMangal\b', caseSensitive: false), 'Mars')
        .replaceAll(
          RegExp(r'casts 5th aspect to', caseSensitive: false),
          'activates through its 5th aspect',
        )
        .replaceAll(
          RegExp(r'casts 10th aspect to', caseSensitive: false),
          'activates through its 10th aspect',
        )
        .replaceAll(
          RegExp(r'supplied deterministic evidence', caseSensitive: false),
          'available Career evidence',
        )
        .replaceAll(
          RegExp(r'source data', caseSensitive: false),
          'available context',
        )
        .replaceAll(
          'POSSIBLE_CAREER_ACTIVITY_SIGNAL',
          evidenceState('POSSIBLE_CAREER_ACTIVITY_SIGNAL'),
        )
        .replaceAll('MD_AD', 'Mahadasha–Antardasha pattern')
        .replaceAll(RegExp(r'\bMD\b'), 'Mahadasha')
        .replaceAll(RegExp(r'\bAD\b'), 'Antardasha')
        .replaceAll(RegExp(r'\bPD\b'), 'Pratyantardasha');
    output = output.replaceAllMapped(
      RegExp(
        r'\b(Jupiter|Saturn|Mars|Rahu|Ketu) ka Gochar 10th-house Career axis par activates through its (\d+(?:st|nd|rd|th)) aspect hai\.?',
        caseSensitive: false,
      ),
      (match) {
        final planet = _canonicalPlanet(match.group(1)!);
        final aspect = match.group(2)!;
        return copy.isHinglish
            ? '$planet ka Gochar Career axis ko $aspect drishti se activate kar raha hai.'
            : '$planet transit is activating the Career axis through its $aspect aspect.';
      },
    );
    output = output.replaceAllMapped(
      RegExp(
        r'\b(Ketu|Mars|Jupiter|Saturn|Mercury|Venus|Rahu) Pratyantar Dasha Career structure se connected hai\.?',
        caseSensitive: false,
      ),
      (match) {
        final planet = _canonicalPlanet(match.group(1)!);
        return copy.isHinglish
            ? '$planet Pratyantardasha Career-related factors ke saath align ho rahi hai.'
            : '$planet Pratyantardasha aligns with Career-related factors.';
      },
    );
    output = output.replaceAll(
      RegExp(
        r'D10 professional theme ko factual structural context ke roop mein dikhata hai\.?',
        caseSensitive: false,
      ),
      copy.isHinglish
          ? 'D10 chart is period ko additional professional context deta hai.'
          : 'The D10 chart adds professional context to this period.',
    );
    if (RegExp(
      r'\b(?:saturn|jupiter|mars|mercury|venus|sun|moon|rahu|ketu)\|(?:saturn|jupiter|mars|mercury|venus|sun|moon|rahu|ketu)\b',
      caseSensitive: false,
    ).hasMatch(output)) {
      return copy.isHinglish
          ? 'Aapki Career History mein similar timing pattern repeat hua.'
          : 'A similar timing pattern appeared in your Career history.';
    }
    output = output.replaceAllMapped(
      RegExp(
        r'\b(saturn|jupiter|mars|mercury|venus|sun|moon|rahu|ketu)\b',
        caseSensitive: false,
      ),
      (match) =>
          '${match.group(0)![0].toUpperCase()}${match.group(0)!.substring(1).toLowerCase()}',
    );
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

  String _canonicalPlanet(String value) =>
      '${value[0].toUpperCase()}${value.substring(1).toLowerCase()}';
}
