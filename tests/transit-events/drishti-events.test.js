'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { START, COVERAGE_END, BODY_NAMES, createScan, linear, withinSecond } = require('./fixtures/transit-scan-helpers');

const boundary = '2024-02-01T02:00:00.000Z';
const longitudeInRashi = (rashiIndex) => ((rashiIndex - 1) * 30) + 5;

function scanCaster(caster, rate, natalLongitudes) {
  return createScan({
    trajectories: { [caster]: [linear(START, COVERAGE_END, rate > 0 ? 359 : 1, rate)] },
    natalLongitudes,
    eventTypes: ['transitDrishtiEnd', 'transitDrishtiStart'],
  }).events.filter((event) => event.body === caster);
}

function natalTargets(offsets) {
  return {
    ...Object.fromEntries(BODY_NAMES.map((body) => [body, 5])),
    ...Object.fromEntries(offsets.map((offset, index) => [BODY_NAMES[index], longitudeInRashi((offset % 12) + 1)])),
  };
}

test('emits refined direct Drishti starts for all seven Layer 6 casters', () => {
  const cases = {
    Sun: [6], Moon: [6], Mars: [3, 6, 7], Mercury: [6], Jupiter: [4, 6, 8], Venus: [6], Saturn: [2, 6, 9],
  };
  for (const [caster, offsets] of Object.entries(cases)) {
    const events = scanCaster(caster, 12, natalTargets(offsets)).filter((event) => event.transition === 'start');
    assert.deepEqual(events.map((event) => event.drishtiOffset).sort((a, b) => a - b), offsets);
    for (const event of events) {
      assert.equal(event.transition, 'start');
      assert.equal(event.providerMotion, 'direct');
      assert.equal(event.provenance, 'layer9-layer6-drishti-transition');
      assert.ok(withinSecond(event.instant, boundary));
    }
  }
});

test('refines standard seventh-aspect starts and ends in direct and retrograde movement', () => {
  const cleanLibraTarget = { ...natalTargets([]), Venus: 185 };
  const startDirect = scanCaster('Sun', 12, cleanLibraTarget).filter((event) => event.transition === 'start');
  const startRetrograde = createScan({
    trajectories: { Sun: [linear(START, COVERAGE_END, 31, -12)] }, natalLongitudes: cleanLibraTarget, eventTypes: ['transitDrishtiStart'],
  }).events.filter((event) => event.body === 'Sun' && event.transition === 'start');
  const endDirect = createScan({
    trajectories: { Sun: [linear(START, COVERAGE_END, 29, 12)] }, natalLongitudes: cleanLibraTarget, eventTypes: ['transitDrishtiEnd'],
  }).events.filter((event) => event.body === 'Sun' && event.transition === 'end');
  const endRetrograde = createScan({
    trajectories: { Sun: [linear(START, COVERAGE_END, 1, -12)] }, natalLongitudes: cleanLibraTarget, eventTypes: ['transitDrishtiEnd'],
  }).events.filter((event) => event.body === 'Sun' && event.transition === 'end');

  for (const event of [...startDirect, ...startRetrograde]) {
    assert.equal(event.transition, 'start');
    assert.equal(event.drishtiOffset, 6);
    assert.ok(withinSecond(event.instant, boundary));
  }
  for (const event of [...endDirect, ...endRetrograde]) {
    assert.equal(event.transition, 'end');
    assert.equal(event.drishtiOffset, 6);
    assert.ok(withinSecond(event.instant, boundary));
  }
  assert.deepEqual([startDirect[0].providerMotion, startRetrograde[0].providerMotion], ['direct', 'retrograde']);
});

test('retains special Mars, Jupiter, and Saturn aspect offsets from Layer 6', () => {
  const cases = { Mars: [3, 6, 7], Jupiter: [4, 6, 8], Saturn: [2, 6, 9] };
  for (const [caster, offsets] of Object.entries(cases)) {
    const events = scanCaster(caster, 12, natalTargets(offsets)).filter((event) => event.transition === 'start');
    assert.deepEqual(events.map((event) => event.drishtiOffset).sort((a, b) => a - b), offsets);
  }
});

test('allows nodes as natal targets but never as transit Drishti casters, including empty targets', () => {
  const nodeTarget = scanCaster('Sun', 12, { ...natalTargets([]), Rahu: 185 }).filter((event) => event.transition === 'start');
  assert.equal(nodeTarget.length, 1);
  assert.equal(nodeTarget[0].natalBody, 'Rahu');

  const nodeCaster = createScan({
    trajectories: { Rahu: [linear(START, COVERAGE_END, 359, 12)] },
    natalLongitudes: { ...natalTargets([]), Venus: 185 },
    eventTypes: ['transitDrishtiEnd', 'transitDrishtiStart'],
  }).events.filter((event) => event.body === 'Rahu');
  assert.deepEqual(nodeCaster, []);

  const emptyTarget = scanCaster('Sun', 12, {});
  const emptyStart = emptyTarget.find((event) => event.transition === 'start' && event.targetRashi.rashiIndex === 7);
  assert.equal(emptyStart.natalBody, null);
  assert.equal(emptyStart.targetHouseNumber, 8);
});

test('keeps multiple natal targets and event identities distinct at the same refined instant', () => {
  const events = scanCaster('Sun', 12, { ...natalTargets([]), Venus: 185, Rahu: 190 }).filter((event) => event.transition === 'start');
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.natalBody), ['Rahu', 'Venus']);
  assert.ok(events.every((event) => withinSecond(event.instant, boundary)));
});
