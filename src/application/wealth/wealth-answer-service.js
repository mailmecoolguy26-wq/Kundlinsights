'use strict';

// Wealth Rules v1 keeps natal/Dasha evidence ahead of every confirming layer.
// Neither a transit nor SAV/BAV can manufacture a Wealth timing period.
const { calculateRashiHouses } = require('../../bhava');
const { calculateGocharSnapshot } = require('../../gochar');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../dasha');
const { calculateChartCoordinates } = require('../divisional-charts/divisional-chart-service');
const { calculateAshtakavargaForLayer2 } = require('../ashtakavarga');
const { classifyLayer1Bodies, canonicalPlanetId } = require('../../jyotish');

const WealthIntent = Object.freeze({ WEALTH_CURRENT_OUTLOOK: 'WEALTH_CURRENT_OUTLOOK', WEALTH_STRONGER_WINDOW: 'WEALTH_STRONGER_WINDOW' });
const PRIMARY_HOUSES = Object.freeze([2, 11]);
const SECONDARY_HOUSES = Object.freeze([5, 9, 10]);
const CONSTRUCTIVE_HOUSES = Object.freeze([...PRIMARY_HOUSES, ...SECONDARY_HOUSES]);
const CAUTION_HOUSES = Object.freeze([6, 8, 12]);
const DAY_MS = 86_400_000;
const WINDOW_STATES = Object.freeze(['Supportive', 'Improving', 'Consolidation']);
const STATE_PRIORITY = Object.freeze({ Supportive: 0, Improving: 1, Consolidation: 2 });

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function canonical(value) { return canonicalPlanetId(value) || String(value || '').toLowerCase(); }
function request(birth) { return { date: birth.localDate, time: birth.localTime, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }; }
function transitRequest(instant, birth) { const date = new Date(instant); return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 23), timezone: 'UTC', latitude: birth.latitude, longitude: birth.longitude }; }
function iso(epoch) { return new Date(epoch).toISOString(); }
function epoch(value) { return Date.parse(value); }
function periodEpoch(period, edge) { return Number(period[`${edge}Instant`].epochMilliseconds); }

function houseLordMap(houses) { const values = new Map(); for (const house of houses.houses) { const lord = canonical(house.rashiHouseLord); values.set(lord, [...(values.get(lord) || []), house.houseNumber]); } return values; }
function placements(houses) { return new Map(houses.planetaryAssignments.map((entry) => [canonical(entry.body), entry.rashiHouseNumber])); }
function wealthFactor(houses, planet) {
  const lordships = houseLordMap(houses).get(canonical(planet)) || [];
  const placement = placements(houses).get(canonical(planet));
  const relatedHouses = [...new Set([...lordships, ...(placement ? [placement] : [])])].sort((a, b) => a - b);
  return freeze({ planet: canonical(planet), houses: freeze(relatedHouses), primary: relatedHouses.some((house) => PRIMARY_HOUSES.includes(house)), secondary: relatedHouses.some((house) => SECONDARY_HOUSES.includes(house)), caution: relatedHouses.some((house) => CAUTION_HOUSES.includes(house)) });
}
function d1Evidence(houses) {
  const planets = [...new Set([...houses.planetaryAssignments.map((entry) => canonical(entry.body)), ...houses.houses.map((house) => canonical(house.rashiHouseLord))])];
  const factors = planets.map((planet) => wealthFactor(houses, planet));
  const primary = factors.filter((factor) => factor.primary), secondary = factors.filter((factor) => factor.secondary), caution = factors.filter((factor) => factor.caution);
  const state = primary.length >= 2 ? 'SUPPORTIVE_FOUNDATION' : primary.length ? 'LIMITED_FOUNDATION' : 'UNCLEAR_FOUNDATION';
  return freeze({ state, factors: freeze(factors), primary, secondary, caution, primaryHouses: PRIMARY_HOUSES, secondaryHouses: SECONDARY_HOUSES, cautionHouses: CAUTION_HOUSES });
}
function d2Evidence(natal) { try { const evidence = d1Evidence(calculateChartCoordinates(natal, 'd2').houses); return freeze({ available: true, rulesetId: 'parashari-hora-v1', reinforcement: evidence.state === 'SUPPORTIVE_FOUNDATION' ? 'REINFORCES' : evidence.state === 'UNCLEAR_FOUNDATION' ? 'WEAKENS' : 'NEUTRAL', evidence }); } catch (_) { return freeze({ available: false, rulesetId: 'parashari-hora-v1', reinforcement: 'UNAVAILABLE', evidence: null }); } }

function parentDashaEvidence(houses, parent) {
  if (!parent) return freeze({ state: 'NO_RELEVANCE', eligible: false, factors: freeze([]), periods: null, strength: 0 });
  const factors = [freeze({ level: 'MD', ...wealthFactor(houses, parent.md) }), freeze({ level: 'AD', ...wealthFactor(houses, parent.ad) })];
  const constructive = factors.filter((factor) => factor.primary || factor.secondary), caution = factors.filter((factor) => factor.caution && !factor.primary);
  const state = constructive.length && caution.length ? 'MIXED_RELEVANCE' : constructive.length ? 'WEALTH_RELEVANT' : caution.length ? 'CAUTION_RELEVANCE' : 'NO_RELEVANCE';
  return freeze({ state, eligible: constructive.length > 0, factors: freeze(factors), periods: freeze(parent), strength: constructive.reduce((total, factor) => total + (factor.primary ? 2 : 1), 0) });
}
function pdRefinement(houses, pdLord) { const factor = wealthFactor(houses, pdLord); return freeze({ state: factor.primary || factor.secondary ? 'STRENGTHENING' : factor.caution ? 'WEAKENING' : 'NEUTRAL', factor }); }
function dashaEvidence(houses, period) {
  if (!period) return freeze({ state: 'NO_RELEVANCE', eligible: false, periods: null, factors: freeze([]), pdState: 'NEUTRAL_REFINEMENT', strength: 0 });
  const parent = parentDashaEvidence(houses, period), pd = pdRefinement(houses, period.pd);
  return freeze({ ...parent, factors: freeze([...parent.factors, freeze({ level: 'PD', ...pd.factor })]), pdState: `${pd.state}_REFINEMENT` });
}
function dashaAt(tree, instant) {
  const stamp = epoch(instant);
  for (const md of tree.periods || []) { if (stamp < periodEpoch(md, 'start') || stamp >= periodEpoch(md, 'end')) continue;
    for (const ad of md.children || []) { if (stamp < periodEpoch(ad, 'start') || stamp >= periodEpoch(ad, 'end')) continue;
      for (const pd of ad.children || []) { if (stamp < periodEpoch(pd, 'start') || stamp >= periodEpoch(pd, 'end')) continue;
        return freeze({ md: canonical(md.lord.id), ad: canonical(ad.lord.id), pd: canonical(pd.lord.id), mdStart: md.startInstant.utc, mdEnd: md.endInstant.utc, adStart: ad.startInstant.utc, adEnd: ad.endInstant.utc, pdStart: pd.startInstant.utc, pdEnd: pd.endInstant.utc });
      }
    }
  }
  return null;
}

function transitHouse(value) { return typeof value === 'number' ? value : value && value.houseNumber; }
function transitEvidence(snapshot) {
  const rows = [];
  for (const [planet, body] of Object.entries(snapshot.transitBodies || {})) { if (!body) continue;
    const houses = [body.transitNatalHouseNumber, ...(body.aspectsNatalHouses || []).map(transitHouse)].filter(Number.isInteger);
    const constructive = houses.some((house) => CONSTRUCTIVE_HOUSES.includes(house)), primary = houses.some((house) => PRIMARY_HOUSES.includes(house)), caution = houses.some((house) => CAUTION_HOUSES.includes(house));
    const kind = planet === 'Jupiter' && constructive ? 'JUPITER_SUPPORT' : planet === 'Saturn' && constructive ? 'SATURN_CONSOLIDATION' : planet === 'Venus' && constructive ? 'VENUS_MATERIAL' : planet === 'Mars' && (constructive || caution) ? 'MARS_ACTIVITY' : ['Rahu', 'Ketu'].includes(planet) && caution ? 'NODE_CAUTION' : 'NEUTRAL';
    rows.push(freeze({ planet, houses: freeze(houses), kind, touchesPrimary: primary, touchesConstructive: constructive, touchesCaution: caution }));
  }
  const supports = rows.filter((row) => row.kind === 'JUPITER_SUPPORT'), consolidation = rows.filter((row) => row.kind === 'SATURN_CONSOLIDATION'), caution = rows.filter((row) => row.kind === 'NODE_CAUTION');
  return freeze({ rows: freeze(rows), supportive: supports.length > 0, consolidation: consolidation.length > 0, caution: caution.length, confirmation: supports.length ? 'CONFIRMS' : consolidation.length ? 'CONSOLIDATES' : caution.length ? 'CAUTION_CONTEXT' : 'NEUTRAL' });
}

function rankRelative(values) {
  const present = values.filter((entry) => Number.isFinite(entry.value)); if (present.length !== 12) return new Map();
  const descending = [...present].sort((left, right) => right.value - left.value), ascending = [...present].sort((left, right) => left.value - right.value);
  const strongBoundary = descending[3].value, weakBoundary = ascending[3].value;
  const strongBoundaryTied = present.filter((entry) => entry.value === strongBoundary).length > 1;
  const weakBoundaryTied = present.filter((entry) => entry.value === weakBoundary).length > 1;
  // Boundary ties remain Neutral rather than being split solely to fill four slots.
  return new Map(present.map((entry) => [entry.house,
    entry.value > strongBoundary || (entry.value === strongBoundary && !strongBoundaryTied) ? 'Strong'
      : entry.value < weakBoundary || (entry.value === weakBoundary && !weakBoundaryTied) ? 'Weak' : 'Neutral']));
}
function scoreByHouse(rawRows, houses) { const bySign = new Map((rawRows || []).map((row) => [row.rashiIndex, row.favorableMarkCount])); return houses.houses.map((house) => ({ house: house.houseNumber, value: bySign.get(house.rashi.rashiIndex) })); }
function savEvidence(raw, houses) {
  const scores = scoreByHouse(raw && raw.rawSarvashtakavarga && raw.rawSarvashtakavarga.rashis, houses), states = rankRelative(scores);
  if (states.size === 0) return freeze({ available: false, overallConfirmation: 'NEUTRAL', houses: freeze([]) });
  const evidence = scores.map((score) => freeze({ ...score, rank: states.get(score.house) }));
  const primary = evidence.filter((item) => PRIMARY_HOUSES.includes(item.house)), secondary = evidence.filter((item) => SECONDARY_HOUSES.includes(item.house)), caution = evidence.filter((item) => CAUTION_HOUSES.includes(item.house));
  const primarySupport = primary.some((item) => item.rank === 'Strong'), secondarySupport = secondary.some((item) => item.rank === 'Strong'), cautionActivity = caution.some((item) => item.rank === 'Strong');
  const overallConfirmation = primarySupport && !cautionActivity ? 'SUPPORTIVE' : cautionActivity && !primarySupport && !secondarySupport ? 'WEAK' : (primarySupport || secondarySupport) && cautionActivity ? 'MIXED' : 'NEUTRAL';
  return freeze({ available: true, policy: 'CHART_RELATIVE_TOP_MIDDLE_BOTTOM_WITH_BOUNDARY_TIES_NEUTRAL', houses: freeze(evidence), primarySupport, secondarySupport, cautionActivity, overallConfirmation });
}
function bavEvidence(raw, houses, transit) {
  const bavs = raw && raw.planetaryBavs || {}, byHouse = new Map(houses.houses.map((house) => [house.houseNumber, house.rashi.rashiIndex])), findings = [];
  for (const row of transit.rows || []) { if (['Rahu', 'Ketu'].includes(row.planet)) continue;
    const source = Object.values(bavs).find((item) => String(item.targetBody || '').toLowerCase() === row.planet.toLowerCase()); if (!source || !Array.isArray(source.rashis)) continue;
    const targetHouse = row.houses[0], sign = byHouse.get(targetHouse), destination = source.rashis.find((item) => item.rashiIndex === sign); if (!destination) continue;
    const distribution = source.rashis.map((item) => ({ house: item.rashiIndex, value: item.favorableMarkCount }));
    const rank = rankRelative(distribution).get(destination.rashiIndex); if (!rank) continue;
    findings.push(freeze({ planet: row.planet, destinationHouse: targetHouse, value: destination.favorableMarkCount, rank }));
  }
  return freeze({ available: findings.length > 0, policy: 'SAME_PLANET_DESTINATION_RELATIVE_RANKING', findings: freeze(findings) });
}
function ashtakavarga(natal, houses, transit = null) { try { const raw = calculateAshtakavargaForLayer2(classifyLayer1Bodies(natal)); return freeze({ rawContextOnly: true, sav: savEvidence(raw, houses), bav: transit ? bavEvidence(raw, houses, transit) : freeze({ available: false, findings: freeze([]) }) }); } catch (_) { return freeze({ rawContextOnly: true, sav: freeze({ available: false, overallConfirmation: 'NEUTRAL', houses: freeze([]) }), bav: freeze({ available: false, findings: freeze([]) }) }); } }

function sampledTransitEvidence(samples) {
  const entries = samples.map((sample) => sample.evidence), count = (key) => entries.filter((entry) => entry[key]).length, cautionCount = entries.filter((entry) => entry.caution > 0).length;
  const persistent = freeze({ jupiterSupport: count('supportive') >= 2, saturnConsolidation: count('consolidation') >= 2, nodeCaution: cautionCount >= 2 });
  return freeze({ samples: freeze(samples), persistent, transitional: freeze({ jupiterSupport: count('supportive') === 1, saturnConsolidation: count('consolidation') === 1, nodeCaution: cautionCount === 1 }), confirmation: persistent.jupiterSupport ? 'PERSISTENT_JUPITER_SUPPORT' : persistent.saturnConsolidation ? 'PERSISTENT_SATURN_CONSOLIDATION' : 'NO_PERSISTENT_MAJOR_SIGNAL' });
}
function candidateState({ d1, d2, parent, pd, transit, sav }) {
  if (!parent.eligible || d1.state === 'UNCLEAR_FOUNDATION') return 'Insufficient Evidence';
  const constructive = d1.state === 'SUPPORTIVE_FOUNDATION' || d1.state === 'LIMITED_FOUNDATION';
  const caution = parent.state === 'MIXED_RELEVANCE' || pd.state === 'WEAKENING' || transit.persistent.nodeCaution || sav.overallConfirmation === 'WEAK';
  if (caution && !(transit.persistent.saturnConsolidation && !transit.persistent.nodeCaution)) return d1.primary.length ? 'Mixed' : 'Cautious';
  if (constructive && (d2.reinforcement === 'REINFORCES' || transit.persistent.jupiterSupport)) return 'Supportive';
  if (constructive && transit.persistent.saturnConsolidation) return 'Consolidation';
  if (constructive && pd.state !== 'WEAKENING') return 'Improving';
  return 'Insufficient Evidence';
}
function classify({ d1, d2, dasha, transit = { supportive: false, consolidation: false, caution: 0 } }) { return candidateState({ d1, d2, parent: { eligible: dasha.eligible, state: dasha.state, strength: dasha.strength || 0 }, pd: { state: String(dasha.pdState || 'NEUTRAL_REFINEMENT').replace('_REFINEMENT', '') }, transit: { persistent: { jupiterSupport: Boolean(transit.supportive), saturnConsolidation: Boolean(transit.consolidation), nodeCaution: Number(transit.caution || 0) > 0 } }, sav: { overallConfirmation: 'NEUTRAL' } }); }

function exactParentPeriods(tree, from, houses, d1) {
  const candidates = [];
  for (const md of tree.periods || []) for (const ad of md.children || []) {
    if (periodEpoch(ad, 'end') <= epoch(from)) continue;
    const parent = freeze({ md: canonical(md.lord.id), ad: canonical(ad.lord.id), mdStart: md.startInstant.utc, mdEnd: md.endInstant.utc, adStart: ad.startInstant.utc, adEnd: ad.endInstant.utc });
    const evidence = parentDashaEvidence(houses, parent); if (!evidence.eligible || d1.state === 'UNCLEAR_FOUNDATION') continue;
    candidates.push(freeze({ parent, evidence, ad }));
  }
  return freeze(candidates);
}
function pdSegments(parents, from, houses) {
  const now = epoch(from), output = [];
  for (const { parent, evidence, ad } of parents) for (const pd of ad.children || []) { const start = periodEpoch(pd, 'start'), end = periodEpoch(pd, 'end'); if (end <= now) continue; output.push(freeze({ parent, parentEvidence: evidence, pd: freeze({ lord: canonical(pd.lord.id), start: pd.startInstant.utc, end: pd.endInstant.utc, temporalStatus: start <= now ? 'CURRENT' : 'FUTURE' }), refinement: pdRefinement(houses, pd.lord.id) })); }
  return freeze(output);
}
function sampleInstants(segment, now) { const start = Math.max(epoch(segment.pd.start), epoch(now)), end = epoch(segment.pd.end), latest = Math.max(start, end - DAY_MS), midpoint = start + Math.floor((latest - start) / 2); return [...new Set([start, midpoint, latest])].map(iso); }
function direction(state) { return state === 'Supportive' ? 'GROWTH' : state === 'Improving' ? 'IMPROVING' : state === 'Consolidation' ? 'CONSOLIDATION' : 'CAUTION_OR_INSUFFICIENT'; }
function hasCaution(candidate) { return candidate.state === 'Mixed' || candidate.state === 'Cautious' || candidate.state === 'Insufficient Evidence' || candidate.transit.persistent.nodeCaution || candidate.pdRefinement.state === 'WEAKENING'; }
function evaluateCandidate({ segment, samples, d1, d2, natal, houses }) {
  const transit = sampledTransitEvidence(samples), contextualTransit = samples[0] && samples[0].evidence || transitEvidence({ transitBodies: {} }), ashtaka = ashtakavarga(natal, houses, contextualTransit), state = candidateState({ d1, d2, parent: segment.parentEvidence, pd: segment.refinement, transit, sav: ashtaka.sav });
  return freeze({ start: segment.pd.start, end: segment.pd.end, temporalStatus: segment.pd.temporalStatus, parent: segment.parent, parentMdRelevance: segment.parentEvidence.factors[0], parentAdRelevance: segment.parentEvidence.factors[1], parentEvidence: segment.parentEvidence, pd: segment.pd, pdRefinement: segment.refinement, d1, d2, transit, ashtakavarga: ashtaka, state, directionalMeaning: direction(state), cautionSignals: freeze({ hasCaution: false }) });
}
function adjacent(left, right) { return epoch(left.end) === epoch(right.start); }
function sameParent(left, right) { return left.parent.md === right.parent.md && left.parent.ad === right.parent.ad && left.parent.adStart === right.parent.adStart && left.parent.adEnd === right.parent.adEnd; }
function materiallySameTransit(left, right) { return left.transit.persistent.jupiterSupport === right.transit.persistent.jupiterSupport && left.transit.persistent.saturnConsolidation === right.transit.persistent.saturnConsolidation && left.transit.persistent.nodeCaution === right.transit.persistent.nodeCaution; }
function coalesceCandidates(candidates) {
  const ordered = [...candidates].sort((left, right) => epoch(left.start) - epoch(right.start)), result = [];
  for (const candidate of ordered) { const prior = result[result.length - 1]; const merge = prior && adjacent(prior, candidate) && sameParent(prior, candidate) && prior.state === candidate.state && prior.directionalMeaning === candidate.directionalMeaning && !hasCaution(prior) && !hasCaution(candidate) && materiallySameTransit(prior, candidate); if (!merge) { result.push(freeze({ ...candidate, segments: freeze([candidate]) })); continue; } result[result.length - 1] = freeze({ ...prior, end: candidate.end, temporalStatus: prior.temporalStatus === 'CURRENT' ? 'CURRENT' : candidate.temporalStatus, segments: freeze([...prior.segments, candidate]), cautionSummary: freeze([]) }); }
  return freeze(result);
}
function rankCandidate(left, right) {
  const compare = (a, b) => a === b ? 0 : a > b ? -1 : 1;
  let value = (STATE_PRIORITY[left.state] ?? 99) - (STATE_PRIORITY[right.state] ?? 99); if (value) return value;
  value = compare(left.parentEvidence.strength, right.parentEvidence.strength); if (value) return value;
  value = compare(left.d1.primary.length, right.d1.primary.length); if (value) return value;
  value = compare(left.pdRefinement.state === 'STRENGTHENING' ? 1 : 0, right.pdRefinement.state === 'STRENGTHENING' ? 1 : 0); if (value) return value;
  value = compare(left.d2.reinforcement === 'REINFORCES' ? 1 : 0, right.d2.reinforcement === 'REINFORCES' ? 1 : 0); if (value) return value;
  value = compare((left.transit.persistent.jupiterSupport || left.transit.persistent.saturnConsolidation) ? 1 : 0, (right.transit.persistent.jupiterSupport || right.transit.persistent.saturnConsolidation) ? 1 : 0); if (value) return value;
  value = compare(left.ashtakavarga.sav.overallConfirmation === 'SUPPORTIVE' ? 1 : 0, right.ashtakavarga.sav.overallConfirmation === 'SUPPORTIVE' ? 1 : 0); if (value) return value;
  value = compare(hasCaution(left) ? 0 : 1, hasCaution(right) ? 0 : 1); if (value) return value;
  return epoch(left.start) - epoch(right.start);
}
function selectStrongerWindow(candidates) { return candidates.filter((candidate) => WINDOW_STATES.includes(candidate.state)).sort(rankCandidate)[0] || null; }

function copy(state) { const phrases = { Supportive: ['Multiple financial timing signals are aligned, but they do not guarantee income or gains.', 'Use supportive periods to strengthen consistent accumulation rather than take risk solely on timing.'], Improving: ['Financial timing is becoming more constructive, though the evidence is not yet fully aligned.', 'Focus on predictable income and steady financial discipline.'], Mixed: ['Financial support and expenditure or responsibility themes are active together.', 'Review major commitments carefully and maintain buffers.'], Consolidation: ['This period is better suited to stability, preservation and disciplined accumulation than aggressive expansion.', 'Strengthen savings habits and review ongoing obligations.'], Cautious: ['The current timing shows more financial pressure or uneven momentum than constructive alignment.', 'Avoid relying on timing alone for major financial commitments.'], 'Insufficient Evidence': ['Available evidence is not strong enough to call this a clearly favourable Wealth period.', 'Use practical financial judgment and avoid treating activity as gain.'] }; return freeze({ summary: phrases[state][0], practicalFocus: freeze([phrases[state][1]]) }); }

class WealthAnswerService {
  constructor({ birthProfileService, astronomicalEngine, canonicalSiderealSunSampler, entitlementService = null, clock = () => new Date().toISOString() } = {}) { if (!birthProfileService || typeof birthProfileService.get !== 'function' || !astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler) throw new TypeError('INVALID_WEALTH_ANSWER_DEPENDENCIES'); Object.assign(this, { profiles: birthProfileService, engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, entitlements: entitlementService, clock }); Object.freeze(this); }
  async answer({ principal, birthProfileId, intent = WealthIntent.WEALTH_CURRENT_OUTLOOK, at = null } = {}) {
    if (!Object.values(WealthIntent).includes(intent)) fail('UNSUPPORTED_WEALTH_INTENT');
    if (this.entitlements) { const access = await this.entitlements.getReadingEntitlementStatus({ principal, birthProfileId }), premium = access && (access.profilePremium || access.career); if (!premium || premium.eligible !== true) return freeze({ intent, answerability: 'PREMIUM_REQUIRED', state: 'Insufficient Evidence', action: freeze({ type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' }), ruleVersion: 'wealth-rules-v1', strongerWindow: null, evidence: null }); }
    const profile = await this.profiles.get({ principal, birthProfileId }); if (!profile || profile.status !== 'active') fail('NOT_FOUND_OR_FORBIDDEN');
    const instant = at || new Date(this.clock()).toISOString(), natal = this.engine.calculate(request(profile.birthData));
    const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies }), d1 = d1Evidence(houses), d2 = d2Evidence(natal);
    const tree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
    const currentPeriod = dashaAt(tree, instant), currentDasha = dashaEvidence(houses, currentPeriod), currentBodies = this.engine.calculate(transitRequest(instant, profile.birthData));
    const currentTransit = transitEvidence(calculateGocharSnapshot({ snapshotInstant: instant, natalBodies: natal.bodies, natalHouses: houses, transitBodies: currentBodies.bodies })), currentState = classify({ d1, d2, dasha: currentDasha, transit: currentTransit });
    const parents = exactParentPeriods(tree, instant, houses, d1), segments = pdSegments(parents, instant, houses);
    const evaluated = segments.map((segment) => { const samples = sampleInstants(segment, instant).map((sampleInstant) => { const bodies = this.engine.calculate(transitRequest(sampleInstant, profile.birthData)); return freeze({ instant: sampleInstant, evidence: transitEvidence(calculateGocharSnapshot({ snapshotInstant: sampleInstant, natalBodies: natal.bodies, natalHouses: houses, transitBodies: bodies.bodies })) }); }); return evaluateCandidate({ segment, samples, d1, d2, natal, houses }); });
    const coalesced = coalesceCandidates(evaluated), strongerWindow = selectStrongerWindow(coalesced), wording = copy(currentState);
    return freeze({ intent, answerability: 'SUPPORTED', state: currentState, summary: wording.summary, currentPhase: currentState, strongerWindow, whatThisCanMean: freeze([wording.summary]), supportiveFactors: freeze(d1.primary.map((factor) => factor.planet)), cautionFactors: freeze(d1.caution.map((factor) => factor.planet)), practicalFocus: wording.practicalFocus, detailedAstrology: freeze({ timingEvidence: currentDasha, dashaAndTransit: currentTransit, d1WealthFoundation: d1, d2Hora: d2, ashtakavarga: ashtakavarga(natal, houses, currentTransit), candidatePipeline: freeze({ parents, pdSegments: segments, evaluated, coalesced }), calibration: freeze({ financialActivityIsNotGain: true }) }), evidence: freeze({ d1, d2, dasha: currentDasha, transit: currentTransit }), ruleVersion: 'wealth-rules-v1', limitations: freeze(['NO_FINANCIAL_ADVICE', 'NO_OUTCOME_GUARANTEE', 'FINANCIAL_ACTIVITY_IS_NOT_GAIN']) });
  }
}

module.exports = { WealthAnswerService, WealthIntent, d1Evidence, d2Evidence, dashaEvidence, classify, rankRelative, savEvidence, bavEvidence, parentDashaEvidence, pdRefinement, exactParentPeriods, pdSegments, sampleInstants, sampledTransitEvidence, evaluateCandidate, candidateState, coalesceCandidates, rankCandidate, selectStrongerWindow };
