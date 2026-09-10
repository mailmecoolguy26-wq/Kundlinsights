'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { VimshottariService, MAX_TIMELINE_WINDOW_MILLISECONDS } = require('../../src/application/vimshottari');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../src/dasha');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const BIRTH = '2000-01-01T00:00:00.000Z';
const BIRTH_EPOCH = new Date(BIRTH).getTime();
const SUN = 220.07412509999472;
const MOON = 319.5198697609602;
const a = Object.freeze({ provider: 'supabase', subject: 'user-a', isAnonymous: false });
const b = Object.freeze({ provider: 'supabase', subject: 'user-b', isAnonymous: false });
const birthData = Object.freeze({ localDate: '2000-01-01', localTime: '00:00:00', timezone: 'UTC', latitude: 0, longitude: 0 });

function canonical(value) { return ((value % 360) + 360) % 360; }
function sampler() {
  return Object.freeze({ sampleCanonicalSiderealSun: ({ instantUtc }) => Object.freeze({
    canonicalSiderealLongitudeDegrees: canonical(SUN + (new Date(instantUtc).getTime() - BIRTH_EPOCH) * 360 / (365 * 86_400_000)),
    provenance: Object.freeze({ providerId: 'synthetic-solar-return', swissVersion: 'test', calculationStatus: 'LICENSE_GATED_VALIDATION', siderealMode: 'SE_SIDM_LAHIRI', coordinateFrame: 'geocentric-ecliptic-of-date; native-sidereal-lahiri', requestedFlags: 65794, returnedFlags: 65794, productionAuthority: false }),
  }) });
}
function engine() {
  return Object.freeze({ calculate(input) {
    assert.deepEqual(input, { date: birthData.localDate, time: birthData.localTime, timezone: birthData.timezone, latitude: 0, longitude: 0 });
    return Object.freeze({ instant: Object.freeze({ utc: BIRTH }), bodies: Object.freeze({ Moon: Object.freeze({ siderealLongitudeDegrees: MOON }), Sun: Object.freeze({ siderealLongitudeDegrees: SUN }) }) });
  } });
}
function expected() { return calculateVimshottariDasha({ birthInstant: BIRTH, moonCanonicalSiderealLongitude: MOON, natalSunCanonicalSiderealLongitude: SUN, canonicalSiderealSunSampler: sampler(), rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id }); }
function profiles() { return Object.freeze({ async get({ principal, birthProfileId }) { if (principal.subject !== 'user-a' || birthProfileId !== 'profile-a') { const error = new Error(); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error; } return Object.freeze({ id: 'profile-a', status: 'active', birthData }); } }); }
function app(sideEffects = { readings: 0 }, careerInsightSource = null, clock = () => '2026-09-10T00:00:00.000Z') {
  const vimshottariService = new VimshottariService({ birthProfileService: profiles(), astronomicalEngine: engine(), canonicalSiderealSunSampler: sampler(), careerInsightSource, clock });
  return createApi({ authVerifier: createTestOnlyAuthVerifier({ a, b }), userResolver: { resolve: async () => ({ id: 'internal-id', status: 'active' }) }, birthProfileService: { create: async () => null, list: async () => [], get: async () => null }, vimshottariService, secureReadingService: { async generateSecureReading() { sideEffects.readings += 1; } }, requestIdGenerator: () => 'request-1' });
}
function safe(value) { const text = JSON.stringify(value).toLowerCase(); for (const field of ['birthdata', 'localdate', 'timezone', 'ciphertext', 'dek', 'kms', 'subject', 'mooncanonical', 'sampler']) assert.equal(text.includes(field), false, field); }
function url(path, query) { return `${path}?${new URLSearchParams(query).toString()}`; }

test('returns active MD/AD/PD from existing findActiveAt authority with half-open boundaries', async () => {
  const dasha = expected();
  const md = dasha.periods[0]; const ad = md.children[0]; const pd = ad.children[0];
  const api = app();
  for (const at of [md.startInstant.utc, new Date(Number(BigInt(md.endInstant.epochMilliseconds) - 1n)).toISOString(), dasha.periods[1].startInstant.utc]) {
    const response = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari', { at }), headers: { authorization: 'Bearer a' } });
    assert.equal(response.statusCode, 200);
    safe(response.json());
  }
  const current = (await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari', { at: pd.startInstant.utc }), headers: { authorization: 'Bearer a' } })).json().vimshottari;
  assert.deepEqual([current.current.mahadasha.lord, current.current.antardasha.lord, current.current.pratyantardasha.lord], [md.lord.id, ad.lord.id, pd.lord.id]);
  assert.equal(current.ruleset.id, SOLAR_RETURN_VIMSHOTTARI_RULESET.id);
  await api.close();
});

test('returns bounded chronologically ordered MD, AD, and PD overlap timelines with parent context', async () => {
  const dasha = expected(); const from = dasha.periods[0].startInstant.utc; const to = new Date(new Date(from).getTime() + 365 * 86_400_000).toISOString();
  const api = app();
  for (const level of ['md', 'ad', 'pd']) {
    const response = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/timeline', { from, to, level }), headers: { authorization: 'Bearer a' } });
    assert.equal(response.statusCode, 200);
    const timeline = response.json().vimshottariTimeline;
    assert.equal(timeline.level, level); assert.ok(timeline.count > 0);
    for (let index = 1; index < timeline.periods.length; index += 1) assert.ok(timeline.periods[index - 1].start <= timeline.periods[index].start);
    if (level === 'ad') assert.equal(timeline.periods[0].mahadashaLord, dasha.periods[0].lord.id);
    if (level === 'pd') { assert.equal(timeline.periods[0].mahadashaLord, dasha.periods[0].lord.id); assert.equal(timeline.periods[0].antardashaLord, dasha.periods[0].children[0].lord.id); }
    safe(timeline);
  }
  await api.close();
});

test('requires UTC parameters, bounds requests, enforces ownership, and has no reading side effects', async () => {
  const sideEffects = { readings: 0 }; const api = app(sideEffects); const dasha = expected(); const from = dasha.periods[0].startInstant.utc; const to = dasha.periods[1].startInstant.utc;
  const cases = [
    ['/v1/birth-profiles/profile-a/vimshottari', 400],
    [url('/v1/birth-profiles/profile-a/vimshottari', { at: '2000-01-01T00:00:00+00:00' }), 400],
    [url('/v1/birth-profiles/profile-a/vimshottari', { at: '2000-02-30T00:00:00Z' }), 400],
    [url('/v1/birth-profiles/profile-a/vimshottari/timeline', { to, level: 'md' }), 400],
    [url('/v1/birth-profiles/profile-a/vimshottari/timeline', { from, level: 'md' }), 400],
    [url('/v1/birth-profiles/profile-a/vimshottari/timeline', { from, to, level: 'd11' }), 400],
    [url('/v1/birth-profiles/profile-a/vimshottari/timeline', { from: to, to: from, level: 'md' }), 400],
    [url('/v1/birth-profiles/profile-a/vimshottari/timeline', { from, to: new Date(new Date(from).getTime() + MAX_TIMELINE_WINDOW_MILLISECONDS + 1).toISOString(), level: 'md' }), 400],
  ];
  for (const [requestUrl, status] of cases) assert.equal((await api.inject({ url: requestUrl, headers: { authorization: 'Bearer a' } })).statusCode, status);
  const rulesetAttempt = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari', { at: from, ruleset: 'vimshottari-longitude-proportional-savana-360-v1' }), headers: { authorization: 'Bearer a' } });
  assert.equal(rulesetAttempt.statusCode, 200);
  assert.equal(rulesetAttempt.json().vimshottari.ruleset.id, SOLAR_RETURN_VIMSHOTTARI_RULESET.id);
  assert.equal((await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari', { at: from }), headers: { authorization: 'Bearer b' } })).statusCode, 404);
  assert.equal((await api.inject(url('/v1/birth-profiles/profile-a/vimshottari', { at: from }))).statusCode, 401);
  assert.equal(sideEffects.readings, 0);
  await api.close();
});

test('adds only same-profile sanitized Career Dasha relevance to the factual current response', async () => {
  const dasha = expected(); const md = dasha.periods[0]; const ad = md.children[0]; const pd = ad.children[0];
  const source = {
    latestForProfile: async ({ principal, birthProfileId }) => {
      assert.equal(principal.subject, 'user-a'); assert.equal(birthProfileId, 'profile-a');
      return { birthProfileId: 'profile-a', insights: [{
        family: 'ACTIVE_CAREER_DASHA', status: 'SUPPORTED',
        timing: { dashaPeriods: [{ periodLevel: 'ANTARDASHA', periodPlanet: ad.lord.id, start: ad.startInstant.utc, end: ad.endInstant.utc }] },
      }] };
    },
  };
  const api = app(undefined, source);
  const response = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari', { at: pd.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200);
  const context = response.json().vimshottari.insightContext;
  assert.equal(context.currentPhase.status, 'SUPPORTED');
  assert.equal(context.currentPhase.timingLevel, 'ANTARDASHA');
  assert.equal(context.careerRelevance.active, true);
  assert.equal(context.currentPeriods.pratyantardasha.lord, pd.lord.id);
  assert.equal(JSON.stringify(context).includes('evidenceId'), false);
  assert.equal(JSON.stringify(context).includes('rulesetId'), false);
  await api.close();
});

test('period insight resolves only an exact canonical Pratyantar boundary, derives parents, and exposes factual-only context', async () => {
  const dasha = expected(); const md = dasha.periods[0]; const ad = md.children[0]; const pd = ad.children[0];
  const api = app(undefined, null, () => pd.startInstant.utc);
  const response = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: pd.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(response.statusCode, 200);
  const detail = response.json().periodInsight;
  assert.deepEqual([detail.hierarchy.mahadasha.lord, detail.hierarchy.antardasha.lord, detail.hierarchy.pratyantar.lord], [md.lord.id, ad.lord.id, pd.lord.id]);
  assert.equal(detail.hierarchy.pratyantar.status, 'CURRENT');
  assert.equal(detail.periodContext.status, 'CURRENT');
  assert.equal(detail.nextPeriod?.lord, ad.children[1]?.lord.id || null);
  assert.ok(detail.natalFacts.every((fact) => Number.isInteger(fact.house) && Array.isArray(fact.ownsHouses)));
  assert.ok(detail.d10Facts.every((fact) => Number.isInteger(fact.house)));
  assert.ok(detail.relationshipFacts.every((fact) => ['FRIEND', 'NEUTRAL', 'ENEMY', 'GREAT_FRIEND', 'GREAT_ENEMY'].includes(fact.relationship)));
  safe(detail);
  const text = JSON.stringify(detail).toLowerCase();
  for (const unsafe of ['ruleid', 'rulesetid', 'evidenceid', 'sourceid', 'rawfacts', 'promotion', 'salary', 'best used', 'watch out']) assert.equal(text.includes(unsafe), false, unsafe);
  await api.close();
});

test('period insight has exact UTC selector and half-open server-clock status semantics', async () => {
  const dasha = expected(); const pd = dasha.periods[0].children[0].children[0];
  const atStart = app(undefined, null, () => pd.startInstant.utc);
  const current = await atStart.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: pd.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(current.statusCode, 200); assert.equal(current.json().periodInsight.periodContext.status, 'CURRENT'); await atStart.close();
  const atEnd = app(undefined, null, () => pd.endInstant.utc);
  const past = await atEnd.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: pd.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(past.statusCode, 200); assert.equal(past.json().periodInsight.periodContext.status, 'PAST'); await atEnd.close();
  const before = app(undefined, null, () => new Date(new Date(pd.startInstant.utc).getTime() - 1).toISOString());
  const upcoming = await before.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: pd.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(upcoming.statusCode, 200); assert.equal(upcoming.json().periodInsight.periodContext.status, 'UPCOMING'); await before.close();
  const api = app();
  assert.equal((await api.inject({ url: '/v1/birth-profiles/profile-a/vimshottari/period-insight', headers: { authorization: 'Bearer a' } })).statusCode, 400);
  assert.equal((await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: '2000-01-01T00:00:00.0000Z' }), headers: { authorization: 'Bearer a' } })).statusCode, 400);
  assert.equal((await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: '2000-01-01T00:00:00.000Z' }), headers: { authorization: 'Bearer a' } })).statusCode, 404);
  assert.equal((await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/period-insight', { pratyantarStart: '2000-01-01T00:00:00.000Z' }), headers: { authorization: 'Bearer b' } })).statusCode, 404);
  await api.close();
});

test('parent-scoped timeline returns complete canonical direct children beyond the legacy window', async () => {
  const dasha = expected(); const md = dasha.periods[0]; const ad = md.children[0];
  const api = app(undefined, null, () => ad.startInstant.utc);
  const adResponse = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/timeline', { level: 'ad', mahadashaStart: md.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(adResponse.statusCode, 200);
  const adTimeline = adResponse.json().vimshottariTimeline;
  assert.equal(adTimeline.count, md.children.length); assert.equal(adTimeline.parent.start, md.startInstant.utc);
  assert.equal(adTimeline.periods[0].start, md.children[0].startInstant.utc); assert.equal(adTimeline.periods.at(-1).end, md.children.at(-1).endInstant.utc);
  assert.ok(adTimeline.periods.every((period) => period.start >= md.startInstant.utc && period.end <= md.endInstant.utc));
  const pdResponse = await api.inject({ url: url('/v1/birth-profiles/profile-a/vimshottari/timeline', { level: 'pd', mahadashaStart: md.startInstant.utc, antardashaStart: ad.startInstant.utc }), headers: { authorization: 'Bearer a' } });
  assert.equal(pdResponse.statusCode, 200);
  const pdTimeline = pdResponse.json().vimshottariTimeline;
  assert.equal(pdTimeline.count, ad.children.length); assert.deepEqual([pdTimeline.parents.mahadasha.start, pdTimeline.parents.antardasha.start], [md.startInstant.utc, ad.startInstant.utc]);
  assert.ok(pdTimeline.periods.every((period) => period.start >= ad.startInstant.utc && period.end <= ad.endInstant.utc));
  assert.ok(md.endInstant.epochMilliseconds - md.startInstant.epochMilliseconds > BigInt(MAX_TIMELINE_WINDOW_MILLISECONDS));
  await api.close();
});

test('parent-scoped selectors are exact, authenticated, and leave legacy timeline validation unchanged', async () => {
  const dasha = expected(); const md = dasha.periods[0]; const ad = md.children[0]; const api = app();
  const base = '/v1/birth-profiles/profile-a/vimshottari/timeline';
  assert.equal((await api.inject({ url: url(base, { level: 'ad' }), headers: { authorization: 'Bearer a' } })).statusCode, 400);
  assert.equal((await api.inject({ url: url(base, { level: 'ad', mahadashaStart: new Date(new Date(md.startInstant.utc).getTime() + 1).toISOString() }), headers: { authorization: 'Bearer a' } })).statusCode, 404);
  assert.equal((await api.inject({ url: url(base, { level: 'pd', mahadashaStart: md.startInstant.utc }), headers: { authorization: 'Bearer a' } })).statusCode, 400);
  assert.equal((await api.inject({ url: url(base, { level: 'pd', mahadashaStart: md.startInstant.utc, antardashaStart: new Date(new Date(ad.startInstant.utc).getTime() - 1).toISOString() }), headers: { authorization: 'Bearer a' } })).statusCode, 404);
  assert.equal((await api.inject({ url: url(base, { level: 'ad', mahadashaStart: md.startInstant.utc }), headers: { authorization: 'Bearer b' } })).statusCode, 404);
  const root = await api.inject({ url: url(base, { level: 'md', root: 'true' }), headers: { authorization: 'Bearer a' } });
  assert.equal(root.statusCode, 200); assert.equal(root.json().vimshottariTimeline.count, dasha.periods.length);
  await api.close();
});
