'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');

const CAREER_READING_INTERPRETATION_SCHEMA_VERSION =
  'career-reading-interpretation-schema-v1';
const CAREER_READING_OUTPUT_VALIDATOR_VERSION =
  'career-reading-output-validator-v1';
const TOP_LEVEL = new Set([
  'schemaVersion', 'calibrationSummary', 'recurringHistoricalEvidence',
  'upcomingRecurrenceWindows', 'decisionConsiderations', 'disclosure',
]);
const CERTAINTY = /\b(you will get promoted|you will switch jobs|you will lose your job|you will definitely|guaranteed|certain to|100%|will certainly)\b/i;
const SCORE = /\b(score|confidence|probability|rank|strength|promotionProbability|jobSwitchProbability|high probability|very likely|\d+(?:\.\d+)?% chance)\b/i;

function fail(reasonCode) {
  const error = repositoryError('READING_GENERATION_INVALID_OUTPUT');
  error.reasonCode = reasonCode;
  throw error;
}
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return plain(value) && Object.keys(value).every((key) => keys.includes(key)); }
function present(value) { return value !== undefined && value !== null; }
function validateText(value, fallbackReason) {
  if (typeof value !== 'string') fail(fallbackReason);
  if (CERTAINTY.test(value)) fail('UNSAFE_CERTAINTY_LANGUAGE');
  if (SCORE.test(value)) fail('UNSAFE_SCORE_LANGUAGE');
}
function dateEquals(source, output) {
  if (!source || !plain(output) || !exactKeys(output, ['eventId', 'precision', 'year', 'month', 'day'])) return false;
  if (output.eventId !== source.eventId || output.precision !== source.eventDate.precision || output.year !== source.eventDate.year) return false;
  if (source.eventDate.precision === 'YEAR') return !present(output.month) && !present(output.day);
  if (output.month !== source.eventDate.month) return false;
  return source.eventDate.precision === 'MONTH' ? !present(output.day) : output.day === source.eventDate.day;
}
function contextMaps(context) {
  return {
    events: new Map((context.eventReferences || []).map((item) => [item.eventId, item])),
    historical: new Map((context.historicalEvidence || []).map((item) => [item.evidenceId, item])),
    future: new Map((context.futureOccurrences || []).map((item) => [item.evidenceId, item])),
    composites: new Map((context.composites || []).map((item) => [item.evidenceId, item])),
    factors: new Set([...(context.historicalEvidence || []), ...(context.futureOccurrences || [])].flatMap((item) => (item.dimensions || []).filter((value) => typeof value === 'string'))),
  };
}
function validateFactors(item, maps) {
  if (!Array.isArray(item.factorsReferenced) || item.factorsReferenced.some((factor) => typeof factor !== 'string' || !maps.factors.has(factor))) fail('INVALID_FACTOR_REFERENCE');
}
function validateHistorical(item, maps) {
  if (!exactKeys(item, ['evidenceId', 'text', 'matchedEventCount', 'eligibleEventCount', 'recurrenceRate', 'eventDateReferences', 'factorsReferenced'])) fail('INVALID_HISTORICAL_EVIDENCE');
  validateText(item.text, 'INVALID_HISTORICAL_EVIDENCE');
  const source = maps.historical.get(item.evidenceId);
  if (!source) fail('INVALID_EVIDENCE_REFERENCE');
  validateFactors(item, maps);
  for (const key of ['matchedEventCount', 'eligibleEventCount', 'recurrenceRate']) if (present(item[key]) && item[key] !== source[key]) fail('INVALID_HISTORICAL_EVIDENCE');
  if (present(item.eventDateReferences) && (!Array.isArray(item.eventDateReferences) || item.eventDateReferences.some((value) => !dateEquals(maps.events.get(value.eventId), value)))) fail('INVALID_EVENT_DATE');
}
function validateFuture(item, maps) {
  if (!exactKeys(item, ['evidenceId', 'text', 'occurrenceType', 'from', 'to', 'instant', 'factorsReferenced'])) fail('INVALID_FUTURE_EVIDENCE');
  validateText(item.text, 'INVALID_FUTURE_EVIDENCE');
  validateFactors(item, maps);
  const source = maps.future.get(item.evidenceId) || maps.composites.get(item.evidenceId);
  if (!source) fail('INVALID_EVIDENCE_REFERENCE');
  if (maps.composites.has(item.evidenceId)) {
    if (item.occurrenceType !== 'COMPOSITE' || item.from !== source.from || item.to !== source.to || present(item.instant)) fail('INVALID_FUTURE_EVIDENCE');
    return;
  }
  if (item.occurrenceType !== source.occurrenceType) fail('INVALID_FUTURE_EVIDENCE');
  if (source.occurrenceType === 'WINDOW' && (item.from !== source.from || item.to !== source.to || present(item.instant))) fail('INVALID_FUTURE_EVIDENCE');
  if (source.occurrenceType === 'EVENT' && (item.instant !== source.instant || present(item.from) || present(item.to))) fail('INVALID_FUTURE_EVIDENCE');
}
function withoutNullOptionals(candidate) {
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (!plain(value)) return value;
    return Object.fromEntries(Object.entries(value).filter(([, child]) => child !== null).map(([key, child]) => [key, clean(child)]));
  };
  return clean(candidate);
}
function createInterpretationInput(context) {
  const maps = contextMaps(context);
  return immutableCopy({
    schemaVersion: CAREER_READING_INTERPRETATION_SCHEMA_VERSION,
    calibrationLevel: context.calibrationLevel,
    eventCount: (context.eventReferences || []).length,
    eventReferences: (context.eventReferences || []).map((item) => ({ eventId: item.eventId, eventDate: item.eventDate })),
    historicalEvidence: [...maps.historical.values()].map((item) => ({ evidenceId: item.evidenceId, matchedEventCount: item.matchedEventCount, eligibleEventCount: item.eligibleEventCount, recurrenceRate: item.recurrenceRate })),
    futureOccurrences: [...maps.future.values()].map((item) => item.occurrenceType === 'EVENT' ? ({ evidenceId: item.evidenceId, occurrenceType: item.occurrenceType, instant: item.instant }) : ({ evidenceId: item.evidenceId, occurrenceType: item.occurrenceType, from: item.from, to: item.to })),
    composites: [...maps.composites.values()].map((item) => ({ evidenceId: item.evidenceId, from: item.from, to: item.to })),
    allowedFactors: [...maps.factors].sort(),
    hasProvisionalEvidence: Boolean(context.calculationBasis && context.calculationBasis.hasProvisionalEvidence),
  });
}
class CareerReadingOutputValidator {
  validate({ context, candidate } = {}) {
    if (!plain(context) || !plain(candidate) || Object.keys(candidate).some((key) => !TOP_LEVEL.has(key)) || TOP_LEVEL.size !== Object.keys(candidate).length || candidate.schemaVersion !== CAREER_READING_INTERPRETATION_SCHEMA_VERSION) fail('INVALID_TOP_LEVEL');
    const maps = contextMaps(context); const level = context.calibrationLevel;
    if (!['NONE', 'LIMITED', 'CALIBRATED'].includes(level)) fail('INVALID_CALIBRATION_LEVEL');
    if (!exactKeys(candidate.calibrationSummary, ['calibrationLevel', 'narrative', 'eventCount'])) fail('INVALID_CALIBRATION_SUMMARY');
    if (candidate.calibrationSummary.calibrationLevel !== level) fail('INVALID_CALIBRATION_LEVEL');
    validateText(candidate.calibrationSummary.narrative, 'INVALID_CALIBRATION_SUMMARY');
    if (present(candidate.calibrationSummary.eventCount) && candidate.calibrationSummary.eventCount !== (context.eventReferences || []).length) fail('INVALID_CALIBRATION_SUMMARY');
    if (!Array.isArray(candidate.recurringHistoricalEvidence) || !Array.isArray(candidate.upcomingRecurrenceWindows)) fail('INVALID_TOP_LEVEL');
    if (!Array.isArray(candidate.decisionConsiderations) || candidate.decisionConsiderations.length > 5) fail('INVALID_DECISION_CONSIDERATIONS');
    candidate.decisionConsiderations.forEach((item) => validateText(item, 'INVALID_DECISION_CONSIDERATIONS'));
    if (!exactKeys(candidate.disclosure, ['hasProvisionalEvidence']) || typeof candidate.disclosure.hasProvisionalEvidence !== 'boolean' || candidate.disclosure.hasProvisionalEvidence !== Boolean(context.calculationBasis && context.calculationBasis.hasProvisionalEvidence)) fail('INVALID_DISCLOSURE');
    if (level !== 'CALIBRATED' && (candidate.recurringHistoricalEvidence.length || candidate.upcomingRecurrenceWindows.length)) fail('INVALID_CALIBRATION_LEVEL');
    if (candidate.recurringHistoricalEvidence.length > maps.historical.size) fail('INVALID_HISTORICAL_EVIDENCE');
    if (candidate.upcomingRecurrenceWindows.length > maps.future.size + maps.composites.size) fail('INVALID_FUTURE_EVIDENCE');
    candidate.recurringHistoricalEvidence.forEach((item) => validateHistorical(item, maps));
    candidate.upcomingRecurrenceWindows.forEach((item) => validateFuture(item, maps));
    return immutableCopy(withoutNullOptionals(candidate));
  }
}
module.exports = { CareerReadingOutputValidator, createInterpretationInput, CAREER_READING_INTERPRETATION_SCHEMA_VERSION, CAREER_READING_OUTPUT_VALIDATOR_VERSION };
