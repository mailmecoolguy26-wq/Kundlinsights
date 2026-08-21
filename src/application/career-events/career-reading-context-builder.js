'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');

const CONTEXT_VERSION = 'career-reading-context-v1';
const SELECTION_POLICY_VERSION = 'career-reading-selection-v1';
const MAX_EVENT_REFERENCES = 10;
const MAX_HISTORICAL_EVIDENCE = 12;
const MAX_FUTURE_ITEMS = 12;
function fail(code) { throw repositoryError(code); }
function dateReference(date) { const out = { precision: date.precision, year: date.year }; if (date.precision !== 'YEAR') out.month = date.month; if (date.precision === 'DAY') out.day = date.day; return out; }
function eventReference(event) { const out = { eventId: event.careerEventId, eventType: event.eventType, eventDate: dateReference(event.eventDate) }; if (event.title) out.title = event.title; return out; }
function status(value) { return value === 'PROVISIONAL' ? 'PROVISIONAL' : value || null; }
function historicalCandidate(pattern, context) {
  const evidenceId = `hist:v1:${context.contextKey}:${pattern.patternKey}`;
  return { evidenceId, patternKey: pattern.patternKey, category: pattern.category, dimensions: [...(pattern.dimensions || [])], matchedEventCount: pattern.matchedEventCount, eligibleEventCount: pattern.eligibleEventCount, recurrenceRate: pattern.recurrenceRate, sourceEventIds: (pattern.eventEvidence || []).map((item) => item.careerEventId).filter(Boolean).slice(0, MAX_EVENT_REFERENCES), provenance: { contextKey: context.contextKey, calculationStatus: status(context.contextMetadata && context.contextMetadata.calculationStatus) } };
}
function historicalOrder(left, right) { return right.matchedEventCount - left.matchedEventCount || right.recurrenceRate - left.recurrenceRate || String(left.category).localeCompare(String(right.category)) || left.evidenceId.localeCompare(right.evidenceId); }
function selectHistorical(contexts) {
  const candidates = contexts.flatMap((context) => (context.patterns || []).map((pattern) => historicalCandidate(pattern, context))).sort(historicalOrder);
  const selected = [], seenCategories = new Set();
  for (const candidate of candidates) if (!seenCategories.has(candidate.category) && selected.length < MAX_HISTORICAL_EVIDENCE) { selected.push(candidate); seenCategories.add(candidate.category); }
  for (const candidate of candidates) if (selected.length < MAX_HISTORICAL_EVIDENCE && !selected.includes(candidate)) selected.push(candidate);
  return selected;
}
function compositeCandidate(item, context) { return { evidenceId: `composite:v1:${context.contextKey}:${item.from}:${item.to}:${(item.matchedPatternKeys || []).join(',')}`, contextKey: context.contextKey, from: item.from, to: item.to, matchedPatternKeys: [...(item.matchedPatternKeys || [])], matchedPatternCount: item.matchedPatternCount, matchedPrimaryPatternCount: item.matchedPrimaryPatternCount, calculationStatus: status(context.compatibility && context.compatibility.calculationStatus || context.calculationStatus) }; }
function futureCandidate(item, context) { const temporal = item.occurrenceType === 'EVENT' ? item.instant : `${item.from}:${item.to}`; const out = { evidenceId: `future:v1:${context.contextKey}:${item.patternKey}:${item.occurrenceType}:${temporal}`, contextKey: context.contextKey, patternKey: item.patternKey, matchType: item.matchType, occurrenceType: item.occurrenceType, dimensions: [...(item.dimensions || [])], historical: { matchedEventCount: item.historicalEvidence && item.historicalEvidence.matchedEventCount, eligibleEventCount: item.historicalEvidence && item.historicalEvidence.eligibleEventCount, recurrenceRate: item.historicalEvidence && item.historicalEvidence.recurrenceRate }, calculationStatus: status(item.provenance && item.provenance.calculationStatus) }; if (item.occurrenceType === 'EVENT') out.instant = item.instant; else { out.from = item.from; out.to = item.to; } return out; }
function timeOf(item) { return item.from || item.instant || ''; }
function futureOrder(left, right) { return timeOf(left).localeCompare(timeOf(right)) || left.evidenceId.localeCompare(right.evidenceId); }
function selectFuture(contexts) {
  const compatible = contexts.filter((context) => !context.compatibility || context.compatibility.status === 'COMPATIBLE');
  const composites = compatible.flatMap((context) => (context.compositeWindows || []).map((item) => compositeCandidate(item, context))).sort(futureOrder);
  const matches = compatible.flatMap((context) => (context.matches || []).filter((item) => item.matchType === 'EXACT' && (item.occurrenceType === 'WINDOW' || item.occurrenceType === 'EVENT')).map((item) => futureCandidate(item, context))).sort(futureOrder);
  const selectedComposites = composites.slice(0, MAX_FUTURE_ITEMS);
  return { composites: selectedComposites, futureOccurrences: matches.slice(0, Math.max(0, MAX_FUTURE_ITEMS - selectedComposites.length)) };
}
function provisional(value) { return JSON.stringify(value).includes('PROVISIONAL'); }

class CareerReadingContextBuilder {
  constructor({ careerEventService, careerPatternComparisonService, careerFutureRecurrenceService } = {}) {
    if (!careerEventService || typeof careerEventService.list !== 'function' || !careerPatternComparisonService || typeof careerPatternComparisonService.get !== 'function' || !careerFutureRecurrenceService || typeof careerFutureRecurrenceService.get !== 'function') fail('INVALID_CAREER_READING_CONTEXT_BUILDER');
    this.events = careerEventService; this.patterns = careerPatternComparisonService; this.future = careerFutureRecurrenceService;
  }
  async build({ principal, birthProfileId } = {}) {
    const events = await this.events.list({ principal, birthProfileId });
    if (!Array.isArray(events)) fail('INVALID_CAREER_READING_CONTEXT_EVENTS');
    const eventReferences = events.slice(0, MAX_EVENT_REFERENCES).map(eventReference);
    const calibrationLevel = events.length === 0 ? 'NONE' : events.length === 1 ? 'LIMITED' : 'CALIBRATED';
    const base = { contextVersion: CONTEXT_VERSION, selectionPolicyVersion: SELECTION_POLICY_VERSION, birthProfileId, calibrationLevel, sourceEventIds: eventReferences.map((item) => item.eventId), eventReferences, historicalEvidence: [], futureOccurrences: [], composites: [], calculationBasis: { hasProvisionalEvidence: false }, rulesets: { p3: null, p4: null } };
    if (calibrationLevel !== 'CALIBRATED') return immutableCopy(base);
    const [p3, p4] = await Promise.all([this.patterns.get({ principal, birthProfileId }), this.future.get({ principal, birthProfileId })]);
    const historicalEvidence = selectHistorical(p3.comparisonContexts || []);
    const selectedFuture = selectFuture(p4.comparisonContexts || []);
    const out = { ...base, historicalEvidence, futureOccurrences: selectedFuture.futureOccurrences, composites: selectedFuture.composites, calculationBasis: { hasProvisionalEvidence: provisional({ p3: p3.comparisonContexts, p4: p4.comparisonContexts, provenance: p4.provenance }) }, rulesets: { p3: p3.provenance && p3.provenance.rulesetId || null, p4: p4.provenance && p4.provenance.rulesetId || null } };
    return immutableCopy(out);
  }
}

module.exports = { CareerReadingContextBuilder, CONTEXT_VERSION, SELECTION_POLICY_VERSION, MAX_EVENT_REFERENCES, MAX_HISTORICAL_EVIDENCE, MAX_FUTURE_ITEMS };
