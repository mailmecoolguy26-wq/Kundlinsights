import '../domain/career_chat.dart';

/// Converts the public, structured contract into display copy without exposing
/// policy identifiers or deriving any astrology meaning on-device.
class CareerChatPresentation {
  const CareerChatPresentation._();

  static CareerChatAssistantPresentation fromResponse(
    CareerChatResponse response,
  ) {
    final answer = response.answer;
    final hinglish = response.language == CareerChatLanguage.hinglish;
    final clarification = response.intent.clarificationNeeded;
    final isNoReadingOutcome = answer.followUpOptions.contains(
      'Generate your Career Reading',
    );
    final followUps = answer.followUpOptions
        .where((item) => item != 'Generate your Career Reading')
        .map(
          (item) => CareerChatFollowUp(
            requestText: item,
            label: _followUpLabel(item, hinglish: hinglish),
          ),
        )
        .toList(growable: false);
    return CareerChatAssistantPresentation(
      headline: switch (answer.answerability) {
        CareerChatAnswerability.insufficientEvidence =>
          hinglish
              ? 'Abhi enough Career timing evidence available nahi hai'
              : "There isn't enough Career timing evidence available yet.",
        CareerChatAnswerability.unsupported =>
          hinglish
              ? 'Career Chat abhi job, promotion, role, salary, switch aur Career timing questions par focused hai.'
              : 'Career Chat currently focuses on job, promotion, role, salary, switch, and Career timing questions.',
        _ => answer.headlineFact,
      },
      body: switch (answer.answerability) {
        CareerChatAnswerability.insufficientEvidence =>
          hinglish
              ? 'Aapke available Career data se is question ka supported timing window abhi determine nahi kiya ja sakta.'
              : 'Your available Career data is not enough to determine a supported timing window for this question.',
        CareerChatAnswerability.partiallySupported when !clarification =>
          hinglish
              ? 'Kuch relevant Career evidence available hai, lekin full conclusion ko support karne ke liye evidence enough nahi hai.'
              : 'Some relevant Career evidence is available, but it does not support the full conclusion.',
        _ => null,
      },
      timingWindows: answer.timingWindows,
      evidence: _safeHumanStrings(answer.evidenceSummary),
      caveats: _safeHumanStrings(answer.caveats),
      followUps: followUps,
      shouldOfferGeneration: isNoReadingOutcome,
    );
  }

  static List<String> _safeHumanStrings(List<String> items) => items
      .where((item) => !_isTechnicalIdentifier(item))
      .toList(growable: false);

  static bool _isTechnicalIdentifier(String value) =>
      RegExp(r'^[A-Z][A-Z0-9_]*$').hasMatch(value.trim());

  static String _followUpLabel(String value, {required bool hinglish}) {
    if (!hinglish) return value;
    return switch (value) {
      'Show my next Career timing window' =>
        'Mera next Career timing window dikhao',
      'Compare current vs upcoming Career period' =>
        'Current aur upcoming Career period compare karo',
      'Show current Career timing' => 'Mera current Career timing dikhao',
      'Check job-switch timing' => 'Job-switch timing check karo',
      _ => value,
    };
  }
}

class CareerChatFollowUp {
  const CareerChatFollowUp({required this.requestText, required this.label});
  final String requestText;
  final String label;
}

class CareerChatAssistantPresentation {
  const CareerChatAssistantPresentation({
    required this.headline,
    required this.body,
    required this.timingWindows,
    required this.evidence,
    required this.caveats,
    required this.followUps,
    required this.shouldOfferGeneration,
  });
  final String headline;
  final String? body;
  final List<Map<String, dynamic>> timingWindows;
  final List<String> evidence;
  final List<String> caveats;
  final List<CareerChatFollowUp> followUps;
  final bool shouldOfferGeneration;
}
