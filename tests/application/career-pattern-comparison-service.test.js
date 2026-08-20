'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerPatternComparisonService, RULESET_ID } = require('../../src/application/career-events');

function event(id, day, precision = 'DAY', type = 'PROMOTION') { return Object.freeze({ careerEventId: id, eventType: type, eventDate: Object.freeze({ precision, year: 2024, month: 1, day: precision === 'YEAR' ? null : day }), createdAt: `2025-01-0${day || 1}T00:00:00.000Z`, title: 'ignored', notes: 'ignored' }); }
function snapshot(id, options = {}) {
  const from = options.from || '2024-01-01T00:00:00.000Z'; const to = options.to || '2024-01-02T00:00:00.000Z';
  const body = options.body || 'Jupiter'; const house = options.house || 10; const sign = options.sign || 9;
  return Object.freeze({ careerEventId: id, temporalCoverage: Object.freeze({ from, to, timezone: 'UTC' }), dashaIntervals: Object.freeze((options.dasha || [{ from, to, md: 'Mercury', ad: 'Ketu', pd: 'Venus' }]).map((x) => Object.freeze({ from: x.from, to: x.to, mahadasha: { lord: x.md }, antardasha: { lord: x.ad }, pratyantardasha: { lord: x.pd } }))), transitCoverage: Object.freeze({ bodies: Object.freeze([{ body, intervals: Object.freeze([{ natalHouseAtStart: house, natalHouseAtEnd: house, signAtStart: { rashiIndex: sign }, signAtEnd: { rashiIndex: sign } }]), transitions: Object.freeze(options.transitions || []), ashtakavarga: Object.freeze({ savMarkCount: 28, sameGrahaBavMarkCount: body === 'Rahu' || body === 'Ketu' ? null : 5, lagnaBavMarkCount: 3 }) }]) }), natalCareerContext: Object.freeze({ d10: { static: true } }), provenance: Object.freeze({ engineProfileId: options.engine || 'v2', engineProfileVersion: options.engineVersion || 2, ayanamshaSystem: 'Lahiri / Chitrapaksha', nodePolicy: 'MEAN_NODE', dashaRulesetId: options.ruleset || 'solar', provider: { provider: options.provider || 'test', providerVersion: options.providerVersion || '1' }, calculationStatus: options.status || 'PROVISIONAL' }) });
}
function service(events, snapshots, monitor = null) { return new CareerPatternComparisonService({ careerEventService: { async list() { return events; } }, careerEventAstrologyService: { async get({ eventId }) { if (monitor) { monitor.active += 1; monitor.maximum = Math.max(monitor.maximum, monitor.active); await new Promise((resolve) => setImmediate(resolve)); monitor.active -= 1; } return snapshots[eventId]; } } }); }
function find(result, text) { return result.comparisonContexts.flatMap((x) => x.patterns).find((x) => x.patternKey.includes(text)); }

test('requires two owned events', async () => {
  await assert.rejects(() => service([event('a', 1)], { a: snapshot('a') }).get({ principal: {}, birthProfileId: 'p' }), (error) => error.code === 'INSUFFICIENT_CAREER_PATTERN_EVENTS');
});

test('returns neutral recurring Dasha, transit, career-house, and exact Ashtakavarga evidence', async () => {
  const result = await service([event('b', 2), event('a', 1)], { a: snapshot('a'), b: snapshot('b') }).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(result.provenance.rulesetId, RULESET_ID);
  assert.deepEqual(result.eventTypeCohorts, [{ eventType: 'PROMOTION', eventCount: 2 }]);
  for (const dimension of ['DASHA_MD|Mercury', 'DASHA_MD_AD|Mercury|Ketu', 'TRANSIT_NATAL_HOUSE|Jupiter|10|FULL', 'CAREER_HOUSE|Jupiter|10', 'ASHTAKAVARGA_SAV|Jupiter|9|28']) {
    const pattern = find(result, dimension); assert.ok(pattern, dimension); assert.deepEqual([pattern.matchedEventCount, pattern.eligibleEventCount, pattern.recurrenceRate], [2, 2, 1]); assert.equal(pattern.eventEvidence.every((x) => x.qualifier === 'FULL'), true);
  }
  assert.equal(JSON.stringify(result).includes('ignored'), false);
  assert.equal(JSON.stringify(result).includes('D10'), false);
});

test('keeps DAY transition evidence, excludes broad fast-mover transitions, and does not match changed occupancy', async () => {
  const dayTransition = { body: 'Sun', eventType: 'rashiIngress', instant: '2024-01-01T12:00:00.000Z', fromRashi: 1, toRashi: 2 };
  const result = await service([event('a', 1), event('b', 2), event('c', 3, 'MONTH')], { a: snapshot('a', { body: 'Sun', transitions: [dayTransition] }), b: snapshot('b', { body: 'Sun', transitions: [dayTransition] }), c: snapshot('c', { body: 'Sun', transitions: [dayTransition] }) }).get({ principal: {}, birthProfileId: 'p' });
  const transition = find(result, 'TRANSIT_EVENT|Sun|rashiIngress'); assert.ok(transition); assert.equal(transition.primary, false); assert.deepEqual([transition.matchedEventCount, transition.eligibleEventCount], [2, 2]);
  const changed = await service([event('a', 1), event('b', 2)], { a: snapshot('a', { body: 'Jupiter' }), b: snapshot('b', { body: 'Jupiter', house: 10, sign: 9, transitions: [{ body: 'Jupiter', eventType: 'rashiIngress', instant: '2024-01-02T00:00:00.000Z' }] }) }).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(find(changed, 'TRANSIT_NATAL_HOUSE|Jupiter|10|FULL'), undefined);
});

test('partitions incompatible provenance, limits processing to ten events, and bounds snapshot concurrency to two', async () => {
  const events = Array.from({ length: 12 }, (_, index) => event(String(index).padStart(2, '0'), index + 1));
  const snapshots = Object.fromEntries(events.map((x, index) => [x.careerEventId, snapshot(x.careerEventId, { engine: index < 2 ? 'other' : 'v2' })])); const monitor = { active: 0, maximum: 0 };
  const result = await service(events.reverse(), snapshots, monitor).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(result.analyzedEventCount, 10); assert.ok(monitor.maximum <= 2); assert.equal(result.comparisonContexts.length, 2); assert.equal(result.comparisonContexts.find((context) => context.eligibleEventCount === 8).patterns.find((pattern) => pattern.patternKey.includes('DASHA_MD|Mercury')).matchedEventCount, 8);
  assert.deepEqual(result, await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }));
});

test('returns a 2/2 exact recurrence', async () => {
  const result = await service([event('a', 1), event('b', 2)], { a: snapshot('a'), b: snapshot('b') }).get({ principal: {}, birthProfileId: 'p' });
  assert.deepEqual([find(result, 'DASHA_MD|Mercury').matchedEventCount, find(result, 'DASHA_MD|Mercury').eligibleEventCount, find(result, 'DASHA_MD|Mercury').recurrenceRate], [2, 2, 1]);
});

test('returns a 2/3 exact recurrence with one NOT_PRESENT eligible event', async () => {
  const events = [event('a', 1), event('b', 2), event('c', 3)]; const snapshots = { a: snapshot('a'), b: snapshot('b'), c: snapshot('c', { dasha: [{ from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', md: 'Venus', ad: 'Ketu', pd: 'Venus' }] }) };
  const pattern = find(await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }), 'DASHA_MD|Mercury'); assert.deepEqual([pattern.matchedEventCount, pattern.eligibleEventCount, pattern.recurrenceRate], [2, 3, 2 / 3]);
});

test('returns a 2/4 exact recurrence at the inclusive one-half threshold', async () => {
  const events = [event('a', 1), event('b', 2), event('c', 3), event('d', 4)]; const other = (id) => snapshot(id, { dasha: [{ from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', md: 'Venus', ad: 'Ketu', pd: 'Venus' }] });
  const pattern = find(await service(events, { a: snapshot('a'), b: snapshot('b'), c: other('c'), d: other('d') }).get({ principal: {}, birthProfileId: 'p' }), 'DASHA_MD|Mercury'); assert.deepEqual([pattern.matchedEventCount, pattern.eligibleEventCount, pattern.recurrenceRate], [2, 4, 0.5]);
});

test('does not return a 2/5 exact recurrence below the rate threshold', async () => {
  const events = Array.from({ length: 5 }, (_, index) => event(String.fromCharCode(97 + index), index + 1)); const other = (id) => snapshot(id, { dasha: [{ from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', md: 'Venus', ad: 'Ketu', pd: 'Venus' }] });
  const snapshots = { a: snapshot('a'), b: snapshot('b'), c: other('c'), d: other('d'), e: other('e') }; assert.equal(find(await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }), 'DASHA_MD|Mercury'), undefined);
});

test('uses FULL and PARTIAL as matches while CHANGED and NOT_PRESENT remain eligible and MONTH PD is NOT_COMPARABLE', async () => {
  const from = '2024-01-01T00:00:00.000Z'; const to = '2024-01-02T00:00:00.000Z';
  const events = [event('full', 1), event('partial', 2), event('changed', 3), event('absent', 4), event('coarse', 5, 'MONTH')];
  const d = (items) => ({ dasha: items }); const snapshots = {
    full: snapshot('full'),
    partial: snapshot('partial', d([{ from: '2024-01-01T06:00:00.000Z', to: '2024-01-01T18:00:00.000Z', md: 'Mercury', ad: 'Ketu', pd: 'Venus' }])),
    changed: snapshot('changed', d([{ from, to: '2024-01-01T12:00:00.000Z', md: 'Mercury', ad: 'Ketu', pd: 'Venus' }, { from: '2024-01-01T12:00:00.000Z', to, md: 'Mercury', ad: 'Ketu', pd: 'Mars' }])),
    absent: snapshot('absent', d([{ from, to, md: 'Mercury', ad: 'Ketu', pd: 'Mars' }])),
    coarse: snapshot('coarse'),
  };
  const pattern = find(await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }), 'DASHA_PD|Venus'); assert.deepEqual([pattern.matchedEventCount, pattern.eligibleEventCount, pattern.recurrenceRate], [2, 4, 0.5]); assert.deepEqual(pattern.eventEvidence.map((e) => e.qualifier), ['FULL', 'PARTIAL']);
});

test('returns a registry-keyed recurring Mahadasha fact', async () => {
  const result = await service([event('a', 1), event('b', 2)], { a: snapshot('a'), b: snapshot('b') }).get({ principal: {}, birthProfileId: 'p' });
  const pattern = find(result, 'DASHA_MD|Mercury'); assert.equal(pattern.category, 'DASHA'); assert.equal(pattern.patternKey, 'p3v1|DASHA_MD|Mercury'); assert.equal(pattern.matchedEventCount, 2);
});

test('returns recurring Antardasha evidence for two of three eligible events', async () => {
  const alternate = (id) => snapshot(id, { dasha: [{ from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', md: 'Mercury', ad: 'Venus', pd: 'Venus' }] });
  const pattern = find(await service([event('a', 1), event('b', 2), event('c', 3)], { a: snapshot('a'), b: snapshot('b'), c: alternate('c') }).get({ principal: {}, birthProfileId: 'p' }), 'DASHA_AD|Ketu'); assert.deepEqual([pattern.matchedEventCount, pattern.eligibleEventCount, pattern.recurrenceRate], [2, 3, 2 / 3]); assert.equal(pattern.patternKey, 'p3v1|DASHA_AD|Ketu');
});

test('keeps Mahadasha, Antardasha, and their pair as distinct keys', async () => {
  const alternate = (id) => snapshot(id, { dasha: [{ from: '2024-01-01T00:00:00.000Z', to: '2024-01-02T00:00:00.000Z', md: 'Venus', ad: 'Ketu', pd: 'Venus' }] });
  const result = await service([event('a', 1), event('b', 2), event('c', 3), event('d', 4)], { a: snapshot('a'), b: snapshot('b'), c: snapshot('c'), d: alternate('d') }).get({ principal: {}, birthProfileId: 'p' }); const pair = find(result, 'DASHA_MD_AD|Mercury|Ketu');
  assert.deepEqual([pair.matchedEventCount, pair.eligibleEventCount, pair.recurrenceRate], [3, 4, 0.75]); assert.equal(pair.patternKey, 'p3v1|DASHA_MD_AD|Mercury|Ketu'); assert.notEqual(pair.patternKey, find(result, 'DASHA_MD|Mercury').patternKey);
});

test('compares PD and MD/AD/PD only for DAY precision', async () => {
  const events = [event('a', 1), event('b', 2), event('m', 3, 'MONTH'), event('y', 4, 'YEAR')]; const snapshots = { a: snapshot('a'), b: snapshot('b'), m: snapshot('m'), y: snapshot('y') };
  const result = await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }); const pd = find(result, 'DASHA_PD|Venus'); const tuple = find(result, 'DASHA_MD_AD_PD|Mercury|Ketu|Venus');
  assert.deepEqual([pd.matchedEventCount, pd.eligibleEventCount], [2, 2]); assert.deepEqual([tuple.matchedEventCount, tuple.eligibleEventCount], [2, 2]); assert.equal(pd.eventEvidence.every((e) => e.sourcePrecision === 'DAY'), true);
});

test('retains full and partial Dasha source intervals while changed coverage is eligible but not an exact match', async () => {
  const from = '2024-01-01T00:00:00.000Z'; const to = '2024-01-02T00:00:00.000Z'; const events = [event('full', 1), event('partial', 2), event('changed', 3)];
  const result = await service(events, { full: snapshot('full'), partial: snapshot('partial', { dasha: [{ from: '2024-01-01T06:00:00.000Z', to: '2024-01-01T18:00:00.000Z', md: 'Mercury', ad: 'Ketu', pd: 'Venus' }] }), changed: snapshot('changed', { dasha: [{ from, to: '2024-01-01T12:00:00.000Z', md: 'Mercury', ad: 'Ketu', pd: 'Venus' }, { from: '2024-01-01T12:00:00.000Z', to, md: 'Venus', ad: 'Ketu', pd: 'Venus' }] }) }).get({ principal: {}, birthProfileId: 'p' });
  const pattern = find(result, 'DASHA_MD|Mercury'); assert.deepEqual([pattern.matchedEventCount, pattern.eligibleEventCount], [2, 3]); assert.deepEqual(pattern.eventEvidence.map((e) => e.qualifier), ['FULL', 'PARTIAL']); assert.equal(pattern.eventEvidence.every((e) => e.sourceFacts.every((fact) => fact.from && fact.to && fact.parts.includes('Mercury'))), true);
});

test('groups compatible snapshot provenance into one deterministic comparison context', async () => {
  const events = [event('a', 1), event('b', 2)]; const snapshots = { a: snapshot('a'), b: snapshot('b') };
  const first = await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }); const second = await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(first.comparisonContexts.length, 1); assert.equal(first.comparisonContexts[0].eligibleEventCount, 2); assert.equal(first.comparisonContexts[0].contextKey, second.comparisonContexts[0].contextKey); assert.equal(first.provenance.rulesetId, RULESET_ID);
});

test('splits engine profile and version contexts without cross-context recurrence', async () => {
  const result = await service([event('a', 1), event('b', 2)], { a: snapshot('a', { engine: 'v2', engineVersion: 2 }), b: snapshot('b', { engine: 'v3', engineVersion: 3 }) }).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(result.comparisonContexts.length, 2); assert.notEqual(result.comparisonContexts[0].contextKey, result.comparisonContexts[1].contextKey); assert.equal(result.comparisonContexts.every((context) => context.eligibleEventCount === 1 && context.patterns.length === 0), true);
});

test('splits calculation statuses and prevents cross-status recurrence', async () => {
  const result = await service([event('a', 1), event('b', 2)], { a: snapshot('a', { status: 'PROVISIONAL' }), b: snapshot('b', { status: 'LICENSE_GATED_VALIDATION' }) }).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(result.comparisonContexts.length, 2); assert.equal(result.comparisonContexts.every((context) => context.eligibleEventCount === 1 && !find({ comparisonContexts: [context] }, 'DASHA_MD|Mercury')), true);
});

test('splits provider and Dasha ruleset contexts using canonical deterministic keys', async () => {
  const providerSplit = await service([event('a', 1), event('b', 2)], { a: snapshot('a', { provider: 'provider-a' }), b: snapshot('b', { provider: 'provider-b' }) }).get({ principal: {}, birthProfileId: 'p' });
  const rulesetSplit = await service([event('a', 1), event('b', 2)], { a: snapshot('a', { ruleset: 'solar-a' }), b: snapshot('b', { ruleset: 'solar-b' }) }).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(providerSplit.comparisonContexts.length, 2); assert.equal(rulesetSplit.comparisonContexts.length, 2); assert.equal(providerSplit.comparisonContexts.every((context) => context.patterns.length === 0), true); assert.equal(rulesetSplit.comparisonContexts.every((context) => context.patterns.length === 0), true);
});

test('returns deterministic exact event-type cohort counts in ascending event-type order', async () => {
  const events = [event('a', 1, 'DAY', 'FIRST_JOB'), event('b', 2, 'DAY', 'JOB_SWITCH'), event('c', 3, 'DAY', 'JOB_SWITCH'), event('d', 4, 'DAY', 'PROMOTION'), event('e', 5, 'DAY', 'CAREER_SETBACK')];
  const snapshots = Object.fromEntries(events.map((item) => [item.careerEventId, snapshot(item.careerEventId)])); const result = await service(events.reverse(), snapshots).get({ principal: {}, birthProfileId: 'p' });
  assert.deepEqual(result.eventTypeCohorts, [{ eventType: 'CAREER_SETBACK', eventCount: 1 }, { eventType: 'FIRST_JOB', eventCount: 1 }, { eventType: 'JOB_SWITCH', eventCount: 2 }, { eventType: 'PROMOTION', eventCount: 1 }]);
});

test('exposes no positive or negative sentiment grouping for neutral event types', async () => {
  const events = [event('a', 1, 'DAY', 'PROMOTION'), event('b', 2, 'DAY', 'JOB_SWITCH'), event('c', 3, 'DAY', 'CAREER_SETBACK'), event('d', 4, 'DAY', 'JOB_LOSS'), event('e', 5, 'DAY', 'ROLE_CHANGE'), event('f', 6, 'DAY', 'BUSINESS_STARTED')];
  const snapshots = Object.fromEntries(events.map((item) => [item.careerEventId, snapshot(item.careerEventId)])); const result = await service(events, snapshots).get({ principal: {}, birthProfileId: 'p' }); const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['positive', 'negative', 'success', 'failure', 'good', 'bad']) assert.equal(serialized.includes(forbidden), false);
  assert.deepEqual(result.eventTypeCohorts.map((x) => x.eventType), ['BUSINESS_STARTED', 'CAREER_SETBACK', 'JOB_LOSS', 'JOB_SWITCH', 'PROMOTION', 'ROLE_CHANGE']);
});

test('ignores title and notes completely when comparing recurring patterns', async () => {
  const base = [event('a', 1), event('b', 2)]; const changed = base.map((item, index) => Object.freeze({ ...item, title: index ? 'Completely different text' : 'Joined Company A', notes: index ? 'Any arbitrary user note' : 'Great promotion' })); const snapshots = { a: snapshot('a'), b: snapshot('b') };
  const first = await service(base, snapshots).get({ principal: {}, birthProfileId: 'p' }); const second = await service(changed, snapshots).get({ principal: {}, birthProfileId: 'p' });
  assert.deepEqual(second, first); assert.equal(JSON.stringify(second).includes('Joined Company A'), false); assert.equal(JSON.stringify(second).includes('Any arbitrary user note'), false);
});

test('returns deeply identical internal P3 output on repeated comparison', async () => {
  const events = [event('b', 2, 'DAY', 'JOB_SWITCH'), event('a', 1, 'DAY', 'PROMOTION')]; const snapshots = { a: snapshot('a'), b: snapshot('b') }; const comparison = service(events, snapshots);
  const first = await comparison.get({ principal: {}, birthProfileId: 'profile-a' }); const second = await comparison.get({ principal: {}, birthProfileId: 'profile-a' });
  assert.deepEqual(second, first); assert.equal(Object.hasOwn(first, 'requestId'), false);
});

test('has no repository, reading, entitlement, payment, or language-model side effects', async () => {
  const state = { events: [event('a', 1), event('b', 2)], profile: { updatedAt: '2025-01-01T00:00:00.000Z' }, snapshotsPersisted: 0, patternsPersisted: 0, entitlements: 1, readings: 0, payments: 0, llm: 0 }; const before = structuredClone(state);
  const comparison = new CareerPatternComparisonService({ careerEventService: { async list() { return state.events; } }, careerEventAstrologyService: { async get({ eventId }) { return snapshot(eventId); } } });
  await comparison.get({ principal: {}, birthProfileId: 'p' }); assert.deepEqual(state, before);
});

test('selects exactly the first ten events by deterministic temporal ordering before snapshot calculation', async () => {
  const events = Array.from({ length: 12 }, (_, index) => event(`event-${String(12 - index).padStart(2, '0')}`, 12 - index)); const calls = [];
  const comparison = new CareerPatternComparisonService({ careerEventService: { async list() { return events; } }, careerEventAstrologyService: { async get({ eventId }) { calls.push(eventId); return snapshot(eventId); } } }); const result = await comparison.get({ principal: {}, birthProfileId: 'p' });
  assert.equal(result.analyzedEventCount, 10); assert.deepEqual(calls.sort(), Array.from({ length: 10 }, (_, index) => `event-${String(index + 1).padStart(2, '0')}`)); assert.equal(calls.includes('event-11') || calls.includes('event-12'), false);
});

test('uses at most and reaches two concurrent internal P2 snapshot calls', async () => {
  const events = Array.from({ length: 4 }, (_, index) => event(String(index), index + 1)); const monitor = { active: 0, maximum: 0 };
  const result = await service(events, Object.fromEntries(events.map((item) => [item.careerEventId, snapshot(item.careerEventId)])), monitor).get({ principal: {}, birthProfileId: 'p' });
  assert.equal(result.analyzedEventCount, 4); assert.equal(monitor.maximum, 2);
});

test('calls the internal P2 snapshot service exactly once for every selected event', async () => {
  const events = Array.from({ length: 4 }, (_, index) => event(String(index), index + 1)); const counts = new Map();
  const comparison = new CareerPatternComparisonService({ careerEventService: { async list() { return events; } }, careerEventAstrologyService: { async get({ eventId }) { counts.set(eventId, (counts.get(eventId) || 0) + 1); return snapshot(eventId); } } }); await comparison.get({ principal: {}, birthProfileId: 'p' });
  assert.deepEqual([...counts.entries()].sort(), events.map((item) => [item.careerEventId, 1]));
});
