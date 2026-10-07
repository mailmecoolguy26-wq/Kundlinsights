'use strict';

// Server-side beta evaluator. It is intentionally separate from the private
// research artifacts and returns descriptive Career-signal convergence only.
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { calculateRashiHouses } = require('../../bhava');
const { scanTransitEvents } = require('../../transit-events');
const { canonicalPlanetId, classifyLayer1Bodies } = require('../../jyotish');
const { calculateAshtakavargaForLayer2 } = require('../ashtakavarga');
const { d10CareerStructure, CAREER_TRANSIT_BOUNDARY_METHOD } = require('../../orchestration/birth-career-reading-orchestrator');
const { resolveCareerNatalFactors, evaluateCareerDashaActivation, moonSupport } = require('../insights/career-generalized-timing-engine');

const BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);
const WORK_HOUSES = Object.freeze([2, 6, 10, 11]);
// Match the private convergence diagnostic horizon. This is a server-side
// policy, not a client-selectable projection range.
const HORIZON_MONTHS = 27;
const iso = (value) => new Date(value).toISOString();
const valid = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Date.parse(value.start) < Date.parse(value.end);
const intersects = (left, right) => valid(left) && valid(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end);
const freeze = (value) => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };
function birthRequest(birth, bodies) { return { date: birth.localDate, time: birth.localTime, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude, ...(bodies ? { bodies } : {}) }; }
function transitRequest(instant, birth) { const date = new Date(instant); return birthRequest({ ...birth, localDate: date.toISOString().slice(0, 10), localTime: date.toISOString().slice(11, 23), timezone: 'UTC' }, BODIES); }
function addMonths(start, months) { const date = new Date(start); date.setUTCMonth(date.getUTCMonth() + months); return date.toISOString(); }
function houseForSign(d1, sign) { const ascendant = d1.ascendant.rashi.rashiIndex; return ((sign - ascendant + 12) % 12) + 1; }
function lord(house) { return canonicalPlanetId(house && house.rashiHouseLord); }
function intervals(dasha, range) { const result = []; for (const md of dasha.periods) for (const ad of md.children) for (const pd of ad.children) { const value = { start: pd.startInstant.utc, end: pd.endInstant.utc, activePeriods: [{ level: 'MD', lord: md.lord.id }, { level: 'AD', lord: ad.lord.id }, { level: 'PD', lord: pd.lord.id }] }; if (intersects(value, range)) result.push(value); } return result; }
function transitIntervals({ engine, natal, d1, birth, range, scanner }) {
  const initial = engine.calculate(transitRequest(range.start, birth));
  const events = scanner({ startInstant: range.start, endInstant: range.end, natalBodies: natal.bodies, natalHouses: d1, astronomicalEngine: engine, observer: { latitude: birth.latitude, longitude: birth.longitude }, bodies: BODIES, eventTypes: ['rashiIngress'] }).events.filter((event) => BODIES.includes(event.body) && event.eventType === 'rashiIngress');
  const output = [];
  for (const planet of BODIES) {
    let cursor = range.start; let sign = Math.floor(initial.bodies[planet].siderealLongitudeDegrees / 30) + 1;
    for (const event of events.filter((item) => item.body === planet).sort((a, b) => a.instant.localeCompare(b.instant))) { if (Date.parse(cursor) < Date.parse(event.instant)) output.push({ planet, sign, start: cursor, end: event.instant }); cursor = event.instant; sign = event.toRashi.rashiIndex; }
    if (Date.parse(cursor) < Date.parse(range.end)) output.push({ planet, sign, start: cursor, end: range.end });
  }
  return { intervals: output, events };
}
function points(dasha, transit, range) { return [...new Set([range.start, range.end, ...dasha.flatMap((item) => [item.start, item.end]), ...transit.flatMap((item) => [item.start, item.end])].filter((value) => Date.parse(value) >= Date.parse(range.start) && Date.parse(value) <= Date.parse(range.end)))].sort(); }
function active(items, span) { return (items || []).filter((item) => intersects(item, span)); }
function dashaWorkContext(d1, periods) {
  const houses = new Map(d1.houses.map((house) => [house.houseNumber, house]));
  const assignments = new Map(d1.planetaryAssignments.map((item) => [canonicalPlanetId(item.body), item]));
  const h6Lord = lord(houses.get(6));
  const work = periods.some((period) => { const body = canonicalPlanetId(period.lord); const placement = assignments.get(body); return WORK_HOUSES.some((house) => body === lord(houses.get(house)) || (placement && placement.rashiHouseNumber === house)); });
  return { workAxisDasha: work, h6LordDasha: periods.some((period) => canonicalPlanetId(period.lord) === h6Lord) };
}
function recentIngress(events, start) { const cutoff = Date.parse(start) - 30 * 86400000; return events.filter((event) => Date.parse(event.instant) >= cutoff && Date.parse(event.instant) <= Date.parse(start)); }
function label({ careerDasha, workAxisDasha, majorTransit, h6Dasha, ingress }) {
  const families = [careerDasha || workAxisDasha, majorTransit, h6Dasha || ingress.length > 0].filter(Boolean).length;
  return families >= 3 ? 'STRONGER' : families === 2 ? 'MODERATE' : null;
}
function customerReasonCodes({ careerDasha, majorTransit, jupiterWork, supportAvailable }) {
  return [careerDasha ? 'CAREER_TIMING_ACTIVATED' : null, jupiterWork ? 'JUPITER_WORK_RELATED_AREA' : null, majorTransit ? 'MAJOR_CAREER_TRANSITS_ACTIVE' : null, supportAvailable ? 'SUPPORTING_CHART_FACTORS_ALIGN' : null].filter(Boolean);
}
function merge(items) { return items.reduce((out, item) => { const previous = out[out.length - 1]; if (previous && previous.strength === item.strength && previous.end === item.start && previous.reasonKey === item.reasonKey) { previous.end = item.end; return out; } out.push({ ...item }); return out; }, []); }

class JobFavourabilityBetaEvaluator {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, clock = () => new Date().toISOString(), transitScanner = scanTransitEvents } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler) throw new TypeError('INVALID_JOB_FAVOURABILITY_BETA_DEPENDENCIES');
    Object.assign(this, { profiles: birthProfileService, engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, clock, scanner: transitScanner }); Object.freeze(this);
  }
  async evaluate({ principal, birthProfileId, reading } = {}) {
    const profile = await this.profiles.get({ principal, birthProfileId }); if (!profile || profile.status !== 'active') return null;
    const range = { start: iso(this.clock()), end: addMonths(iso(this.clock()), HORIZON_MONTHS) };
    const natal = this.engine.calculate(birthRequest(profile.birthData));
    const d1 = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
    const dasha = intervals(calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id }), range);
    const transit = transitIntervals({ engine: this.engine, natal, d1, birth: profile.birthData, range, scanner: this.scanner });
    const factors = resolveCareerNatalFactors({ d1Houses: d1 });
    const supportAvailable = Boolean(reading && (reading.careerD10Structure || reading.careerD10Corroboration || reading.careerAshtakavargaStructure || reading.careerAshtakavargaCorroboration));
    const factualSupport = freeze({ d10Available: Boolean(reading && (reading.careerD10Structure || reading.careerD10Corroboration)), moonAvailable: Boolean(moonSupport({ d1Houses: d1, transitIntervals: transit.intervals })), ashtakavargaAvailable: Boolean(calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal))), transitBoundaryMethod: CAREER_TRANSIT_BOUNDARY_METHOD, d10StructurePresent: Boolean(d10CareerStructure(natal)) });
    const candidates = [];
    const bounds = points(dasha, transit.intervals, range);
    for (let index = 0; index < bounds.length - 1; index += 1) {
      const span = { start: bounds[index], end: bounds[index + 1] }; const dashaRow = active(dasha, span)[0]; if (!dashaRow) continue;
      const current = Object.fromEntries(BODIES.map((body) => [canonicalPlanetId(body), active(transit.intervals.filter((item) => item.planet === body), span)[0] || null]));
      const careerDasha = evaluateCareerDashaActivation({ careerNatalFactors: factors, activePeriods: dashaRow.activePeriods, d1CareerRelevant: true }).active;
      const work = dashaWorkContext(d1, dashaRow.activePeriods);
      const jupiterWork = Boolean(current.jupiter && WORK_HOUSES.includes(houseForSign(d1, current.jupiter.sign)));
      const saturnWork = Boolean(current.saturn && WORK_HOUSES.includes(houseForSign(d1, current.saturn.sign)));
      const strength = label({ careerDasha, ...work, majorTransit: jupiterWork || saturnWork, ingress: recentIngress(transit.events, span.start) });
      if (!strength) continue;
      const reasons = customerReasonCodes({ careerDasha, majorTransit: jupiterWork || saturnWork, jupiterWork, supportAvailable });
      candidates.push({ start: span.start, end: span.end, strength, reasons, reasonKey: reasons.join('|'), evidenceAgreementCount: reasons.length, factual: { careerDasha, workAxisDasha: work.workAxisDasha, h6LordDasha: work.h6LordDasha, jupiterNatalHouse: current.jupiter && houseForSign(d1, current.jupiter.sign), saturnNatalHouse: current.saturn && houseForSign(d1, current.saturn.sign), rahuNatalHouse: current.rahu && houseForSign(d1, current.rahu.sign), ketuNatalHouse: current.ketu && houseForSign(d1, current.ketu.sign) } });
    }
    const windows = merge(candidates).sort((a, b) => a.start.localeCompare(b.start)); const selected = windows.find((item) => item.strength === 'STRONGER') || windows[0] || null;
    if (!selected) return freeze({ status: 'NO_CONCENTRATED_JOB_FAVOURABILITY', range, factualSupport });
    return freeze({ status: 'SUPPORTED', range, broadWindow: freeze({ start: selected.start, end: selected.end }), strongerConcentrationWindow: null, strength: selected.strength, evidenceAgreementCount: selected.evidenceAgreementCount, evidenceReasonCodes: freeze(selected.reasons), recommendedActionCodes: freeze(['PREPARE_CAREER_MATERIALS_AND_CONVERSATIONS', 'REVIEW_PRACTICAL_ROLES_OPPORTUNITIES_AND_DECISIONS']), limitationCode: 'BETA_DESCRIPTIVE_CONVERGENCE_ONLY', factualSupport, provenance: freeze({ dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, transitBoundaryMethod: CAREER_TRANSIT_BOUNDARY_METHOD, horizonPolicy: `${HORIZON_MONTHS}_MONTH_SERVER_HORIZON`, noGenericCareerSignalUsed: true, noHistoricalRecurrenceRequired: true }) });
  }
}

module.exports = { JobFavourabilityBetaEvaluator, HORIZON_MONTHS };
