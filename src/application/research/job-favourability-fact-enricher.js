'use strict';

// Offline/private enrichment only. This module is deliberately not imported by
// API composition, Career Answers, readings, or mobile code.
const { calculateRashiHouses } = require('../../bhava');
const { classifyLayer1Bodies } = require('../../jyotish');
const { evaluatePlanetaryState } = require('../../dignity');
const { calculateAshtakavargaForLayer2 } = require('../ashtakavarga');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { scanTransitEvents } = require('../../transit-events');
const { d10CareerStructure, CAREER_TRANSIT_BOUNDARY_METHOD } = require('../../orchestration/birth-career-reading-orchestrator');
const { resolveCareerNatalFactors, scanCareerTimingWindows, moonSupport } = require('../insights/career-generalized-timing-engine');

const TRANSIT_BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);
const STATUS = Object.freeze({ CALCULATED: 'CALCULATED', UNAVAILABLE: 'UNAVAILABLE', NOT_APPLICABLE: 'NOT_APPLICABLE' });

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function request(birth) { return { date: birth.localDate, time: birth.localTime, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }; }
function utcRequest(instant, birth, bodies) { const d = new Date(instant); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 23), timezone: 'UTC', latitude: birth.latitude, longitude: birth.longitude, ...(bodies ? { bodies } : {}) }; }
function validInterval(value) { return value && typeof value.start === 'string' && typeof value.end === 'string' && Date.parse(value.start) < Date.parse(value.end); }
function eventRange(events) {
  const points = events.flatMap((event) => (event.observations || []).map((item) => item.temporalCoverage)).filter(validInterval);
  if (!points.length) throw new TypeError('Private research enrichment requires event coverage.');
  const min = Math.min(...points.map((item) => Date.parse(item.start))) - (90 * 86400000);
  const max = Math.max(...points.map((item) => Date.parse(item.end))) + (90 * 86400000);
  return { start: new Date(min).toISOString(), end: new Date(max).toISOString() };
}
function dashaIntervals(dasha, range) {
  const start = BigInt(Date.parse(range.start)); const end = BigInt(Date.parse(range.end)); const rows = [];
  for (const md of dasha.periods) for (const ad of md.children) for (const pd of ad.children) {
    const pdStart = BigInt(pd.startInstant.epochMilliseconds); const pdEnd = BigInt(pd.endInstant.epochMilliseconds);
    if (pdStart >= end || pdEnd <= start) continue;
    rows.push({ start: new Date(Number(pdStart > start ? pdStart : start)).toISOString(), end: new Date(Number(pdEnd < end ? pdEnd : end)).toISOString(), activePeriods: [{ level: 'MD', lord: md.lord.id }, { level: 'AD', lord: ad.lord.id }, { level: 'PD', lord: pd.lord.id }] });
  }
  return rows.sort((a, b) => a.start.localeCompare(b.start));
}
function transitFacts({ astronomicalEngine, natal, houses, birth, range }) {
  const initial = astronomicalEngine.calculate(utcRequest(range.start, birth, TRANSIT_BODIES));
  const scan = scanTransitEvents({ startInstant: range.start, endInstant: range.end, natalBodies: natal.bodies, natalHouses: houses, astronomicalEngine, observer: { latitude: birth.latitude, longitude: birth.longitude }, bodies: TRANSIT_BODIES, eventTypes: ['rashiIngress'] });
  const intervals = [];
  for (const planet of TRANSIT_BODIES) {
    let cursor = range.start;
    let sign = Math.floor(initial.bodies[planet].siderealLongitudeDegrees / 30) + 1;
    for (const event of scan.events.filter((item) => item.body === planet && item.eventType === 'rashiIngress').sort((a, b) => a.instant.localeCompare(b.instant))) {
      if (Date.parse(cursor) < Date.parse(event.instant)) intervals.push({ planet, sign, start: cursor, end: event.instant, boundaryMethod: CAREER_TRANSIT_BOUNDARY_METHOD });
      cursor = event.instant; sign = event.toRashi.rashiIndex;
    }
    if (Date.parse(cursor) < Date.parse(range.end)) intervals.push({ planet, sign, start: cursor, end: range.end, boundaryMethod: CAREER_TRANSIT_BOUNDARY_METHOD });
  }
  return { transitIntervals: intervals, transitEvents: scan.events.filter((item) => TRANSIT_BODIES.includes(item.body)).map((item) => ({ body: item.body, eventType: item.eventType, instant: item.instant, fromRashi: item.fromRashi, toRashi: item.toRashi })) };
}
function diagnostic(family, error) { return freeze({ family, status: STATUS.UNAVAILABLE, failureReason: error && error.code ? String(error.code) : error && error.constructor ? error.constructor.name : 'CALCULATION_FAILED' }); }
function calculated(family) { return freeze({ family, status: STATUS.CALCULATED }); }

function enrichPrivateResearchProfile({ profile, astronomicalEngine, canonicalSiderealSunSampler } = {}) {
  if (!profile || !profile.birth || !astronomicalEngine || !canonicalSiderealSunSampler) throw new TypeError('Private research fact enrichment requires profile, astronomy engine, and canonical Sun sampler.');
  const diagnostics = []; const coverage = {};
  let natal; let d1Houses;
  try {
    natal = astronomicalEngine.calculate(request(profile.birth));
    d1Houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
    coverage.natal = calculated('natal');
  } catch (error) {
    diagnostics.push(diagnostic('natal', error)); coverage.natal = diagnostics.at(-1);
    return freeze({ profile: null, diagnostics: freeze(diagnostics), calculationCoverage: freeze(coverage) });
  }
  const range = eventRange(profile.canonicalEvents);
  const output = { birthProfileId: profile.pseudonymousProfileId, events: profile.canonicalEvents, d1Houses };
  const derive = (family, callback) => {
    try { Object.assign(output, callback()); coverage[family] = calculated(family); }
    catch (error) { const item = diagnostic(family, error); diagnostics.push(item); coverage[family] = item; }
  };
  derive('dasha', () => {
    const dasha = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
    return { dashaIntervals: dashaIntervals(dasha, range) };
  });
  derive('transits', () => transitFacts({ astronomicalEngine, natal, houses: d1Houses, birth: profile.birth, range }));
  derive('d10', () => ({ d10Facts: d10CareerStructure(natal) }));
  derive('moon', () => {
    if (!output.transitIntervals) throw new TypeError('DEPENDENT_TRANSIT_FACTS_UNAVAILABLE');
    return { moonSupportFacts: moonSupport({ d1Houses, transitIntervals: output.transitIntervals }) };
  });
  derive('ashtakavarga', () => ({ ashtakavargaFacts: calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal)) }));
  derive('planetaryState', () => ({ planetaryStateFacts: evaluatePlanetaryState({ bodies: Object.fromEntries(Object.entries(classifyLayer1Bodies(natal)).map(([body, item]) => [body, { canonicalSiderealLongitudeDegrees: item.siderealLongitudeDegrees, motion: item.motion || 'unknown' }])) }) }));
  derive('genericCareerSignal', () => {
    if (!output.dashaIntervals || !output.transitIntervals) throw new TypeError('DEPENDENT_FACTS_UNAVAILABLE');
    const scan = scanCareerTimingWindows({ careerNatalFactors: resolveCareerNatalFactors({ d1Houses }), d1Houses, d1CareerRelevant: true, dashaIntervals: output.dashaIntervals, transitIntervals: output.transitIntervals, horizonStart: range.start, horizonEnd: range.end });
    return { genericCareerSignals: scan.windows.map((item) => ({ start: item.start, end: item.end, evidenceState: 'POSSIBLE_CAREER_ACTIVITY_SIGNAL' })) };
  });
  // Recurrence remains strictly prior in the extractor. A calculated empty list
  // means no historical-comparison evidence was supplied by an earlier event;
  // it must never be interpreted as a negative result.
  output.recurrenceEvidence = [];
  coverage.recurrence = freeze({ family: 'recurrence', status: STATUS.UNAVAILABLE, failureReason: 'NO_COMPARABLE_PRIOR_PATTERN' });
  diagnostics.push(coverage.recurrence);
  output.astronomyProvenance = { engineProfileId: natal.provider && natal.provider.providerId || 'private-research-engine', ayanamshaSystem: natal.sidereal && natal.sidereal.ayanamshaSystem || null, nodePolicy: natal.provider && natal.provider.nodePolicy || null, calculationStatus: natal.calculationStatus || null, dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, transitBoundaryMethod: CAREER_TRANSIT_BOUNDARY_METHOD, factSource: 'ENGINE_CALCULATED_PRIVATE_RESEARCH' };
  output.calculationDiagnostics = freeze(diagnostics);
  output.calculationCoverage = freeze(coverage);
  return freeze({ profile: freeze(output), diagnostics: freeze(diagnostics), calculationCoverage: freeze(coverage) });
}

module.exports = { STATUS, TRANSIT_BODIES, dashaIntervals, transitFacts, enrichPrivateResearchProfile };
