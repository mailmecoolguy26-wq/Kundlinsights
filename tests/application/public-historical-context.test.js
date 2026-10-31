'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { publicHistoricalContext } = require('../../src/application/life-event-calibration');

const eligible = Object.freeze({
  customerDisplayEligible: true,
  customerDisplayReadiness: Object.freeze([
    Object.freeze({ customerDisplayEligible: true, matchedEventCount: 2, comparableEventCount: 3 }),
  ]),
  audit: Object.freeze({ eventTypes: Object.freeze(['PROPERTY_PURCHASE']) }),
});

test('public historical context exposes only the bounded Property summary', () => {
  const value = publicHistoricalContext({ domain: 'PROPERTY', calibration: eligible });
  assert.deepEqual(value, {
    available: true,
    summary: 'Similar timing factors were present around 2 of your 3 recorded property purchases.',
    matchedEventCount: 2,
    comparableEventCount: 3,
  });
  assert.equal(JSON.stringify(value).includes('audit'), false);
  assert.equal(JSON.stringify(value).includes('eventTypes'), false);
});

test('ineligible or malformed calibration remains absent', () => {
  assert.equal(publicHistoricalContext({ domain: 'VEHICLE', calibration: null }), null);
  assert.equal(publicHistoricalContext({ domain: 'VEHICLE', calibration: { customerDisplayEligible: false } }), null);
  assert.equal(publicHistoricalContext({ domain: 'UNKNOWN', calibration: eligible }), null);
});

test('Family Expansion uses safety-bounded family wording without counts', () => {
  const value = publicHistoricalContext({ domain: 'FAMILY_EXPANSION', calibration: eligible });
  assert.deepEqual(value, {
    available: true,
    summary: 'Similar family-oriented timing factors were present around prior recorded family milestones.',
  });
  assert.doesNotMatch(value.summary, /medical|fertility|pregnancy|child count/i);
});
