'use strict';

const { repositoryError, immutableCopy } = require('../../persistence/contracts');

const RULESET_ID = 'career-pattern-comparison-v1';
const QUALIFIERS = Object.freeze(['FULL', 'PARTIAL', 'CHANGED', 'NOT_PRESENT', 'NOT_COMPARABLE']);
const PRIMARY_BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);
const FAST_BODIES = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Venus']);
const TRANSITION_TYPES = Object.freeze(['rashiIngress', 'retrogradeStation', 'directStation', 'sameRashiAssociationStart', 'sameRashiAssociationEnd', 'transitDrishtiStart', 'transitDrishtiEnd', 'sadeSatiPhaseChange']);
const CAREER_HOUSES = Object.freeze([2, 6, 10, 11]);
const DIMENSION_REGISTRY = Object.freeze([
  Object.freeze({ id: 'DASHA_MD', category: 'DASHA', precisions: ['DAY', 'MONTH', 'YEAR'], order: 10 }),
  Object.freeze({ id: 'DASHA_AD', category: 'DASHA', precisions: ['DAY', 'MONTH', 'YEAR'], order: 20 }),
  Object.freeze({ id: 'DASHA_MD_AD', category: 'DASHA', precisions: ['DAY', 'MONTH', 'YEAR'], order: 30 }),
  Object.freeze({ id: 'DASHA_PD', category: 'DASHA', precisions: ['DAY'], order: 40 }),
  Object.freeze({ id: 'DASHA_MD_AD_PD', category: 'DASHA', precisions: ['DAY'], order: 50 }),
  Object.freeze({ id: 'TRANSIT_NATAL_HOUSE', category: 'TRANSIT', precisions: ['DAY', 'MONTH', 'YEAR'], order: 60 }),
  Object.freeze({ id: 'TRANSIT_RASHI', category: 'TRANSIT', precisions: ['DAY', 'MONTH', 'YEAR'], order: 70 }),
  Object.freeze({ id: 'TRANSIT_EVENT', category: 'TRANSIT_EVENT', precisions: ['DAY', 'MONTH', 'YEAR'], order: 80 }),
  Object.freeze({ id: 'CAREER_HOUSE', category: 'CAREER_HOUSE', precisions: ['DAY', 'MONTH', 'YEAR'], order: 90 }),
  Object.freeze({ id: 'ASHTAKAVARGA_SAV', category: 'ASHTAKAVARGA', precisions: ['DAY', 'MONTH', 'YEAR'], order: 100 }),
  Object.freeze({ id: 'ASHTAKAVARGA_BAV', category: 'ASHTAKAVARGA', precisions: ['DAY', 'MONTH', 'YEAR'], order: 110 }),
  Object.freeze({ id: 'ASHTAKAVARGA_LAGNA_BAV', category: 'ASHTAKAVARGA', precisions: ['DAY', 'MONTH', 'YEAR'], order: 120 }),
]);
const REGISTRY = new Map(DIMENSION_REGISTRY.map((item) => [item.id, item]));

function fail(code) { throw repositoryError(code); }
function canonical(value) { return JSON.stringify(value, Object.keys(value || {}).sort()); }
function key(id, dimensions) { return ['p3v1', id, ...dimensions.map((value) => encodeURIComponent(String(value)))].join('|'); }
function full(intervals, from, to) { return intervals.length === 1 && intervals[0].from === from && intervals[0].to === to; }
function dashaFacts(snapshot, event) {
  const by = (id, values) => {
    const rule = REGISTRY.get(id); if (!rule.precisions.includes(event.eventDate.precision)) return [];
    const unique = [...new Set(values.map((value) => canonical(value.parts)))];
    if (!unique.length) return [];
    if (unique.length > 1) return [{ id, qualifier: 'CHANGED', values: null, sourceFacts: values }];
    const value = values[0]; return [{ id, qualifier: full(values, snapshot.temporalCoverage.from, snapshot.temporalCoverage.to) ? 'FULL' : 'PARTIAL', values: value.parts, sourceFacts: values }];
  };
  const intervals = snapshot.dashaIntervals || [];
  const md = intervals.map((x) => ({ from: x.from, to: x.to, parts: [x.mahadasha.lord] }));
  const ad = intervals.map((x) => ({ from: x.from, to: x.to, parts: [x.antardasha.lord] }));
  const pair = intervals.map((x) => ({ from: x.from, to: x.to, parts: [x.mahadasha.lord, x.antardasha.lord] }));
  const pd = intervals.map((x) => ({ from: x.from, to: x.to, parts: [x.pratyantardasha.lord] }));
  const tuple = intervals.map((x) => ({ from: x.from, to: x.to, parts: [x.mahadasha.lord, x.antardasha.lord, x.pratyantardasha.lord] }));
  return [...by('DASHA_MD', md), ...by('DASHA_AD', ad), ...by('DASHA_MD_AD', pair), ...by('DASHA_PD', pd), ...by('DASHA_MD_AD_PD', tuple)];
}
function transitFacts(snapshot, event) {
  const out = [];
  for (const body of snapshot.transitCoverage.bodies || []) {
    const interval = body.intervals && body.intervals[0]; if (!interval) continue;
    const primary = PRIMARY_BODIES.includes(body.body);
    const stable = interval.natalHouseAtStart === interval.natalHouseAtEnd && interval.signAtStart && interval.signAtEnd && interval.signAtStart.rashiIndex === interval.signAtEnd.rashiIndex && !(body.transitions || []).some((x) => x.eventType === 'rashiIngress');
    const qualifier = stable ? 'FULL' : 'CHANGED';
    if (qualifier === 'FULL') {
      out.push({ id: 'TRANSIT_NATAL_HOUSE', qualifier, values: [body.body, interval.natalHouseAtStart, qualifier], primary, sourceFacts: [interval] });
      out.push({ id: 'TRANSIT_RASHI', qualifier, values: [body.body, interval.signAtStart.rashiIndex, qualifier], primary, sourceFacts: [interval] });
      if (CAREER_HOUSES.includes(interval.natalHouseAtStart)) out.push({ id: 'CAREER_HOUSE', qualifier, values: [body.body, interval.natalHouseAtStart], primary, sourceFacts: [interval] });
      for (const [id, value] of [['ASHTAKAVARGA_SAV', body.ashtakavarga.savMarkCount], ['ASHTAKAVARGA_BAV', body.ashtakavarga.sameGrahaBavMarkCount], ['ASHTAKAVARGA_LAGNA_BAV', body.ashtakavarga.lagnaBavMarkCount]]) if (value !== null) out.push({ id, qualifier, values: [body.body, interval.signAtStart.rashiIndex, value], primary, sourceFacts: [body.ashtakavarga] });
    }
    for (const transition of body.transitions || []) {
      if (!TRANSITION_TYPES.includes(transition.eventType)) continue;
      const broadFast = FAST_BODIES.includes(body.body) && event.eventDate.precision !== 'DAY';
      const facts = Object.fromEntries(Object.entries(transition).filter(([name, value]) => !['instant', 'body'].includes(name) && (typeof value === 'string' || typeof value === 'number' || value === null)));
      out.push({ id: 'TRANSIT_EVENT', qualifier: broadFast ? 'NOT_COMPARABLE' : 'PARTIAL', values: [body.body, transition.eventType, canonical(facts)], primary, sourceFacts: [transition] });
      const target = transition.targetHouseNumber || transition.natalTargetHouseNumber;
      if (CAREER_HOUSES.includes(target)) out.push({ id: 'CAREER_HOUSE', qualifier: broadFast ? 'NOT_COMPARABLE' : 'PARTIAL', values: [body.body, 'EVENT', transition.eventType, target], primary, sourceFacts: [transition] });
    }
  }
  return out;
}
function context(snapshot) {
  const p = snapshot.provenance || {}; const provider = p.provider || {};
  const value = { engineProfileId: p.engineProfileId, engineProfileVersion: p.engineProfileVersion, ayanamshaSystem: p.ayanamshaSystem, nodePolicy: p.nodePolicy, dashaRulesetId: p.dashaRulesetId, provider: provider.provider || provider.providerId || null, providerVersion: provider.providerVersion || null, ephemerisVersion: provider.ephemerisVersion || null, calculationStatus: p.calculationStatus };
  return { contextKey: `p3ctxv1|${encodeURIComponent(canonical(value))}`, metadata: value };
}
async function bounded(items, limit, operation) { const out = new Array(items.length); let next = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (next < items.length) { const index = next++; out[index] = await operation(items[index]); } })); return out; }
function eventStart(event) { const d = event.eventDate; return `${String(d.year).padStart(4, '0')}-${String(d.month || 1).padStart(2, '0')}-${String(d.day || 1).padStart(2, '0')}`; }
class CareerPatternComparisonService {
  constructor({ careerEventService, careerEventAstrologyService } = {}) { if (!careerEventService || !careerEventAstrologyService || typeof careerEventService.list !== 'function' || typeof careerEventAstrologyService.get !== 'function') fail('INVALID_CAREER_PATTERN_COMPARISON_SERVICE'); this.events = careerEventService; this.snapshots = careerEventAstrologyService; Object.freeze(this); }
  async get({ principal, birthProfileId } = {}) {
    const events = (await this.events.list({ principal, birthProfileId })).slice().sort((a, b) => eventStart(a).localeCompare(eventStart(b)) || String(a.createdAt).localeCompare(String(b.createdAt)) || a.careerEventId.localeCompare(b.careerEventId)).slice(0, 10);
    if (events.length < 2) fail('INSUFFICIENT_CAREER_PATTERN_EVENTS');
    const pairs = await bounded(events, 2, async (event) => ({ event, snapshot: await this.snapshots.get({ principal, birthProfileId, eventId: event.careerEventId }) }));
    const contexts = new Map();
    for (const pair of pairs) { const c = context(pair.snapshot); if (!contexts.has(c.contextKey)) contexts.set(c.contextKey, { ...c, pairs: [] }); contexts.get(c.contextKey).pairs.push(pair); }
    const comparisonContexts = [...contexts.values()].sort((a, b) => a.contextKey.localeCompare(b.contextKey)).map((group) => {
      const candidates = new Map();
      for (const pair of group.pairs) for (const fact of [...dashaFacts(pair.snapshot, pair.event), ...transitFacts(pair.snapshot, pair.event)]) {
        if (!fact.values || fact.qualifier === 'NOT_COMPARABLE' || fact.qualifier === 'CHANGED') continue;
        const patternKey = key(fact.id, fact.values); if (!candidates.has(patternKey)) candidates.set(patternKey, { fact, evidence: [], eligible: 0 });
        const candidate = candidates.get(patternKey); candidate.eligible += 1; candidate.evidence.push({ careerEventId: pair.event.careerEventId, eventType: pair.event.eventType, sourcePrecision: pair.event.eventDate.precision, qualifier: fact.qualifier, sourceFacts: fact.sourceFacts });
      }
      const patterns = [...candidates.entries()].map(([patternKey, candidate]) => {
        const rule = REGISTRY.get(candidate.fact.id); const matched = candidate.evidence.length; const eligible = group.pairs.filter((pair) => rule.precisions.includes(pair.event.eventDate.precision) && !(candidate.fact.id === 'TRANSIT_EVENT' && FAST_BODIES.includes(candidate.fact.values[0]) && pair.event.eventDate.precision !== 'DAY')).length;
        return { patternKey, category: rule.category, primary: candidate.fact.primary !== false, dimensions: candidate.fact.values, matchedEventCount: matched, eligibleEventCount: eligible, totalEventCount: events.length, recurrenceRate: matched / eligible, eventEvidence: candidate.evidence };
      }).filter((x) => x.matchedEventCount >= 2 && x.recurrenceRate >= 0.5).sort((a, b) => a.category.localeCompare(b.category) || a.patternKey.localeCompare(b.patternKey));
      return { contextKey: group.contextKey, eligibleEventCount: group.pairs.length, contextMetadata: group.metadata, patterns };
    });
    const cohorts = [...new Map(events.map((event) => [event.eventType, 0])).keys()].sort().map((eventType) => ({ eventType, eventCount: events.filter((event) => event.eventType === eventType).length }));
    return immutableCopy({ birthProfileId, analyzedEventCount: events.length, eventTypeCohorts: cohorts, comparisonContexts, provenance: { rulesetId: RULESET_ID } });
  }
}
module.exports = { CareerPatternComparisonService, RULESET_ID, QUALIFIERS, DIMENSION_REGISTRY, PRIMARY_BODIES, FAST_BODIES };
