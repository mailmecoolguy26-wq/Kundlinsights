'use strict';

// Property Rules v1 is intentionally an evidence-first projection.  The
// classifications below implement the approved product contract; they do not
// estimate an outcome or a probability.
const { calculateRashiHouses } = require('../../bhava');
const { calculateGocharSnapshot } = require('../../gochar');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { scanTransitEvents } = require('../../transit-events');
const { calculateChartCoordinates } = require('../divisional-charts/divisional-chart-service');
const { calculateAshtakavargaForLayer2 } = require('../ashtakavarga');
const { classifyLayer1Bodies, canonicalPlanetId } = require('../../jyotish');

const PropertyIntent = Object.freeze({
  PROPERTY_CURRENT_STRENGTH: 'PROPERTY_CURRENT_STRENGTH',
  PROPERTY_PURCHASE_TIMING: 'PROPERTY_PURCHASE_TIMING',
  PROPERTY_SALE_TIMING: 'PROPERTY_SALE_TIMING',
  PROPERTY_LOAN_CONTEXT: 'PROPERTY_LOAN_CONTEXT',
  PROPERTY_INHERITANCE_CONTEXT: 'PROPERTY_INHERITANCE_CONTEXT',
  PROPERTY_STRONGER_WINDOW: 'PROPERTY_STRONGER_WINDOW',
});
const MAJOR = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);
const SUPPORT = Object.freeze(['Mars', 'Venus']);
const PROPERTY_HOUSES = Object.freeze([2, 4, 11]);
const CONTEXT_HOUSES = Object.freeze([6, 8, 12]);
const DAY = 86_400_000;
// The shared Layer 10 scanner refines every transition after coarse discovery.
// A daily coarse cadence is its documented maximum and retains the same
// customer-facing refined ingress/aspect/association boundaries without the
// 18k+ hourly astronomy samples previously used by a Property window scan.
const PROPERTY_WINDOW_COARSE_SCAN_STEP_MS = DAY;

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function planetId(value) { return canonicalPlanetId(value) || String(value || '').toLowerCase(); }
function request(birth) { return { date: birth.localDate, time: birth.localTime, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }; }
function transitRequest(instant, birth) { const date = new Date(instant); return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 23), timezone: 'UTC', latitude: birth.latitude, longitude: birth.longitude }; }
function overlaps(a, b) { return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end); }
function houseMap(houses) { return new Map(houses.houses.map((house) => [house.houseNumber, house])); }
function assignments(houses) { return new Map(houses.planetaryAssignments.map((item) => [planetId(item.body), item])); }
function lords(houses) { const out = new Map(); for (const house of houses.houses) { const id = canonicalPlanetId(house.rashiHouseLord); if (!id) continue; if (!out.has(id)) out.set(id, []); out.get(id).push(house.houseNumber); } return out; }
function planetsIn(houses, number) { return houses.planetaryAssignments.filter((item) => item.rashiHouseNumber === number).map((item) => item.body); }
function sameSign(houses, left, right) { const a = assignments(houses).get(planetId(left)); const b = assignments(houses).get(planetId(right)); return Boolean(a && b && a.rashiHouseNumber === b.rashiHouseNumber); }
function natalAspects(houses, targetHouse) {
  // The shared Gochar Drishti rules are the only existing aspect primitive.
  // D1 natal aspects are therefore not inferred here; the result records this
  // limitation rather than manufacturing a new natal-aspect ruleset.
  return Object.freeze([]);
}
function connectedPlanet(houses, body) {
  const id = canonicalPlanetId(body); if (!id) return freeze({ planet: null, corePropertyConnection: false, acquisitionConnection: false, contextConnection: false, placementHouse: null, rulesHouses: freeze([]) }); const byLord = lords(houses); const placement = assignments(houses).get(id);
  const core = (byLord.get(id) || []).includes(4) || Boolean(placement && placement.rashiHouseNumber === 4) || sameSign(houses, id, houseMap(houses).get(4).rashiHouseLord);
  const acquisition = (byLord.get(id) || []).some((house) => house === 2 || house === 11) || Boolean(placement && (placement.rashiHouseNumber === 2 || placement.rashiHouseNumber === 11));
  const context = (byLord.get(id) || []).some((house) => CONTEXT_HOUSES.includes(house)) || Boolean(placement && CONTEXT_HOUSES.includes(placement.rashiHouseNumber));
  return freeze({ planet: id, corePropertyConnection: core, acquisitionConnection: acquisition, contextConnection: context, placementHouse: placement && placement.rashiHouseNumber || null, rulesHouses: freeze((byLord.get(id) || []).slice().sort((a, b) => a - b)) });
}
function natalEvidence(houses) {
  const h4 = houseMap(houses).get(4); const fourthLord = h4.rashiHouseLord;
  const candidates = [...new Set([...houses.planetaryAssignments.map((item) => canonicalPlanetId(item.body)), canonicalPlanetId(fourthLord)].filter(Boolean))];
  const links = candidates.map((planet) => connectedPlanet(houses, planet));
  const core = links.filter((item) => item.corePropertyConnection);
  const acquisition = links.filter((item) => item.acquisitionConnection);
  // The approved contract permits the core and acquisition connections to be
  // supplied by different chart factors.  The evidence remains explicit, so
  // interpretation can distinguish the factors instead of implying one
  // planet is responsible for both roles.
  const classification = core.length && acquisition.length ? 'STRONG' : core.length ? 'MODERATE' : 'LIMITED';
  return freeze({ classification, fourthHouse: freeze({ house: 4, lord: fourthLord, occupants: freeze(planetsIn(houses, 4)), aspects: natalAspects(houses, 4) }), acquisitionHouses: freeze([2, 11]), contextHouses: freeze(CONTEXT_HOUSES.slice()), connections: freeze(links), coreConnectionCount: core.length, acquisitionConnectionCount: acquisition.length });
}
function d4Evidence(natal, houses) {
  const chart = calculateChartCoordinates(natal, 'd4'); const d4Houses = chart.houses; const h4 = houseMap(d4Houses).get(4); const lord = h4.rashiHouseLord;
  const occupants = planetsIn(d4Houses, 4); const lordPlacement = assignments(d4Houses).get(planetId(lord));
  // No D4 dignity/affliction scoring exists in the engine, so D4 can only
  // confirm through the approved factual placement/lordship/conjunction facts.
  const confirms = occupants.length > 0 || Boolean(lordPlacement && (lordPlacement.rashiHouseNumber === 1 || lordPlacement.rashiHouseNumber === 4)) || sameSign(d4Houses, lord, 'Ascendant');
  return freeze({ chart: 'D4', ascendant: d4Houses.ascendant.rashi.rashiIndex, fourthHouse: freeze({ house: 4, lord, occupants: freeze(occupants) }), fourthLordHouse: lordPlacement && lordPlacement.rashiHouseNumber || null, confirmation: confirms ? 'CONFIRMS' : 'NEUTRAL', dignity: 'NOT_AVAILABLE', aspects: 'NOT_AVAILABLE', d4Houses });
}
function dashaAt(dasha, instant) {
  const stamp = Date.parse(instant);
  for (const md of dasha.periods) if (stamp >= Number(md.startInstant.epochMilliseconds) && stamp < Number(md.endInstant.epochMilliseconds)) for (const ad of md.children) if (stamp >= Number(ad.startInstant.epochMilliseconds) && stamp < Number(ad.endInstant.epochMilliseconds)) for (const pd of ad.children) if (stamp >= Number(pd.startInstant.epochMilliseconds) && stamp < Number(pd.endInstant.epochMilliseconds)) return { mdStart: md.startInstant.utc, mdEnd: md.endInstant.utc, adStart: ad.startInstant.utc, adEnd: ad.endInstant.utc, pdStart: pd.startInstant.utc, pdEnd: pd.endInstant.utc, md: planetId(md.lord.id), ad: planetId(ad.lord.id), pd: planetId(pd.lord.id) };
  return null;
}
function primaryDashaBounds(dasha) {
  const mdStart = dasha.mdStart || dasha.start;
  const mdEnd = dasha.mdEnd || dasha.end;
  const adStart = dasha.adStart || dasha.start;
  const adEnd = dasha.adEnd || dasha.end;
  const start = Math.max(Date.parse(mdStart), Date.parse(adStart));
  const end = Math.min(Date.parse(mdEnd), Date.parse(adEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return freeze({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
}
function dashaEvidence(houses, dasha) {
  if (!dasha) return freeze({ classification: 'LIMITED', active: false, periods: null, factors: freeze([]) });
  // MD, AD, and PD may be ruled by the same planet. Preserve the Dasha level
  // by position rather than planet equality so a Me/Me/Me sequence remains
  // three independently auditable timing facts.
  const facts = [['MD', dasha.md], ['AD', dasha.ad], ['PD', dasha.pd]].map(([level, planet]) => ({ level, ...connectedPlanet(houses, planet) }));
  const md = facts[0], ad = facts[1], pd = facts[2];
  const strong = Boolean(md && ad && (md.corePropertyConnection || md.acquisitionConnection) && (ad.corePropertyConnection || ad.acquisitionConnection) && (md.corePropertyConnection || ad.corePropertyConnection));
  const moderate = Boolean(md && ad && (md.corePropertyConnection || ad.corePropertyConnection));
  const primaryBounds = primaryDashaBounds(dasha);
  return freeze({ classification: strong ? 'STRONG' : moderate ? 'MODERATE' : (pd && (pd.corePropertyConnection || pd.acquisitionConnection)) ? 'LIMITED' : 'LIMITED', active: strong || moderate, periods: freeze({ md: dasha.md, ad: dasha.ad, pd: dasha.pd, start: primaryBounds && primaryBounds.start || null, end: primaryBounds && primaryBounds.end || null, mdStart: dasha.mdStart || dasha.start || null, mdEnd: dasha.mdEnd || dasha.end || null, adStart: dasha.adStart || dasha.start || null, adEnd: dasha.adEnd || dasha.end || null, pdStart: dasha.pdStart || null, pdEnd: dasha.pdEnd || null }), factors: freeze(facts) });
}
function transitEvidence(snapshot, houses) {
  const h4Lord = planetId(houseMap(houses).get(4).rashiHouseLord); const out = [];
  for (const body of [...MAJOR, ...SUPPORT]) {
    const item = snapshot.transitBodies[body]; if (!item) continue;
    const house = item.transitNatalHouseNumber;
    const aspects = (item.aspectsNatalHouses || []).map((entry) => entry.houseNumber);
    const targetBodies = (item.aspectsNatalBodies || []).map((entry) => planetId(entry.natalBody));
    const property = house === 4 || aspects.includes(4) || (item.sameRashiNatalBodies || []).some((entry) => planetId(entry.body || entry) === h4Lord) || targetBodies.includes(h4Lord) || ((house === 2 || house === 11 || aspects.includes(2) || aspects.includes(11)) && (house === 4 || aspects.includes(4) || targetBodies.includes(h4Lord)));
    const contexts = freeze([house, ...aspects].filter((value) => CONTEXT_HOUSES.includes(value)));
    out.push(freeze({ planet: body, major: MAJOR.includes(body), supportOnly: SUPPORT.includes(body), natalHouse: house, aspectHouses: freeze(aspects), propertyActive: property, contexts, natalInteractions: freeze({ conjunctions: freeze((item.sameRashiNatalBodies || []).map((entry) => entry.body || entry)), aspects: freeze(targetBodies) }) }));
  }
  const activeMajor = out.filter((item) => item.major && item.propertyActive);
  return freeze({ activeMajor: freeze(activeMajor), activeSupport: freeze(out.filter((item) => item.supportOnly && item.propertyActive)), all: freeze(out), active: activeMajor.length > 0 });
}
function ashtakavargaEvidence(raw, houses) {
  // Raw Ashtakavarga rashi rows intentionally use the compact factual shape
  // `{ rashiIndex, favorableMarkCount }`; unlike the public DTO they do not
  // contain a nested `rashi` object.  This layer is context only, so an
  // unavailable individual value must remain null rather than failing a
  // grounded Property answer.
  const bySign = new Map((raw && raw.rawSarvashtakavarga && raw.rawSarvashtakavarga.rashis || [])
    .filter((item) => item && Number.isInteger(item.rashiIndex))
    .map((item) => [item.rashiIndex, item.favorableMarkCount]));
  const byHouse = houseMap(houses);
  return freeze({ policy: 'CONTEXT_ONLY_NO_THRESHOLDS', sav: freeze([2, 4, 11].map((house) => {
    const rashiIndex = byHouse.get(house) && byHouse.get(house).rashi && byHouse.get(house).rashi.rashiIndex;
    return freeze({ house, bindu: Number.isInteger(rashiIndex) ? bySign.get(rashiIndex) ?? null : null });
  })), bav: 'AVAILABLE_RAW_ONLY' });
}
function classify({ natal, d4, dasha, transit }) {
  if (natal.classification === 'STRONG' && d4.confirmation === 'CONFIRMS' && dasha.classification === 'STRONG' && transit.active) return 'STRONG';
  if ((natal.classification === 'STRONG' || natal.classification === 'MODERATE') && (dasha.classification === 'STRONG' || dasha.classification === 'MODERATE') && transit.active) return 'MODERATE';
  if (natal.classification !== 'LIMITED' && (dasha.active || transit.active)) return 'MIXED';
  return 'WEAK';
}
function eventInstant(event) {
  const date = event && event.eventDate || {};
  if (!Number.isInteger(date.year)) return null;
  return Date.UTC(date.year, Math.max(0, (date.month || 1) - 1), date.day || 1);
}
function calibration(events, at) {
  const cutoff = Date.parse(at);
  const usable = events
    .filter((event) => ['PROPERTY_PURCHASE', 'PROPERTY_SALE'].includes(event.eventType))
    .filter((event) => Number.isFinite(cutoff) && eventInstant(event) !== null && eventInstant(event) < cutoff);
  const state = usable.length === 0 ? 'NONE' : usable.length === 1 ? 'LIMITED' : usable.length === 2 ? 'MODERATE' : 'STRONG';
  return freeze({ state, eventCount: usable.length, recurringPattern: false, events: freeze(usable.map((event) => freeze({ lifeEventId: event.lifeEventId, eventType: event.eventType, eventDate: event.eventDate }))) });
}
function limitation(intent) { return intent === PropertyIntent.PROPERTY_SALE_TIMING ? 'PROPERTY_SALE_TIMING_NOT_PREDICTIVE_IN_V1' : null; }
function propertyTransitStateBoundaries(scan, scanStart, end) {
  return freeze([...new Set([scanStart, end, ...(scan.events || [])
    .filter((event) => [...MAJOR, ...SUPPORT].includes(event.body))
    .filter((event) => Date.parse(event.instant) >= Date.parse(scanStart) && Date.parse(event.instant) <= Date.parse(end))
    .map((event) => event.instant)])].sort());
}
function classifyPropertyWindow({ start, end }) {
  const startMs = Date.parse(start); const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 'NO_RELIABLE_WINDOW';
  if (endMs === startMs) return 'NO_RELIABLE_WINDOW';
  // A sub-day intersection is preserved as factual timing context but is not
  // promoted to a customer-facing stronger window. This is a presentation
  // classification only; no interval is extended or made eligible by it.
  return endMs - startMs < DAY ? 'BRIEF_ACTIVATION' : 'BOUNDED_WINDOW';
}
function propertyWindowClassificationRank(classification) { return ({ STRONG_CANDIDATE: 3, MODERATE_CANDIDATE: 2, MIXED_CANDIDATE: 1 })[classification] || 0; }
function dashaClassificationRank(classification) { return ({ STRONG: 2, MODERATE: 1 })[classification] || 0; }
function pdRelevanceRank(relevance) { return ({ PROPERTY_ACTIVE: 3, PROPERTY_SUPPORTING: 2, CONTEXTUAL: 1, NEUTRAL: 0 })[relevance] || 0; }
function transitConfirmationRank(state) { return ({ MAJOR_CONFIRMATION: 3, SUPPORTIVE_CONFIRMATION: 2, MIXED: 1, NONE: 0 })[state] || 0; }
function propertyConnectionSummary(factor) {
  if (!factor) return null;
  return freeze({
    planet: factor.planet,
    corePropertyConnection: factor.corePropertyConnection,
    acquisitionConnection: factor.acquisitionConnection,
    placementHouse: factor.placementHouse,
    rulesHouses: factor.rulesHouses,
  });
}
function pdRelevance(dasha) {
  const factor = dasha && dasha.factors.find((item) => item.level === 'PD');
  if (!factor) return freeze({ state: 'NEUTRAL', factor: null });
  const state = factor.corePropertyConnection && factor.acquisitionConnection
    ? 'PROPERTY_ACTIVE'
    : factor.corePropertyConnection || factor.acquisitionConnection
    ? 'PROPERTY_SUPPORTING'
    : factor.contextConnection
    ? 'CONTEXTUAL'
    : 'NEUTRAL';
  return freeze({ state, factor: propertyConnectionSummary(factor) });
}
function selectVisiblePeak(states, { now = null } = {}) {
  const major = states.filter((state) => state.evidence.activeMajor.length > 0);
  const supporting = states.filter((state) => state.evidence.activeSupport.length > 0);
  const pool = major.length ? major : supporting;
  return pool.filter((item) => !now || Date.parse(item.end) >= Date.parse(now)).slice().sort((left, right) => right.evidence.activeMajor.length - left.evidence.activeMajor.length
    || right.evidence.activeSupport.length - left.evidence.activeSupport.length
    || Date.parse(left.start) - Date.parse(right.start))[0] || null;
}
function transitConfirmationForPd({ engine, scanner, birth, natalBodies, houses, start, end, now }) {
  const scan = scanner({ startInstant: start, endInstant: end, natalBodies, natalHouses: houses, astronomicalEngine: engine, observer: { latitude: birth.latitude, longitude: birth.longitude }, bodies: [...MAJOR, ...SUPPORT], eventTypes: ['rashiIngress', 'transitDrishtiStart', 'transitDrishtiEnd', 'sameRashiAssociationStart', 'sameRashiAssociationEnd'], options: { coarseScanStepMilliseconds: PROPERTY_WINDOW_COARSE_SCAN_STEP_MS } });
  const boundaries = propertyTransitStateBoundaries(scan, start, end);
  const sourceEventsAt = (instant) => freeze((scan.events || [])
    .filter((event) => event.instant === instant)
    .filter((event) => [...MAJOR, ...SUPPORT].includes(event.body))
    .map((event) => freeze({ planet: event.body, eventType: event.eventType })));
  const states = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const stateStart = boundaries[index]; const stateEnd = boundaries[index + 1];
    if (Date.parse(stateEnd) <= Date.parse(stateStart)) continue;
    const transitBodies = engine.calculate(transitRequest(stateStart, birth));
    const snapshot = calculateGocharSnapshot({ snapshotInstant: stateStart, natalBodies, natalHouses: houses, transitBodies: transitBodies.bodies });
    const evidence = transitEvidence(snapshot, houses);
    const relevant = [...evidence.activeMajor, ...evidence.activeSupport];
    states.push(freeze({ start: stateStart, end: stateEnd, evidence, caution: relevant.some((item) => item.contexts.length > 0), sourceEvents: sourceEventsAt(stateStart) }));
  }
  const major = states.filter((state) => state.evidence.activeMajor.length > 0);
  const supporting = states.filter((state) => state.evidence.activeSupport.length > 0);
  const hasCaution = [...major, ...supporting].some((state) => state.caution);
  const state = major.length && hasCaution ? 'MIXED' : major.length ? 'MAJOR_CONFIRMATION' : supporting.length ? 'SUPPORTIVE_CONFIRMATION' : 'NONE';
  // A timing answer must not turn a completed transit segment into future
  // guidance. For an active PD candidate, choose only a peak that is still
  // ongoing or ahead of the calculation instant; otherwise suppress it.
  const peak = selectVisiblePeak(states, { now });
  return freeze({
    state,
    majorPlanets: freeze([...new Set(major.flatMap((item) => item.evidence.activeMajor.map((body) => body.planet)))]),
    supportPlanets: freeze([...new Set(supporting.flatMap((item) => item.evidence.activeSupport.map((body) => body.planet)))]),
    hasCaution,
    peakActivation: peak && freeze({ start: peak.start, end: peak.end, source: peak.sourceEvents.length ? peak.sourceEvents : freeze([{ planet: null, eventType: 'PD_INTERVAL_START' }]) }),
  });
}
function candidateState({ natal, d4, dasha, pd, transit }) {
  if (!['STRONG', 'MODERATE'].includes(natal.classification) || !['CONFIRMS', 'NEUTRAL'].includes(d4.confirmation) || !dasha.active) return 'NOT_SUPPORTED';
  if (pd.state === 'NEUTRAL') return 'NOT_SUPPORTED';
  if (dasha.classification === 'STRONG' && pd.state === 'PROPERTY_ACTIVE' && transit.state === 'MAJOR_CONFIRMATION' && d4.confirmation === 'CONFIRMS') return 'STRONG_CANDIDATE';
  if (pd.state !== 'CONTEXTUAL' && ['MAJOR_CONFIRMATION', 'SUPPORTIVE_CONFIRMATION'].includes(transit.state)) return 'MODERATE_CANDIDATE';
  return 'MIXED_CANDIDATE';
}
function candidateDiagnostic(candidate, { natal, d4 }) {
  const factorFor = (level) => candidate.dasha.factors.find((factor) => factor.level === level);
  return freeze({
    d1Classification: natal.classification,
    d4Confirmation: d4.confirmation,
    md: candidate.dasha.periods.md,
    mdPropertyConnection: propertyConnectionSummary(factorFor('MD')),
    ad: candidate.dasha.periods.ad,
    adPropertyConnection: propertyConnectionSummary(factorFor('AD')),
    mdAdStart: candidate.dasha.periods.start,
    mdAdEnd: candidate.dasha.periods.end,
    pd: candidate.dasha.periods.pd,
    pdStart: candidate.start,
    pdEnd: candidate.end,
    pdRelevance: candidate.pdRelevance.state,
    majorPropertyTransits: candidate.transitConfirmation.majorPlanets,
    transitConfirmationState: candidate.transitConfirmation.state,
    transitActivationStart: candidate.transitConfirmation.peakActivation && candidate.transitConfirmation.peakActivation.start || null,
    transitActivationEnd: candidate.transitConfirmation.peakActivation && candidate.transitConfirmation.peakActivation.end || null,
    peakSource: candidate.transitConfirmation.peakActivation && candidate.transitConfirmation.peakActivation.source || freeze([]),
    candidateState: candidate.candidateState,
  });
}
// This ranks already-qualified PD candidates. It does not add a new Property
// predicate: the ordering only uses the approved D1/D4, MD/AD, PD, and transit
// evidence that made each candidate eligible in the first place.
function temporalPriority(candidate, now) {
  const stamp = Date.parse(now);
  if (Date.parse(candidate.start) <= stamp && stamp <= Date.parse(candidate.end)) return 0;
  if (Date.parse(candidate.start) > stamp) return 1;
  return 2;
}
function selectPropertyWindow(candidates, { now = new Date().toISOString() } = {}) {
  if (!candidates.length) return null;
  const ranked = candidates.slice().sort((left, right) => {
    const leftTemporal = temporalPriority(left, now); const rightTemporal = temporalPriority(right, now);
    const temporal = leftTemporal - rightTemporal;
    if (temporal) return temporal;
    // For a forward-looking question, prefer the next usable candidate over a
    // later one; evidence ranks candidates that share the same temporal slot.
    if (leftTemporal === 1) {
      const next = Date.parse(left.start) - Date.parse(right.start);
      if (next) return next;
    }
    const classification = propertyWindowClassificationRank(right.candidateState) - propertyWindowClassificationRank(left.candidateState);
    if (classification) return classification;
    const dasha = dashaClassificationRank(right.dasha.classification) - dashaClassificationRank(left.dasha.classification);
    if (dasha) return dasha;
    const pd = pdRelevanceRank(right.pdRelevance.state) - pdRelevanceRank(left.pdRelevance.state);
    if (pd) return pd;
    const transit = transitConfirmationRank(right.transitConfirmation.state) - transitConfirmationRank(left.transitConfirmation.state);
    if (transit) return transit;
    const d4 = (right.d4Confirmation === 'CONFIRMS' ? 1 : 0) - (left.d4Confirmation === 'CONFIRMS' ? 1 : 0);
    if (d4) return d4;
    const caution = Number(left.transitConfirmation.hasCaution) - Number(right.transitConfirmation.hasCaution);
    if (caution) return caution;
    const duration = (Date.parse(right.end) - Date.parse(right.start)) - (Date.parse(left.end) - Date.parse(left.start));
    if (duration) return duration;
    return Date.parse(left.start) - Date.parse(right.start);
  });
  return freeze({ selected: ranked[0], ranked: freeze(ranked), secondary: freeze(ranked.slice(1, 3)) });
}
function pdIntervals(dashaTree, start, end) {
  const out = [];
  for (const md of dashaTree.periods || []) for (const ad of md.children || []) for (const pd of ad.children || []) {
    const pdStart = pd.startInstant.utc; const pdEnd = pd.endInstant.utc;
    if (Date.parse(pdEnd) <= Date.parse(start) || Date.parse(pdStart) >= Date.parse(end)) continue;
    out.push(freeze({ start: pdStart, end: pdEnd }));
  }
  return freeze(out.sort((left, right) => Date.parse(left.start) - Date.parse(right.start)));
}
function publicCandidate(candidate) {
  return freeze({ start: candidate.start, end: candidate.end, classification: candidate.candidateState, timingClassification: 'BOUNDED_WINDOW', temporalStatus: candidate.temporalStatus, basis: 'MD_AD_PD_TRANSIT_CONFIRMATION', peakActivation: candidate.transitConfirmation.peakActivation, transitConfirmation: candidate.transitConfirmation.state, pd: candidate.dasha.periods.pd });
}
function strongerWindow({ engine, scanner, birth, natalBodies, houses, dashaTree, natal, d1, d4, start, diagnosticLog = null }) {
  const end = new Date(Date.parse(start) + 365 * DAY).toISOString();
  const candidates = [];
  for (const interval of pdIntervals(dashaTree, start, end)) {
    const activeDasha = dashaEvidence(d1, dashaAt(dashaTree, interval.start));
    if (!activeDasha.active) continue;
    if (!['STRONG', 'MODERATE'].includes(natal.classification) || !['CONFIRMS', 'NEUTRAL'].includes(d4.confirmation)) continue;
    const relevance = pdRelevance(activeDasha);
    const confirmation = transitConfirmationForPd({ engine, scanner, birth, natalBodies, houses, start: interval.start, end: interval.end, now: start });
    const state = candidateState({ natal, d4, dasha: activeDasha, pd: relevance, transit: confirmation });
    const candidate = freeze({
      start: interval.start,
      end: interval.end,
      dasha: activeDasha,
      d4Confirmation: d4.confirmation,
      pdRelevance: relevance,
      transitConfirmation: confirmation,
      candidateState: state,
      temporalStatus: Date.parse(interval.start) > Date.parse(start) ? 'UPCOMING' : 'CURRENT',
    });
    if (typeof diagnosticLog === 'function') {
      diagnosticLog(freeze({ event: 'PROPERTY_PD_TRANSIT_CONFIRMATION', ...candidateDiagnostic(candidate, { natal, d4 }) }));
      diagnosticLog(freeze({ event: 'PROPERTY_PD_CANDIDATE', ...candidateDiagnostic(candidate, { natal, d4 }) }));
    }
    if (state === 'NOT_SUPPORTED') continue;
    candidates.push(candidate);
  }
  const ranked = selectPropertyWindow(candidates, { now: start });
  if (!ranked) return null;
  if (typeof diagnosticLog === 'function') {
    for (const [index, candidate] of ranked.ranked.entries()) diagnosticLog(freeze({
      event: 'PROPERTY_WINDOW_RANKING',
      rank: index + 1,
      activeNow: temporalPriority(candidate, start) === 0,
      future: temporalPriority(candidate, start) === 1,
      ...candidateDiagnostic(candidate, { natal, d4 }),
    }));
    diagnosticLog(freeze({ event: 'PROPERTY_WINDOW_SELECTED', ...candidateDiagnostic(ranked.selected, { natal, d4 }) }));
    diagnosticLog(freeze({
      event: 'PROPERTY_PEAK_SELECTED',
      candidatePd: ranked.selected.dasha.periods.pd,
      candidateStart: ranked.selected.start,
      candidateEnd: ranked.selected.end,
      candidateState: ranked.selected.candidateState,
      peakStart: ranked.selected.transitConfirmation.peakActivation && ranked.selected.transitConfirmation.peakActivation.start || null,
      peakEnd: ranked.selected.transitConfirmation.peakActivation && ranked.selected.transitConfirmation.peakActivation.end || null,
      peakSource: ranked.selected.transitConfirmation.peakActivation && ranked.selected.transitConfirmation.peakActivation.source || freeze([]),
    }));
  }
  return freeze({ ...publicCandidate(ranked.selected), secondaryWindows: freeze(ranked.secondary.map(publicCandidate)) });
}

class PropertyAnswerService {
  constructor({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, clock = () => new Date().toISOString(), transitScanner = scanTransitEvents } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !lifeEventService || typeof lifeEventService.getRelevantLifeEvents !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler) throw new TypeError('INVALID_PROPERTY_ANSWER_DEPENDENCIES');
    Object.assign(this, { profiles: birthProfileService, lifeEvents: lifeEventService, engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, clock, scanner: transitScanner }); Object.freeze(this);
  }
  async answer({ principal, birthProfileId, intent = PropertyIntent.PROPERTY_CURRENT_STRENGTH, at = null, diagnosticLog = null } = {}) {
    if (!Object.values(PropertyIntent).includes(intent)) fail('UNSUPPORTED_PROPERTY_INTENT');
    const log = (event, fields = {}) => { if (typeof diagnosticLog === 'function') diagnosticLog(freeze({ event, birthProfileId, intent, ...fields })); };
    const startedAt = Date.now();
    const timed = (event, stageStartedAt) => log(event, { durationMs: Date.now() - stageStartedAt });
    log('PROPERTY_CALCULATION_START', { state: 'STARTED' });
    const profile = await this.profiles.get({ principal, birthProfileId }); if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    const instant = at || new Date(this.clock()).toISOString();
    let stage = 'PROFILE';
    try {
      stage = 'NATAL';
      let stageStartedAt = Date.now();
      const natal = this.engine.calculate(request(profile.birthData)); const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
      const natalFacts = natalEvidence(houses); timed('PROPERTY_NATAL_EVIDENCE', stageStartedAt);
      stage = 'D4';
      stageStartedAt = Date.now();
      const d4 = d4Evidence(natal, houses); timed('PROPERTY_D4_EVIDENCE', stageStartedAt);
      stage = 'DASHA';
      stageStartedAt = Date.now();
      const dashaTree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
      const dasha = dashaEvidence(houses, dashaAt(dashaTree, instant)); timed('PROPERTY_DASHA_EVIDENCE', stageStartedAt);
      stage = 'TRANSIT';
      stageStartedAt = Date.now();
      const transitBodies = this.engine.calculate(transitRequest(instant, profile.birthData)); const snapshot = calculateGocharSnapshot({ snapshotInstant: instant, natalBodies: natal.bodies, natalHouses: houses, transitBodies: transitBodies.bodies }); const transit = transitEvidence(snapshot, houses); timed('PROPERTY_TRANSIT_EVIDENCE', stageStartedAt);
      stage = 'ASHTAKAVARGA';
      stageStartedAt = Date.now();
      const rawAshtaka = calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal)); const ashtakavarga = ashtakavargaEvidence(rawAshtaka, houses); timed('PROPERTY_ASHTAKAVARGA_EVIDENCE', stageStartedAt);
      stage = 'CALIBRATION';
      stageStartedAt = Date.now();
      const events = await this.lifeEvents.getRelevantLifeEvents({ principal, birthProfileId, categories: ['PROPERTY'] }); const history = calibration(events, instant); timed('PROPERTY_CALIBRATION', stageStartedAt);
      stage = 'RESULT';
      const final = classify({ natal: natalFacts, d4, dasha, transit });
      stage = 'WINDOW';
      stageStartedAt = Date.now();
      const window = intent === PropertyIntent.PROPERTY_SALE_TIMING ? null : strongerWindow({ engine: this.engine, scanner: this.scanner, birth: profile.birthData, natalBodies: natal.bodies, houses, dashaTree, natal: natalFacts, d1: houses, d4, start: instant, diagnosticLog: log });
      timed('PROPERTY_WINDOW_EVIDENCE', stageStartedAt);
      const financing = transit.all.some((item) => item.propertyActive && item.contexts.some((house) => [6, 12].includes(house))) || dasha.factors.some((item) => item.corePropertyConnection && item.contextConnection);
      const shared = transit.all.some((item) => item.propertyActive && item.contexts.includes(8)) || dasha.factors.some((item) => item.corePropertyConnection && item.rulesHouses.includes(8));
      const result = freeze({ intent, answerability: intent === PropertyIntent.PROPERTY_SALE_TIMING ? 'LIMITED_EVIDENCE' : 'SUPPORTED', classification: final, state: limitation(intent) || final, strongerWindow: window, windowStatus: window && window.timingClassification || 'NO_RELIABLE_WINDOW', evidence: freeze({ natal: natalFacts, d4: freeze({ ...d4, d4Houses: undefined }), dasha, transit, ashtakavarga, lifeEvents: history }), contexts: freeze({ financing: financing ? (intent === PropertyIntent.PROPERTY_LOAN_CONTEXT ? 'STRONGER_FINANCING_INVOLVEMENT' : 'FINANCING_CONTEXT') : 'LIMITED_EVIDENCE', sharedAsset: shared ? (intent === PropertyIntent.PROPERTY_INHERITANCE_CONTEXT ? 'SHARED_OR_INHERITED_ASSET_THEME_ACTIVE' : 'SHARED_ASSET_CONTEXT') : 'LIMITED_EVIDENCE', expenditure: transit.all.some((item) => item.propertyActive && item.contexts.includes(12)) ? 'EXPENDITURE_CONTEXT' : 'NONE' }), limitations: freeze(['NO_OUTCOME_GUARANTEE', 'NO_EXACT_PURCHASE_DATE', ...(intent === PropertyIntent.PROPERTY_SALE_TIMING ? ['SALE_METHODOLOGY_DEFERRED'] : [])]), provenance: freeze({ dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, d4RulesetId: 'parashari-chaturthamsha-v1', ashtakavargaPolicy: 'RAW_CONTEXT_ONLY' }) });
      log('PROPERTY_RESULT', { state: result.state, classification: result.classification, evidenceCount: transit.activeMajor.length, durationMs: Date.now() - startedAt }); return result;
    } catch (error) {
      log('PROPERTY_RESULT', { stage, state: 'FAILED', safeErrorCode: error && error.code || 'PROPERTY_CALCULATION_FAILED', errorClass: error && error.name || 'Error' });
      throw error;
    }
  }
}

module.exports = { PropertyAnswerService, PropertyIntent, natalEvidence, d4Evidence, dashaEvidence, primaryDashaBounds, transitEvidence, ashtakavargaEvidence, calibration, propertyTransitStateBoundaries, classifyPropertyWindow, pdRelevance, candidateState, selectVisiblePeak, transitConfirmationForPd, classify, selectPropertyWindow, strongerWindow, PROPERTY_WINDOW_COARSE_SCAN_STEP_MS };
