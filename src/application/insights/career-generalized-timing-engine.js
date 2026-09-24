'use strict';

// Phase 2G: an internal owner-approved contract. It consumes canonical D1,
// Dasha, and supplied transit facts; it performs no astronomy or I/O and is not
// wired into projection, readings, chat, or mobile presentation.
const { FULL_ASPECTS_BY_GRAHA } = require('../../drishti/reference-data');
const { freeze } = require('../../synthesis/evidence-node');

const CAREER_GENERALIZED_TIMING_RULESET_ID = 'taraverse-career-generalized-timing-v1';
const MAJOR_WINDOW_PLANETS = freeze(['Jupiter', 'Saturn']);
const REVIEW_ONLY_MAJOR_CONTEXT = freeze(['Rahu', 'Ketu']);
const SHORT_TRIGGER_PLANETS = freeze(['Sun', 'Mars', 'Mercury', 'Venus']);
const FAST_CONTEXT_PLANETS = freeze(['Moon']);
const RELEVANCE_RULE_IDS = freeze([
  'career-h10-signification-scope-v1',
  'career-h10-lord-natal-connection-v1',
  'career-h10-occupant-connection-v1',
]);
const DASHA_RULE_ID = 'career-h10-connected-dasha-activation-v1';
const GOCHAR_RULE_ID = 'career-gochar-activation-owner-v1';

const validSign = (value) => Number.isInteger(value) && value >= 1 && value <= 12;
const validHouse = validSign;
const stable = (values) => [...new Set(values)].sort((left, right) => {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
});
const at = (source, offset) => ((source - 1 + offset) % 12) + 1;
const interval = (value) => value && typeof value.start === 'string' && typeof value.end === 'string' && Date.parse(value.start) < Date.parse(value.end);

function assignmentMap(d1) {
  return new Map((Array.isArray(d1 && d1.planetaryAssignments) ? d1.planetaryAssignments : [])
    .filter((item) => item && typeof item.body === 'string' && item.rashi && validSign(item.rashi.rashiIndex) && validHouse(item.rashiHouseNumber))
    .map((item) => [item.body, item]));
}

function fullAspectTargets(planet, sourceHouse) {
  return (FULL_ASPECTS_BY_GRAHA[planet] || []).map((definition) => ({
    house: at(sourceHouse, definition.rashiOffset), aspectNumber: definition.aspectNumber,
  }));
}

function resolveCareerNatalFactors({ d1Houses } = {}) {
  const houses = Array.isArray(d1Houses && d1Houses.houses) ? d1Houses.houses : [];
  const h10 = houses.find((item) => item && item.houseNumber === 10);
  const tenthLord = typeof (h10 && h10.rashiHouseLord) === 'string'
    ? h10.rashiHouseLord
    : h10 && h10.rashiHouseLord && typeof h10.rashiHouseLord.name === 'string'
      ? h10.rashiHouseLord.name
      : null;
  if (!h10 || !h10.rashi || !validSign(h10.rashi.rashiIndex) || !tenthLord) {
    throw new TypeError('Career natal factors require canonical D1 H10 and its lord.');
  }
  const assignments = assignmentMap(d1Houses);
  const lord = assignments.get(tenthLord);
  if (!lord) throw new TypeError('Career natal factors require the canonical D1 H10 lord placement.');
  const occupants = [...assignments.values()].filter((item) => item.rashiHouseNumber === 10).map((item) => item.body).sort();
  const tenthHouseAspectors = [...assignments.values()].flatMap((item) => fullAspectTargets(item.body, item.rashiHouseNumber)
    .filter((aspect) => aspect.house === 10).map((aspect) => ({ planet: item.body, aspectNumber: aspect.aspectNumber })))
    .sort((a, b) => `${a.planet}|${a.aspectNumber}`.localeCompare(`${b.planet}|${b.aspectNumber}`));
  const tenthLordConjunctions = [...assignments.values()].filter((item) => item.body !== lord.body && item.rashiHouseNumber === lord.rashiHouseNumber).map((item) => item.body).sort();
  const tenthLordAspectors = [...assignments.values()].flatMap((item) => fullAspectTargets(item.body, item.rashiHouseNumber)
    .filter((aspect) => aspect.house === lord.rashiHouseNumber).map((aspect) => ({ planet: item.body, aspectNumber: aspect.aspectNumber })))
    .sort((a, b) => `${a.planet}|${a.aspectNumber}`.localeCompare(`${b.planet}|${b.aspectNumber}`));
  const reasons = new Map();
  const add = (planet, reason, ruleId) => {
    if (!reasons.has(planet)) reasons.set(planet, { planet, relevanceReasons: [], matchedRuleIds: [] });
    const item = reasons.get(planet); item.relevanceReasons.push(reason); item.matchedRuleIds.push(ruleId);
  };
  add(lord.body, 'D1_H10_LORD', 'career-h10-lord-natal-connection-v1');
  occupants.forEach((planet) => add(planet, 'D1_H10_OCCUPANT', 'career-h10-occupant-connection-v1'));
  tenthHouseAspectors.forEach(({ planet }) => add(planet, 'D1_H10_FULL_ASPECT', 'career-h10-occupant-connection-v1'));
  tenthLordConjunctions.forEach((planet) => add(planet, 'D1_H10_LORD_CONJUNCTION', 'career-h10-lord-natal-connection-v1'));
  tenthLordAspectors.forEach(({ planet }) => add(planet, 'D1_H10_LORD_FULL_ASPECT', 'career-h10-lord-natal-connection-v1'));
  const relevantPlanets = [...reasons.values()].map((item) => freeze({ planet: item.planet, relevanceReasons: freeze(stable(item.relevanceReasons)), matchedRuleIds: freeze(stable(item.matchedRuleIds)) })).sort((a, b) => a.planet.localeCompare(b.planet));
  return freeze({
    tenthHouseSign: h10.rashi.rashiIndex,
    tenthLord: lord.body,
    tenthLordNatalSign: lord.rashi.rashiIndex,
    tenthLordNatalHouse: lord.rashiHouseNumber,
    tenthHouseOccupants: freeze(occupants), tenthHouseAspectors: freeze(tenthHouseAspectors.map(freeze)),
    tenthLordConjunctions: freeze(tenthLordConjunctions), tenthLordAspectors: freeze(tenthLordAspectors.map(freeze)),
    relevantPlanets: freeze(relevantPlanets), relevantSigns: freeze(stable([h10.rashi.rashiIndex, lord.rashi.rashiIndex])),
    matchedRuleIds: RELEVANCE_RULE_IDS,
    evidenceRefs: freeze([{ source: 'D1_H10', house: 10 }, { source: 'D1_H10_LORD', planet: lord.body, house: lord.rashiHouseNumber }]),
  });
}

function evaluateCareerDashaActivation({ careerNatalFactors, activePeriods = [], d1CareerRelevant = false } = {}) {
  const relevant = new Map((careerNatalFactors && careerNatalFactors.relevantPlanets || []).map((item) => [item.planet, item]));
  const matches = (Array.isArray(activePeriods) ? activePeriods : []).filter((period) => period && ['MD', 'AD', 'PD'].includes(period.level) && relevant.has(period.lord))
    .map((period) => freeze({ level: period.level, lord: period.lord, activatedCareerFactors: relevant.get(period.lord).relevanceReasons, matchedRuleIds: [DASHA_RULE_ID] }))
    .sort((a, b) => a.level.localeCompare(b.level) || a.lord.localeCompare(b.lord));
  const byLevel = (level) => matches.filter((item) => item.level === level);
  return freeze({ active: d1CareerRelevant === true && matches.length > 0, mdEvidence: freeze(byLevel('MD')), adEvidence: freeze(byLevel('AD')), pdEvidence: freeze(byLevel('PD')), activatedCareerFactors: freeze(stable(matches.flatMap((item) => item.activatedCareerFactors))), matchedRuleIds: freeze(matches.length ? [DASHA_RULE_ID] : []) });
}

function targets(factors, assignments) {
  const result = [{ targetType: 'D1_H10_SIGN', targetPlanet: null, targetSign: factors.tenthHouseSign }];
  for (const item of factors.relevantPlanets || []) {
    const placement = assignments.get(item.planet);
    if (placement) result.push({ targetType: item.planet === factors.tenthLord ? 'D1_H10_LORD' : 'D1_APPROVED_RELEVANT_PLANET', targetPlanet: item.planet, targetSign: placement.rashi.rashiIndex });
  }
  return result.sort((a, b) => `${a.targetType}|${a.targetPlanet || ''}`.localeCompare(`${b.targetType}|${b.targetPlanet || ''}`));
}

function transitActivatesTarget(transit, target) {
  const activations = [];
  if (transit.sign === target.targetSign) {
    activations.push('SIGN_OCCUPANCY');
    if (target.targetPlanet && transit.planet !== target.targetPlanet) activations.push('CONJUNCTION');
  }
  for (const aspect of (FULL_ASPECTS_BY_GRAHA[transit.planet] || [])) if (at(transit.sign, aspect.rashiOffset) === target.targetSign) activations.push('FULL_SIGN_ASPECT');
  return stable(activations);
}

function evaluateCareerGocharActivations({ careerNatalFactors, d1Houses, careerDashaActivation, d1CareerRelevant = false, transitIntervals = [] } = {}) {
  if (d1CareerRelevant !== true || !careerDashaActivation || careerDashaActivation.active !== true) return freeze([]);
  const assignments = assignmentMap(d1Houses); const targetList = targets(careerNatalFactors, assignments); const result = [];
  for (const transit of Array.isArray(transitIntervals) ? transitIntervals : []) {
    if (!transit || typeof transit.planet !== 'string' || !validSign(transit.sign) || !interval(transit)) continue;
    for (const target of targetList) for (const activationType of transitActivatesTarget(transit, target)) result.push(freeze({
      transitPlanet: transit.planet, targetType: target.targetType, targetPlanet: target.targetPlanet, targetSign: target.targetSign, activationType,
      start: transit.start, end: transit.end, matchedRuleIds: freeze([GOCHAR_RULE_ID]), evidenceRefs: freeze([{ source: 'SUPPLIED_TRANSIT_INTERVAL', planet: transit.planet }]),
    }));
  }
  return freeze(result.sort((a, b) => `${a.start}|${a.transitPlanet}|${a.targetType}|${a.activationType}`.localeCompare(`${b.start}|${b.transitPlanet}|${b.targetType}|${b.activationType}`)));
}

function overlap(left, right) { return Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end); }
function boundedInterval(value, boundary) {
  if (!interval(value) || !interval(boundary) || !overlap(value, boundary)) return null;
  return { ...value, start: Date.parse(value.start) > Date.parse(boundary.start) ? value.start : boundary.start, end: Date.parse(value.end) < Date.parse(boundary.end) ? value.end : boundary.end };
}
function activationIdentity(item) { return `${item.transitPlanet}|${item.targetType}|${item.targetPlanet || ''}|${item.targetSign}|${item.activationType}|${item.start}|${item.end}`; }
function windowEvidenceState(item) {
  return JSON.stringify({
    classification: item.classification,
    dasha: item.dashaActivation,
    majorPlanetsActive: item.majorPlanetsActive,
    majorDualActivation: item.majorDualActivation,
    multiTargetActivation: item.multiTargetActivation,
    moonSupport: item.moonSupport,
    d10Confirmation: item.d10Confirmation,
    ashtakavargaSupport: item.ashtakavargaSupport,
    historicalRecurrence: item.historicalRecurrence,
    activations: item.gocharActivations.map((activation) => `${activation.transitPlanet}|${activation.targetType}|${activation.targetPlanet || ''}|${activation.targetSign}|${activation.activationType}`).sort(),
  });
}
function moonSupport({ d1Houses, transitIntervals = [] } = {}) {
  const moon = assignmentMap(d1Houses).get('Moon'); if (!moon) return freeze({ jupiterSupportive: false, saturnSupportive: false, details: freeze([]) });
  const relative = (sign) => ((sign - moon.rashi.rashiIndex + 12) % 12) + 1;
  const details = (Array.isArray(transitIntervals) ? transitIntervals : []).filter((item) => item && validSign(item.sign) && ['Jupiter', 'Saturn'].includes(item.planet) && interval(item))
    .map((item) => ({ planet: item.planet, houseFromNatalMoon: relative(item.sign), supportive: item.planet === 'Jupiter' ? [2, 5, 7, 9, 11].includes(relative(item.sign)) : [3, 6, 11].includes(relative(item.sign)), start: item.start, end: item.end }))
    .filter((item) => item.supportive).sort((a, b) => `${a.planet}|${a.start}`.localeCompare(`${b.planet}|${b.start}`));
  return freeze({ jupiterSupportive: details.some((item) => item.planet === 'Jupiter'), saturnSupportive: details.some((item) => item.planet === 'Saturn'), details: freeze(details.map(freeze)) });
}

function evaluateCareerTimingWindow({ careerNatalFactors, d1Houses, d1CareerRelevant = false, activePeriods = [], transitIntervals = [], d10Confirmation = false, ashtakavargaSupport = null, historicalRecurrence = null } = {}) {
  const dashaActivation = evaluateCareerDashaActivation({ careerNatalFactors, activePeriods, d1CareerRelevant });
  const gocharActivations = evaluateCareerGocharActivations({ careerNatalFactors, d1Houses, careerDashaActivation: dashaActivation, d1CareerRelevant, transitIntervals });
  const major = gocharActivations.filter((item) => MAJOR_WINDOW_PLANETS.includes(item.transitPlanet));
  const majorPlanetsActive = stable(major.map((item) => item.transitPlanet));
  const majorDualActivation = major.some((jupiter) => jupiter.transitPlanet === 'Jupiter' && major.some((saturn) => saturn.transitPlanet === 'Saturn' && overlap(jupiter, saturn)));
  const targetsByPlanet = new Map(); for (const item of major) { if (!targetsByPlanet.has(item.transitPlanet)) targetsByPlanet.set(item.transitPlanet, new Set()); targetsByPlanet.get(item.transitPlanet).add(`${item.targetType}|${item.targetPlanet || ''}`); }
  const hasMultiTarget = [...targetsByPlanet.values()].some((set) => set.size > 1);
  const eligible = d1CareerRelevant === true && dashaActivation.active && major.length > 0;
  const moon = moonSupport({ d1Houses, transitIntervals });
  const reinforced = eligible && (moon.jupiterSupportive || moon.saturnSupportive || d10Confirmation === true || Boolean(ashtakavargaSupport) || Boolean(historicalRecurrence));
  const classification = !eligible ? 'NO_V1_TIMING_WINDOW' : majorDualActivation ? 'STRONG_CONVERGENCE_WINDOW' : reinforced ? 'REINFORCED_TIMING_WINDOW' : 'BASE_TIMING_WINDOW';
  return freeze({ natalCareerFactors: careerNatalFactors, dashaActivation, gocharActivations, majorPlanetsActive: freeze(majorPlanetsActive), majorDualActivation, multiTargetActivation: hasMultiTarget, moonSupport: moon, d10Confirmation: d10Confirmation === true, ashtakavargaSupport, historicalRecurrence, classification, careerTimingEligible: eligible, matchedRuleIds: freeze(stable([...dashaActivation.matchedRuleIds, ...major.flatMap((item) => item.matchedRuleIds)])), evidenceRefs: freeze(major.flatMap((item) => item.evidenceRefs)), limitations: freeze(['FUTURE_PROJECTION_DISABLED', 'NO_EVENT_TYPE_PREDICTION', 'NO_PROBABILITY_OR_GUARANTEE', 'D10_REFINEMENT_ONLY', 'SAV_BAV_SUPPORT_ONLY', 'HISTORICAL_RECURRENCE_SUPPORT_ONLY']) });
}

// The scanner intentionally accepts already-calculated Dasha and Gochar
// intervals. It is an internal backtest seam, not a source of astronomy and is
// not connected to the disabled production projection integration.
function scanCareerTimingWindows({ careerNatalFactors, d1Houses, d1CareerRelevant = false, dashaIntervals = [], transitIntervals = [], horizonStart, horizonEnd, d10Confirmation = false, ashtakavargaSupport = null, historicalRecurrence = null } = {}) {
  const horizon = { start: horizonStart, end: horizonEnd };
  if (!interval(horizon)) throw new TypeError('Career timing scan requires a valid ISO horizon.');
  const factors = careerNatalFactors || resolveCareerNatalFactors({ d1Houses });
  const candidates = [];
  for (const dasha of Array.isArray(dashaIntervals) ? dashaIntervals : []) {
    const dashaBounds = boundedInterval(dasha, horizon);
    if (!dashaBounds || !Array.isArray(dasha.activePeriods)) continue;
    const dashaActivation = evaluateCareerDashaActivation({ careerNatalFactors: factors, activePeriods: dasha.activePeriods, d1CareerRelevant });
    if (!dashaActivation.active) continue;
    const majorIntervals = (Array.isArray(transitIntervals) ? transitIntervals : [])
      .filter((item) => item && MAJOR_WINDOW_PLANETS.includes(item.planet))
      .map((item) => boundedInterval(item, dashaBounds))
      .filter(Boolean);
    for (const candidateBounds of majorIntervals) {
      const contextIntervals = (Array.isArray(transitIntervals) ? transitIntervals : [])
        .map((item) => boundedInterval(item, candidateBounds)).filter(Boolean);
      const evaluation = evaluateCareerTimingWindow({
        careerNatalFactors: factors, d1Houses, d1CareerRelevant, activePeriods: dasha.activePeriods, transitIntervals: contextIntervals,
        d10Confirmation, ashtakavargaSupport, historicalRecurrence,
      });
      if (!evaluation.careerTimingEligible) continue;
      candidates.push(freeze({ start: candidateBounds.start, end: candidateBounds.end, ...evaluation }));
    }
  }
  const unique = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.start}|${candidate.end}|${candidate.classification}|${candidate.majorPlanetsActive.join(',')}|${candidate.gocharActivations.map((item) => `${item.transitPlanet}:${item.targetType}:${item.targetPlanet || ''}:${item.activationType}`).join(',')}`;
    unique.set(key, candidate);
  }
  const ordered = [...unique.values()].sort((left, right) => `${left.start}|${left.end}`.localeCompare(`${right.start}|${right.end}`));
  const merged = ordered.reduce((windows, candidate) => {
    const previous = windows[windows.length - 1];
    if (!previous || previous.end !== candidate.start || windowEvidenceState(previous) !== windowEvidenceState(candidate)) {
      windows.push(candidate); return windows;
    }
    const activationMap = new Map([...previous.gocharActivations, ...candidate.gocharActivations].map((item) => [activationIdentity(item), item]));
    windows[windows.length - 1] = freeze({ ...previous, end: candidate.end, gocharActivations: freeze([...activationMap.values()].sort((left, right) => activationIdentity(left).localeCompare(activationIdentity(right)))) });
    return windows;
  }, []);
  return freeze({
    rulesetId: CAREER_GENERALIZED_TIMING_RULESET_ID,
    horizon: freeze(horizon),
    windows: freeze(merged),
    integrationGate: freeze({ enabled: false, reason: 'Future Career projection remains disabled; scanner output is internal backtest evidence only.' }),
    limitations: freeze(['FUTURE_PROJECTION_DISABLED', 'NO_EVENT_TYPE_PREDICTION', 'NO_PROBABILITY_OR_GUARANTEE']),
  });
}

module.exports = { CAREER_GENERALIZED_TIMING_RULESET_ID, MAJOR_WINDOW_PLANETS, REVIEW_ONLY_MAJOR_CONTEXT, SHORT_TRIGGER_PLANETS, FAST_CONTEXT_PLANETS, resolveCareerNatalFactors, evaluateCareerDashaActivation, evaluateCareerGocharActivations, evaluateCareerTimingWindow, scanCareerTimingWindows, moonSupport };
