'use strict';
const { immutableCopy, repositoryError } = require('../../persistence/contracts');

const CAREER_READING_INTERPRETATION_SCHEMA_VERSION = 'career-reading-interpretation-schema-v1';
const CAREER_READING_OUTPUT_VALIDATOR_VERSION = 'career-reading-output-validator-v1';
const TOP_LEVEL = new Set(['schemaVersion', 'calibrationSummary', 'recurringHistoricalEvidence', 'upcomingRecurrenceWindows', 'decisionConsiderations', 'disclosure']);
const CERTAINTY = /\b(you will get promoted|you will switch jobs|you will lose your job|you will definitely|guaranteed|certain to|100%|will certainly)\b/i;
const SCORE = /\b(score|confidence|probability|rank|strength|promotionProbability|jobSwitchProbability|high probability|very likely|\d+(?:\.\d+)?% chance)\b/i;
function fail() { throw repositoryError('READING_GENERATION_INVALID_OUTPUT'); }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return plain(value) && Object.keys(value).every((key) => keys.includes(key)); }
function textSafe(value) { return typeof value === 'string' && !CERTAINTY.test(value) && !SCORE.test(value); }
function dateEquals(source, output) { return Boolean(source) && plain(output) && Object.keys(output).every((key) => ['eventId', 'precision', 'year', 'month', 'day'].includes(key)) && output.eventId && output.precision === source.eventDate.precision && output.year === source.eventDate.year && (source.eventDate.precision === 'YEAR' ? !Object.hasOwn(output, 'month') && !Object.hasOwn(output, 'day') : output.month === source.eventDate.month && (source.eventDate.precision === 'MONTH' ? !Object.hasOwn(output, 'day') : output.day === source.eventDate.day)); }
function contextMaps(context) {
  return { events: new Map((context.eventReferences || []).map((item) => [item.eventId, item])), historical: new Map((context.historicalEvidence || []).map((item) => [item.evidenceId, item])), future: new Map((context.futureOccurrences || []).map((item) => [item.evidenceId, item])), composites: new Map((context.composites || []).map((item) => [item.evidenceId, item])), factors: new Set([...(context.historicalEvidence || []), ...(context.futureOccurrences || [])].flatMap((item) => (item.dimensions || []).filter((value) => typeof value === 'string'))) };
}
function validateFactors(item, maps) { if (!Array.isArray(item.factorsReferenced) || item.factorsReferenced.some((factor) => typeof factor !== 'string' || !maps.factors.has(factor))) fail(); }
function validateHistorical(item, maps) {
  if (!exactKeys(item, ['evidenceId', 'text', 'matchedEventCount', 'eligibleEventCount', 'recurrenceRate', 'eventDateReferences', 'factorsReferenced']) || !textSafe(item.text)) fail();
  const source = maps.historical.get(item.evidenceId); if (!source) fail(); validateFactors(item, maps);
  for (const key of ['matchedEventCount', 'eligibleEventCount', 'recurrenceRate']) if (Object.hasOwn(item, key) && item[key] !== source[key]) fail();
  if (Object.hasOwn(item, 'eventDateReferences') && (!Array.isArray(item.eventDateReferences) || item.eventDateReferences.some((value) => !dateEquals(maps.events.get(value.eventId), value)))) fail();
}
function validateFuture(item, maps) {
  if (!exactKeys(item, ['evidenceId', 'text', 'occurrenceType', 'from', 'to', 'instant', 'factorsReferenced']) || !textSafe(item.text)) fail(); validateFactors(item, maps);
  const source = maps.future.get(item.evidenceId) || maps.composites.get(item.evidenceId); if (!source) fail();
  if (maps.composites.has(item.evidenceId)) { if (item.occurrenceType !== 'COMPOSITE' || item.from !== source.from || item.to !== source.to || Object.hasOwn(item, 'instant')) fail(); return; }
  if (item.occurrenceType !== source.occurrenceType) fail();
  if (source.occurrenceType === 'WINDOW' && (item.from !== source.from || item.to !== source.to || Object.hasOwn(item, 'instant'))) fail();
  if (source.occurrenceType === 'EVENT' && (item.instant !== source.instant || Object.hasOwn(item, 'from') || Object.hasOwn(item, 'to'))) fail();
}
function createInterpretationInput(context) {
  const maps = contextMaps(context);
  return immutableCopy({ schemaVersion: CAREER_READING_INTERPRETATION_SCHEMA_VERSION, calibrationLevel: context.calibrationLevel, eventCount: (context.eventReferences || []).length, eventReferences: (context.eventReferences || []).map((item) => ({ eventId: item.eventId, eventDate: item.eventDate })), historicalEvidence: [...maps.historical.values()].map((item) => ({ evidenceId: item.evidenceId, matchedEventCount: item.matchedEventCount, eligibleEventCount: item.eligibleEventCount, recurrenceRate: item.recurrenceRate })), futureOccurrences: [...maps.future.values()].map((item) => item.occurrenceType === 'EVENT' ? ({ evidenceId: item.evidenceId, occurrenceType: item.occurrenceType, instant: item.instant }) : ({ evidenceId: item.evidenceId, occurrenceType: item.occurrenceType, from: item.from, to: item.to })), composites: [...maps.composites.values()].map((item) => ({ evidenceId: item.evidenceId, from: item.from, to: item.to })), allowedFactors: [...maps.factors].sort(), hasProvisionalEvidence: Boolean(context.calculationBasis && context.calculationBasis.hasProvisionalEvidence) });
}
class CareerReadingOutputValidator {
  validate({ context, candidate } = {}) {
    if (!plain(context) || !plain(candidate) || Object.keys(candidate).some((key) => !TOP_LEVEL.has(key)) || candidate.schemaVersion !== CAREER_READING_INTERPRETATION_SCHEMA_VERSION) fail();
    const maps = contextMaps(context); const level = context.calibrationLevel;
    if (!['NONE', 'LIMITED', 'CALIBRATED'].includes(level) || !exactKeys(candidate.calibrationSummary, ['calibrationLevel', 'narrative', 'eventCount']) || candidate.calibrationSummary.calibrationLevel !== level || !textSafe(candidate.calibrationSummary.narrative) || (Object.hasOwn(candidate.calibrationSummary, 'eventCount') && candidate.calibrationSummary.eventCount !== (context.eventReferences || []).length)) fail();
    if (!Array.isArray(candidate.recurringHistoricalEvidence) || !Array.isArray(candidate.upcomingRecurrenceWindows) || !Array.isArray(candidate.decisionConsiderations) || candidate.decisionConsiderations.length > 5 || candidate.decisionConsiderations.some((item) => !textSafe(item))) fail();
    if (!exactKeys(candidate.disclosure, ['hasProvisionalEvidence']) || candidate.disclosure.hasProvisionalEvidence !== Boolean(context.calculationBasis && context.calculationBasis.hasProvisionalEvidence)) fail();
    if (level !== 'CALIBRATED' && (candidate.recurringHistoricalEvidence.length || candidate.upcomingRecurrenceWindows.length)) fail();
    if (candidate.recurringHistoricalEvidence.length > maps.historical.size || candidate.upcomingRecurrenceWindows.length > maps.future.size + maps.composites.size) fail();
    candidate.recurringHistoricalEvidence.forEach((item) => validateHistorical(item, maps)); candidate.upcomingRecurrenceWindows.forEach((item) => validateFuture(item, maps));
    return immutableCopy(candidate);
  }
}
module.exports = { CareerReadingOutputValidator, createInterpretationInput, CAREER_READING_INTERPRETATION_SCHEMA_VERSION, CAREER_READING_OUTPUT_VALIDATOR_VERSION };
