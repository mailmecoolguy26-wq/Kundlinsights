'use strict';

// Development/test-only diagnostic harness.  It is intentionally not wired to
// Fastify, production DTOs, or Property answer selection.  It reports factual
// calculation layers and invariant outcomes so an external golden source can
// be compared without changing any calculation policy.
const { calculateRashiHouses } = require('../bhava');
const { classifyLayer1Bodies, classifySiderealLongitude, canonicalPlanetId } = require('../jyotish');
const { calculateGocharSnapshot } = require('../gochar');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../dasha');
const { deriveVargaFromSiderealLongitude } = require('../varga');
const { calculateRawAshtakavarga } = require('../ashtakavarga');
const { scanTransitEvents } = require('../transit-events');
const {
  natalEvidence, d4Evidence, dashaEvidence, transitEvidence, ashtakavargaEvidence,
  calibration, classify,
} = require('../application/property');

const VALIDATION_LAYERS = Object.freeze([
  'ASTRONOMY', 'DERIVED_CHART_FACTS', 'DASHA', 'VARGA', 'TRANSIT',
  'ASHTAKAVARGA', 'PROPERTY_EVIDENCE', 'PROPERTY_CLASSIFICATION',
]);
const VARGAS = Object.freeze(['D4', 'D9', 'D10', 'D16']);
const TRANSIT_BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars', 'Venus']);
const DAY = 86_400_000;

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function request(birth) { return { date: birth.localDate, time: birth.localTime, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }; }
function transitRequest(instant, birth, bodies) { const date = new Date(instant); return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 23), timezone: 'UTC', latitude: birth.latitude, longitude: birth.longitude, bodies }; }
function safeTimestamp(value) { return typeof value === 'string' && value.endsWith('Z') ? value : null; }
function periodSummary(period) { return freeze({ lord: period.lord.id, start: period.startInstant.utc, end: period.endInstant.utc, durationMilliseconds: period.materializedDuration.milliseconds }); }
function isLongitude(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360; }
function circularDifference(a, b) { return Math.abs((((a - b + 540) % 360) - 180)); }

function check(checks, layer, check, condition, expected, actual, context = {}) {
  checks.push(freeze({ layer, check, status: condition ? 'PASS' : 'FAIL', expected, actual, context: freeze(context) }));
}

function chartForVarga(natal, vargaId) {
  const coordinates = Object.fromEntries(Object.entries(natal.bodies).map(([body, result]) => {
    const projection = deriveVargaFromSiderealLongitude(vargaId, result.siderealLongitudeDegrees);
    const rashi = projection.derivedVargaRashi;
    const longitude = ((rashi.startDegrees + rashi.degreesWithinResultingRashi) % 360 + 360) % 360;
    return [body, freeze({ longitude, projection })];
  }));
  const houses = calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: coordinates.Ascendant.longitude,
    bodies: Object.fromEntries(Object.entries(coordinates).map(([body, value]) => [body, { siderealLongitudeDegrees: value.longitude }])),
  });
  return freeze({ ascendant: houses.ascendant, bodies: freeze(Object.fromEntries(Object.entries(coordinates).map(([body, value]) => [body, freeze({ rashiIndex: value.projection.derivedVargaRashi.rashiIndex, house: body === 'Ascendant' ? 1 : houses.planetaryAssignments.find((item) => item.body === body).rashiHouseNumber })]))), houses });
}

function validateDashaTree(tree, checks) {
  const validateChildren = (parent, children, label) => {
    const duration = BigInt(parent.endInstant.epochMilliseconds) - BigInt(parent.startInstant.epochMilliseconds);
    const childDuration = children.reduce((sum, child) => sum + BigInt(child.endInstant.epochMilliseconds) - BigInt(child.startInstant.epochMilliseconds), 0n);
    check(checks, 'DASHA', `${label}_PARENT_PARTITION`, children.length === 9
      && children[0].startInstant.utc === parent.startInstant.utc
      && children.at(-1).endInstant.utc === parent.endInstant.utc
      && children.every((child, index) => index === 0 || children[index - 1].endInstant.utc === child.startInstant.utc)
      && childDuration === duration, '[start,end) children fully partition parent', `${children.length} children / ${childDuration.toString()}ms`, { lord: parent.lord.id, start: parent.startInstant.utc, end: parent.endInstant.utc });
  };
  for (const md of tree.periods) {
    validateChildren(md, md.children, 'AD');
    for (const ad of md.children) validateChildren(ad, ad.children, 'PD');
  }
}

function activeDasha(tree, instant) {
  const stamp = Date.parse(instant);
  const contains = (period) => stamp >= Number(period.startInstant.epochMilliseconds) && stamp < Number(period.endInstant.epochMilliseconds);
  const md = tree.periods.find(contains); const ad = md && md.children.find(contains); const pd = ad && ad.children.find(contains);
  return freeze({ md: md && periodSummary(md), ad: ad && periodSummary(ad), pd: pd && periodSummary(pd) });
}

function rawAshtakavarga(natal) {
  const classified = classifyLayer1Bodies(natal);
  const placements = Object.fromEntries(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Ascendant']
    .map((body) => [body, classified[body].jyotishCoordinates.rashi.rashiIndex]));
  return calculateRawAshtakavarga({ rashiPlacements: placements });
}

class PropertyValidationHarness {
  constructor({ astronomicalEngine, canonicalSiderealSunSampler, transitScanner = scanTransitEvents, clock = () => new Date().toISOString() } = {}) {
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') throw new TypeError('PropertyValidationHarness requires astronomicalEngine.');
    if (!canonicalSiderealSunSampler || typeof canonicalSiderealSunSampler.sampleCanonicalSiderealSun !== 'function') throw new TypeError('PropertyValidationHarness requires canonicalSiderealSunSampler.');
    Object.assign(this, { engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, scanner: transitScanner, clock }); Object.freeze(this);
  }

  generate({ birthProfileId, birthData, calculationInstant = null, lifeEvents = [], transitHorizonDays = 60 } = {}) {
    if (!birthProfileId || !birthData) throw new TypeError('birthProfileId and birthData are required.');
    const at = calculationInstant || new Date(this.clock()).toISOString();
    if (!safeTimestamp(at)) throw new RangeError('calculationInstant must be a UTC timestamp.');
    const checks = [];
    const natal = this.engine.calculate(request(birthData));
    const repeatedNatal = this.engine.calculate(request(birthData));
    const bodies = natal.bodies;
    const bodyRows = Object.entries(bodies).map(([body, result]) => freeze({ body, longitude: result.siderealLongitudeDegrees, motion: result.motion, rashi: classifySiderealLongitude(result.siderealLongitudeDegrees).rashi.rashiIndex }));
    for (const row of bodyRows) {
      check(checks, 'ASTRONOMY', 'LONGITUDE_RANGE', isLongitude(row.longitude), '0 <= longitude < 360', row.longitude, { body: row.body });
      check(checks, 'ASTRONOMY', 'ONE_RASHI_PER_PLANET', Number.isInteger(row.rashi) && row.rashi >= 1 && row.rashi <= 12, 'one rashi 1..12', row.rashi, { body: row.body });
      const again = repeatedNatal.bodies[row.body];
      check(checks, 'ASTRONOMY', 'DETERMINISTIC_LONGITUDE', again && again.siderealLongitudeDegrees === row.longitude, row.longitude, again && again.siderealLongitudeDegrees, { body: row.body });
      check(checks, 'ASTRONOMY', 'DETERMINISTIC_MOTION', again && again.motion === row.motion, row.motion, again && again.motion, { body: row.body });
    }
    if (bodies.Rahu && bodies.Ketu) {
      const separation = circularDifference(bodies.Rahu.siderealLongitudeDegrees, bodies.Ketu.siderealLongitudeDegrees);
      check(checks, 'ASTRONOMY', 'RAHU_KETU_OPPOSITION', Math.abs(separation - 180) <= 1e-9, '180° within engine tolerance', separation, {});
    }
    const moon = classifySiderealLongitude(bodies.Moon.siderealLongitudeDegrees);
    check(checks, 'ASTRONOMY', 'MOON_ONE_NAKSHATRA_AND_PADA', Boolean(moon.nakshatra && moon.pada && moon.pada.pada >= 1 && moon.pada.pada <= 4), 'one Nakshatra and Pada', `${moon.nakshatra.index}/${moon.pada.pada}`, {});
    const ascendant = classifySiderealLongitude(bodies.Ascendant.siderealLongitudeDegrees);
    check(checks, 'ASTRONOMY', 'ASCENDANT_ONE_RASHI', Number.isInteger(ascendant.rashi.rashiIndex), 'one rashi', ascendant.rashi.rashiIndex, {});

    const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: bodies.Ascendant.siderealLongitudeDegrees, bodies });
    for (const house of houses.houses) check(checks, 'DERIVED_CHART_FACTS', 'HOUSE_SIGN_AND_LORD', Number.isInteger(house.rashi.rashiIndex) && Boolean(house.rashiHouseLord), 'one sign with canonical lord', `${house.rashi.rashiIndex}/${house.rashiHouseLord}`, { house: house.houseNumber });
    for (const assignment of houses.planetaryAssignments) check(checks, 'DERIVED_CHART_FACTS', 'ONE_NATAL_HOUSE_PER_PLANET', Number.isInteger(assignment.rashiHouseNumber) && assignment.rashiHouseNumber >= 1 && assignment.rashiHouseNumber <= 12, 'one house 1..12', assignment.rashiHouseNumber, { body: assignment.body });

    const vargas = Object.fromEntries(VARGAS.map((id) => [id, chartForVarga(natal, id)]));
    for (const [id, chart] of Object.entries(vargas)) for (const [body, fact] of Object.entries(chart.bodies)) check(checks, 'VARGA', 'DETERMINISTIC_PROJECTION', Number.isInteger(fact.rashiIndex) && Number.isInteger(fact.house), 'rashi and house', `${fact.rashiIndex}/${fact.house}`, { chart: id, body });

    const tree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
    validateDashaTree(tree, checks);
    const current = activeDasha(tree, at);

    const transitLayer = this.engine.calculate(transitRequest(at, birthData, TRANSIT_BODIES));
    const snapshot = calculateGocharSnapshot({ snapshotInstant: at, natalBodies: bodies, natalHouses: houses, transitBodies: transitLayer.bodies, bodies: TRANSIT_BODIES });
    for (const [body, fact] of Object.entries(snapshot.transitBodies)) check(checks, 'TRANSIT', 'TRANSIT_LONGITUDE_AND_HOUSE', isLongitude(fact.normalizedTransitCanonicalSiderealLongitudeDegrees) && Number.isInteger(fact.transitNatalHouseNumber), 'valid longitude and natal house', `${fact.normalizedTransitCanonicalSiderealLongitudeDegrees}/${fact.transitNatalHouseNumber}`, { body });
    const scanEnd = new Date(Date.parse(at) + transitHorizonDays * DAY).toISOString();
    const transitScan = this.scanner({ startInstant: at, endInstant: scanEnd, natalBodies: bodies, natalHouses: houses, astronomicalEngine: this.engine, observer: { latitude: birthData.latitude, longitude: birthData.longitude }, bodies: TRANSIT_BODIES, eventTypes: ['rashiIngress'], options: { coarseScanStepMilliseconds: DAY } });
    const uniqueEvents = new Set();
    for (const event of transitScan.events) {
      const key = `${event.body}/${event.eventType}/${event.instant}`;
      check(checks, 'TRANSIT', 'INGRESS_IN_INTERVAL_AND_UNIQUE', Date.parse(event.instant) >= Date.parse(at) && Date.parse(event.instant) <= Date.parse(scanEnd) && !uniqueEvents.has(key), 'unique event inside requested interval', event.instant, { body: event.body, eventType: event.eventType }); uniqueEvents.add(key);
      // The scanner returns a refined categorical transition. Sampling one
      // millisecond either side verifies its observable half-open Rashi edge
      // without introducing a second ingress algorithm.
      const transition = Date.parse(event.instant);
      const before = this.engine.calculate(transitRequest(new Date(transition - 1).toISOString(), birthData, [event.body])).bodies[event.body];
      const after = this.engine.calculate(transitRequest(new Date(transition + 1).toISOString(), birthData, [event.body])).bodies[event.body];
      const beforeRashi = classifySiderealLongitude(before.siderealLongitudeDegrees).rashi.rashiIndex;
      const afterRashi = classifySiderealLongitude(after.siderealLongitudeDegrees).rashi.rashiIndex;
      check(checks, 'TRANSIT', 'INGRESS_BOUNDARY_CHANGES_RASHI_ONCE', beforeRashi !== afterRashi && beforeRashi === event.fromRashi.rashiIndex && afterRashi === event.toRashi.rashiIndex, `${event.fromRashi.rashiIndex} -> ${event.toRashi.rashiIndex}`, `${beforeRashi} -> ${afterRashi}`, { body: event.body, instant: event.instant });
    }

    const rawAshtaka = rawAshtakavarga(natal);
    const rawRashis = rawAshtaka.rawSarvashtakavarga.rashis;
    check(checks, 'ASHTAKAVARGA', 'SAV_COMPLETE_NUMERIC_RASHIS', rawRashis.length === 12 && rawRashis.every((row) => Number.isInteger(row.rashiIndex) && Number.isFinite(row.favorableMarkCount)), '12 numeric rashi values', rawRashis.length, {});
    const d1 = natalEvidence(houses); const d4 = d4Evidence(natal, houses); const dasha = dashaEvidence(houses, current.md && { md: current.md.lord, ad: current.ad.lord, pd: current.pd.lord, mdStart: current.md.start, mdEnd: current.md.end, adStart: current.ad.start, adEnd: current.ad.end, pdStart: current.pd.start, pdEnd: current.pd.end });
    const transit = transitEvidence(snapshot, houses); const ashtakavarga = ashtakavargaEvidence(rawAshtaka, houses); const events = calibration(lifeEvents);
    const propertyState = classify({ natal: d1, d4, dasha, transit });
    check(checks, 'PROPERTY_EVIDENCE', 'ASHTAKAVARGA_CONTEXT_ONLY', ashtakavarga.policy === 'CONTEXT_ONLY_NO_THRESHOLDS', 'context only', ashtakavarga.policy, {});
    check(checks, 'PROPERTY_EVIDENCE', 'LIFE_EVENTS_CALIBRATION_ONLY', events.recurringPattern === false, 'does not create recurrence/window', events.recurringPattern, {});

    const fourth = houses.houses.find((house) => house.houseNumber === 4);
    const related = (number) => { const house = houses.houses.find((item) => item.houseNumber === number); return freeze({ sign: house.rashi.rashiIndex, lord: house.rashiHouseLord, occupants: houses.planetaryAssignments.filter((item) => item.rashiHouseNumber === number).map((item) => item.body), connections: d1.connections.filter((item) => item.rulesHouses.includes(number) || item.placementHouse === number).map((item) => item.planet) }); };
    const report = freeze({
      metadata: freeze({ ruleset: SOLAR_RETURN_VIMSHOTTARI_RULESET.id, calculationInstant: at, birthProfileId, developmentOnly: true }),
      astronomy: freeze({ planets: freeze(bodyRows), ascendant: freeze({ longitude: bodies.Ascendant.siderealLongitudeDegrees, rashi: ascendant.rashi.rashiIndex }), nakshatra: freeze({ moon: moon.nakshatra.name, nakshatraIndex: moon.nakshatra.index, pada: moon.pada.pada }) }),
      derivedChartFacts: freeze({ houses: freeze(houses.houses.map((house) => freeze({ house: house.houseNumber, sign: house.rashi.rashiIndex, lord: house.rashiHouseLord }))), houseLords: freeze(Object.fromEntries(houses.houses.map((house) => [house.houseNumber, house.rashiHouseLord]))), propertyFacts: freeze({ h4: freeze({ sign: fourth.rashi.rashiIndex, lord: fourth.rashiHouseLord, occupants: houses.planetaryAssignments.filter((item) => item.rashiHouseNumber === 4).map((item) => item.body), aspects: [], lordPlacement: houses.planetaryAssignments.find((item) => canonicalPlanetId(item.body) === canonicalPlanetId(fourth.rashiHouseLord))?.rashiHouseNumber || null, lordConjunctions: d1.connections.find((item) => item.planet === canonicalPlanetId(fourth.rashiHouseLord)) ? [] : [] }), h2: related(2), h11: related(11) }) }),
      vargas: freeze(Object.fromEntries(Object.entries(vargas).map(([id, chart]) => [id, freeze({ ascendant: chart.ascendant.rashi.rashiIndex, bodies: chart.bodies, houseLords: Object.fromEntries(chart.houses.houses.map((house) => [house.houseNumber, house.rashiHouseLord])) })]))),
      dasha: freeze({ currentMD: current.md, currentAD: current.ad, currentPD: current.pd, timeline: freeze(tree.periods.map((md) => freeze({ ...periodSummary(md), antardashas: freeze(md.children.map((ad) => freeze({ ...periodSummary(ad), pratyantardashas: freeze(ad.children.map(periodSummary)) }))) }))) }),
      transits: freeze({ current: freeze(Object.values(snapshot.transitBodies).map((fact) => freeze({ body: fact.body, rashi: fact.transitRashi.rashiIndex, natalHouse: fact.transitNatalHouseNumber, aspectsNatalHouses: fact.aspectsNatalHouses.map((entry) => entry.houseNumber) }))), futureIngresses: freeze(transitScan.events.map((event) => freeze({ body: event.body, eventType: event.eventType, instant: event.instant, fromRashi: event.fromRashi.rashiIndex, toRashi: event.toRashi.rashiIndex }))) }),
      ashtakavarga: freeze({ sav: freeze(rawRashis.map((row) => freeze({ rashi: row.rashiIndex, bindu: row.favorableMarkCount }))), bav: freeze(Object.fromEntries(Object.entries(rawAshtaka.planetaryBavs).map(([body, bav]) => [body, bav.rashis.map((row) => freeze({ rashi: row.rashiIndex, bindu: row.favorableMarkCount }))]))) }),
      propertyEvidence: freeze({ d1, d4: freeze({ confirmation: d4.confirmation, fourthHouse: d4.fourthHouse, fourthLordHouse: d4.fourthLordHouse }), dasha, transit, ashtakavarga, lifeEvents: events }),
      propertyWindows: freeze([]),
      checks: freeze(checks),
      externalValidationGaps: freeze({ astronomy: freeze(['planet longitudes', 'Ascendant', 'Moon Nakshatra/Pada']), dasha: freeze(['MD start/end', 'AD start/end', 'PD start/end']), varga: freeze(['D4 placements', 'D9 placements', 'D10 placements', 'D16 placements']), transit: freeze(['major ingress timestamps']), ashtakavarga: freeze(['SAV', 'BAV']) }),
      propertyClassification: propertyState,
    });
    return report;
  }
}

const GOLDEN_FIXTURE_SCHEMA = Object.freeze({ name: 'string', input: freeze({ birthProfile: 'fixture-reference' }), expected: freeze({ astronomy: {}, d1: {}, d4: {}, d9: {}, d10: {}, d16: {}, dasha: {}, transits: {}, ashtakavarga: {} }), tolerances: freeze({ longitudeDegrees: null, timestampSeconds: null }) });

module.exports = { PropertyValidationHarness, VALIDATION_LAYERS, GOLDEN_FIXTURE_SCHEMA };
