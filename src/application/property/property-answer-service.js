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
  for (const md of dasha.periods) if (stamp >= Number(md.startInstant.epochMilliseconds) && stamp < Number(md.endInstant.epochMilliseconds)) for (const ad of md.children) if (stamp >= Number(ad.startInstant.epochMilliseconds) && stamp < Number(ad.endInstant.epochMilliseconds)) for (const pd of ad.children) if (stamp >= Number(pd.startInstant.epochMilliseconds) && stamp < Number(pd.endInstant.epochMilliseconds)) return { start: pd.startInstant.utc, end: pd.endInstant.utc, md: planetId(md.lord.id), ad: planetId(ad.lord.id), pd: planetId(pd.lord.id) };
  return null;
}
function dashaEvidence(houses, dasha) {
  if (!dasha) return freeze({ classification: 'LIMITED', active: false, periods: null, factors: freeze([]) });
  const facts = [dasha.md, dasha.ad, dasha.pd].map((planet) => ({ level: planet === dasha.md ? 'MD' : planet === dasha.ad ? 'AD' : 'PD', ...connectedPlanet(houses, planet) }));
  const md = facts[0], ad = facts[1], pd = facts[2];
  const strong = Boolean(md && ad && (md.corePropertyConnection || md.acquisitionConnection) && (ad.corePropertyConnection || ad.acquisitionConnection) && (md.corePropertyConnection || ad.corePropertyConnection));
  const moderate = Boolean(md && ad && (md.corePropertyConnection || ad.corePropertyConnection));
  return freeze({ classification: strong ? 'STRONG' : moderate ? 'MODERATE' : (pd && (pd.corePropertyConnection || pd.acquisitionConnection)) ? 'LIMITED' : 'LIMITED', active: strong || moderate, periods: freeze({ md: dasha.md, ad: dasha.ad, pd: dasha.pd, start: dasha.start, end: dasha.end }), factors: freeze(facts) });
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
function calibration(events) {
  const usable = events.filter((event) => ['PROPERTY_PURCHASE', 'PROPERTY_SALE'].includes(event.eventType));
  const state = usable.length === 0 ? 'NONE' : usable.length === 1 ? 'LIMITED' : usable.length === 2 ? 'MODERATE' : 'STRONG';
  return freeze({ state, eventCount: usable.length, recurringPattern: false, events: freeze(usable.map((event) => freeze({ lifeEventId: event.lifeEventId, eventType: event.eventType, eventDate: event.eventDate }))) });
}
function limitation(intent) { return intent === PropertyIntent.PROPERTY_SALE_TIMING ? 'PROPERTY_SALE_TIMING_NOT_PREDICTIVE_IN_V1' : null; }
function propertyTransitStateBoundaries(scan, scanStart, end) {
  return freeze([...new Set([scanStart, end, ...(scan.events || [])
    .filter((event) => [...MAJOR, ...SUPPORT].includes(event.body))
    .map((event) => event.instant)])].sort());
}
function strongerWindow({ engine, scanner, birth, natalBodies, houses, dashaTree, natal, d1, d4, start }) {
  // Scan before the requested point as well.  This lets an already-active
  // interval retain its real refined ingress/aspect/association boundary
  // rather than presenting `now` as an invented customer-facing start date.
  const scanStart = new Date(Date.parse(start) - 400 * DAY).toISOString();
  const end = new Date(Date.parse(start) + 365 * DAY).toISOString();
  const scan = scanner({ startInstant: scanStart, endInstant: end, natalBodies, natalHouses: houses, astronomicalEngine: engine, observer: { latitude: birth.latitude, longitude: birth.longitude }, bodies: [...MAJOR, ...SUPPORT], eventTypes: ['rashiIngress', 'transitDrishtiStart', 'transitDrishtiEnd', 'sameRashiAssociationStart', 'sameRashiAssociationEnd'] });
  const boundaries = propertyTransitStateBoundaries(scan, scanStart, end);
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const range = { start: boundaries[index], end: boundaries[index + 1] };
    if (Date.parse(range.end) <= Date.parse(start)) continue;
    const activeDasha = dashaEvidence(d1, dashaAt(dashaTree, range.start));
    if (!activeDasha.active) continue;
    const transitBodies = engine.calculate(transitRequest(range.start, birth));
    const snapshot = calculateGocharSnapshot({ snapshotInstant: range.start, natalBodies, natalHouses: houses, transitBodies: transitBodies.bodies });
    const transit = transitEvidence(snapshot, houses); if (!transit.active) continue;
    const classification = classify({ natal, d4, dasha: activeDasha, transit });
    if (classification === 'WEAK') continue;
    const dashaStart = activeDasha.periods.start;
    const dashaEnd = activeDasha.periods.end;
    const windowStart = Date.parse(dashaStart) > Date.parse(range.start) ? dashaStart : range.start;
    // scanStart is a lookup boundary, never a customer-facing boundary.
    if (windowStart === scanStart) continue;
    const windowEnd = Date.parse(dashaEnd) < Date.parse(range.end) ? dashaEnd : range.end;
    if (Date.parse(windowEnd) <= Date.parse(start)) continue;
    return freeze({ start: windowStart, end: windowEnd, classification, basis: 'REFINED_DASHA_TRANSIT_STATE_INTERSECTION' });
  }
  return null;
}

class PropertyAnswerService {
  constructor({ birthProfileService, lifeEventService, astronomicalEngine, canonicalSiderealSunSampler, clock = () => new Date().toISOString(), transitScanner = scanTransitEvents } = {}) {
    if (!birthProfileService || typeof birthProfileService.get !== 'function' || !lifeEventService || typeof lifeEventService.getRelevantLifeEvents !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler) throw new TypeError('INVALID_PROPERTY_ANSWER_DEPENDENCIES');
    Object.assign(this, { profiles: birthProfileService, lifeEvents: lifeEventService, engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, clock, scanner: transitScanner }); Object.freeze(this);
  }
  async answer({ principal, birthProfileId, intent = PropertyIntent.PROPERTY_CURRENT_STRENGTH, at = null, diagnosticLog = null } = {}) {
    if (!Object.values(PropertyIntent).includes(intent)) fail('UNSUPPORTED_PROPERTY_INTENT');
    const log = (event, fields = {}) => { if (typeof diagnosticLog === 'function') diagnosticLog(freeze({ event, birthProfileId, intent, ...fields })); };
    log('PROPERTY_CALCULATION_START', { state: 'STARTED' });
    const profile = await this.profiles.get({ principal, birthProfileId }); if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    const instant = at || new Date(this.clock()).toISOString();
    let stage = 'PROFILE';
    try {
      stage = 'NATAL';
      const natal = this.engine.calculate(request(profile.birthData)); const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
      const natalFacts = natalEvidence(houses); log('PROPERTY_NATAL_EVIDENCE', { state: natalFacts.classification, evidenceCount: natalFacts.connections.length });
      stage = 'D4';
      const d4 = d4Evidence(natal, houses); log('PROPERTY_D4_EVIDENCE', { state: d4.confirmation, evidenceCount: d4.fourthHouse.occupants.length });
      stage = 'DASHA';
      const dashaTree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
      const dasha = dashaEvidence(houses, dashaAt(dashaTree, instant)); log('PROPERTY_DASHA_EVIDENCE', { state: dasha.classification, evidenceCount: dasha.factors.length });
      stage = 'TRANSIT';
      const transitBodies = this.engine.calculate(transitRequest(instant, profile.birthData)); const snapshot = calculateGocharSnapshot({ snapshotInstant: instant, natalBodies: natal.bodies, natalHouses: houses, transitBodies: transitBodies.bodies }); const transit = transitEvidence(snapshot, houses); log('PROPERTY_TRANSIT_EVIDENCE', { state: transit.active ? 'ACTIVE' : 'LIMITED', evidenceCount: transit.activeMajor.length });
      stage = 'ASHTAKAVARGA';
      const rawAshtaka = calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal)); const ashtakavarga = ashtakavargaEvidence(rawAshtaka, houses); log('PROPERTY_ASHTAKAVARGA_EVIDENCE', { state: 'CONTEXT_ONLY', evidenceCount: ashtakavarga.sav.length });
      stage = 'CALIBRATION';
      const events = await this.lifeEvents.getRelevantLifeEvents({ principal, birthProfileId, categories: ['PROPERTY'] }); const history = calibration(events); log('PROPERTY_CALIBRATION', { state: history.state, evidenceCount: history.eventCount });
      stage = 'RESULT';
      const final = classify({ natal: natalFacts, d4, dasha, transit });
      stage = 'WINDOW';
      const window = intent === PropertyIntent.PROPERTY_SALE_TIMING ? null : strongerWindow({ engine: this.engine, scanner: this.scanner, birth: profile.birthData, natalBodies: natal.bodies, houses, dashaTree, natal: natalFacts, d1: houses, d4, start: instant });
      const financing = transit.all.some((item) => item.propertyActive && item.contexts.some((house) => [6, 12].includes(house))) || dasha.factors.some((item) => item.corePropertyConnection && item.contextConnection);
      const shared = transit.all.some((item) => item.propertyActive && item.contexts.includes(8)) || dasha.factors.some((item) => item.corePropertyConnection && item.rulesHouses.includes(8));
      const result = freeze({ intent, answerability: intent === PropertyIntent.PROPERTY_SALE_TIMING ? 'LIMITED_EVIDENCE' : 'SUPPORTED', classification: final, state: limitation(intent) || final, strongerWindow: window, evidence: freeze({ natal: natalFacts, d4: freeze({ ...d4, d4Houses: undefined }), dasha, transit, ashtakavarga, lifeEvents: history }), contexts: freeze({ financing: financing ? (intent === PropertyIntent.PROPERTY_LOAN_CONTEXT ? 'STRONGER_FINANCING_INVOLVEMENT' : 'FINANCING_CONTEXT') : 'LIMITED_EVIDENCE', sharedAsset: shared ? (intent === PropertyIntent.PROPERTY_INHERITANCE_CONTEXT ? 'SHARED_OR_INHERITED_ASSET_THEME_ACTIVE' : 'SHARED_ASSET_CONTEXT') : 'LIMITED_EVIDENCE', expenditure: transit.all.some((item) => item.propertyActive && item.contexts.includes(12)) ? 'EXPENDITURE_CONTEXT' : 'NONE' }), limitations: freeze(['NO_OUTCOME_GUARANTEE', 'NO_EXACT_PURCHASE_DATE', ...(intent === PropertyIntent.PROPERTY_SALE_TIMING ? ['SALE_METHODOLOGY_DEFERRED'] : [])]), provenance: freeze({ dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, d4RulesetId: 'parashari-chaturthamsha-v1', ashtakavargaPolicy: 'RAW_CONTEXT_ONLY' }) });
      log('PROPERTY_RESULT', { state: result.state, classification: result.classification, evidenceCount: transit.activeMajor.length }); return result;
    } catch (error) {
      log('PROPERTY_RESULT', { stage, state: 'FAILED', safeErrorCode: error && error.code || 'PROPERTY_CALCULATION_FAILED', errorClass: error && error.name || 'Error' });
      throw error;
    }
  }
}

module.exports = { PropertyAnswerService, PropertyIntent, natalEvidence, d4Evidence, dashaEvidence, transitEvidence, ashtakavargaEvidence, calibration, propertyTransitStateBoundaries, classify };
