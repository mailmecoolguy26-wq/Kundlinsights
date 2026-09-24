'use strict';

const { verifiedPrincipal } = require('../../security/auth');
const { repositoryError, immutableCopy, requiredString } = require('../../persistence/contracts');
const { ReadingPayloadCodec } = require('../../security/crypto');
const { CareerAccessResolver } = require('./career-access-resolver');
const { buildCareerTechnicalContext } = require('../insights/career-technical-context');

function fail(code) { throw repositoryError(code); }
function requiredFunction(value, code) { if (typeof value !== 'function') fail(code); return value; }
function principal(value) { try { return verifiedPrincipal(value); } catch (error) { if (error && error.code) throw error; fail('INVALID_AUTH_PRINCIPAL'); } }
function safeError(error, fallback) {
  const allowed = new Set(['INVALID_AUTH_PRINCIPAL', 'UNSUPPORTED_AUTH_PROVIDER', 'ANONYMOUS_AUTH_NOT_ALLOWED', 'APP_USER_DISABLED', 'NOT_FOUND_OR_FORBIDDEN', 'ENTITLEMENT_REQUIRED', 'ENTITLEMENT_EXHAUSTED', 'IDEMPOTENCY_CONFLICT']);
  if (error && allowed.has(error.code)) throw error;
  fail(fallback);
}
function publicReading(item) { return immutableCopy({ readingId: item.readingId, domain: item.record.domain, engineProfileId: item.record.engineProfileId, createdAt: item.record.createdAt, status: item.status }); }
function publicReadingSummary(item) {
  return immutableCopy({
    readingId: item.readingId,
    birthProfileId: item.birthProfileId,
    domain: item.record.domain,
    status: item.status,
    createdAt: item.record.createdAt,
    readingInstant: item.record.input.readingInstant,
    locale: item.record.input.locale,
  });
}
function calibratedContent(record) {
  const interpretation = record && record.reading && record.reading.calibrationInterpretation;
  if (!interpretation || typeof interpretation !== 'object') return null;
  const sections = []; const add = (section, headline, items) => { if (items.length) sections.push({ section, headline, items }); };
  const summary = interpretation.calibrationSummary;
  if (summary && typeof summary.narrative === 'string') add('calibration', 'Calibration', [{ headline: 'Career calibration', sentence: summary.narrative }]);
  add('historical-patterns', 'Historical patterns', (interpretation.recurringHistoricalEvidence || []).filter((item) => item && typeof item.text === 'string').map((item) => ({ headline: 'Recurring pattern', sentence: item.text })));
  add('upcoming-periods', 'Upcoming periods', (interpretation.upcomingRecurrenceWindows || []).filter((item) => item && typeof item.text === 'string').map((item) => ({ headline: 'Upcoming period', sentence: item.text })));
  add('decision-considerations', 'Decision considerations', (interpretation.decisionConsiderations || []).filter((item) => typeof item === 'string').map((sentence) => ({ headline: 'Consideration', sentence })));
  if (interpretation.disclosure && interpretation.disclosure.hasProvisionalEvidence === true) add('calculation-note', 'Calculation note', [{ headline: 'Calculation basis', sentence: 'Some calculations use a provisional calculation basis.' }]);
  return { domain: record.domain, locale: record.input.locale, sections };
}
function publicCalibrationSummary(record) {
  const summary = record && record.reading && record.reading.calibrationInterpretation && record.reading.calibrationInterpretation.calibrationSummary;
  if (!summary || !['NONE', 'LIMITED', 'CALIBRATED'].includes(summary.calibrationLevel)) return undefined;
  return {
    calibrationLevel: summary.calibrationLevel,
    ...(Number.isInteger(summary.eventCount) ? { eventCount: summary.eventCount } : {}),
  };
}
function publicCareerAshtakavargaStructure(record) {
  const value = record && record.reading && record.reading.careerAshtakavargaStructure;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const houseValue = (item) => {
    if (!item || typeof item !== 'object' || !Number.isInteger(item.house) || item.house < 1 || item.house > 12) return null;
    const output = { house: item.house };
    if (Number.isInteger(item.sav) && item.sav >= 0) output.sav = item.sav;
    return output;
  };
  const lordValue = (item) => {
    if (!item || typeof item !== 'object' || !Number.isInteger(item.house) || item.house < 1 || item.house > 12) return null;
    if (typeof item.planet !== 'string' || !['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(item.planet)) return null;
    const output = { planet: item.planet, house: item.house };
    if (Number.isInteger(item.houseSav) && item.houseSav >= 0) output.houseSav = item.houseSav;
    return output;
  };
  const h10 = houseValue(value.h10);
  const h10Lord = lordValue(value.h10Lord);
  const h7 = houseValue(value.h7);
  const h7Lord = lordValue(value.h7Lord);
  const tenthFromH10Lord = houseValue(value.tenthFromH10Lord);
  const structure = {
    ...(h10 ? { h10 } : {}),
    ...(h10Lord ? { h10Lord } : {}),
    ...(h7 ? { h7 } : {}),
    ...(h7Lord ? { h7Lord } : {}),
    ...(tenthFromH10Lord ? { tenthFromH10Lord } : {}),
  };
  return Object.keys(structure).length ? structure : undefined;
}
function publicCareerD10Structure(record) {
  const value = record && record.reading && record.reading.careerD10Structure;
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.chart !== 'D10') return undefined;
  const planets = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']), lords = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);
  const house = (input) => Number.isInteger(input) && input >= 1 && input <= 12 ? input : null;
  const sign = (input) => input && typeof input === 'object' && Number.isInteger(input.rashiIndex) && input.rashiIndex >= 1 && input.rashiIndex <= 12 && typeof input.englishName === 'string' ? { rashiIndex: input.rashiIndex, ...(typeof input.sanskritName === 'string' ? { sanskritName: input.sanskritName } : {}), englishName: input.englishName } : null;
  const planet = (input) => { if (!input || typeof input !== 'object' || !planets.has(input.planet) || !house(input.house) || !sign(input.sign)) return null; const output = { planet: input.planet, house: input.house, sign: sign(input.sign) }; if (Number.isFinite(input.degree) && input.degree >= 0 && input.degree < 30) output.degree = input.degree; if (typeof input.retrograde === 'boolean') output.retrograde = input.retrograde; return output; };
  const aspect = (input) => input && typeof input === 'object' && planets.has(input.planet) && Number.isInteger(input.aspectNumber) && input.aspectNumber >= 3 && input.aspectNumber <= 10 ? { planet: input.planet, aspectNumber: input.aspectNumber } : null;
  const structureHouse = (input) => { if (!input || typeof input !== 'object' || !house(input.house) || !sign(input.sign)) return null; const output = { house: input.house, sign: sign(input.sign), occupants: Array.isArray(input.occupants) ? input.occupants.map(planet).filter(Boolean) : [], aspectsReceived: Array.isArray(input.aspectsReceived) ? input.aspectsReceived.map(aspect).filter(Boolean) : [] }; if (lords.has(input.lord)) output.lord = input.lord; if (house(input.lordHouse)) output.lordHouse = input.lordHouse; return output; };
  const lagna = structureHouse(value.lagna), tenthHouse = structureHouse(value.tenthHouse), shaniBody = planet(value.shani);
  if (!lagna || !tenthHouse || !shaniBody || shaniBody.planet !== 'Saturn') return undefined;
  const aspectsToHouses = Array.isArray(value.shani.aspectsToHouses) ? value.shani.aspectsToHouses.filter((item) => item && typeof item === 'object' && house(item.house) && Number.isInteger(item.aspectNumber) && item.aspectNumber >= 3 && item.aspectNumber <= 10).map((item) => ({ house: item.house, aspectNumber: item.aspectNumber })) : [];
  const aspectsToPlanets = Array.isArray(value.shani.aspectsToPlanets) ? value.shani.aspectsToPlanets.filter((item) => item && typeof item === 'object' && planets.has(item.planet) && house(item.house) && Number.isInteger(item.aspectNumber) && item.aspectNumber >= 3 && item.aspectNumber <= 10).map((item) => ({ planet: item.planet, house: item.house, aspectNumber: item.aspectNumber })) : [];
  return { chart: 'D10', lagna, tenthHouse, shani: { ...shaniBody, conjunctions: Array.isArray(value.shani.conjunctions) ? value.shani.conjunctions.map(planet).filter(Boolean) : [], aspectsToHouses, aspectsToPlanets } };
}
function publicCareerD10Corroboration(record) {
  const value = record && record.reading && record.reading.careerD10Corroboration;
  const themes = new Set(['AUTHORITY_ADMINISTRATION', 'PEOPLE_CARE_PUBLIC', 'EXECUTION_TECHNICAL', 'COMMUNICATION_COMMERCE_TECH', 'ADVISORY_KNOWLEDGE', 'DESIGN_LUXURY_CLIENT', 'STRUCTURE_OPERATIONS', 'UNCONVENTIONAL_TECH_GLOBAL', 'RESEARCH_SPECIALIZATION']);
  const planets = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
  const sources = new Set(['D10_LAGNA_OCCUPANT', 'D10_LAGNA_LORD', 'D10_TENTH_OCCUPANT', 'D10_TENTH_LORD', 'D10_SHANI']);
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.chart !== 'D10' || value.corroborates !== 'CAREER_FOUNDATION' || !Array.isArray(value.themes)) return undefined;
  const output = value.themes.map((item) => {
    if (!item || typeof item !== 'object' || !themes.has(item.theme) || item.interpretationLevel !== 'CONTEXTUAL' || item.limitation !== 'NOT_STANDALONE_PREDICTION' || !Array.isArray(item.supportingFactors)) return null;
    const supportingFactors = item.supportingFactors.filter((factor) => factor && typeof factor === 'object' && sources.has(factor.source) && planets.has(factor.planet) && Number.isInteger(factor.house) && factor.house >= 1 && factor.house <= 12).map((factor) => ({ source: factor.source, planet: factor.planet, house: factor.house }));
    return supportingFactors.length ? { theme: item.theme, supportingFactors, interpretationLevel: 'CONTEXTUAL', limitation: 'NOT_STANDALONE_PREDICTION' } : null;
  }).filter(Boolean);
  return output.length ? { chart: 'D10', corroborates: 'CAREER_FOUNDATION', themes: output } : undefined;
}
function publicCareerAshtakavargaCorroboration(record) {
  const value = record && record.reading && record.reading.careerAshtakavargaCorroboration;
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.kind !== 'H10_NATAL_CONTEXT' || value.chart !== 'D1' ||
      value.corroborates !== 'CAREER_FOUNDATION' ||
      value.limitation !== 'NOT_STANDALONE_PREDICTION') return undefined;
  const h10 = value.h10;
  if (!h10 || h10.house !== 10 || !Number.isInteger(h10.sav) || h10.sav < 0) return undefined;
  return { kind: 'H10_NATAL_CONTEXT', chart: 'D1', corroborates: 'CAREER_FOUNDATION', h10: { house: 10, sav: h10.sav }, limitation: 'NOT_STANDALONE_PREDICTION' };
}
function publicCareerEvidenceSynthesis(record) {
  const value = record && record.reading && record.reading.careerEvidenceSynthesis;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.foundation || value.foundation.family !== 'CAREER_FOUNDATION') return undefined;
  const timing = value.timing;
  if (!timing || typeof timing !== 'object' || !['activeDasha', 'currentTransit', 'concurrent', 'limited'].every((key) => typeof timing[key] === 'boolean')) return undefined;
  const output = { foundation: { family: 'CAREER_FOUNDATION' }, timing: { activeDasha: timing.activeDasha, currentTransit: timing.currentTransit, concurrent: timing.concurrent, limited: timing.limited } };
  const corroboration = value.corroboration;
  if (corroboration && corroboration.h10 && corroboration.h10.house === 10 && Number.isInteger(corroboration.h10.sav) && corroboration.h10.sav >= 0) output.corroboration = { h10: { house: 10, sav: corroboration.h10.sav } };
  const calibration = value.calibration;
  if (calibration && ['NONE', 'LIMITED', 'CALIBRATED'].includes(calibration.calibrationLevel)) output.calibration = { calibrationLevel: calibration.calibrationLevel, ...(Number.isInteger(calibration.eventCount) && calibration.eventCount >= 0 ? { eventCount: calibration.eventCount } : {}) };
  if (value.futureRecurrence && value.futureRecurrence.family === 'FUTURE_RECURRENCE_WINDOW') output.futureRecurrence = { family: 'FUTURE_RECURRENCE_WINDOW' };
  return output;
}
function publicCareerTimingPeriods(record) {
  const values = record && record.reading && record.reading.careerTimingPeriods;
  if (!Array.isArray(values)) return undefined;
  const iso = (value) => typeof value === 'string' && value.endsWith('Z') && !Number.isNaN(Date.parse(value)) ? value : null;
  const planets = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']);
  const states = new Set(['POSSIBLE_CAREER_ACTIVITY_SIGNAL', 'ASTROLOGICALLY_SUPPORTIVE_PERIOD', 'MULTIPLE_TIMING_FACTORS_CONVERGE']);
  const output = values.map((value) => {
    if (!value || typeof value !== 'object' || !states.has(value.evidenceState)) return null;
    const startDate = iso(value.startDate), endDate = iso(value.endDate);
    if (!startDate || !endDate || Date.parse(startDate) >= Date.parse(endDate) || typeof value.headline !== 'string' || typeof value.summary !== 'string' || typeof value.whatThisCanMean !== 'string' || typeof value.professionalDirection !== 'string' || typeof value.disclosure !== 'string' || typeof value.sourceRuleVersion !== 'string') return null;
    const d1 = value.technicalDetails && value.technicalDetails.d1;
    const dasha = value.technicalDetails && value.technicalDetails.dasha;
    const gochar = value.technicalDetails && value.technicalDetails.gochar;
    if (!d1 || !Number.isInteger(d1.h10Sign) || d1.h10Sign < 1 || d1.h10Sign > 12 || !planets.has(d1.h10Lord) || !dasha || !Array.isArray(dasha.qualifyingLevel) || !Array.isArray(dasha.periods) || !Array.isArray(gochar)) return null;
    const technicalDetails = {
      d1: { h10Sign: d1.h10Sign, h10Lord: d1.h10Lord, directCareerFactors: Array.isArray(d1.directCareerFactors) ? d1.directCareerFactors.filter((item) => planets.has(item)).sort() : [] },
      dasha: { qualifyingLevel: dasha.qualifyingLevel.filter((item) => ['MD', 'AD', 'PD'].includes(item)).sort(), periods: dasha.periods.filter((item) => typeof item === 'string').sort() },
      gochar: gochar.map((item) => item && planets.has(item.transitPlanet) && typeof item.target === 'string' && typeof item.activation === 'string' ? { transitPlanet: item.transitPlanet, target: item.target, ...(planets.has(item.targetPlanet) ? { targetPlanet: item.targetPlanet } : {}), activation: item.activation } : null).filter(Boolean),
      d10: { confirmationPresent: value.technicalDetails.d10 && value.technicalDetails.d10.confirmationPresent === true },
      moon: { supportPresent: value.technicalDetails.moon && value.technicalDetails.moon.supportPresent === true },
      savBav: Number.isInteger(value.technicalDetails.savBav && value.technicalDetails.savBav.h10Sav) ? { h10Sav: value.technicalDetails.savBav.h10Sav } : {},
      historicalPattern: { available: value.technicalDetails.historicalPattern && value.technicalDetails.historicalPattern.available === true, present: value.technicalDetails.historicalPattern && value.technicalDetails.historicalPattern.present === true },
      window: { startDate, endDate },
    };
    return { startDate, endDate, evidenceState: value.evidenceState, headline: value.headline, summary: value.summary, whyItems: Array.isArray(value.whyItems) ? value.whyItems.filter((item) => typeof item === 'string') : [], whatThisCanMean: value.whatThisCanMean, professionalDirection: value.professionalDirection, ...(typeof value.recurrenceSummary === 'string' ? { recurrenceSummary: value.recurrenceSummary } : {}), technicalDetails, disclosure: value.disclosure, sourceRuleVersion: value.sourceRuleVersion, longWindow: value.longWindow === true };
  }).filter(Boolean).sort((left, right) => left.startDate.localeCompare(right.startDate));
  return output;
}
function publicAshtakavargaContext(context) {
  if (!context || context.sourceFamily !== 'ASHTAKAVARGA' || !['SAV', 'BAV', 'LAGNA_BAV'].includes(context.scoreType)) return null;
  if (!Number.isInteger(context.houseNumber) || context.houseNumber < 1 || context.houseNumber > 12 || !Number.isInteger(context.rashiIndex) || context.rashiIndex < 1 || context.rashiIndex > 12 || !Number.isInteger(context.value)) return null;
  return {
    sourceFamily: 'ASHTAKAVARGA',
    scoreType: context.scoreType,
    houseNumber: context.houseNumber,
    rashiIndex: context.rashiIndex,
    value: context.value,
    ...(typeof context.planet === 'string' ? { planet: context.planet } : {}),
  };
}
function publicPlanetaryStateContext(context) {
  if (!context || context.chart !== 'D1' || typeof context.planet !== 'string' || !['RETROGRADE', 'COMBUST', 'EXALTED', 'DEBILITATED', 'OWN_SIGN', 'MOOLATRIKONA'].includes(context.state)) return null;
  return { sourceFamily: 'PLANETARY_STATE', planet: context.planet, chart: 'D1', state: context.state };
}
function publicPlanetaryRelationshipContext(context) {
  if (!context || context.sourceFamily !== 'PLANETARY_RELATIONSHIP' || context.chart !== 'D1' || typeof context.subjectPlanet !== 'string' || typeof context.targetPlanet !== 'string' || !['NATURAL', 'TEMPORARY', 'PANCHADHA'].includes(context.relationshipType) || !['friend', 'neutral', 'enemy', 'greatFriend', 'greatEnemy'].includes(context.relationship)) return null;
  return { sourceFamily: 'PLANETARY_RELATIONSHIP', subjectPlanet: context.subjectPlanet, targetPlanet: context.targetPlanet, relationshipType: context.relationshipType, relationship: context.relationship, chart: 'D1' };
}
function publicInsightTiming(timing) {
  const iso = (value) => typeof value === 'string' && value.endsWith('Z') && !Number.isNaN(Date.parse(value)) ? value : null;
  const periods = (timing && timing.dashaPeriods || []).map((item) => {
    const start = iso(item.start), end = iso(item.end);
    if (!start || !end || !['MAHADASHA', 'ANTARDASHA', 'PRATYANTAR_DASHA'].includes(item.periodLevel) || typeof item.periodPlanet !== 'string') return null;
    return { kind: 'DASHA_PERIOD', start, end, isCurrent: item.isCurrent === true, periodLevel: item.periodLevel, periodPlanet: item.periodPlanet, source: 'VIMSHOTTARI' };
  }).filter(Boolean);
  const transits = (timing && timing.transitContexts || []).map((item) => {
    const start = iso(item.start); const end = iso(item.end);
    if (!start || !['GOCHAR_SNAPSHOT', 'TRANSIT_EVENT'].includes(item.kind)) return null;
    return { kind: item.kind, start, ...(end ? { end } : {}), isCurrent: item.isCurrent === true, ...(typeof item.transitPlanet === 'string' ? { transitPlanet: item.transitPlanet } : {}), ...(typeof item.eventType === 'string' ? { eventType: item.eventType } : {}), ...(typeof item.motion === 'string' ? { motion: item.motion } : {}), ...(Number.isInteger(item.natalHouseNumber) ? { natalHouseNumber: item.natalHouseNumber } : {}), ...(typeof item.natalBody === 'string' ? { natalBody: item.natalBody } : {}), source: item.kind === 'GOCHAR_SNAPSHOT' ? 'GOCHAR' : 'TRANSIT_EVENT_SCANNER' };
  }).filter(Boolean);
  const window = timing && timing.timingWindow; const start = window && iso(window.start), end = window && iso(window.end);
  return { dashaPeriods: periods, transitContexts: transits, ...(iso(timing && timing.instant) ? { instant: timing.instant } : {}), ...(iso(timing && timing.from) ? { from: timing.from } : {}), ...(iso(timing && timing.to) ? { to: timing.to } : {}), ...(start && end ? { timingWindow: { kind: 'CAREER_TIMING_OVERLAP', start, end, isCurrent: window.isCurrent === true } } : {}), ...(timing && ['CURRENT', 'UPCOMING', 'PAST'].includes(timing.timingState) ? { timingState: timing.timingState } : {}), ...(timing && ['INDEPENDENT', 'PARTIALLY_OVERLAPPING', 'FULLY_DEPENDENT', 'IDENTICAL', 'CONTRADICTORY'].includes(timing.lineageClassification) ? { lineageClassification: timing.lineageClassification } : {}), mechanismFamilies: Array.isArray(timing && timing.mechanismFamilies) ? timing.mechanismFamilies.filter((item) => typeof item === 'string').sort() : [] };
}
function publicCalibrationEvent(event) {
  if (!event || typeof event.eventType !== 'string' || !event.eventDate || !['DAY', 'MONTH', 'YEAR'].includes(event.eventDate.precision) || !Number.isInteger(event.eventDate.year)) return null;
  const date = { precision: event.eventDate.precision, year: event.eventDate.year };
  if (date.precision !== 'YEAR' && Number.isInteger(event.eventDate.month)) date.month = event.eventDate.month;
  if (date.precision === 'DAY' && Number.isInteger(event.eventDate.day)) date.day = event.eventDate.day;
  return { eventType: event.eventType, eventDate: date };
}
function publicCalibrationContext(context) {
  if (!context || typeof context !== 'object' || !['NONE', 'LIMITED', 'CALIBRATED'].includes(context.calibrationLevel)) return null;
  const families = Array.isArray(context.mechanismFamilies) ? context.mechanismFamilies.filter((item) => ['DASHA_RECURRENCE', 'TRANSIT_RECURRENCE', 'DASHA_TRANSIT_COACTIVATION_RECURRENCE', 'CAREER_SUBJECT_RECURRENCE', 'STRUCTURAL_CONTEXT'].includes(item)).sort() : [];
  return {
    calibrationLevel: context.calibrationLevel,
    ...(Number.isInteger(context.eventCount) ? { eventCount: context.eventCount } : {}),
    ...(Number.isInteger(context.matchedEventCount) ? { matchedEventCount: context.matchedEventCount } : {}),
    matchedEvents: (context.matchedEvents || []).map(publicCalibrationEvent).filter(Boolean),
    mechanismFamilies: families,
    ...(Number.isInteger(context.patternCount) ? { patternCount: context.patternCount } : {}),
    composite: context.composite === true,
  };
}
function publicInsights(record) {
  const insights = record && record.reading && record.reading.insights;
  if (!Array.isArray(insights)) return undefined;
  return insights.map((insight) => {
    const timing = publicInsightTiming(insight.timing);
    const evidence = (insight.evidenceTrace && insight.evidenceTrace.signals || []).flatMap((signal) => signal.evidence || []);
    const charts = [...new Set(evidence.map((item) => item.chart).filter((chart) => chart === 'D10'))];
    const ashtakavarga = evidence.flatMap((item) => item.technicalContext || []).map(publicAshtakavargaContext).filter(Boolean);
    const planetaryState = evidence.flatMap((item) => item.technicalContext || []).map(publicPlanetaryStateContext).filter(Boolean);
    const planetaryRelationships = evidence.flatMap((item) => item.technicalContext || []).map(publicPlanetaryRelationshipContext).filter(Boolean);
    const calibrationContext = publicCalibrationContext(insight.calibrationContext);
    return ({
    insightId: insight.insightId,
    family: insight.family,
    titleKey: insight.titleKey,
    summaryKey: insight.summaryKey,
    displayPriority: insight.displayPriority,
    status: insight.status,
    timing,
    caveats: (insight.caveats || []).map((caveat) => ({ status: caveat.status })),
    calibrationContext,
    technicalContext: buildCareerTechnicalContext({ timing, charts, ashtakavarga, planetaryState, planetaryRelationships, calibrationContext, family: insight.family }),
    technicalDetails: { independentMechanismFamilies: insight.technicalDetails && insight.technicalDetails.independentMechanismFamilies || [] },
    evidenceTrace: { signals: [] },
  });
  });
}
function publicReadingDetail(item) { const calibrated = calibratedContent(item.record), calibrationContext = publicCalibrationSummary(item.record), careerAshtakavargaStructure = publicCareerAshtakavargaStructure(item.record), careerD10Structure = publicCareerD10Structure(item.record), careerD10Corroboration = publicCareerD10Corroboration(item.record), careerAshtakavargaCorroboration = publicCareerAshtakavargaCorroboration(item.record), careerEvidenceSynthesis = publicCareerEvidenceSynthesis(item.record), careerTimingPeriods = publicCareerTimingPeriods(item.record), insights = publicInsights(item.record); return immutableCopy({ ...publicReadingSummary(item), content: item.record.renderedReading, ...(calibrated ? { calibratedContent: calibrated } : {}), ...(calibrationContext === undefined ? {} : { calibrationContext }), ...(careerAshtakavargaStructure === undefined ? {} : { careerAshtakavargaStructure }), ...(careerD10Structure === undefined ? {} : { careerD10Structure }), ...(careerD10Corroboration === undefined ? {} : { careerD10Corroboration }), ...(careerAshtakavargaCorroboration === undefined ? {} : { careerAshtakavargaCorroboration }), ...(careerEvidenceSynthesis === undefined ? {} : { careerEvidenceSynthesis }), ...(careerTimingPeriods === undefined ? {} : { careerTimingPeriods }), ...(insights === undefined ? {} : { insights }) }); }
function scopedKeyProvider(key) { return Object.freeze({ current: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }), forVersion: async () => ({ keyVersion: key.keyVersion, dek: Buffer.from(key.dek) }) }); }
function rawRecord(raw, record) { return { readingId: raw.readingId, userId: raw.userId, birthProfileId: raw.birthProfileId, status: raw.status, archivedAt: raw.archivedAt, idempotencyKey: raw.idempotencyKey, record }; }

class SecureReadingService {
  constructor({ authUserResolver, transactionExecutor, repositories, secureBirthProfileLoader, readingCryptoCoordinator, readingGenerator, readingRecordFactory, replayReading, requiresEntitlement, careerAccessResolver = new CareerAccessResolver(), idGenerator, clock } = {}) {
    this.authUserResolver = requiredFunction(authUserResolver, 'INVALID_AUTH_USER_RESOLVER');
    this.transactions = transactionExecutor && typeof transactionExecutor.execute === 'function' ? transactionExecutor : fail('INVALID_APPLICATION_TRANSACTION_EXECUTOR');
    this.repositories = requiredFunction(repositories, 'INVALID_APPLICATION_REPOSITORIES');
    this.secureBirthProfileLoader = secureBirthProfileLoader || null;
    if (this.secureBirthProfileLoader && typeof this.secureBirthProfileLoader.get !== 'function') fail('INVALID_SECURE_BIRTH_PROFILE_LOADER');
    this.readingCrypto = readingCryptoCoordinator || null;
    if (this.readingCrypto && (typeof this.readingCrypto.current !== 'function' || typeof this.readingCrypto.forVersion !== 'function')) fail('INVALID_READING_CRYPTO_COORDINATOR');
    this.readingGenerator = readingGenerator && typeof readingGenerator.generate === 'function' ? readingGenerator : fail('INVALID_READING_GENERATOR');
    this.readingRecordFactory = requiredFunction(readingRecordFactory, 'INVALID_READING_RECORD_FACTORY');
    this.replayReading = requiredFunction(replayReading, 'INVALID_REPLAY_READING');
    this.requiresEntitlement = requiredFunction(requiresEntitlement, 'INVALID_ENTITLEMENT_POLICY');
    this.careerAccessResolver = careerAccessResolver && typeof careerAccessResolver.resolve === 'function' && typeof careerAccessResolver.resolveForProfile === 'function' ? careerAccessResolver : fail('INVALID_CAREER_ACCESS_RESOLVER');
    this.idGenerator = requiredFunction(idGenerator, 'INVALID_READING_ID');
    this.clock = requiredFunction(clock, 'INVALID_APPLICATION_CLOCK');
  }

  async resolve(principalInput) {
    const verified = principal(principalInput); if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED');
    try {
      const user = await this.authUserResolver(verified);
      if (!user || typeof user.id !== 'string' || user.status !== 'active') fail('INVALID_AUTH_PRINCIPAL');
      return { verified, user: immutableCopy({ id: user.id, status: user.status }) };
    } catch (error) { safeError(error, 'INVALID_AUTH_PRINCIPAL'); }
  }
  async execute(verified, role, operation) { return this.transactions.execute({ principal: verified, role, operation }); }
  repo(context) {
    const value = this.repositories(context);
    if (!value || !value.birthProfiles || !value.readings || !value.entitlements) fail('INVALID_APPLICATION_REPOSITORIES');
    return value;
  }
  async withKey(key, operation) { try { return await operation(new ReadingPayloadCodec({ userDekProvider: scopedKeyProvider(key) })); } finally { if (key && Buffer.isBuffer(key.dek)) key.dek.fill(0); } }
  async decryptReading(verified, raw) { const key = await this.readingCrypto.forVersion(verified, raw.userId, raw.payloadKeyVersion); const record = await this.withKey(key, (codec) => codec.decodeRecord({ userId: raw.userId, inputSnapshotCiphertext: raw.inputSnapshotCiphertext, provenanceCiphertext: raw.provenanceCiphertext, structuredReadingCiphertext: raw.structuredReadingCiphertext, renderedReadingCiphertext: raw.renderedReadingCiphertext, payloadEncryptionVersion: raw.payloadEncryptionVersion, payloadKeyVersion: raw.payloadKeyVersion, payloadAlgorithm: raw.payloadAlgorithm, inputSnapshotNonce: raw.inputSnapshotNonce, provenanceNonce: raw.provenanceNonce, structuredReadingNonce: raw.structuredReadingNonce, renderedReadingNonce: raw.renderedReadingNonce, integrityMetadata: raw.integrityMetadata, recordMetadata: raw.recordMetadata })); return rawRecord(raw, record); }
  async existing({ verified, user, idempotencyKey }) {
    if (!this.readingCrypto) return this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getReadingRecordByIdempotencyKey(user.id, idempotencyKey));
    const raw = await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getEncryptedReadingRecordByIdempotencyKey(user.id, idempotencyKey));
    return raw ? this.decryptReading(verified, raw) : null;
  }
  async generateSecureReading({ principal: principalInput, birthProfileId, domain, idempotencyKey, readingInstant, locale } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    const profileId = requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'); const key = requiredString(idempotencyKey, 'INVALID_IDEMPOTENCY_KEY'); const readingDomain = requiredString(domain, 'INVALID_READING_DOMAIN');
    const prior = await this.existing({ verified, user, idempotencyKey: key }); if (prior) return publicReading(prior);
    let profile;
    try {
      profile = this.secureBirthProfileLoader
        ? await this.secureBirthProfileLoader.get({ principal: verified, birthProfileId: profileId })
        : await this.execute(verified, 'app_runtime', async (context) => this.repo(context).birthProfiles.getBirthProfile(profileId));
      if (!profile || (!this.secureBirthProfileLoader && profile.userId !== user.id) || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
    if (this.requiresEntitlement({ domain: readingDomain })) {
      try {
        const access = await this.execute(verified, 'app_runtime', async (context) => this.careerAccessResolver.resolveForProfile({ repositories: this.repo(context), userId: user.id, birthProfileId: profileId, at: this.clock() }));
        if (!access.eligible) fail('ENTITLEMENT_EXHAUSTED');
      } catch (error) { safeError(error, 'ENTITLEMENT_EXHAUSTED'); }
    }
    let generated;
    try { generated = await this.readingGenerator.generate({ principal: verified, birthProfile: profile, domain: readingDomain, readingInstant, locale }); if (!generated || !generated.input || !generated.result) fail('READING_GENERATION_FAILED'); } catch (error) { safeError(error, 'READING_GENERATION_FAILED'); }
    let record;
    try { record = this.readingRecordFactory({ readingId: this.idGenerator(), createdAt: this.clock(), input: generated.input, result: generated.result }); } catch (error) { safeError(error, 'READING_GENERATION_FAILED'); }
    let encrypted;
    if (this.readingCrypto) {
      try { const operationKey = await this.readingCrypto.current(verified, user.id); encrypted = await this.withKey(operationKey, (codec) => codec.encodeRecord({ userId: user.id, record })); }
      catch (error) { safeError(error, 'READING_PERSISTENCE_FAILED'); }
    }
    try {
      const persisted = await this.execute(verified, 'app_runtime', async (context) => {
        const repos = this.repo(context);
        const winner = this.readingCrypto
          ? await repos.readings.getEncryptedReadingRecordByIdempotencyKey(user.id, key)
          : await repos.readings.getReadingRecordByIdempotencyKey(user.id, key);
        if (winner) return { kind: 'existing', value: winner };
        let access = null;
        if (this.requiresEntitlement({ domain: readingDomain })) {
          access = await this.careerAccessResolver.resolveForProfile({ repositories: repos, userId: user.id, birthProfileId: profile.id, at: this.clock() });
          if (!access.eligible) fail('ENTITLEMENT_EXHAUSTED');
        }
        if (access && access.consuming) {
          if (typeof context.setRole === 'function') await context.setRole('app_worker');
          await repos.entitlements.consumeEntitlement(access.sourceId, this.clock());
          if (typeof context.setRole === 'function') await context.setRole('app_runtime');
        }
        let inserted;
        if (this.readingCrypto) {
          inserted = await repos.readings.insertEncryptedReadingRecord({ userId: user.id, birthProfileId: profile.id, record, encryptedPayload: encrypted, idempotencyKey: key });
          inserted = rawRecord(inserted, record);
        } else inserted = await repos.readings.insertReadingRecord({ userId: user.id, birthProfileId: profile.id, record, idempotencyKey: key });
        return { kind: 'created', value: inserted };
      });
      const item = persisted.kind === 'existing' && this.readingCrypto ? await this.decryptReading(verified, persisted.value) : persisted.value;
      return publicReading(item);
    } catch (error) {
      if (error && error.code === 'DUPLICATE_READING_IDEMPOTENCY_KEY') { const winner = await this.existing({ verified, user, idempotencyKey: key }); if (winner) return publicReading(winner); fail('IDEMPOTENCY_CONFLICT'); }
      safeError(error, 'READING_PERSISTENCE_FAILED');
    }
  }
  async getReadingEntitlementStatus({ principal: principalInput, birthProfileId } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID');
    const domain = 'CAREER';
    if (!this.requiresEntitlement({ domain })) return immutableCopy({ career: { eligible: true } });
    try {
      const access = await this.execute(verified, 'app_runtime', async (context) => this.careerAccessResolver.resolveForProfile({ repositories: this.repo(context), userId: user.id, birthProfileId, at: this.clock() }));
      return immutableCopy({ career: { eligible: access.eligible, mode: access.mode, consuming: access.consuming } });
    } catch (error) { safeError(error, 'ENTITLEMENT_STATUS_FAILED'); }
  }
  async getSecureReading({ principal: principalInput, readingId } = {}) {
    const { verified, user } = await this.resolve(principalInput); const id = requiredString(readingId, 'INVALID_READING_ID');
    try { const item = this.readingCrypto ? await this.decryptReading(verified, await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getEncryptedReadingRecord(id))) : await this.execute(verified, 'app_runtime', async (context) => this.repo(context).readings.getReadingRecord(id)); if (!item || item.userId !== user.id) fail('NOT_FOUND_OR_FORBIDDEN'); return immutableCopy({ readingId: item.readingId, birthProfileId: item.birthProfileId, status: item.status, record: item.record }); } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
  }
  async listSecureReadings({ principal: principalInput, birthProfileId } = {}) {
    const { verified, user } = await this.resolve(principalInput);
    const profileId = birthProfileId === undefined ? null : requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID');
    if (profileId !== null) {
      try {
        const profile = this.secureBirthProfileLoader
          ? await this.secureBirthProfileLoader.get({ principal: verified, birthProfileId: profileId })
          : await this.execute(verified, 'app_runtime', async (context) => this.repo(context).birthProfiles.getBirthProfile(profileId));
        if (!profile || (!this.secureBirthProfileLoader && profile.userId !== user.id)) fail('NOT_FOUND_OR_FORBIDDEN');
      } catch (error) { safeError(error, 'NOT_FOUND_OR_FORBIDDEN'); }
    }
    try {
      const raw = await this.execute(verified, 'app_runtime', async (context) => {
        const readings = this.repo(context).readings;
        if (this.readingCrypto) {
          const method = profileId === null ? readings.listEncryptedReadingRecordsForUser : readings.listEncryptedReadingRecordsForBirthProfile;
          if (typeof method !== 'function') fail('INVALID_APPLICATION_REPOSITORIES');
          return method.call(readings, profileId === null ? user.id : profileId, 50);
        }
        const method = profileId === null ? readings.listReadingRecordsForUser : readings.listReadingRecordsForBirthProfile;
        return method.call(readings, profileId === null ? user.id : profileId).slice(0, 50);
      });
      const records = this.readingCrypto ? await Promise.all(raw.map((item) => this.decryptReading(verified, item))) : raw;
      return immutableCopy(records.filter((item) => item.userId === user.id).map(publicReadingSummary));
    } catch (error) { safeError(error, 'READING_LIST_FAILED'); }
  }
  async getSecureReadingDetail(input = {}) { return publicReadingDetail(await this.getSecureReading(input)); }
  async replaySecureReading({ principal: principalInput, readingId, astronomicalRuntime } = {}) {
    const secure = await this.getSecureReading({ principal: principalInput, readingId });
    try { return immutableCopy({ readingId: secure.readingId, replay: await this.replayReading({ record: secure.record, astronomicalRuntime }) }); } catch (error) { safeError(error, 'READING_INTEGRITY_FAILED'); }
  }
}

module.exports = { SecureReadingService };
