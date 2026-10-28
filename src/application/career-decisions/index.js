'use strict';

const { verifiedPrincipal } = require('../../security/auth');

// Career decisions are a deterministic presentation layer over the existing
// saved Career reading. They deliberately do not calculate charts or let
// user-entered context manufacture timing or astrological evidence.
const CareerDecisionType = Object.freeze({
  JOB_OFFER: 'JOB_OFFER', SWITCH_JOB: 'SWITCH_JOB', COMPARE_OFFERS: 'COMPARE_OFFERS',
  PROMOTION_GROWTH: 'PROMOTION_GROWTH', START_BUSINESS: 'START_BUSINESS', CAREER_ABROAD: 'CAREER_ABROAD',
});
const DecisionState = Object.freeze({ MORE_SUPPORTIVE: 'MORE_SUPPORTIVE', SUPPORTIVE_WITH_CONDITIONS: 'SUPPORTIVE_WITH_CONDITIONS', MIXED: 'MIXED', CAUTIOUS: 'CAUTIOUS', INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE', PREMIUM_REQUIRED: 'PREMIUM_REQUIRED' });

function failure(code) { const error = new Error(code); error.code = code; return error; }
function cleanText(value, key) { if (typeof value !== 'string' || !value.trim() || value.length > 280) throw failure(`INVALID_${key}`); return value.trim(); }
function optionalText(value, key) { return value === undefined || value === null || value === '' ? null : cleanText(value, key); }
const comparePriorities = Object.freeze(['Career growth', 'Higher compensation', 'Stability', 'Better role/title', 'Learning', 'Leadership', 'Work-life balance', 'Location', 'Company/brand', 'Long-term trajectory']);
const compareMoveTypes = Object.freeze(['NEW_COMPANY', 'INTERNAL_MOVE']);
const compensationContexts = Object.freeze(['LOWER', 'SIMILAR', 'HIGHER', 'NOT_SHARED']);
function context(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw failure('INVALID_CAREER_DECISION_CONTEXT');
  const permitted = new Set(['priority', 'priorities', 'offerReceivedDate', 'joiningDate', 'moveType', 'role', 'currentSituation', 'reasons', 'activelyInterviewing', 'preferredTimeline', 'noticePeriod', 'currentRole', 'targetRole', 'workModelPreference', 'offerA', 'offerB', 'growthTypes', 'reviewDate', 'managerDiscussionStatus', 'businessStage', 'startMode', 'founderMode', 'businessReason', 'runway', 'businessCategory', 'tractionSummary', 'abroadPath', 'targetRegion', 'applicationStage', 'movementDate', 'concerns']);
  if (Object.keys(value).some((key) => !permitted.has(key))) throw failure('INVALID_CAREER_DECISION_CONTEXT');
  const list = (item, key) => item === undefined ? [] : (!Array.isArray(item) || item.length > 8 || item.some((part) => typeof part !== 'string' || !part.trim() || part.length > 80) ? (() => { throw failure(`INVALID_${key}`); })() : item.map((part) => part.trim()));
  const offer = (item, key) => {
    if (item === undefined) return null;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw failure(`INVALID_${key}`);
    const permittedOffer = new Set(['offerDate', 'joiningDate', 'role', 'moveType', 'companyLabel', 'compensationContext', 'locationOrWorkModel', 'noticePeriodImpact', 'strengths', 'concerns']);
    if (Object.keys(item).some((field) => !permittedOffer.has(field))) throw failure(`INVALID_${key}`);
    const moveType = optionalText(item.moveType, `${key}_MOVE_TYPE`);
    const compensationContext = optionalText(item.compensationContext, `${key}_COMPENSATION_CONTEXT`);
    if (moveType && !compareMoveTypes.includes(moveType)) throw failure(`INVALID_${key}_MOVE_TYPE`);
    if (compensationContext && !compensationContexts.includes(compensationContext)) throw failure(`INVALID_${key}_COMPENSATION_CONTEXT`);
    return Object.freeze({ offerDate: optionalText(item.offerDate, `${key}_OFFER_DATE`), joiningDate: optionalText(item.joiningDate, `${key}_JOINING_DATE`), role: optionalText(item.role, `${key}_ROLE`), moveType, companyLabel: optionalText(item.companyLabel, `${key}_COMPANY_LABEL`), compensationContext, locationOrWorkModel: optionalText(item.locationOrWorkModel, `${key}_WORK_MODEL`), noticePeriodImpact: optionalText(item.noticePeriodImpact, `${key}_NOTICE_PERIOD`), strengths: list(item.strengths, `${key}_STRENGTHS`), concerns: list(item.concerns, `${key}_CONCERNS`) });
  };
  return Object.freeze({ priority: optionalText(value.priority, 'PRIORITY'), priorities: list(value.priorities, 'PRIORITIES'), offerReceivedDate: optionalText(value.offerReceivedDate, 'OFFER_DATE'), joiningDate: optionalText(value.joiningDate, 'JOINING_DATE'), moveType: optionalText(value.moveType, 'MOVE_TYPE'), role: optionalText(value.role, 'ROLE'), currentSituation: optionalText(value.currentSituation, 'CURRENT_SITUATION'), reasons: list(value.reasons, 'REASONS'), activelyInterviewing: optionalText(value.activelyInterviewing, 'ACTIVELY_INTERVIEWING'), preferredTimeline: optionalText(value.preferredTimeline, 'PREFERRED_TIMELINE'), noticePeriod: optionalText(value.noticePeriod, 'NOTICE_PERIOD'), currentRole: optionalText(value.currentRole, 'CURRENT_ROLE'), targetRole: optionalText(value.targetRole, 'TARGET_ROLE'), workModelPreference: optionalText(value.workModelPreference, 'WORK_MODEL_PREFERENCE'), offerA: offer(value.offerA, 'OFFER_A'), offerB: offer(value.offerB, 'OFFER_B'), growthTypes: list(value.growthTypes, 'GROWTH_TYPES'), reviewDate: optionalText(value.reviewDate, 'REVIEW_DATE'), managerDiscussionStatus: optionalText(value.managerDiscussionStatus, 'MANAGER_DISCUSSION_STATUS'), businessStage: optionalText(value.businessStage, 'BUSINESS_STAGE'), startMode: optionalText(value.startMode, 'START_MODE'), founderMode: optionalText(value.founderMode, 'FOUNDER_MODE'), businessReason: optionalText(value.businessReason, 'BUSINESS_REASON'), runway: optionalText(value.runway, 'RUNWAY'), businessCategory: optionalText(value.businessCategory, 'BUSINESS_CATEGORY'), tractionSummary: optionalText(value.tractionSummary, 'TRACTION_SUMMARY'), abroadPath: optionalText(value.abroadPath, 'ABROAD_PATH'), targetRegion: optionalText(value.targetRegion, 'TARGET_REGION'), applicationStage: optionalText(value.applicationStage, 'APPLICATION_STAGE'), movementDate: optionalText(value.movementDate, 'MOVEMENT_DATE'), concerns: optionalText(value.concerns, 'CONCERNS') });
}
function validate(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !['decisionType', 'context', 'readingId'].includes(key))) throw failure('INVALID_CAREER_DECISION_REQUEST');
  if (!Object.values(CareerDecisionType).includes(value.decisionType)) throw failure('UNSUPPORTED_CAREER_DECISION');
  const normalizedContext = context(value.context);
  if (value.decisionType === CareerDecisionType.SWITCH_JOB) {
    const reasons = new Set(['Better compensation', 'Career growth', 'Manager/team issues', 'Role mismatch', 'Company instability', 'Work-life balance', 'Relocation', 'Better opportunity', 'Lack of learning', 'Other']);
    const interviewing = new Set(['YES', 'NO', 'EXPLORING']);
    const timelines = new Set(['IMMEDIATELY', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'NO_FIXED_TIMELINE']);
    if (!normalizedContext.reasons.length || normalizedContext.reasons.some((reason) => !reasons.has(reason)) || !interviewing.has(normalizedContext.activelyInterviewing) || !timelines.has(normalizedContext.preferredTimeline)) throw failure('INVALID_SWITCH_JOB_CONTEXT');
  }
  if (value.decisionType === CareerDecisionType.COMPARE_OFFERS) {
    const validOffer = (offer) => offer && offer.offerDate && offer.role && offer.moveType;
    if (!validOffer(normalizedContext.offerA) || !validOffer(normalizedContext.offerB) || !normalizedContext.priorities.length || normalizedContext.priorities.some((priority) => !comparePriorities.includes(priority))) throw failure('INVALID_COMPARE_OFFERS_CONTEXT');
  }
  if (value.decisionType === CareerDecisionType.PROMOTION_GROWTH) {
    const growth = new Set(['Promotion', 'Salary increase', 'Bigger responsibilities', 'Leadership role', 'Internal transfer', 'Recognition / visibility', 'Role expansion']);
    const discussions = new Set(['YES', 'NO', 'INFORMALLY', 'NOT_SURE']);
    const timelines = new Set(['THIS_MONTH', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'NO_FIXED_TIMELINE']);
    if (!normalizedContext.growthTypes.length || normalizedContext.growthTypes.some((item) => !growth.has(item)) || !discussions.has(normalizedContext.managerDiscussionStatus) || !timelines.has(normalizedContext.preferredTimeline)) throw failure('INVALID_PROMOTION_GROWTH_CONTEXT');
  }
  if (value.decisionType === CareerDecisionType.START_BUSINESS) {
    const modes = new Set(['FULL_TIME', 'ALONGSIDE_CURRENT_JOB', 'NOT_SURE']);
    const stages = new Set(['IDEA', 'RESEARCHING', 'MVP_PROTOTYPE', 'EARLY_CUSTOMERS', 'REVENUE_ALREADY', 'EXISTING_BUSINESS']);
    const timelines = new Set(['NOW', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'SIX_TO_TWELVE_MONTHS', 'NO_FIXED_TIMELINE']);
    const founders = new Set(['SOLO', 'COFOUNDER', 'NOT_DECIDED']);
    const reasons = new Set(['Independence', 'Long-term ambition', 'Income upside', 'Existing traction', 'Current job dissatisfaction', 'Opportunity identified', 'Other']);
    const runways = new Set(['UNDER_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'SIX_TO_TWELVE_MONTHS', 'TWELVE_PLUS_MONTHS', 'PREFER_NOT_TO_SAY']);
    if (!modes.has(normalizedContext.startMode) || !stages.has(normalizedContext.businessStage) || !timelines.has(normalizedContext.preferredTimeline) || !founders.has(normalizedContext.founderMode) || !reasons.has(normalizedContext.businessReason) || (normalizedContext.runway && !runways.has(normalizedContext.runway))) throw failure('INVALID_START_BUSINESS_CONTEXT');
  }
  if (value.decisionType === CareerDecisionType.CAREER_ABROAD) {
    const paths = new Set(['OVERSEAS_JOB', 'RELOCATION', 'REMOTE_FOREIGN_COMPANY', 'INTERNAL_INTERNATIONAL_TRANSFER', 'STUDY_TO_WORK']);
    const applying = new Set(['YES', 'NO', 'EXPLORING']);
    const timelines = new Set(['IMMEDIATELY', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'SIX_TO_TWELVE_MONTHS', 'NO_FIXED_TIMELINE']);
    const priorities = new Set(['Career growth', 'Compensation', 'Immigration / settlement', 'Lifestyle', 'International exposure', 'Long-term career path']);
    if (!paths.has(normalizedContext.abroadPath) || !applying.has(normalizedContext.activelyInterviewing) || !timelines.has(normalizedContext.preferredTimeline) || !priorities.has(normalizedContext.priority)) throw failure('INVALID_CAREER_ABROAD_CONTEXT');
  }
  return Object.freeze({ decisionType: value.decisionType, context: normalizedContext, ...(value.readingId === undefined ? {} : { readingId: cleanText(value.readingId, 'READING_ID') }) });
}
const practical = Object.freeze({
  [CareerDecisionType.JOB_OFFER]: ['Compare role scope, manager, compensation and joining conditions before accepting.'],
  [CareerDecisionType.SWITCH_JOB]: ['Use any supportive period to explore and interview; do not treat it as a reason to resign without a practical plan.'],
  [CareerDecisionType.COMPARE_OFFERS]: ['Compare both offers against your stated priority and their practical trade-offs.'],
  [CareerDecisionType.PROMOTION_GROWTH]: ['Prepare evidence of impact and plan growth conversations around your review process.'],
  [CareerDecisionType.START_BUSINESS]: ['Validate demand, capital runway and risk before changing stable income.'],
  [CareerDecisionType.CAREER_ABROAD]: ['Separate applications from movement planning and verify immigration requirements independently.'],
});
function title(type) { return ({ JOB_OFFER: 'Job offer', SWITCH_JOB: 'Switching jobs', COMPARE_OFFERS: 'Comparing offers', PROMOTION_GROWTH: 'Promotion and growth', START_BUSINESS: 'Starting a business', CAREER_ABROAD: 'Career abroad' })[type]; }
function listContext(context = {}) {
  const value = context && typeof context === 'object' ? context : {};
  const text = (key) => typeof value[key] === 'string' ? value[key] : null;
  const list = (key) => Array.isArray(value[key]) ? value[key].filter((item) => typeof item === 'string') : [];
  const offer = (key) => {
    const item = value[key];
    return item && typeof item === 'object'
      ? Object.freeze({ role: typeof item.role === 'string' ? item.role : null, companyLabel: typeof item.companyLabel === 'string' ? item.companyLabel : null })
      : null;
  };
  // Never expose free-form concerns, compensation, traction, or other long
  // text in list responses. Detail remains protected by its owned GET route.
  return Object.freeze({ role: text('role'), currentRole: text('currentRole'), targetRole: text('targetRole'), priority: text('priority'), priorities: list('priorities'), reasons: list('reasons'), growthTypes: list('growthTypes'), startMode: text('startMode'), businessStage: text('businessStage'), abroadPath: text('abroadPath'), targetRegion: text('targetRegion'), offerA: offer('offerA'), offerB: offer('offerB') });
}
function withinWindow(date, window) { const instant = Date.parse(date); const start = Date.parse(window.start); const end = Date.parse(window.end); return Number.isFinite(instant) && Number.isFinite(start) && Number.isFinite(end) && instant >= start && instant <= end; }
function offerTiming(offer, window) {
  if (!offer.joiningDate) return Object.freeze({ state: 'NOT_ASSESSED', message: 'No expected joining date was provided, so joining timing cannot be compared yet.' });
  if (withinWindow(offer.joiningDate, window)) return Object.freeze({ state: 'WITHIN_CURRENT_WINDOW', message: 'The expected joining date falls within the current supported Career period.' });
  return Object.freeze({ state: 'OUTSIDE_CURRENT_WINDOW', message: 'The expected joining date does not fall within the current supported Career period.' });
}
function priorityAlignment(offer, priorities) {
  if (priorities.includes('Higher compensation') && offer.compensationContext === 'HIGHER') return Object.freeze({ state: 'SUPPORTS_PRIORITY', message: 'The supplied compensation context is higher, which supports your compensation priority.' });
  if (priorities.includes('Higher compensation') && offer.compensationContext === 'LOWER') return Object.freeze({ state: 'CONFLICTS_WITH_PRIORITY', message: 'The supplied compensation context is lower, which conflicts with your compensation priority.' });
  return Object.freeze({ state: 'NOT_ASSESSED', message: 'The supplied offer details do not establish a priority-based advantage for this offer.' });
}
function compareOffers(context, window) {
  const aTiming = offerTiming(context.offerA, window);
  const bTiming = offerTiming(context.offerB, window);
  const aPriority = priorityAlignment(context.offerA, context.priorities);
  const bPriority = priorityAlignment(context.offerB, context.priorities);
  const timingScore = (result) => result.state === 'WITHIN_CURRENT_WINDOW' ? 1 : result.state === 'OUTSIDE_CURRENT_WINDOW' ? -1 : 0;
  const priorityScore = (result) => result.state === 'SUPPORTS_PRIORITY' ? 1 : result.state === 'CONFLICTS_WITH_PRIORITY' ? -1 : 0;
  const timingDifference = timingScore(aTiming) - timingScore(bTiming);
  const priorityDifference = priorityScore(aPriority) - priorityScore(bPriority);
  const hasComparableTiming = aTiming.state !== 'NOT_ASSESSED' && bTiming.state !== 'NOT_ASSESSED';
  let outcome = 'MIXED';
  if (hasComparableTiming && timingDifference === 0 && priorityDifference === 0) outcome = 'SIMILAR_ALIGNMENT';
  else if ((timingDifference > 0 && priorityDifference >= 0) || (timingDifference === 0 && priorityDifference > 0)) outcome = 'OFFER_A_MORE_ALIGNED';
  else if ((timingDifference < 0 && priorityDifference <= 0) || (timingDifference === 0 && priorityDifference < 0)) outcome = 'OFFER_B_MORE_ALIGNED';
  const timingComparison = !hasComparableTiming ? 'Joining timing cannot be compared until both expected joining dates are known.' : timingDifference > 0 ? 'Offer A falls more clearly within the current supported Career period.' : timingDifference < 0 ? 'Offer B falls more clearly within the current supported Career period.' : 'Both offers fall within broadly similar Career timing.';
  const summary = outcome === 'OFFER_A_MORE_ALIGNED' ? 'Offer A appears more aligned with the available Career timing and supplied priorities.' : outcome === 'OFFER_B_MORE_ALIGNED' ? 'Offer B appears more aligned with the available Career timing and supplied priorities.' : outcome === 'SIMILAR_ALIGNMENT' ? 'Both offers appear similarly aligned with the available Career timing and supplied priorities.' : 'The available timing and supplied practical priorities point to a mixed comparison rather than a single clear preference.';
  const detail = (offer, timing, priority) => Object.freeze({ timing, priority, strengths: offer.strengths, cautions: [...offer.concerns, ...(offer.joiningDate ? [] : ['Expected joining date is not known.'])] });
  return Object.freeze({ outcome, summary, timingComparison, offerA: detail(context.offerA, aTiming, aPriority), offerB: detail(context.offerB, bTiming, bPriority) });
}

class CareerDecisionService {
  constructor({ careerAnswerService, authUserResolver = null, birthProfileService = null, transactionExecutor = null, repositories = null, idGenerator = null, clock = null } = {}) {
    if (!careerAnswerService || typeof careerAnswerService.answer !== 'function') throw new TypeError('INVALID_CAREER_ANSWER_SERVICE');
    this.answers = careerAnswerService;
    this.auth = authUserResolver;
    this.profiles = birthProfileService;
    this.tx = transactionExecutor;
    this.repos = repositories;
    this.ids = idGenerator;
    this.clock = clock;
    this.persistenceEnabled = Boolean(this.auth && this.profiles && this.tx && typeof this.tx.execute === 'function' && this.repos && this.ids && this.clock);
  }
  async _user(principal) {
    const verified = verifiedPrincipal(principal);
    if (verified.isAnonymous) throw failure('ANONYMOUS_AUTH_NOT_ALLOWED');
    const user = await this.auth(verified);
    if (!user || user.status !== 'active') throw failure('APP_USER_DISABLED');
    return { verified, user };
  }
  async _ownedProfile(principal, birthProfileId) {
    try { return await this.profiles.get({ principal, birthProfileId }); }
    catch (_) { throw failure('NOT_FOUND_OR_FORBIDDEN'); }
  }
  async _runtime(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation: (context) => operation(this.repos(context)) }); }
  async _persist({ principal, user, birthProfileId, request, result }) {
    if (!this.persistenceEnabled) return result;
    const createdAt = this.clock();
    const decisionId = this.ids();
    const stored = await this._runtime(principal, (repositories) => {
      if (!repositories.careerDecisions || typeof repositories.careerDecisions.createDecision !== 'function') throw failure('INVALID_CAREER_DECISION_REPOSITORY');
      return repositories.careerDecisions.createDecision({ id: decisionId, userId: user.id, birthProfileId, decisionType: request.decisionType, context: request.context, result, sourceReadingId: result.sourceReadingId || null, createdAt });
    });
    return Object.freeze({ ...result, decisionId: stored.decisionId, createdAt: stored.createdAt });
  }
  async decide({ principal, birthProfileId, body } = {}) {
    const request = validate(body);
    const owner = this.persistenceEnabled ? await this._user(principal) : null;
    if (owner) await this._ownedProfile(owner.verified, birthProfileId);
    const evidence = await this.answers.answer({ principal, birthProfileId, body: { questionType: 'CAREER_ACTIVITY_TIMING', ...(request.readingId ? { readingId: request.readingId } : {}) } });
    let result;
    if (evidence.answerability === 'PREMIUM_REQUIRED') result = Object.freeze({ decisionType: request.decisionType, state: DecisionState.PREMIUM_REQUIRED, context: request.context, sourceReadingId: evidence.sourceReadingId || null, limitation: 'Career Decision Support requires TaraVerse Premium for this birth profile.' });
    else if (evidence.answerability !== 'SUPPORTED' || !evidence.answer || !evidence.answer.window) result = Object.freeze({ decisionType: request.decisionType, state: DecisionState.INSUFFICIENT_EVIDENCE, context: request.context, sourceReadingId: evidence.sourceReadingId || null, limitation: 'TaraVerse does not have enough saved Career timing evidence to give a calibrated decision view.', practicalFactors: practical[request.decisionType], detailedAstrology: { evidence: evidence.evidence || [], agreement: evidence.agreement || null } });
    else {
    const hasConditions = Boolean(request.context.concerns || request.context.reasons.length || request.context.priority || request.context.priorities.length);
    const state = hasConditions ? DecisionState.SUPPORTIVE_WITH_CONDITIONS : DecisionState.MORE_SUPPORTIVE;
    const comparison = request.decisionType === CareerDecisionType.COMPARE_OFFERS ? compareOffers(request.context, evidence.answer.window) : null;
    result = Object.freeze({ decisionType: request.decisionType, state, context: request.context, sourceReadingId: evidence.sourceReadingId, timing: evidence.answer.window, ...(request.decisionType === CareerDecisionType.SWITCH_JOB ? { timingScope: 'EXPLORE_ONLY' } : {}), ...(comparison ? { comparison } : {}), overallView: comparison ? comparison.summary : `${title(request.decisionType)} can be considered alongside the currently supported Career timing.`, supports: (evidence.evidence || []).map((item) => item.summary), cautions: hasConditions ? ['Your stated priorities and concerns remain important practical conditions.'] : [], practicalFactors: [...practical[request.decisionType], ...(request.context.priority ? [`Prioritize ${request.context.priority} when comparing practical options.`] : [])], whatToDo: practical[request.decisionType], limitation: evidence.answer.limitation, detailedAstrology: { evidence: evidence.evidence || [], agreement: evidence.agreement || null } });
    }
    return this._persist({ principal: owner ? owner.verified : principal, user: owner && owner.user, birthProfileId, request, result });
  }
  async list({ principal, birthProfileId } = {}) {
    if (!this.persistenceEnabled) throw failure('CAREER_DECISION_PERSISTENCE_UNAVAILABLE');
    const { verified, user } = await this._user(principal); await this._ownedProfile(verified, birthProfileId);
    const decisions = await this._runtime(verified, (repositories) => repositories.careerDecisions.listDecisionsForBirthProfile({ userId: user.id, birthProfileId }));
    return decisions.map((decision) => Object.freeze({ ...decision, context: listContext(decision.context) }));
  }
  async get({ principal, birthProfileId, decisionId } = {}) {
    if (!this.persistenceEnabled) throw failure('CAREER_DECISION_PERSISTENCE_UNAVAILABLE');
    const { verified, user } = await this._user(principal); await this._ownedProfile(verified, birthProfileId);
    let stored;
    try { stored = await this._runtime(verified, (repositories) => repositories.careerDecisions.getDecisionForBirthProfile({ userId: user.id, birthProfileId, decisionId })); }
    catch (error) { if (error && error.code === 'CAREER_DECISION_NOT_FOUND') throw failure('NOT_FOUND_OR_FORBIDDEN'); throw error; }
    return Object.freeze({ ...stored.result, decisionId: stored.decisionId, createdAt: stored.createdAt });
  }
}
module.exports = { CareerDecisionType, DecisionState, CareerDecisionService, validateCareerDecisionRequest: validate };
