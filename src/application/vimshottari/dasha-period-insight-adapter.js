'use strict';

const { calculateRashiHouses } = require('../../bhava');
const { calculateChartCoordinates } = require('../divisional-charts/divisional-chart-service');
const { evaluatePlanetaryState, SEVEN_CLASSICAL_BODIES } = require('../../dignity');
const { createDashaPeriodInsight } = require('./dasha-period-insight-contract');
const { structuralSummary } = require('./dasha-period-insight-renderer');

const ACTIVE_CAREER_DASHA = 'ACTIVE_CAREER_DASHA';
const AUDITED_CLASSICAL_PREDICATE = 'AUDITED_CLASSICAL_PREDICATE';
const USABLE_STATUSES = new Set(['SUPPORTED', 'MIXED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE']);
const STATE_LABELS = Object.freeze({ isOwnSign: 'OWN_SIGN', isMoolatrikona: 'MOOLATRIKONA', isExalted: 'EXALTED', isDebilitated: 'DEBILITATED' });
const ROLE_ORDER = Object.freeze(['MAHADASHA', 'ANTARDASHA', 'PRATYANTAR']);

function publicPeriod(period, status) { return status ? { lord: period.lord.id, start: period.startInstant.utc, end: period.endInstant.utc, status } : { lord: period.lord.id, start: period.startInstant.utc, end: period.endInstant.utc }; }
function rolePeriods(selection) { return [{ role: 'MAHADASHA', period: selection.mahadasha }, { role: 'ANTARDASHA', period: selection.antardasha }, { role: 'PRATYANTAR', period: selection.pratyantar }]; }
function uniqueRoles(selection) { const seen = new Set(); return rolePeriods(selection).filter(({ period }) => !seen.has(period.lord.id) && (seen.add(period.lord.id) || true)); }
function factualProjection({ selection, layer1 }) {
  // A complete astronomical snapshot is always present in production. Keep
  // this projection additive, however: incomplete test/degraded snapshots
  // must not make canonical period selection unavailable.
  if (!layer1?.bodies?.Ascendant) {
    return { natalFacts: [], stateFacts: [], relationshipFacts: [], d10Facts: [] };
  }
  const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: layer1.bodies.Ascendant.siderealLongitudeDegrees, bodies: layer1.bodies });
  const assignmentByPlanet = new Map(houses.planetaryAssignments.map((item) => [item.body, item]));
  const stateEngine = evaluatePlanetaryState({ bodies: Object.fromEntries(Object.entries(layer1.bodies).filter(([body]) => body !== 'Ascendant')) });
  const d10 = Object.values(layer1.bodies).length >= 10 ? calculateChartCoordinates(layer1, 'd10') : null;
  const d10HouseByPlanet = new Map(d10 ? d10.houses.planetaryAssignments.map((item) => [item.body, item]) : []);
  const natalFacts = []; const stateFacts = []; const d10Facts = [];
  for (const { role, period } of uniqueRoles(selection)) {
    const planet = period.lord.id; const placement = assignmentByPlanet.get(planet); const state = stateEngine.bodies[planet]; const d10Placement = d10HouseByPlanet.get(planet);
    if (placement) natalFacts.push({ planet, role, sign: placement.rashi.englishName, house: placement.rashiHouseNumber, ownsHouses: houses.houses.filter((house) => house.rashiHouseLord === planet).map((house) => house.houseNumber) });
    if (state) {
      const labels = Object.entries(STATE_LABELS).filter(([key]) => state.dignity[key] === true).map(([, label]) => label);
      if (state.motion.isRetrograde) labels.push('RETROGRADE');
      if (state.combustion.combust === true) labels.push('COMBUST');
      if (labels.length) stateFacts.push({ planet, role, states: labels });
    }
    if (d10Placement) d10Facts.push({ planet, role, sign: d10Placement.rashi.englishName, house: d10Placement.rashiHouseNumber });
  }
  const selected = rolePeriods(selection); const relationshipFacts = [];
  for (const [from, to] of [[selected[0], selected[1]], [selected[1], selected[2]], [selected[0], selected[2]]]) {
    if (from.period.lord.id === to.period.lord.id || !SEVEN_CLASSICAL_BODIES.includes(from.period.lord.id) || !SEVEN_CLASSICAL_BODIES.includes(to.period.lord.id)) continue;
    const relation = stateEngine.bodies[from.period.lord.id]?.relationships?.compoundByBody?.[to.period.lord.id];
    if (typeof relation === 'string') relationshipFacts.push({ from: from.period.lord.id, to: to.period.lord.id, relationship: relation.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '') });
  }
  return { natalFacts, stateFacts, relationshipFacts, d10Facts };
}
function exactPeriodMatch(candidate, period, level) { return candidate && candidate.periodLevel === level && candidate.periodPlanet === period.lord.id && candidate.start === period.startInstant.utc && candidate.end === period.endInstant.utc; }
function exactInsight(insights, family, selection) {
  return (Array.isArray(insights) ? insights : []).find((insight) => insight && insight.family === family && USABLE_STATUSES.has(insight.status) && Array.isArray(insight.timing?.dashaPeriods) && rolePeriods(selection).some(({ role, period }) => insight.timing.dashaPeriods.some((candidate) => exactPeriodMatch(candidate, period, role))));
}
function safeCareerContext(insights, selection, status) {
  if (status !== 'CURRENT') return null;
  const insight = exactInsight(insights, ACTIVE_CAREER_DASHA, selection);
  if (!insight) return null;
  return { status: insight.status, presentation: { english: 'This period contributes to your current Career timing analysis.', hinglish: 'Yeh period aapki current Career timing analysis ka hissa hai.' } };
}
function safeClassicalContext(insights, selection, status) {
  if (status !== 'CURRENT') return null;
  const insight = exactInsight(insights, AUDITED_CLASSICAL_PREDICATE, selection);
  if (!insight || insight.status !== 'SUPPORTED') return null;
  return { status: insight.status, presentation: { english: 'An audited classical Career rule is active in this Dasha sequence.', hinglish: 'Is Dasha sequence mein ek audited classical Career rule active hai.' } };
}
function adaptDashaPeriodInsight({ selection, status, nextPeriod, layer1, insights = [] } = {}) {
  const factual = factualProjection({ selection, layer1 });
  return createDashaPeriodInsight({
    hierarchy: { mahadasha: publicPeriod(selection.mahadasha), antardasha: publicPeriod(selection.antardasha), pratyantar: publicPeriod(selection.pratyantar, status) },
    periodContext: { status, presentation: structuralSummary({ status, mahadashaLord: selection.mahadasha.lord.id, antardashaLord: selection.antardasha.lord.id, pratyantarLord: selection.pratyantar.lord.id }) },
    ...factual,
    careerRelevance: safeCareerContext(insights, selection, status),
    calibrationContext: null,
    classicalContext: safeClassicalContext(insights, selection, status),
    nextPeriod: nextPeriod ? publicPeriod(nextPeriod) : null,
  });
}

module.exports = { adaptDashaPeriodInsight, factualProjection, exactInsight };
