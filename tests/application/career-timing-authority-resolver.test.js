'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CareerTimingAuthorityResolver } = require('../../src/application/career-timing/authority-resolver');

const QA = '11111111-1111-4111-8111-111111111111';
const NORMAL = '22222222-2222-4222-8222-222222222222';
const START = '2026-01-01T00:00:00.000Z';
const END = '2026-01-20T00:00:00.000Z';
function evidence() { return { d1Houses: { houses: Array.from({ length: 12 }, (_, i) => ({ houseNumber: i + 1, rashi: { rashiIndex: i + 1 }, rashiHouseLord: i === 9 ? 'Saturn' : 'Sun' })), planetaryAssignments: [{ body: 'Saturn', rashi: { rashiIndex: 8 }, rashiHouseNumber: 8 }, { body: 'Moon', rashi: { rashiIndex: 10 }, rashiHouseNumber: 10 }] }, dashaIntervals: [{ start: START, end: END, activePeriods: [{ level: 'MD', lord: 'Saturn' }, { level: 'AD', lord: 'Moon' }, { level: 'PD', lord: 'Saturn' }] }], transitIntervals: [{ planet: 'Jupiter', sign: 10, start: START, end: END }, { planet: 'Saturn', sign: 10, start: START, end: END }], d10Corroboration: { themes: [{}] }, forecastStart: START, forecastEnd: END, calculationInstant: START }; }

test('OFF wins over the QA allowlist and missing allowlists target nobody', () => {
  assert.equal(new CareerTimingAuthorityResolver({ globalMode: 'OFF', canonicalQaProfileIds: [QA] }).resolveMode(QA), 'OFF');
  assert.equal(new CareerTimingAuthorityResolver({ globalMode: 'SHADOW' }).resolveMode(QA), 'SHADOW');
});

test('SHADOW upgrades only the exact allowlisted profile while global ON remains global', () => {
  const resolver = new CareerTimingAuthorityResolver({ globalMode: 'SHADOW', canonicalQaProfileIds: [QA] });
  assert.equal(resolver.resolveMode(QA), 'ON');
  assert.equal(resolver.resolveMode(NORMAL), 'SHADOW');
  assert.equal(new CareerTimingAuthorityResolver({ globalMode: 'ON', canonicalQaProfileIds: [] }).resolveMode(NORMAL), 'ON');
});

test('resolver creates exactly one effective authority per request without exposing identifiers', () => {
  const calls = [];
  const resolver = new CareerTimingAuthorityResolver({
    globalMode: 'SHADOW',
    canonicalQaProfileIds: [QA],
    serviceFactory(mode) { calls.push(mode); return Object.freeze({ mode }); },
  });
  assert.deepEqual(resolver.createService(QA), { mode: 'ON' });
  assert.deepEqual(resolver.createService(NORMAL), { mode: 'SHADOW' });
  assert.deepEqual(calls, ['ON', 'SHADOW']);
  assert.equal(JSON.stringify(calls).includes(QA), false);
});

test('invalid allowlist entries fail closed', () => {
  assert.throws(() => new CareerTimingAuthorityResolver({ globalMode: 'SHADOW', canonicalQaProfileIds: ['not-a-profile-id'] }), /valid profile identifiers/);
});

test('new QA calculations are CANONICAL, normal calculations remain SHADOW, and removing the override affects only new calculations', () => {
  const diagnostics = [];
  const configured = new CareerTimingAuthorityResolver({ globalMode: 'SHADOW', canonicalQaProfileIds: [QA], serviceOptions: { diagnosticObserver: (entry) => diagnostics.push(entry) } });
  const qaSnapshot = configured.createService(QA).calculate(evidence()).careerTiming;
  const normalSnapshot = configured.createService(NORMAL).calculate(evidence()).careerTiming;
  const removed = new CareerTimingAuthorityResolver({ globalMode: 'SHADOW' });
  const newQaSnapshot = removed.createService(QA).calculate(evidence()).careerTiming;
  assert.equal(qaSnapshot.authority, 'CANONICAL');
  assert.equal(normalSnapshot.authority, 'SHADOW');
  assert.equal(newQaSnapshot.authority, 'SHADOW');
  assert.equal(qaSnapshot.authority, 'CANONICAL');
  assert.equal(JSON.stringify(diagnostics).includes(QA), false);
  assert.equal(JSON.stringify(diagnostics).includes(NORMAL), false);
});
