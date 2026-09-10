'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptTransitInsight } = require('../../src/application/transit-snapshot');

const AT = '2026-09-01T00:00:00.000Z';
function snapshot() {
  return { snapshotInstant: AT, transitBodies: {
    Sun: { body: 'Sun', transitNatalHouseNumber: 10, motion: 'direct' },
    Jupiter: { body: 'Jupiter', transitNatalHouseNumber: 10, motion: 'direct' },
    Saturn: { body: 'Saturn', transitNatalHouseNumber: 12, motion: 'retrograde', sadeSati: { detected: true, phase: 'peak' } },
  } };
}
function insight(planet = 'Jupiter', profile = true) { return { family: 'CURRENT_CAREER_TRANSIT', status: 'SUPPORTED', ...(profile ? {} : { profile: 'wrong' }), timing: { transitContexts: [{ instant: AT, transitPlanet: planet }] } }; }

test('adapts only matching current Career-transit facts and factual states', () => {
  const value = adaptTransitInsight({ snapshot: snapshot(), insights: [insight(), insight('Unknown'), { family: 'CURRENT_CAREER_TRANSIT', status: 'NOT_APPLICABLE', timing: { transitContexts: [{ instant: AT, transitPlanet: 'Sun' }] } }], horizon: { from: AT, to: '2026-10-01T00:00:00.000Z' } });
  assert.deepEqual(value.activatedHouses, [{ house: 10, planets: ['Jupiter', 'Sun'] }, { house: 12, planets: ['Saturn'] }]);
  assert.deepEqual(value.careerRelevance.map((item) => [item.planet, item.status]), [['Jupiter', 'SUPPORTED']]);
  assert.match(value.careerRelevance[0].presentation.hinglish, /Guru Dev.*Gochar/);
  assert.deepEqual(value.specialStates.map((item) => item.type), ['RETROGRADE', 'SADE_SATI']);
  const text = JSON.stringify(value).toLowerCase();
  for (const prohibited of ['ruleid', 'ruleset', 'evidenceid', 'signalid', 'rawfacts', 'sourceid', 'strong', 'favorable', 'opportunity', 'growth', 'pressure', 'delay', 'restructuring', 'profession', 'promotion', 'salary', 'watch']) assert.equal(text.includes(prohibited), false, prohibited);
});

test('projects scanner events as chronological points without undefined fields', () => {
  const value = adaptTransitInsight({ snapshot: snapshot(), scan: { events: [
    { eventType: 'transitDrishtiStart', body: 'Jupiter', instant: '2026-09-03T00:00:00.000Z', natalBody: 'Sun', targetHouseNumber: 10 },
    { eventType: 'rashiIngress', body: 'Saturn', instant: '2026-09-02T00:00:00.000Z', fromRashi: { englishName: 'Pisces' }, toRashi: { englishName: 'Aries' } },
    { eventType: 'directStation', body: 'Saturn', instant: '2026-09-02T00:00:00.000Z', fromMotion: 'retrograde', toMotion: 'direct' },
  ] } });
  assert.deepEqual(value.upcomingTransitions.map((item) => item.type), ['STATION_DIRECT', 'INGRESS', 'DRISHTI_CHANGE']);
  assert.deepEqual(value.upcomingTransitions[0], { type: 'STATION_DIRECT', planet: 'Saturn', at: '2026-09-02T00:00:00.000Z', motionBefore: 'retrograde', motionAfter: 'direct' });
  assert.deepEqual(value.upcomingTransitions[1], { type: 'INGRESS', planet: 'Saturn', at: '2026-09-02T00:00:00.000Z', fromSign: 'Pisces', toSign: 'Aries' });
  assert.equal(JSON.stringify(value).includes('undefined'), false);
});

test('filters self and ambiguous relations, deduplicates public facts, and bounds Moon ingress rows', () => {
  const at = '2026-09-03T00:00:00.000Z';
  const value = adaptTransitInsight({ snapshot: snapshot(), scan: { events: [
    { eventType: 'sameRashiAssociationStart', body: 'Moon', instant: at, natalBody: 'Moon', transition: 'start' },
    { eventType: 'transitDrishtiStart', body: 'Moon', instant: at, natalBody: 'Sun', transition: 'start' },
    { eventType: 'transitDrishtiStart', body: 'Mars', instant: at, natalBody: 'Mars', transition: 'start' },
    { eventType: 'sameRashiAssociationStart', body: 'Mars', instant: at, natalBody: 'Ketu', transition: 'start' },
    { eventType: 'sameRashiAssociationStart', body: 'Mars', instant: at, natalBody: 'Ketu', transition: 'start' },
    { eventType: 'transitDrishtiEnd', body: 'Jupiter', instant: at, natalBody: 'Sun', transition: 'end', targetHouseNumber: 10 },
    { eventType: 'rashiIngress', body: 'Moon', instant: '2026-09-04T00:00:00.000Z', toRashi: { englishName: 'Aries' } },
    { eventType: 'rashiIngress', body: 'Moon', instant: '2026-09-05T00:00:00.000Z', toRashi: { englishName: 'Taurus' } },
    { eventType: 'rashiIngress', body: 'Moon', instant: '2026-09-06T00:00:00.000Z', toRashi: { englishName: 'Gemini' } },
    { eventType: 'rashiIngress', body: 'Moon', instant: '2026-09-07T00:00:00.000Z', toRashi: { englishName: 'Cancer' } },
  ] } });
  assert.deepEqual(value.upcomingTransitions.filter((item) => item.type === 'ASSOCIATION_CHANGE'), [{ type: 'ASSOCIATION_CHANGE', planet: 'Mars', at, targetPlanet: 'Ketu', change: 'start' }]);
  assert.deepEqual(value.upcomingTransitions.find((item) => item.type === 'DRISHTI_CHANGE'), { type: 'DRISHTI_CHANGE', planet: 'Jupiter', at, targetPlanet: 'Sun', house: 10, change: 'end' });
  assert.equal(value.upcomingTransitions.filter((item) => item.planet === 'Moon' && item.type === 'INGRESS').length, 3);
  assert.equal(value.upcomingTransitions.some((item) => item.planet === item.targetPlanet), false);
  assert.equal(value.upcomingTransitions.some((item) => item.planet === 'Moon' && item.type === 'DRISHTI_CHANGE'), false);
  assert.deepEqual([...value.upcomingTransitions].map((item) => item.at), [...value.upcomingTransitions].map((item) => item.at).sort());
});
