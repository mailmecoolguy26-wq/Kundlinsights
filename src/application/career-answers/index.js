'use strict';

// Career Answers is a product-facing projection over an immutable Career
// Reading. It deliberately does not calculate charts, scan transits, or let a
// question change deterministic timing eligibility.
const CAREER_ANSWER_RULESET_VERSION = 'career-answer-v1';
const CareerQuestionType = Object.freeze({
  CURRENT_CAREER_PHASE: 'CURRENT_CAREER_PHASE',
  CAREER_ACTIVITY_TIMING: 'CAREER_ACTIVITY_TIMING',
  JOB_FAVOURABILITY_TIMING: 'JOB_FAVOURABILITY_TIMING',
});
const Answerability = Object.freeze({
  SUPPORTED: 'SUPPORTED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  NO_CONCENTRATED_JOB_FAVOURABILITY: 'NO_CONCENTRATED_JOB_FAVOURABILITY',
  PROJECTION_DISABLED: 'PROJECTION_DISABLED',
  UNSUPPORTED: 'UNSUPPORTED',
});
const POSSIBLE_SIGNAL = 'POSSIBLE_CAREER_ACTIVITY_SIGNAL';

function failure(code) { const error = new Error(code); error.code = code; return error; }
function requiredId(value, code) { if (typeof value !== 'string' || !value.trim() || value.length > 160) throw failure(code); return value.trim(); }
function immutable(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value); Object.values(value).forEach(immutable); return value;
}

function validateQuestionRequest(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure('INVALID_CAREER_ANSWER_REQUEST');
  if (Object.keys(value).some((key) => !['questionType', 'readingId'].includes(key))) throw failure('INVALID_CAREER_ANSWER_REQUEST');
  if (!Object.values(CareerQuestionType).includes(value.questionType)) throw failure('UNSUPPORTED_CAREER_QUESTION');
  return immutable({
    questionType: value.questionType,
    ...(value.readingId === undefined ? {} : { readingId: requiredId(value.readingId, 'INVALID_READING_ID') }),
  });
}

function supported(insights, family) {
  return Array.isArray(insights) && insights.some((item) => item && item.family === family && item.status === 'SUPPORTED');
}

function selectSignal(reading) {
  const periods = Array.isArray(reading && reading.careerTimingPeriods) ? reading.careerTimingPeriods : [];
  return periods
    .filter((item) => item && item.evidenceState === POSSIBLE_SIGNAL && typeof item.startDate === 'string' && typeof item.endDate === 'string' && Date.parse(item.startDate) < Date.parse(item.endDate))
    .slice()
    .sort((left, right) => left.startDate.localeCompare(right.startDate))[0] || null;
}

function collectEvidence(reading, signal = null) {
  const insights = Array.isArray(reading && reading.insights) ? reading.insights : [];
  const details = signal && signal.technicalDetails || {};
  const dasha = Boolean(details.dasha && Array.isArray(details.dasha.periods) && details.dasha.periods.length) || supported(insights, 'ACTIVE_CAREER_DASHA');
  const gochar = Boolean(details.gochar && Array.isArray(details.gochar) && details.gochar.length) || supported(insights, 'CURRENT_CAREER_TRANSIT') || supported(insights, 'CONCURRENT_CAREER_TIMING');
  const d1 = supported(insights, 'CAREER_FOUNDATION');
  const d10 = Boolean(details.d10 && details.d10.confirmationPresent === true) || Boolean(reading && reading.careerD10Corroboration);
  const ashtakavarga = Boolean(reading && (reading.careerAshtakavargaCorroboration || reading.careerAshtakavargaStructure));
  // Only the selected, persisted timing signal may supply historical context.
  // It is already built by the existing leakage-safe recurrence pipeline.
  const historical = Boolean(signal && typeof signal.recurrenceSummary === 'string' && signal.recurrenceSummary.trim());
  // D1, Dasha and Gochar are primary. The rest is deliberately support-only.
  const primaryEligibility = d1 && dasha && gochar;
  const evidence = [
    d1 ? { family: 'D1_CAREER_FOUNDATION', role: 'PRIMARY', summary: 'Career foundation evidence is available.' } : null,
    dasha ? { family: 'DASHA', role: 'PRIMARY', summary: 'Career-linked Dasha evidence is active.' } : null,
    gochar ? { family: 'TRANSIT', role: 'PRIMARY', summary: 'Career transit evidence is available.' } : null,
    d10 ? { family: 'D10', role: 'SUPPORT', summary: 'Career chart context is available.' } : null,
    ashtakavarga ? { family: 'ASHTAKAVARGA', role: 'SUPPORT', summary: 'Ashtakavarga context is available.' } : null,
    historical ? { family: 'HISTORICAL_PATTERN', role: 'SUPPORT', summary: 'A related historical Career pattern is available.' } : null,
  ].filter(Boolean);
  return immutable({ primaryEligibility, evidence });
}

function agreement(evidence) {
  const primary = evidence.filter((item) => item.role === 'PRIMARY');
  return immutable({
    availableMajorSignals: evidence.length,
    alignedMajorSignals: primary.length,
    primaryEligibility: primary.length === 3,
    supportSignals: evidence.filter((item) => item.role === 'SUPPORT').map((item) => item.family),
  });
}

function noReading(questionType) {
  return immutable({
    questionType,
    answerability: Answerability.INSUFFICIENT_EVIDENCE,
    answer: {
      headline: 'A Career Reading is needed first',
      summary: 'Generate a Career Reading before TaraVerse can describe supported Career context.',
      currentPhase: null,
      window: null,
      actionItems: [],
      limitation: 'TaraVerse cannot create a timing window without a saved Career Reading.',
    },
    agreement: { availableMajorSignals: 0, alignedMajorSignals: 0, primaryEligibility: false, supportSignals: [] },
    evidence: [],
    historicalContext: null,
    sourceReadingId: null,
    rulesetVersion: CAREER_ANSWER_RULESET_VERSION,
  });
}

function jobFavourabilityContract({ reading, researchEnabled }) {
  const signal = selectSignal(reading);
  const collected = collectEvidence(reading, signal);
  const historicalAvailable = Boolean(signal && typeof signal.recurrenceSummary === 'string' && signal.recurrenceSummary.trim());
  const base = {
    questionType: CareerQuestionType.JOB_FAVOURABILITY_TIMING,
    sourceReadingId: reading ? reading.readingId : null,
    broadWindow: null,
    strongerConcentrationWindow: null,
    primaryAlignment: immutable({
      careerTimingFoundation: signal ? 'PRESENT' : 'UNAVAILABLE',
      careerLinkedDasha: collected.evidence.some((item) => item.family === 'DASHA') ? 'PRESENT' : 'UNAVAILABLE',
      employmentServiceContext: 'RESEARCH_ONLY_NOT_EVALUATED',
    }),
    supportingContext: immutable({
      d10: collected.evidence.some((item) => item.family === 'D10') ? 'AVAILABLE' : 'UNAVAILABLE',
      moon: 'NOT_EVALUATED',
      ashtakavarga: collected.evidence.some((item) => item.family === 'ASHTAKAVARGA') ? 'AVAILABLE' : 'UNAVAILABLE',
      historicalRecurrence: historicalAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      jupiterSaturnGochar: collected.evidence.some((item) => item.family === 'TRANSIT') ? 'PROVISIONAL' : 'UNAVAILABLE',
      rahuKetu: 'CONTEXT_ONLY',
    }),
    signalRoles: immutable({
      base: 'EXISTING_CAREER_TIMING_FOUNDATION',
      primary: 'CAREER_LINKED_DASHA',
      employmentService: 'RESEARCH_ONLY',
      supportOnly: ['D10', 'MOON', 'ASHTAKAVARGA', 'HISTORICAL_RECURRENCE'],
      provisional: ['JUPITER_SATURN_GOCHAR'],
      contextOnly: ['RAHU_KETU'],
    }),
    provenance: immutable({
      rulesetVersion: CAREER_ANSWER_RULESET_VERSION,
      sourceTimingRulesetVersion: signal && signal.sourceRuleVersion || null,
      sourceReadingRulesetId: reading && reading.rulesetId || null,
      projectionGate: researchEnabled ? 'RESEARCH_ENABLED' : 'DISABLED',
    }),
    rulesetVersion: CAREER_ANSWER_RULESET_VERSION,
  };
  if (!reading) return immutable({
    ...base,
    answerability: Answerability.INSUFFICIENT_EVIDENCE,
    projectionStatus: 'PREREQUISITE_REQUIRED',
    limitationCode: 'CAREER_READING_REQUIRED',
  });
  if (!researchEnabled) return immutable({
    ...base,
    answerability: Answerability.PROJECTION_DISABLED,
    projectionStatus: 'DISABLED',
    limitationCode: 'JOB_FAVOURABILITY_RESEARCH_DISABLED',
  });
  // The gate alone cannot promote generic Career activity into employment
  // favourability. A separately approved evaluator will be required here.
  return immutable({
    ...base,
    answerability: Answerability.NO_CONCENTRATED_JOB_FAVOURABILITY,
    projectionStatus: 'RESEARCH_ENABLED_NO_VALIDATED_METHODOLOGY',
    limitationCode: 'EMPLOYMENT_TRANSITION_DISCRIMINATOR_NOT_VALIDATED',
  });
}

function present({ questionType, reading }) {
  if (!reading) return noReading(questionType);
  const signal = selectSignal(reading);
  const collected = collectEvidence(reading, signal);
  const history = signal && typeof signal.recurrenceSummary === 'string' && signal.recurrenceSummary.trim()
    ? { summary: signal.recurrenceSummary } : null;
  const base = {
    questionType,
    agreement: agreement(collected.evidence),
    evidence: collected.evidence,
    historicalContext: history,
    sourceReadingId: reading.readingId,
    rulesetVersion: CAREER_ANSWER_RULESET_VERSION,
  };
  if (questionType === CareerQuestionType.CURRENT_CAREER_PHASE) {
    const supported = collected.evidence.length > 0;
    return immutable({
      ...base,
      answerability: supported ? Answerability.SUPPORTED : Answerability.INSUFFICIENT_EVIDENCE,
      answer: supported ? {
        headline: 'Your current Career phase',
        summary: 'TaraVerse has current Career context from your saved reading. Use it as supportive context, alongside practical decisions and real-world information.',
        currentPhase: 'Current Career context available',
        window: null,
        actionItems: ['Review ongoing Career priorities.', 'Use practical information when making decisions.'],
        limitation: 'This describes available Career context; it does not guarantee a specific outcome.',
      } : {
        headline: 'Current Career context is limited',
        summary: 'Your saved reading does not contain enough supported Career evidence for a clearer phase description.',
        currentPhase: null,
        window: null,
        actionItems: [],
        limitation: 'TaraVerse will not manufacture a Career phase when the available evidence is limited.',
      },
    });
  }
  if (!signal || !collected.primaryEligibility) {
    return immutable({
      ...base,
      answerability: Answerability.INSUFFICIENT_EVIDENCE,
      answer: {
        headline: 'No concentrated Career activity signal is identified',
        summary: 'TaraVerse cannot determine a stronger period from the currently validated evidence.',
        currentPhase: null,
        window: null,
        actionItems: ['Keep practical Career planning active.', 'Refresh your Career Reading when you need current context.'],
        limitation: 'TaraVerse does not manufacture a timing window when primary Career timing evidence does not align.',
      },
    });
  }
  return immutable({
    ...base,
    answerability: Answerability.SUPPORTED,
    answer: {
      headline: 'Career activity is more strongly indicated during this period',
      summary: 'This period contains more of the currently supported Career timing signals.',
      currentPhase: null,
      window: { start: signal.startDate, end: signal.endDate, classification: POSSIBLE_SIGNAL },
      actionItems: ['Use this period for practical Career conversations and preparation.', 'Consider real-world role, financial, and personal factors before acting.'],
      limitation: 'This is a possible Career activity signal, not a favourable window, job-offer prediction, or guarantee.',
    },
  });
}

function shapeForAccess(answer, premium) {
  if (premium) return answer;
  const primaryEvidence = answer.evidence.filter((item) => item.role === 'PRIMARY');
  return immutable({
    ...answer,
    answer: {
      ...answer.answer,
      limitation: `${answer.answer.limitation} Detailed supporting context is available with Career Premium.`,
    },
    agreement: {
      availableMajorSignals: primaryEvidence.length,
      alignedMajorSignals: answer.agreement.primaryEligibility ? primaryEvidence.length : 0,
      primaryEligibility: answer.agreement.primaryEligibility,
      supportSignals: [],
    },
    evidence: primaryEvidence,
    historicalContext: null,
  });
}

class CareerAnswerService {
  constructor({ secureReadingService, jobFavourabilityResearchEnabled = false } = {}) {
    if (!secureReadingService || typeof secureReadingService.getReadingEntitlementStatus !== 'function' || typeof secureReadingService.listSecureReadings !== 'function' || typeof secureReadingService.getSecureReadingDetail !== 'function') throw new TypeError('INVALID_SECURE_READING_SERVICE');
    this.readings = secureReadingService;
    this.jobFavourabilityResearchEnabled = jobFavourabilityResearchEnabled === true;
  }
  async answer({ principal, birthProfileId, body } = {}) {
    const profileId = requiredId(birthProfileId, 'INVALID_BIRTH_PROFILE_ID');
    const request = validateQuestionRequest(body);
    const access = await this.readings.getReadingEntitlementStatus({ principal, birthProfileId: profileId });
    const premium = Boolean(access && access.career && access.career.eligible === true);
    const summaries = await this.readings.listSecureReadings({ principal, birthProfileId: profileId });
    const career = (Array.isArray(summaries) ? summaries : [])
      .filter((item) => item && item.domain === 'CAREER' && item.birthProfileId === profileId)
      .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)) || String(right.readingId).localeCompare(String(left.readingId)));
    const selected = request.readingId ? career.find((item) => item.readingId === request.readingId) : career[0];
    if (request.readingId && !selected) throw failure('NOT_FOUND_OR_FORBIDDEN');
    if (!selected && request.questionType === CareerQuestionType.JOB_FAVOURABILITY_TIMING) return jobFavourabilityContract({ reading: null, researchEnabled: this.jobFavourabilityResearchEnabled });
    if (!selected) return shapeForAccess(
      present({ questionType: request.questionType, reading: null }),
      premium,
    );
    const detail = await this.readings.getSecureReadingDetail({ principal, readingId: selected.readingId });
    if (!detail || detail.domain !== 'CAREER' || detail.birthProfileId !== profileId || detail.readingId !== selected.readingId) throw failure('NOT_FOUND_OR_FORBIDDEN');
    if (request.questionType === CareerQuestionType.JOB_FAVOURABILITY_TIMING) return jobFavourabilityContract({ reading: detail, researchEnabled: this.jobFavourabilityResearchEnabled });
    return shapeForAccess(
      present({ questionType: request.questionType, reading: detail }),
      premium,
    );
  }
}

module.exports = { CareerAnswerService, CareerQuestionType, Answerability, CAREER_ANSWER_RULESET_VERSION, POSSIBLE_SIGNAL, validateQuestionRequest, collectEvidence, present, shapeForAccess, jobFavourabilityContract };
