'use strict';

// Factual, offline feature extraction. It accepts already-authoritative natal,
// Dasha, transit, and support facts; it never calculates astrology, scores a
// chart, or turns a conjunction into an employment conclusion.
const { HORIZON_IDS } = require('./job-favourability-cohort-builder');

const DAY_MS = 24 * 60 * 60 * 1000;
const STATES = Object.freeze(['AVAILABLE', 'UNAVAILABLE', 'NOT_APPLICABLE']);
const RESEARCH_RULESET_ID = 'taraverse-job-favourability-feature-v1';
const RELEVANT_TRANSIT_BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function iso(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
function interval(value) { return value && iso(value.start) && iso(value.end) && Date.parse(value.start) < Date.parse(value.end); }
function intersects(left, right) { return interval(left) && interval(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end); }
function overlapMs(left, right) { return intersects(left, right) ? Math.min(Date.parse(left.end), Date.parse(right.end)) - Math.max(Date.parse(left.start), Date.parse(right.start)) : 0; }
function state(value, values = null) { return freeze({ state: STATES.includes(value) ? value : 'UNAVAILABLE', ...(values === null ? {} : { values: freeze(values) }) }); }
function addDays(value, days) { return new Date(Date.parse(value) + (days * DAY_MS)).toISOString(); }

function horizonFor(anchor, horizonId) {
  if (!anchor || !interval(anchor.coverage) || !HORIZON_IDS.includes(horizonId)) throw new TypeError('Research feature extraction requires a valid pre-registered anchor and horizon.');
  const days = Number(horizonId.split('_')[1]);
  const start = anchor.coverage.start; const end = anchor.coverage.end;
  if (horizonId.startsWith('PRE_')) return freeze({ horizonId, start: addDays(start, -days), end: start, direction: 'PRE' });
  if (horizonId.startsWith('POST_')) return freeze({ horizonId, start: end, end: addDays(end, days), direction: 'POST' });
  return freeze({ horizonId, start: addDays(start, -days), end: addDays(end, days), direction: 'SYMMETRIC' });
}

function housesByNumber(d1Houses) { return new Map((Array.isArray(d1Houses && d1Houses.houses) ? d1Houses.houses : []).filter((house) => Number.isInteger(house && house.houseNumber)).map((house) => [house.houseNumber, house])); }
function lord(house) { return typeof (house && house.rashiHouseLord) === 'string' ? house.rashiHouseLord : house && house.rashiHouseLord && typeof house.rashiHouseLord.name === 'string' ? house.rashiHouseLord.name : null; }
function houseForSign(d1Houses, sign) { const house = (Array.isArray(d1Houses && d1Houses.houses) ? d1Houses.houses : []).find((item) => item && item.rashi && item.rashi.rashiIndex === sign); return house ? house.houseNumber : null; }
function normalizeDasha(value) {
  const start = value && (value.start || value.from); const end = value && (value.end || value.to);
  const periods = Array.isArray(value && value.activePeriods) ? value.activePeriods : [
    value && value.mahadasha && { level: 'MD', lord: value.mahadasha.lord },
    value && value.antardasha && { level: 'AD', lord: value.antardasha.lord },
    value && value.pratyantardasha && { level: 'PD', lord: value.pratyantardasha.lord },
  ].filter(Boolean);
  return iso(start) && iso(end) && Date.parse(start) < Date.parse(end) ? { start, end, periods: periods.filter((item) => item && ['MD', 'AD', 'PD'].includes(item.level) && typeof item.lord === 'string') } : null;
}
function normalizeTransit(value, d1Houses) {
  const start = value && (value.start || value.from); const end = value && (value.end || value.to);
  if (!value || !RELEVANT_TRANSIT_BODIES.includes(value.planet) || !iso(start) || !iso(end) || Date.parse(start) >= Date.parse(end)) return null;
  const sign = Number.isInteger(value.sign) ? value.sign : Number.isInteger(value.rashiIndex) ? value.rashiIndex : value.signAtStart && value.signAtStart.rashiIndex;
  const natalHouse = Number.isInteger(value.natalHouse) ? value.natalHouse : Number.isInteger(value.natalHouseAtStart) ? value.natalHouseAtStart : Number.isInteger(sign) ? houseForSign(d1Houses, sign) : null;
  return { planet: value.planet, start, end, sign: Number.isInteger(sign) ? sign : null, natalHouse };
}
function dashaFeatures(profile, window, h10Lord, h6Lord, eventPrecision) {
  const source = Array.isArray(profile.dashaIntervals) ? profile.dashaIntervals.map(normalizeDasha).filter(Boolean) : null;
  if (source === null) return freeze({ identities: state('UNAVAILABLE'), h10Lord: state(h10Lord ? 'UNAVAILABLE' : 'NOT_APPLICABLE'), h6Lord: state(h6Lord ? 'UNAVAILABLE' : 'NOT_APPLICABLE') });
  const active = source.filter((item) => intersects(item, window)).flatMap((item) => item.periods)
    .filter((item) => eventPrecision === 'DAY' || item.level !== 'PD')
    .sort((left, right) => `${left.level}|${left.lord}`.localeCompare(`${right.level}|${right.lord}`));
  const byLevel = (level) => [...new Set(active.filter((item) => item.level === level).map((item) => item.lord))].sort();
  const activation = (planet) => !planet ? state('NOT_APPLICABLE') : state('AVAILABLE', freeze({ active: active.some((item) => item.lord === planet), levels: freeze(active.filter((item) => item.lord === planet).map((item) => item.level).sort()) }));
  return freeze({ identities: state('AVAILABLE', freeze({ md: freeze(byLevel('MD')), ad: freeze(byLevel('AD')), pd: eventPrecision === 'DAY' ? freeze(byLevel('PD')) : null, pdState: eventPrecision === 'DAY' ? 'AVAILABLE' : 'NOT_APPLICABLE' })), h10Lord: activation(h10Lord), h6Lord: activation(h6Lord) });
}
function transitFeatures(profile, window) {
  const source = Array.isArray(profile.transitIntervals) ? profile.transitIntervals.map((item) => normalizeTransit(item, profile.d1Houses)).filter(Boolean) : null;
  if (source === null) return freeze(Object.fromEntries(RELEVANT_TRANSIT_BODIES.map((planet) => [planet.toLowerCase(), state('UNAVAILABLE')])));
  return freeze(Object.fromEntries(RELEVANT_TRANSIT_BODIES.map((planet) => {
    const active = source.filter((item) => item.planet === planet && intersects(item, window));
    const values = active.map((item) => freeze({ natalHouse: item.natalHouse, sign: item.sign, start: item.start, end: item.end })).sort((left, right) => `${left.start}|${left.natalHouse}`.localeCompare(`${right.start}|${right.natalHouse}`));
    return [planet.toLowerCase(), state('AVAILABLE', freeze(values))];
  })));
}
function refinedTransitFacts(profile, window) {
  if (!Array.isArray(profile.transitEvents)) return state('UNAVAILABLE');
  const values = profile.transitEvents.filter((item) => item && RELEVANT_TRANSIT_BODIES.includes(item.body) && iso(item.instant) && Date.parse(item.instant) >= Date.parse(window.start) && Date.parse(item.instant) < Date.parse(window.end))
    .map((item) => freeze({ body: item.body, eventType: item.eventType || null, instant: item.instant, fromRashi: item.fromRashi && item.fromRashi.rashiIndex || item.fromRashi || null, toRashi: item.toRashi && item.toRashi.rashiIndex || item.toRashi || null }))
    .sort((left, right) => `${left.instant}|${left.body}|${left.eventType || ''}`.localeCompare(`${right.instant}|${right.body}|${right.eventType || ''}`));
  return state('AVAILABLE', freeze(values));
}
function genericCareerSignal(profile, window) {
  if (!Array.isArray(profile.genericCareerSignals)) return state('UNAVAILABLE');
  const active = profile.genericCareerSignals.filter((item) => item && interval(item) && intersects(item, window));
  const activeDurationMs = active.reduce((total, item) => total + overlapMs(item, window), 0);
  return state('AVAILABLE', freeze({ active: active.length > 0, activeDurationMs, classifications: freeze([...new Set(active.map((item) => item.evidenceState || item.classification || 'POSSIBLE_CAREER_ACTIVITY_SIGNAL'))].sort()) }));
}
function supportFeature(value) { return value === undefined ? state('UNAVAILABLE') : state('AVAILABLE', value === null ? null : value); }
function recurrence(profile, unit, anchor) {
  if (!Array.isArray(profile.recurrenceEvidence)) return state('UNAVAILABLE');
  const candidates = profile.recurrenceEvidence.filter((item) => item && item.unitId === unit.unitId && item.profileId === unit.profileId && Array.isArray(item.sourceTransitions) && item.sourceTransitions.every((source) => source && iso(source.completedAt) && Date.parse(source.completedAt) < Date.parse(anchor.coverage.start)));
  if (!candidates.length) return state('UNAVAILABLE');
  const selected = candidates.slice().sort((left, right) => String(left.generatedAt || '').localeCompare(String(right.generatedAt || ''))).at(-1);
  return state('AVAILABLE', freeze({ present: selected.present === true, sourceTransitionCount: selected.sourceTransitions.length, leakageSafe: true }));
}
function provenance(profile) {
  const value = profile.astronomyProvenance || {};
  return freeze({ engineProfileId: value.engineProfileId || null, ayanamshaSystem: value.ayanamshaSystem || null, nodePolicy: value.nodePolicy || null, dashaRulesetId: value.dashaRulesetId || null, transitBoundaryMethod: value.transitBoundaryMethod || null, calculationStatus: value.calculationStatus || null });
}

function extractJobFavourabilityFeatureRows({ profile, cohort, horizons = HORIZON_IDS } = {}) {
  if (!profile || !cohort || !Array.isArray(cohort.units)) throw new TypeError('Research feature extraction requires supplied profile facts and a cohort.');
  const ownUnits = cohort.units.filter((unit) => unit.profileId === profile.birthProfileId);
  const houses = housesByNumber(profile.d1Houses); const h10Lord = lord(houses.get(10)); const h6Lord = lord(houses.get(6));
  const rows = [];
  for (const unit of ownUnits) for (const anchor of unit.anchors) for (const horizonId of horizons) {
    const window = horizonFor(anchor, horizonId);
    rows.push(freeze({
      schemaId: RESEARCH_RULESET_ID,
      pseudonymousProfileId: unit.pseudonymousProfileId,
      unitId: unit.unitId,
      unitKind: unit.unitKind,
      eventFamily: unit.eventFamily,
      eventPrecision: anchor.precision,
      observationType: anchor.observationType,
      partition: unit.partition,
      horizon: window,
      astronomyProvenance: provenance(profile),
      dasha: dashaFeatures(profile, window, h10Lord, h6Lord, anchor.precision),
      d1CareerFactors: freeze({ h10Lord: h10Lord || null, h6Lord: h6Lord || null, h10: h10Lord ? 'AVAILABLE' : 'UNAVAILABLE', h6EmploymentServiceContext: h6Lord ? 'RESEARCH_ONLY' : 'UNAVAILABLE' }),
      transits: transitFeatures(profile, window),
      refinedTransitFacts: refinedTransitFacts(profile, window),
      d10: supportFeature(profile.d10Facts),
      moon: supportFeature(profile.moonSupportFacts),
      ashtakavarga: supportFeature(profile.ashtakavargaFacts),
      genericCareerSignal: genericCareerSignal(profile, window),
      historicalRecurrence: recurrence(profile, unit, anchor),
    }));
  }
  return freeze(rows.sort((left, right) => `${left.pseudonymousProfileId}|${left.unitId}|${left.horizon.horizonId}|${left.horizon.start}`.localeCompare(`${right.pseudonymousProfileId}|${right.unitId}|${right.horizon.horizonId}|${right.horizon.start}`)));
}

module.exports = { RESEARCH_RULESET_ID, STATES, RELEVANT_TRANSIT_BODIES, horizonFor, extractJobFavourabilityFeatureRows };
