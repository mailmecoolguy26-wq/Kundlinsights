'use strict';

const { EVENT_ORDER } = require('../../transit-events/reference-data');
const { createTransitInsightContext, STATUSES } = require('./transit-insight-contract');
const copy = require('./transit-insight-renderer');

const CAREER_FAMILIES = new Set(['CURRENT_CAREER_TRANSIT', 'CONCURRENT_CAREER_TIMING']);
const EVENT_TYPE_ORDER = new Map(EVENT_ORDER.map((type, index) => [type, index]));

function activatedHouses(snapshot) {
  const groups = new Map();
  for (const body of Object.values(snapshot.transitBodies)) {
    const house = body.transitNatalHouseNumber;
    if (!groups.has(house)) groups.set(house, []);
    groups.get(house).push(body.body);
  }
  return [...groups.entries()].map(([house, planets]) => ({ house, planets: planets.sort() })).sort((a, b) => a.house - b.house);
}
function validCurrentTransit(context, snapshotAt, knownPlanets) {
  if (!context || typeof context.transitPlanet !== 'string' || !knownPlanets.has(context.transitPlanet)) return null;
  const point = context.instant || context.start;
  if (point !== snapshotAt) return null;
  return context.transitPlanet;
}
function careerRelevance({ insights = [], snapshot }) {
  const known = new Set(Object.keys(snapshot.transitBodies)); const found = new Map();
  for (const insight of insights) {
    if (!insight || !CAREER_FAMILIES.has(insight.family) || !STATUSES.has(insight.status)) continue;
    const contexts = insight.timing && Array.isArray(insight.timing.transitContexts) ? insight.timing.transitContexts : [];
    for (const context of contexts) {
      const planet = validCurrentTransit(context, snapshot.snapshotInstant, known);
      if (planet && !found.has(planet)) found.set(planet, { planet, status: insight.status, presentation: copy.careerRelevance(planet), timing: { instant: snapshot.snapshotInstant } });
    }
  }
  return [...found.values()].sort((a, b) => a.planet.localeCompare(b.planet));
}
function specialStates(snapshot) {
  const states = Object.values(snapshot.transitBodies).filter((body) => body.motion === 'retrograde').map((body) => ({ type: 'RETROGRADE', planet: body.body, status: 'ACTIVE', presentation: copy.retrograde(body.body) }));
  const sade = snapshot.transitBodies.Saturn && snapshot.transitBodies.Saturn.sadeSati;
  if (sade && sade.detected) states.push({ type: 'SADE_SATI', planet: 'Saturn', status: 'ACTIVE', phase: sade.phase, presentation: copy.sadeSati(sade.phase) });
  return states.sort((a, b) => a.type.localeCompare(b.type) || a.planet.localeCompare(b.planet));
}
function sign(value) { return value && (value.englishName || value.sanskritName); }
function publicEvent(event) {
  const planet = event.body || event.transitBody;
  if (event.eventType === 'rashiIngress') return { type: 'INGRESS', planet, at: event.instant, ...(sign(event.fromRashi) ? { fromSign: sign(event.fromRashi) } : {}), ...(sign(event.toRashi) ? { toSign: sign(event.toRashi) } : {}) };
  if (event.eventType === 'retrogradeStation') return { type: 'STATION_RETROGRADE', planet, at: event.instant, ...(event.fromMotion ? { motionBefore: event.fromMotion } : {}), ...(event.toMotion ? { motionAfter: event.toMotion } : {}) };
  if (event.eventType === 'directStation') return { type: 'STATION_DIRECT', planet, at: event.instant, ...(event.fromMotion ? { motionBefore: event.fromMotion } : {}), ...(event.toMotion ? { motionAfter: event.toMotion } : {}) };
  if (event.eventType === 'transitDrishtiStart' || event.eventType === 'transitDrishtiEnd') {
    if (typeof event.natalBody !== 'string' || event.natalBody === planet) return null;
    return { type: 'DRISHTI_CHANGE', planet, at: event.instant, targetPlanet: event.natalBody, ...(event.transition === 'start' || event.transition === 'end' ? { change: event.transition } : {}), ...(Number.isInteger(event.targetHouseNumber) ? { house: event.targetHouseNumber } : {}) };
  }
  if (event.eventType === 'sameRashiAssociationStart' || event.eventType === 'sameRashiAssociationEnd') {
    if (typeof event.natalBody !== 'string' || event.natalBody === planet) return null;
    return { type: 'ASSOCIATION_CHANGE', planet, at: event.instant, targetPlanet: event.natalBody, ...(event.transition === 'start' || event.transition === 'end' ? { change: event.transition } : {}) };
  }
  if (event.eventType === 'sadeSatiPhaseChange') return { type: 'SADE_SATI_PHASE_CHANGE', planet, at: event.instant };
  return null;
}
function identity(value) {
  return [value.type, value.planet, value.at, value.targetPlanet || '', value.fromSign || '', value.toSign || '', value.motionBefore || '', value.motionAfter || '', value.change || '', value.house ?? ''].join('|');
}
function transitions(scan) {
  const ordered = (scan && Array.isArray(scan.events) ? scan.events : [])
    .map((event) => ({ event, value: publicEvent(event) }))
    .filter((item) => item.value)
    .filter(({ value }) => value.planet !== 'Moon' || value.type === 'INGRESS' || (value.type !== 'ASSOCIATION_CHANGE' && value.type !== 'DRISHTI_CHANGE'))
    .sort((left, right) => left.value.at.localeCompare(right.value.at) || (EVENT_TYPE_ORDER.get(left.event.eventType) ?? 99) - (EVENT_TYPE_ORDER.get(right.event.eventType) ?? 99) || left.value.planet.localeCompare(right.value.planet) || (left.value.targetPlanet || '').localeCompare(right.value.targetPlanet || ''));
  const seen = new Set(); let moonIngresses = 0;
  return ordered.filter(({ value }) => {
    const key = identity(value); if (seen.has(key)) return false; seen.add(key);
    if (value.type === 'INGRESS' && value.planet === 'Moon' && ++moonIngresses > 3) return false;
    return true;
  }).map((item) => item.value);
}
function adaptTransitInsight({ snapshot, insights = [], scan = null, horizon = null } = {}) {
  return createTransitInsightContext({ activatedHouses: activatedHouses(snapshot), careerRelevance: careerRelevance({ insights, snapshot }), specialStates: specialStates(snapshot), upcomingTransitions: transitions(scan), horizon });
}

module.exports = { adaptTransitInsight, activatedHouses, careerRelevance, specialStates, transitions, publicEvent, identity };
