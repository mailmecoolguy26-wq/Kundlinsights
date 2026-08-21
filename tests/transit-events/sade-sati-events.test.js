'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { START, COVERAGE_END, createScan, linear, withinSecond } = require('./fixtures/transit-scan-helpers');

const boundary = '2024-02-01T02:00:00.000Z';

function transition(startLongitudeDegrees, longitudeRateDegreesPerDay) {
  const result = createScan({
    trajectories: { Saturn: [linear(START, COVERAGE_END, startLongitudeDegrees, longitudeRateDegreesPerDay)] },
    eventTypes: ['sadeSatiPhaseChange'],
  });
  assert.equal(result.events.length, 1);
  assert.ok(withinSecond(result.events[0].instant, boundary));
  return result.events[0];
}

test('emits every forward Layer 9 Sade Sati phase transition with refined evidence', () => {
  const cases = [
    [269, 12, 'none', 'rising'],
    [299, 12, 'rising', 'peak'],
    [329, 12, 'peak', 'setting'],
    [359, 12, 'setting', 'none'],
  ];
  for (const [longitude, speed, fromPhase, toPhase] of cases) {
    const event = transition(longitude, speed);
    assert.deepEqual({ fromPhase: event.fromPhase, toPhase: event.toPhase, body: event.body, motion: event.providerMotion }, {
      fromPhase, toPhase, body: 'Saturn', motion: 'direct',
    });
    assert.equal(event.provenance, 'layer9-sade-sati-transition');
    assert.equal(event.natalMoonRashi.rashiIndex, 11);
    assert.equal(event.saturnRashi.rashiIndex, toPhase === 'none' ? 1 : { rising: 10, peak: 11, setting: 12 }[toPhase]);
  }
});

test('emits every retrograde Layer 9 Sade Sati phase transition with refined evidence', () => {
  const cases = [
    [1, -12, 'none', 'setting'],
    [331, -12, 'setting', 'peak'],
    [301, -12, 'peak', 'rising'],
    [271, -12, 'rising', 'none'],
  ];
  for (const [longitude, speed, fromPhase, toPhase] of cases) {
    const event = transition(longitude, speed);
    assert.deepEqual({ fromPhase: event.fromPhase, toPhase: event.toPhase, body: event.body, motion: event.providerMotion }, {
      fromPhase, toPhase, body: 'Saturn', motion: 'retrograde',
    });
    assert.equal(event.moonRelativeHouse, { rising: 12, peak: 1, setting: 2, none: 11 }[toPhase]);
  }
});

test('preserves a Saturn Sade Sati phase transition at the twenty-four-hour cadence', () => {
  const startInstant = '2024-02-01T00:00:00.000Z';
  const endInstant = '2024-02-11T00:00:00.000Z';
  const input = {
    trajectories: { Saturn: [linear(startInstant, '2024-02-12T00:00:00.000Z', 269.6, 0.1)] },
    eventTypes: ['sadeSatiPhaseChange'],
    bodies: ['Saturn'],
    startInstant,
    endInstant,
  };
  const baseline = createScan({ ...input, options: { coarseScanStepMilliseconds: 3600000 } });
  const optimized = createScan({ ...input, options: { coarseScanStepMilliseconds: 86400000 } });
  assert.equal(baseline.events.length, 1);
  assert.equal(optimized.events.length, 1);
  const { instant: baselineInstant, ...baselinePayload } = baseline.events[0];
  const { instant: optimizedInstant, ...optimizedPayload } = optimized.events[0];
  assert.deepEqual(optimizedPayload, baselinePayload);
  assert.ok(Math.abs(Date.parse(optimizedInstant) - Date.parse(baselineInstant)) <= 1000);
});
