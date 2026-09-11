enum CareerChatRole { user, assistant }

enum CareerChatLanguage { english, hinglish }

enum CareerChatAnswerability {
  supported,
  partiallySupported,
  insufficientEvidence,
  unsupported,
}

class CareerChatContextMessage {
  const CareerChatContextMessage({required this.role, required this.text});
  final CareerChatRole role;
  final String text;

  Map<String, dynamic> toJson() => {
    'role': role == CareerChatRole.user ? 'USER' : 'ASSISTANT',
    'text': text,
  };
}

class CareerChatRequest {
  const CareerChatRequest({
    required this.message,
    required this.conversationContext,
    required this.language,
  });
  final String message;
  final List<CareerChatContextMessage> conversationContext;
  final CareerChatLanguage language;

  Map<String, dynamic> toJson() => {
    'message': message,
    'conversationContext': conversationContext
        .map((item) => item.toJson())
        .toList(),
    'language': language == CareerChatLanguage.hinglish
        ? 'HINGLISH'
        : 'ENGLISH',
  };
}

class CareerChatIntent {
  const CareerChatIntent({
    required this.type,
    this.referencedEvent,
    this.clarificationNeeded = false,
  });
  final String type;
  final String? referencedEvent;
  final bool clarificationNeeded;

  factory CareerChatIntent.fromJson(Map<String, dynamic> json) {
    final type = json['type'];
    if (type is! String || type.isEmpty) {
      throw const FormatException('Malformed Career Chat intent.');
    }
    return CareerChatIntent(
      type: type,
      referencedEvent: json['referencedEvent'] is String
          ? json['referencedEvent'] as String
          : null,
      clarificationNeeded: json['clarificationNeeded'] == true,
    );
  }
}

class CareerChatAnswer {
  const CareerChatAnswer({
    required this.answerability,
    required this.headlineFact,
    required this.timingWindows,
    required this.evidenceSummary,
    required this.caveats,
    required this.followUpOptions,
  });
  final CareerChatAnswerability answerability;
  final String headlineFact;
  final List<Map<String, dynamic>> timingWindows;
  final List<String> evidenceSummary;
  final List<String> caveats;
  final List<String> followUpOptions;

  factory CareerChatAnswer.fromJson(Map<String, dynamic> json) {
    final answerability = _answerability(json['answerability']);
    final headline = json['headlineFact'];
    if (answerability == null || headline is! String || headline.isEmpty) {
      throw const FormatException('Malformed Career Chat answer.');
    }
    return CareerChatAnswer(
      answerability: answerability,
      headlineFact: headline,
      timingWindows: _maps(json['timingWindows']),
      evidenceSummary: _strings(json['evidenceSummary']),
      caveats: _strings(json['caveats']),
      followUpOptions: _strings(json['followUpOptions']),
    );
  }
}

class CareerChatResponse {
  const CareerChatResponse({
    required this.profileId,
    required this.domain,
    required this.intent,
    required this.answer,
    required this.language,
    this.renderedAnswer,
  });
  final String profileId;
  final String domain;
  final CareerChatIntent intent;
  final CareerChatAnswer answer;
  final CareerChatLanguage language;
  final CareerChatRenderedAnswer? renderedAnswer;

  factory CareerChatResponse.fromJson(Map<String, dynamic> json) {
    final profileId = json['profileId'];
    final domain = json['domain'];
    final intent = json['intent'];
    final answer = json['answer'];
    final language = json['language'];
    if (profileId is! String ||
        profileId.isEmpty ||
        domain != 'CAREER' ||
        intent is! Map<String, dynamic> ||
        answer is! Map<String, dynamic>) {
      throw const FormatException('Malformed Career Chat response.');
    }
    return CareerChatResponse(
      profileId: profileId,
      domain: domain,
      intent: CareerChatIntent.fromJson(intent),
      answer: CareerChatAnswer.fromJson(answer),
      language: language == 'HINGLISH'
          ? CareerChatLanguage.hinglish
          : CareerChatLanguage.english,
      renderedAnswer: json['renderedAnswer'] is Map<String, dynamic>
          ? CareerChatRenderedAnswer.tryFromJson(
              json['renderedAnswer'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class CareerChatRenderedAnswer {
  const CareerChatRenderedAnswer({
    required this.message,
    required this.followUpLabels,
  });
  final String message;
  final List<String> followUpLabels;
  static CareerChatRenderedAnswer? tryFromJson(Map<String, dynamic> json) {
    final message = json['message'];
    final labels = json['followUpLabels'];
    if (message is! String ||
        message.trim().isEmpty ||
        message.length > 1500 ||
        labels is! List ||
        !labels.every(
          (x) => x is String && x.trim().isNotEmpty && x.length <= 160,
        )) {
      return null;
    }
    return CareerChatRenderedAnswer(
      message: message,
      followUpLabels: List.unmodifiable(labels.cast<String>()),
    );
  }
}

CareerChatAnswerability? _answerability(Object? value) => switch (value) {
  'SUPPORTED' => CareerChatAnswerability.supported,
  'PARTIALLY_SUPPORTED' => CareerChatAnswerability.partiallySupported,
  'INSUFFICIENT_EVIDENCE' => CareerChatAnswerability.insufficientEvidence,
  'UNSUPPORTED' => CareerChatAnswerability.unsupported,
  _ => null,
};

List<String> _strings(Object? value) => value is List
    ? List.unmodifiable(
        value.whereType<String>().where((item) => item.isNotEmpty),
      )
    : const [];

List<Map<String, dynamic>> _maps(Object? value) => value is List
    ? List.unmodifiable(
        value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)),
      )
    : const [];
