'use strict';

// Vehicle Rules v1 is deliberately separate from Property Rules v1. It uses
// the existing chart, Dasha, Gochar, D16, Ashtakavarga, Life Event, and
// boundary-refinement primitives, but applies only the approved Vehicle
// evidence contract below. It is not an outcome or ownership prediction.
const { calculateRashiHouses } = require('../../bhava');
const { calculateGocharSnapshot } = require('../../gochar');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { scanTransitEvents } = require('../../transit-events');
const { calculateChartCoordinates } = require('../divisional-charts/divisional-chart-service');
const { calculateAshtakavargaForLayer2 } = require('../ashtakavarga');
const { classifyLayer1Bodies, canonicalPlanetId } = require('../../jyotish');
const { publicHistoricalContext } = require('../life-event-calibration');

const VehicleIntent = Object.freeze({
  VEHICLE_CURRENT_STRENGTH: 'VEHICLE_CURRENT_STRENGTH',
  VEHICLE_PURCHASE_TIMING: 'VEHICLE_PURCHASE_TIMING',
  VEHICLE_STRONGER_WINDOW: 'VEHICLE_STRONGER_WINDOW',
});
const MAJOR_TRANSIT_PLANETS = Object.freeze(['Jupiter', 'Saturn']);
const SUPPORTING_TRANSIT_PLANETS = Object.freeze(['Venus', 'Mars']);
const CONTEXT_TRANSIT_PLANETS = Object.freeze(['Rahu', 'Ketu']);
const ALL_TRANSIT_PLANETS = Object.freeze([...MAJOR_TRANSIT_PLANETS, ...SUPPORTING_TRANSIT_PLANETS, ...CONTEXT_TRANSIT_PLANETS]);
const ACQUISITION_HOUSES = Object.freeze([2, 11]);
const CONTEXT_HOUSES = Object.freeze([3, 6, 12]);
const DAY = 86_400_000;
const VEHICLE_WINDOW_COARSE_SCAN_STEP_MS = DAY;
const VEHICLE_RULESET_VERSION = 'vehicle-rules-v1';

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function planetId(value) { if (value === null || value === undefined || value === '') return null; return canonicalPlanetId(value) || String(value).toLowerCase(); }
function request(birth) { return { date: birth.localDate, time: birth.localTime, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }; }
function transitRequest(instant, birth) { const date = new Date(instant); return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 23), timezone: 'UTC', latitude: birth.latitude, longitude: birth.longitude }; }
function houseMap(houses) { return new Map(houses.houses.map((house) => [house.houseNumber, house])); }
function assignments(houses) { return new Map(houses.planetaryAssignments.map((item) => [planetId(item.body), item])); }
function lords(houses) { const out = new Map(); for (const house of houses.houses) { const id = planetId(house.rashiHouseLord); if (!id) continue; const values = out.get(id) || []; values.push(house.houseNumber); out.set(id, values); } return out; }
function planetsIn(houses, houseNumber) { return houses.planetaryAssignments.filter((item) => item.rashiHouseNumber === houseNumber).map((item) => item.body); }
function sameSign(houses, left, right) { const a = assignments(houses).get(planetId(left)); const b = assignments(houses).get(planetId(right)); return Boolean(a && b && a.rashiHouseNumber === b.rashiHouseNumber); }

// The repository has no separately approved natal-aspect primitive. Existing
// D1 aspect logic is only used where the shared Gochar snapshot supplies it.
function chartConnection(houses, body) {
  const id = planetId(body);
  if (!id) return freeze({ planet: null, directVehicleConnection: false, acquisitionConnection: false, contextualConnection: false, placementHouse: null, rulesHouses: freeze([]) });
  const byLord = lords(houses); const placement = assignments(houses).get(id); const h4 = houseMap(houses).get(4);
  const ruled = byLord.get(id) || [];
  const direct = ruled.includes(4) || Boolean(placement && placement.rashiHouseNumber === 4) || Boolean(h4 && sameSign(houses, id, h4.rashiHouseLord));
  const acquisition = ruled.some((house) => ACQUISITION_HOUSES.includes(house)) || Boolean(placement && ACQUISITION_HOUSES.includes(placement.rashiHouseNumber));
  const contextual = ruled.some((house) => CONTEXT_HOUSES.includes(house)) || Boolean(placement && CONTEXT_HOUSES.includes(placement.rashiHouseNumber));
  return freeze({ planet: id, directVehicleConnection: direct, acquisitionConnection: acquisition, contextualConnection: contextual, placementHouse: placement && placement.rashiHouseNumber || null, rulesHouses: freeze(ruled.slice().sort((a, b) => a - b)) });
}

function d1Evidence(houses) {
  const h4 = houseMap(houses).get(4);
  const candidates = [...new Set([...houses.planetaryAssignments.map((item) => planetId(item.body)), planetId(h4 && h4.rashiHouseLord)].filter(Boolean))];
  const connections = candidates.map((planet) => chartConnection(houses, planet));
  const core = connections.filter((item) => item.directVehicleConnection);
  const acquisition = connections.filter((item) => item.acquisitionConnection);
  const contextual = connections.filter((item) => item.contextualConnection);
  return freeze({
    fourthHouse: freeze({ house: 4, lord: h4 && h4.rashiHouseLord || null, occupants: freeze(planetsIn(houses, 4)) }),
    connections: freeze(connections),
    coreVehicleConnections: freeze(core),
    acquisitionConnections: freeze(acquisition),
    contextualConnections: freeze(contextual),
    d1Seed: core.length > 0,
    classification: core.length ? acquisition.length ? 'CORE_AND_ACQUISITION' : 'CORE_ONLY' : 'NO_CORE_VEHICLE_CONNECTION',
  });
}

function d16Evidence(natal) {
  const chart = calculateChartCoordinates(natal, 'd16'); const houses = chart.houses;
  const h4 = houseMap(houses).get(4);
  const candidates = [...new Set([...houses.planetaryAssignments.map((item) => planetId(item.body)), planetId(h4 && h4.rashiHouseLord)].filter(Boolean))];
  const connections = candidates.map((planet) => chartConnection(houses, planet));
  const core = connections.filter((item) => item.directVehicleConnection);
  const acquisition = connections.filter((item) => item.acquisitionConnection);
  const contextual = connections.filter((item) => item.contextualConnection);
  // D16 has no approved dignity or aspect scorer. Confirmation is therefore
  // limited to factual placement/lordship/association structure; it cannot
  // manufacture a D1 promise.
  const confirmation = core.length > 0 && (acquisition.length > 0 || core.length > 1)
    ? 'CONFIRMS'
    : core.length === 0 && contextual.length > 0 ? 'WEAKENS' : 'NEUTRAL';
  return freeze({ chart: 'D16', confirmation, fourthHouse: freeze({ house: 4, lord: h4 && h4.rashiHouseLord || null, occupants: freeze(planetsIn(houses, 4)) }), connections: freeze(connections), coreVehicleConnections: freeze(core), acquisitionConnections: freeze(acquisition), contextualConnections: freeze(contextual), d16Houses: houses });
}

function natalPromise(d1, d16) {
  if (!d1.d1Seed) return 'NO_VEHICLE_PROMISE';
  if (d16.confirmation === 'WEAKENS') return 'LIMITED';
  if (d1.coreVehicleConnections.length && d1.acquisitionConnections.length && d16.confirmation === 'CONFIRMS') return 'STRONG';
  if (d1.coreVehicleConnections.length && (d16.confirmation === 'CONFIRMS' || d1.acquisitionConnections.length)) return 'MODERATE';
  return 'LIMITED';
}

function vehicleFactor(d1Houses, d16, body) {
  const d1 = chartConnection(d1Houses, body);
  const d16Connection = chartConnection(d16.d16Houses, body);
  const role = d1.directVehicleConnection || d16Connection.directVehicleConnection
    ? 'VEHICLE_ACTIVE'
    : d1.acquisitionConnection || d16Connection.acquisitionConnection
    ? 'VEHICLE_SUPPORTING'
    : d1.contextualConnection || d16Connection.contextualConnection
    ? 'CONTEXTUAL'
    : 'NOT_RELEVANT';
  return freeze({ planet: planetId(body), role, d1, d16: d16Connection });
}

function dashaAt(tree, instant) {
  const stamp = Date.parse(instant);
  for (const md of tree.periods || []) if (stamp >= Number(md.startInstant.epochMilliseconds) && stamp < Number(md.endInstant.epochMilliseconds)) {
    for (const ad of md.children || []) if (stamp >= Number(ad.startInstant.epochMilliseconds) && stamp < Number(ad.endInstant.epochMilliseconds)) {
      for (const pd of ad.children || []) if (stamp >= Number(pd.startInstant.epochMilliseconds) && stamp < Number(pd.endInstant.epochMilliseconds)) {
        return freeze({ md: planetId(md.lord.id), ad: planetId(ad.lord.id), pd: planetId(pd.lord.id), mdStart: md.startInstant.utc, mdEnd: md.endInstant.utc, adStart: ad.startInstant.utc, adEnd: ad.endInstant.utc, pdStart: pd.startInstant.utc, pdEnd: pd.endInstant.utc });
      }
    }
  }
  return null;
}

function mdAdEvidence(d1, d16, dasha) {
  if (!dasha) return freeze({ classification: 'INSUFFICIENT_MD_AD_SUPPORT', eligible: false, factors: freeze([]), periods: null });
  const md = freeze({ level: 'MD', ...vehicleFactor(d1, d16, dasha.md) });
  const ad = freeze({ level: 'AD', ...vehicleFactor(d1, d16, dasha.ad) });
  const pd = freeze({ level: 'PD', ...vehicleFactor(d1, d16, dasha.pd) });
  const mdAd = [md, ad];
  const activeCount = mdAd.filter((factor) => factor.role === 'VEHICLE_ACTIVE').length;
  const eligible = activeCount >= 1 && mdAd.every((factor) => ['VEHICLE_ACTIVE', 'VEHICLE_SUPPORTING'].includes(factor.role));
  const classification = eligible && activeCount === 2 ? 'STRONG_MD_AD_SUPPORT' : eligible ? 'MODERATE_MD_AD_SUPPORT' : 'INSUFFICIENT_MD_AD_SUPPORT';
  const start = Math.max(Date.parse(dasha.mdStart), Date.parse(dasha.adStart)); const end = Math.min(Date.parse(dasha.mdEnd), Date.parse(dasha.adEnd));
  return freeze({ classification, eligible, factors: freeze([md, ad, pd]), periods: freeze({ md: dasha.md, ad: dasha.ad, pd: dasha.pd, mdStart: dasha.mdStart, mdEnd: dasha.mdEnd, adStart: dasha.adStart, adEnd: dasha.adEnd, pdStart: dasha.pdStart, pdEnd: dasha.pdEnd, start: Number.isFinite(start) && Number.isFinite(end) && end > start ? new Date(start).toISOString() : null, end: Number.isFinite(start) && Number.isFinite(end) && end > start ? new Date(end).toISOString() : null }) });
}

function pdRefinement(mdAd) {
  const pd = mdAd && mdAd.factors.find((factor) => factor.level === 'PD');
  if (!pd) return freeze({ state: 'NOT_RELEVANT', factor: null });
  const state = pd.role === 'VEHICLE_ACTIVE' ? 'PRIMARY_REFINEMENT'
    : pd.role === 'VEHICLE_SUPPORTING' ? 'CONFIRMING_REFINEMENT'
    : pd.role === 'CONTEXTUAL' ? 'CONTEXT_ONLY' : 'NOT_RELEVANT';
  return freeze({ state, factor: freeze({ planet: pd.planet, role: pd.role, d1: pd.d1, d16: pd.d16 }) });
}

function transitEvidence(snapshot, d1Houses) {
  const h4Lord = planetId(houseMap(d1Houses).get(4).rashiHouseLord);
  const acquisitionLords = new Set([planetId(houseMap(d1Houses).get(2).rashiHouseLord), planetId(houseMap(d1Houses).get(11).rashiHouseLord)]);
  const entries = [];
  for (const planet of ALL_TRANSIT_PLANETS) {
    const item = snapshot.transitBodies[planet]; if (!item) continue;
    const natalHouse = item.transitNatalHouseNumber;
    const aspectHouses = (item.aspectsNatalHouses || []).map((entry) => entry.houseNumber);
    const targets = (item.aspectsNatalBodies || []).map((entry) => planetId(entry.natalBody));
    const conjunctions = (item.sameRashiNatalBodies || []).map((entry) => planetId(entry.body || entry));
    const direct = natalHouse === 4 || aspectHouses.includes(4) || targets.includes(h4Lord) || conjunctions.includes(h4Lord);
    const acquisition = ACQUISITION_HOUSES.includes(natalHouse) || aspectHouses.some((house) => ACQUISITION_HOUSES.includes(house)) || targets.some((planetIdValue) => acquisitionLords.has(planetIdValue)) || conjunctions.some((planetIdValue) => acquisitionLords.has(planetIdValue));
    const contexts = freeze([natalHouse, ...aspectHouses].filter((house) => CONTEXT_HOUSES.includes(house)));
    entries.push(freeze({ planet, kind: MAJOR_TRANSIT_PLANETS.includes(planet) ? 'MAJOR' : SUPPORTING_TRANSIT_PLANETS.includes(planet) ? 'SUPPORTING' : 'CONTEXT_ONLY', natalHouse, aspectHouses: freeze(aspectHouses), directVehicleConnection: direct, acquisitionConnection: acquisition, contextualHouses: contexts, natalInteractions: freeze({ conjunctions: freeze(conjunctions), aspects: freeze(targets) }) }));
  }
  const majorDirect = entries.filter((item) => item.kind === 'MAJOR' && item.directVehicleConnection);
  const majorSupporting = entries.filter((item) => item.kind === 'MAJOR' && !item.directVehicleConnection && item.acquisitionConnection);
  const supporting = entries.filter((item) => item.kind === 'SUPPORTING' && (item.directVehicleConnection || item.acquisitionConnection));
  const contexts = entries.filter((item) => item.kind === 'CONTEXT_ONLY' || item.contextualHouses.length > 0);
  const majorConfirmation = majorDirect.length ? contexts.length ? 'MIXED_MAJOR_CONFIRMATION' : 'MAJOR_CONFIRMATION' : majorSupporting.length ? 'PARTIAL_MAJOR_CONFIRMATION' : 'NO_MAJOR_CONFIRMATION';
  return freeze({ all: freeze(entries), majorDirect: freeze(majorDirect), majorSupporting: freeze(majorSupporting), supporting: freeze(supporting), contexts: freeze(contexts), majorConfirmation, hasMajorConfirmation: majorDirect.length > 0 || majorSupporting.length > 0 });
}

function ashtakavargaEvidence(raw, houses) {
  const values = new Map(((raw && raw.rawSarvashtakavarga && raw.rawSarvashtakavarga.rashis) || []).filter((row) => Number.isInteger(row.rashiIndex)).map((row) => [row.rashiIndex, row.favorableMarkCount]));
  const chart = houseMap(houses);
  return freeze({ policy: 'CONTEXT_ONLY_NO_THRESHOLDS', sav: freeze([2, 4, 11].map((house) => freeze({ house, bindu: values.get(chart.get(house).rashi.rashiIndex) ?? null }))), bav: 'AVAILABLE_RAW_ONLY' });
}

function calibration(events, at) {
  const before = events.filter((event) => ['VEHICLE_PURCHASE', 'VEHICLE_SALE'].includes(event.eventType)).filter((event) => {
    const date = event.eventDate || {}; const year = date.year; if (!Number.isInteger(year)) return false;
    return Date.UTC(year, Math.max(0, (date.month || 1) - 1), date.day || 1) < Date.parse(at);
  });
  return freeze({ policy: 'STRICTLY_PRIOR_CONTEXT_ONLY', eventCount: before.length, events: freeze(before.map((event) => freeze({ lifeEventId: event.lifeEventId, eventType: event.eventType, eventDate: event.eventDate }))), recurringPattern: false });
}

// MONTH/YEAR records represent an uncertainty interval.  These samples are
// only a deterministic retrospective summary of that interval; they never
// manufacture a precise vehicle-event date.
function retrospectiveSampleInstants(interval, precision) {
  if (!interval || !Number.isFinite(Date.parse(interval.from)) || !Number.isFinite(Date.parse(interval.to))) fail('INVALID_VEHICLE_CALIBRATION_INTERVAL');
  if (precision === 'DAY') return freeze([interval.from]);
  const from = Date.parse(interval.from); const to = Date.parse(interval.to);
  if (to <= from) fail('INVALID_VEHICLE_CALIBRATION_INTERVAL');
  return freeze([interval.from, new Date(from + Math.floor((to - from) / 2)).toISOString(), new Date(to - 1).toISOString()]);
}

async function reconstructVehicleRetrospectiveEvidence({ principal, birthProfileId, interval, datePrecision, birthProfileService, astronomicalEngine, canonicalSiderealSunSampler } = {}) {
  if (!birthProfileService || typeof birthProfileService.get !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler) fail('INVALID_VEHICLE_RETROSPECTIVE_DEPENDENCIES');
  const profile = await birthProfileService.get({ principal, birthProfileId });
  if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
  const natal = astronomicalEngine.calculate(request(profile.birthData));
  const d1Houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
  const d1 = d1Evidence(d1Houses); const d16 = d16Evidence(natal); const promise = natalPromise(d1, d16);
  const dashaTree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
  const ashtakavarga = ashtakavargaEvidence(calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal)), d1Houses);
  const samples = retrospectiveSampleInstants(interval, datePrecision).map((instant) => {
    const dasha = dashaAt(dashaTree, instant); const mdAd = mdAdEvidence(d1Houses, d16, dasha); const pd = pdRefinement(mdAd);
    const transitBodies = astronomicalEngine.calculate(transitRequest(instant, profile.birthData));
    const snapshot = calculateGocharSnapshot({ snapshotInstant: instant, natalBodies: natal.bodies, natalHouses: d1Houses, transitBodies: transitBodies.bodies });
    const transit = transitEvidence(snapshot, d1Houses);
    return freeze({ instant, dasha: freeze({ classification: mdAd.classification, eligible: mdAd.eligible, md: mdAd.periods && mdAd.periods.md || null, ad: mdAd.periods && mdAd.periods.ad || null, pd: mdAd.periods && mdAd.periods.pd || null, pdRefinement: pd.state }), transit: freeze({ majorConfirmation: transit.majorConfirmation, hasMajorConfirmation: transit.hasMajorConfirmation, majorPlanets: freeze([...transit.majorDirect, ...transit.majorSupporting].map((item) => item.planet)), supportPlanets: freeze(transit.supporting.map((item) => item.planet)) }) });
  });
  return freeze({ foundation: freeze({ classification: promise, d1Seed: d1.d1Seed, coreConnectionCount: d1.coreVehicleConnections.length, acquisitionConnectionCount: d1.acquisitionConnections.length }), d16: freeze({ confirmation: d16.confirmation, coreConnectionCount: d16.coreVehicleConnections.length, acquisitionConnectionCount: d16.acquisitionConnections.length }), dasha: freeze(samples.map((item) => item.dasha)), transit: freeze(samples.map((item) => item.transit)), ashtakavarga, intervalSummary: freeze({ policy: datePrecision === 'DAY' ? 'EXACT_DAY' : datePrecision === 'MONTH' ? 'INTERVAL_START_MIDPOINT_END_MINUS_ONE' : 'BROAD_INTERVAL_START_MIDPOINT_END_MINUS_ONE', sampleInstants: freeze(samples.map((item) => item.instant)) }), provenance: freeze({ vehicleRulesVersion: VEHICLE_RULESET_VERSION, dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, d16RulesetId: 'parashari-shodashamsha-v1', ashtakavargaPolicy: 'RAW_CONTEXT_ONLY' }) });
}

function vehicleCalibrationCandidates(window, classification) {
  const windows = [window, ...((window && window.secondaryWindows) || [])].filter(Boolean);
  return freeze(windows.map((item, index) => {
    const phase = item.internalPhases && item.internalPhases[0];
    return freeze({ candidateId: `vehicle-candidate-v1:${item.start}:${item.end}:${phase && phase.refinement && phase.refinement.pd || 'none'}`, primaryRank: index, primaryState: classification, primaryStrength: item.candidateStrength || null, start: item.start, end: item.end, primaryEvidenceFingerprint: freeze({ pd: phase && phase.refinement && phase.refinement.pd || null, majorConfirmation: phase && phase.majorGocharConfirmation || null }) });
  }));
}

function classifyCandidate({ promise, d16, mdAd, pd, transit }) {
  if (!['STRONG', 'MODERATE'].includes(promise) || d16.confirmation !== 'CONFIRMS' || !mdAd.eligible || !['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT'].includes(pd.state) || !transit.hasMajorConfirmation) return 'NOT_SUPPORTED';
  if (mdAd.classification === 'STRONG_MD_AD_SUPPORT' && pd.state === 'PRIMARY_REFINEMENT' && transit.majorConfirmation === 'MAJOR_CONFIRMATION') return 'STRONG_CANDIDATE';
  if (transit.majorConfirmation === 'MAJOR_CONFIRMATION' || transit.majorConfirmation === 'PARTIAL_MAJOR_CONFIRMATION') return 'MODERATE_CANDIDATE';
  return 'MIXED_CANDIDATE';
}

function classifyWindowShape({ start, end }) {
  const startMs = Date.parse(start); const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 'NO_RELIABLE_WINDOW';
  return endMs - startMs < DAY ? 'BRIEF_ACTIVATION' : 'BOUNDED_WINDOW';
}
function strengthRank(value) { return ({ STRONG_CANDIDATE: 3, MODERATE_CANDIDATE: 2, MIXED_CANDIDATE: 1, NOT_SUPPORTED: 0 })[value] || 0; }
function temporalPriority(candidate, now) { const stamp = Date.parse(now); return Date.parse(candidate.start) <= stamp && stamp < Date.parse(candidate.end) ? 0 : Date.parse(candidate.start) > stamp ? 1 : 2; }

// Transit scanning deliberately retains every refined state transition.  Those
// transitions are evidence, not automatically customer-facing window ends:
// a Mars/Venus refinement or a Jupiter/Saturn sign change can leave the
// complete approved Vehicle timing stack at the same effective support level.
function internalPhase(candidate) {
  return freeze({
    start: candidate.start,
    end: candidate.end,
    candidateStrength: candidate.candidateStrength,
    windowShape: candidate.windowShape,
    majorGocharConfirmation: candidate.transit.majorConfirmation,
    majorGocharPlanets: freeze([...candidate.transit.majorDirect, ...candidate.transit.majorSupporting].map((item) => item.planet)),
    contextualFactors: freeze(candidate.transit.contexts.map((item) => freeze({ planet: item.planet, kind: item.kind, houses: item.contextualHouses }))),
    transitChanges: candidate.transitChanges || freeze([]),
    refinement: freeze({ mdAdSupport: candidate.mdAd.classification, pd: candidate.mdAd.periods.pd, pdRefinement: candidate.pd.state }),
  });
}

function isContiguous(left, right) { return Date.parse(left.end) === Date.parse(right.start); }
function sameEffectiveVehicleSupport(left, right) {
  return left.candidateStrength === right.candidateStrength
    && left.natalPromise === right.natalPromise
    && left.d16Confirmation === right.d16Confirmation
    && left.mdAd.eligible && right.mdAd.eligible
    && left.pd.state === right.pd.state
    && left.transit.hasMajorConfirmation && right.transit.hasMajorConfirmation
    && left.transit.majorConfirmation === right.transit.majorConfirmation;
}
function windowPeak(candidates, now) {
  const starts = Date.parse(candidates[0].start); const ends = Date.parse(candidates[candidates.length - 1].end); const nowMs = Date.parse(now);
  return candidates.map((candidate) => candidate.peakActivation).filter((peak) => peak && Date.parse(peak.start) >= starts && Date.parse(peak.end) <= ends && Date.parse(peak.end) >= nowMs)[0] || null;
}

function coalesceVehicleCandidates(candidates, { now } = {}) {
  const supported = candidates.filter((candidate) => candidate.candidateStrength !== 'NOT_SUPPORTED' && candidate.windowShape !== 'NO_RELIABLE_WINDOW')
    .slice().sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
  const groups = [];
  for (const candidate of supported) {
    const group = groups[groups.length - 1];
    if (group && isContiguous(group.candidates[group.candidates.length - 1], candidate) && sameEffectiveVehicleSupport(group.candidates[group.candidates.length - 1], candidate)) {
      group.candidates.push(candidate);
    } else groups.push({ candidates: [candidate] });
  }
  return freeze(groups.map(({ candidates: phases }) => {
    const first = phases[0]; const last = phases[phases.length - 1]; const start = first.start; const end = last.end;
    const supportWindow = freeze({ start, end, candidateStrength: first.candidateStrength, windowShape: classifyWindowShape({ start, end }) });
    return freeze({
      ...first,
      start,
      end,
      windowShape: supportWindow.windowShape,
      peakActivation: windowPeak(phases, now),
      supportWindow,
      internalPhases: freeze(phases.map(internalPhase)),
    });
  }));
}
function selectVehicleWindow(candidates, { now } = {}) {
  const usable = candidates.filter((candidate) => candidate.candidateStrength !== 'NOT_SUPPORTED' && candidate.windowShape !== 'NO_RELIABLE_WINDOW');
  if (!usable.length) return null;
  const ranked = usable.slice().sort((left, right) => {
    const temporal = temporalPriority(left, now) - temporalPriority(right, now); if (temporal) return temporal;
    if (temporalPriority(left, now) === 1) { const earlier = Date.parse(left.start) - Date.parse(right.start); if (earlier) return earlier; }
    const strength = strengthRank(right.candidateStrength) - strengthRank(left.candidateStrength); if (strength) return strength;
    const duration = (Date.parse(right.end) - Date.parse(right.start)) - (Date.parse(left.end) - Date.parse(left.start)); if (duration) return duration;
    return Date.parse(left.start) - Date.parse(right.start);
  });
  return freeze({ selected: ranked[0], ranked: freeze(ranked), secondary: freeze(ranked.slice(1, 3)) });
}

function transitBoundaries(scan, start, end) {
  const events = (scan.events || [])
    .filter((event) => ALL_TRANSIT_PLANETS.includes(event.body) && Date.parse(event.instant) > Date.parse(start) && Date.parse(event.instant) < Date.parse(end))
    .map((event) => event.instant);
  return freeze([...new Set([start, end, ...events])].sort());
}
function selectPeak(states, now) {
  return states.filter((state) => state.evidence.hasMajorConfirmation && Date.parse(state.end) >= Date.parse(now)).sort((left, right) => (right.evidence.majorDirect.length - left.evidence.majorDirect.length) || (right.evidence.majorSupporting.length - left.evidence.majorSupporting.length) || Date.parse(left.start) - Date.parse(right.start))[0] || null;
}
function transitStatesForPd({ engine, scanner, birth, natalBodies, d1Houses, start, end, now }) {
  const scan = scanner({ startInstant: start, endInstant: end, natalBodies, natalHouses: d1Houses, astronomicalEngine: engine, observer: { latitude: birth.latitude, longitude: birth.longitude }, bodies: ALL_TRANSIT_PLANETS, eventTypes: ['rashiIngress', 'transitDrishtiStart', 'transitDrishtiEnd', 'sameRashiAssociationStart', 'sameRashiAssociationEnd'], options: { coarseScanStepMilliseconds: VEHICLE_WINDOW_COARSE_SCAN_STEP_MS } });
  const boundaries = transitBoundaries(scan, start, end); const states = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const stateStart = boundaries[index]; const stateEnd = boundaries[index + 1]; if (Date.parse(stateEnd) <= Date.parse(stateStart)) continue;
    const transitBodies = engine.calculate(transitRequest(stateStart, birth));
    const snapshot = calculateGocharSnapshot({ snapshotInstant: stateStart, natalBodies, natalHouses: d1Houses, transitBodies: transitBodies.bodies });
    const evidence = transitEvidence(snapshot, d1Houses);
    const source = freeze((scan.events || []).filter((event) => event.instant === stateStart).map((event) => freeze({ planet: event.body, eventType: event.eventType })));
    states.push(freeze({ start: stateStart, end: stateEnd, evidence, source }));
  }
  const peak = selectPeak(states, now);
  return freeze({ states: freeze(states), peakActivation: peak && freeze({ start: peak.start, end: peak.end, source: peak.source }) || null });
}

function pdIntervals(tree, start, end) {
  const intervals = [];
  for (const md of tree.periods || []) for (const ad of md.children || []) for (const pd of ad.children || []) {
    if (Date.parse(pd.endInstant.utc) <= Date.parse(start) || Date.parse(pd.startInstant.utc) >= Date.parse(end)) continue;
    intervals.push(freeze({ start: pd.startInstant.utc, end: pd.endInstant.utc }));
  }
  return freeze(intervals.sort((left, right) => Date.parse(left.start) - Date.parse(right.start)));
}
function candidateDiagnostic(candidate) { return freeze({ pd: candidate.mdAd.periods.pd, pdStart: candidate.pdStart, pdEnd: candidate.pdEnd, candidateStart: candidate.start, candidateEnd: candidate.end, candidateStrength: candidate.candidateStrength, windowShape: candidate.windowShape, mdAdSupport: candidate.mdAd.classification, pdRefinement: candidate.pd.state, majorTransitConfirmation: candidate.transit.majorConfirmation, majorTransitPlanets: freeze([...candidate.transit.majorDirect, ...candidate.transit.majorSupporting].map((item) => item.planet)), peakStart: candidate.peakActivation && candidate.peakActivation.start || null, peakEnd: candidate.peakActivation && candidate.peakActivation.end || null }); }
function strongerWindow({ engine, scanner, birth, natalBodies, d1Houses, d16, dashaTree, promise, start, diagnosticLog }) {
  const horizonEnd = new Date(Date.parse(start) + 365 * DAY).toISOString(); const candidates = [];
  for (const interval of pdIntervals(dashaTree, start, horizonEnd)) {
    const current = dashaAt(dashaTree, interval.start); const mdAd = mdAdEvidence(d1Houses, d16, current); const pd = pdRefinement(mdAd);
    if (!mdAd.eligible || !['PRIMARY_REFINEMENT', 'CONFIRMING_REFINEMENT'].includes(pd.state)) continue;
    const transitStates = transitStatesForPd({ engine, scanner, birth, natalBodies, d1Houses, start: interval.start, end: interval.end, now: start });
    for (const state of transitStates.states) {
      const candidate = freeze({ start: state.start, end: state.end, pdStart: interval.start, pdEnd: interval.end, natalPromise: promise, d16Confirmation: d16.confirmation, mdAd, pd, transit: state.evidence, transitChanges: state.source, candidateStrength: classifyCandidate({ promise, d16, mdAd, pd, transit: state.evidence }), windowShape: classifyWindowShape(state), peakActivation: transitStates.peakActivation && Date.parse(transitStates.peakActivation.end) >= Date.parse(start) ? transitStates.peakActivation : null });
      if (typeof diagnosticLog === 'function') diagnosticLog(freeze({ event: 'VEHICLE_PD_REFINEMENT', ...candidateDiagnostic(candidate) }));
      if (candidate.candidateStrength !== 'NOT_SUPPORTED') candidates.push(candidate);
    }
  }
  const customerWindows = coalesceVehicleCandidates(candidates, { now: start });
  const selected = selectVehicleWindow(customerWindows, { now: start });
  if (!selected) {
    if (typeof diagnosticLog === 'function') {
      diagnosticLog(freeze({ event: 'VEHICLE_WINDOW_RANKING', rank: null, state: 'NO_SUPPORTED_CANDIDATES' }));
      diagnosticLog(freeze({ event: 'VEHICLE_WINDOW_SELECTED', state: 'NO_RELIABLE_WINDOW' }));
      diagnosticLog(freeze({ event: 'VEHICLE_PEAK_SELECTED', peakStart: null, peakEnd: null, peakSource: freeze([]) }));
    }
    return null;
  }
  if (typeof diagnosticLog === 'function') {
    for (const [index, candidate] of selected.ranked.entries()) diagnosticLog(freeze({ event: 'VEHICLE_WINDOW_RANKING', rank: index + 1, activeNow: temporalPriority(candidate, start) === 0, future: temporalPriority(candidate, start) === 1, ...candidateDiagnostic(candidate) }));
    diagnosticLog(freeze({ event: 'VEHICLE_WINDOW_SELECTED', ...candidateDiagnostic(selected.selected) }));
    diagnosticLog(freeze({ event: 'VEHICLE_PEAK_SELECTED', ...candidateDiagnostic(selected.selected) }));
  }
  const publicCandidate = (candidate) => freeze({ start: candidate.start, end: candidate.end, candidateStrength: candidate.candidateStrength, windowShape: candidate.windowShape, temporalStatus: temporalPriority(candidate, start) === 0 ? 'CURRENT' : temporalPriority(candidate, start) === 1 ? 'UPCOMING' : 'HISTORICAL', peakActivation: candidate.peakActivation, basis: 'D1_D16_MD_AD_PD_MAJOR_GOCHAR', supportWindow: candidate.supportWindow, internalPhases: candidate.internalPhases });
  return freeze({ ...publicCandidate(selected.selected), secondaryWindows: freeze(selected.secondary.map(publicCandidate)) });
}

class VehicleAnswerService {
  constructor({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService = null, clock = () => new Date().toISOString(), transitScanner = scanTransitEvents, lifeEventCalibrationCoordinator = null, vehicleCalibrationAdapter = null } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !lifeEventService || typeof lifeEventService.getRelevantLifeEvents !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler) throw new TypeError('INVALID_VEHICLE_ANSWER_DEPENDENCIES');
    if (entitlementService && typeof entitlementService.getReadingEntitlementStatus !== 'function') throw new TypeError('INVALID_PROFILE_PREMIUM_ENTITLEMENT_SERVICE');
    if ((lifeEventCalibrationCoordinator && !vehicleCalibrationAdapter) || (!lifeEventCalibrationCoordinator && vehicleCalibrationAdapter)) throw new TypeError('INVALID_VEHICLE_CALIBRATION_DEPENDENCIES');
    Object.assign(this, { profiles: birthProfileService, lifeEvents: lifeEventService, engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, entitlements: entitlementService, clock, scanner: transitScanner, calibrationCoordinator: lifeEventCalibrationCoordinator, calibrationAdapter: vehicleCalibrationAdapter }); Object.freeze(this);
  }
  async answer({ principal, birthProfileId, intent = VehicleIntent.VEHICLE_CURRENT_STRENGTH, at = null, diagnosticLog = null, includeInternalCalibration = false } = {}) {
    if (!Object.values(VehicleIntent).includes(intent)) fail('UNSUPPORTED_VEHICLE_INTENT');
    const log = (event, fields = {}) => { if (typeof diagnosticLog === 'function') diagnosticLog(freeze({ event, birthProfileId, intent, ...fields })); };
    if (this.entitlements) {
      const access = await this.entitlements.getReadingEntitlementStatus({ principal, birthProfileId });
      const premium = access && (access.profilePremium || access.career);
      if (!premium || premium.eligible !== true) return freeze({ intent, answerability: 'PREMIUM_REQUIRED', state: 'PREMIUM_REQUIRED', classification: 'NOT_SUPPORTED', action: freeze({ type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' }), strongerWindow: null, windowShape: 'NO_RELIABLE_WINDOW', evidence: null, limitations: freeze(['PROFILE_PREMIUM_REQUIRED']), provenance: null });
    }
    const profile = await this.profiles.get({ principal, birthProfileId }); if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    const instant = at || new Date(this.clock()).toISOString(); let stage = 'NATAL';
    try {
      const natal = this.engine.calculate(request(profile.birthData)); const d1Houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
      const d1 = d1Evidence(d1Houses);
      stage = 'D16'; const d16 = d16Evidence(natal); const promise = natalPromise(d1, d16); log('VEHICLE_NATAL_PROMISE', { state: promise, d1State: d1.classification, evidenceCount: d1.coreVehicleConnections.length }); log('VEHICLE_D16_CONFIRMATION', { state: d16.confirmation, evidenceCount: d16.coreVehicleConnections.length });
      stage = 'DASHA'; const dashaTree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id }); const mdAd = mdAdEvidence(d1Houses, d16, dashaAt(dashaTree, instant)); const pd = pdRefinement(mdAd); log('VEHICLE_MD_AD_ELIGIBILITY', { state: mdAd.classification, evidenceCount: mdAd.factors.filter((factor) => factor.role === 'VEHICLE_ACTIVE').length }); log('VEHICLE_PD_REFINEMENT', { state: pd.state, evidenceCount: pd.state === 'NOT_RELEVANT' ? 0 : 1 });
      stage = 'TRANSIT'; const transitBodies = this.engine.calculate(transitRequest(instant, profile.birthData)); const snapshot = calculateGocharSnapshot({ snapshotInstant: instant, natalBodies: natal.bodies, natalHouses: d1Houses, transitBodies: transitBodies.bodies }); const transit = transitEvidence(snapshot, d1Houses); log('VEHICLE_TRANSIT_CONFIRMATION', { state: transit.majorConfirmation, evidenceCount: transit.majorDirect.length + transit.majorSupporting.length });
      stage = 'ASHTAKAVARGA'; const ashtakavarga = ashtakavargaEvidence(calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal)), d1Houses);
      stage = 'CALIBRATION'; const events = await this.lifeEvents.getRelevantLifeEvents({ principal, birthProfileId, categories: ['VEHICLE'] }); const history = calibration(events, instant);
      stage = 'WINDOW'; const window = strongerWindow({ engine: this.engine, scanner: this.scanner, birth: profile.birthData, natalBodies: natal.bodies, d1Houses, d16, dashaTree, promise, start: instant, diagnosticLog: log });
      const currentStrength = classifyCandidate({ promise, d16, mdAd, pd, transit });
      const result = freeze({ intent, answerability: promise === 'NO_VEHICLE_PROMISE' ? 'LIMITED_EVIDENCE' : 'SUPPORTED', classification: currentStrength, natalPromise: promise, strongerWindow: window, windowShape: window && window.windowShape || 'NO_RELIABLE_WINDOW', evidence: freeze({ d1, d16: freeze({ ...d16, d16Houses: undefined }), mdAd, pd, transit, ashtakavarga, lifeEvents: history }), limitations: freeze(['NO_OUTCOME_GUARANTEE', 'NO_EXACT_PURCHASE_DATE', 'SAV_BAV_CONTEXT_ONLY', 'LIFE_EVENTS_CALIBRATION_ONLY']), provenance: freeze({ vehicleRulesVersion: VEHICLE_RULESET_VERSION, dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, d16RulesetId: 'parashari-shodashamsha-v1', transitBoundaryPolicy: 'REFINED_EXISTING_TRANSIT_BOUNDARIES_ONLY' }) });
      const internalCalibration = this.calibrationCoordinator && await this.calibrationCoordinator.calibrate({ principal, birthProfileId, adapter: this.calibrationAdapter, primaryCandidates: vehicleCalibrationCandidates(window, currentStrength), primaryDomainRulesVersion: result.provenance.vehicleRulesVersion, adapterContext: { intent, primaryVehicleEvidence: { d1, d16, mdAd, pd, transit, ashtakavarga }, strongerWindow: window } });
      if (internalCalibration) log('VEHICLE_LIFE_EVENT_CALIBRATION', { state: internalCalibration.status, patternStrength: internalCalibration.patternStrength, eventCount: internalCalibration.comparableEventCount });
      log('VEHICLE_RESULT', { state: result.classification, evidenceCount: transit.majorDirect.length + transit.majorSupporting.length });
      const historicalContext = publicHistoricalContext({ domain: 'VEHICLE', calibration: internalCalibration });
      const publicResult = historicalContext ? freeze({ ...result, historicalContext }) : result;
      return includeInternalCalibration && internalCalibration ? freeze({ ...publicResult, internalCalibration }) : publicResult;
    } catch (error) {
      log('VEHICLE_RESULT', { state: 'FAILED', stage, safeErrorCode: error && error.code || 'VEHICLE_CALCULATION_FAILED', errorClass: error && error.name || 'Error' }); throw error;
    }
  }
}

module.exports = { VehicleAnswerService, VehicleIntent, VEHICLE_RULESET_VERSION, d1Evidence, d16Evidence, natalPromise, vehicleFactor, mdAdEvidence, pdRefinement, transitEvidence, ashtakavargaEvidence, calibration, retrospectiveSampleInstants, reconstructVehicleRetrospectiveEvidence, vehicleCalibrationCandidates, classifyCandidate, classifyWindowShape, coalesceVehicleCandidates, sameEffectiveVehicleSupport, selectVehicleWindow, selectPeak, transitBoundaries, transitStatesForPd, strongerWindow, VEHICLE_WINDOW_COARSE_SCAN_STEP_MS };
