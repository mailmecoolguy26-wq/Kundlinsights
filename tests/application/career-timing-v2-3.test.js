'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCareerTimingV2,
  buildCareerTimingV21,
  buildCareerTimingV22,
  buildCareerTimingV23,
  refinementTier,
  coalesceChildren,
} = require('../../src/application/insights');

const START = '2026-01-01T00:00:00.000Z';
const MID = '2026-01-10T00:00:00.000Z';
const END = '2026-01-20T00:00:00.000Z';

function phase(start, end, { pd = 'DIRECTLY_ALIGNED', pdState = 'PRIMARY_REFINEMENT', d10 = 'CONFIRMS', jupiter = 'ALIGNED', saturn = 'ALIGNED' } = {}) {
  return { start, end, dasha: { pd: { relationship: pd, refinementState: pdState } }, d10: { state: d10 }, transit: { jupiter: { state: jupiter }, saturn: { state: saturn } } };
}
function candidate(id, phases = [phase(START, END)]) {
  return { candidateId: id, start: phases[0].start, end: phases.at(-1).end, state: 'SUPPORTIVE', dasha: { convergence: 'STRONG_CONVERGENCE' }, internalPhases: phases };
}
function v22(candidates = [candidate('PARENT_1')]) {
  return { rulesetVersion: 'career-timing-v2.2-shadow-1', calculationInstant: START, forecastStart: START, forecastEnd: END, candidates };
}

test('A-D: V2.3 only refines supplied V2.2 parents and every child remains bounded', () => {
  const supplied = v22([candidate('P1', [phase(START, MID), phase(MID, END, { pd: 'CONNECTED', pdState: 'CONFIRMING_REFINEMENT' })])]);
  const result = buildCareerTimingV23({ v22Result: supplied, referenceInstant: START });
  assert.equal(result.parentCount, supplied.candidates.length);
  assert.equal(result.eligibilityRulesetVersion, supplied.rulesetVersion);
  assert.ok(result.children.every((child) => child.parentCandidateId === 'P1' && child.start >= START && child.end <= END));
  assert.throws(() => buildCareerTimingV23({ v22Result: { ...supplied, rulesetVersion: 'other' } }), /authoritative CareerTimingV2.2/);
  assert.deepEqual(buildCareerTimingV23({ v22Result: supplied, referenceInstant: START, historicalEvents: [{ type: 'PROMOTION' }] }), result);
});

test('E-G: PD direct, connected, and unrelated states are deterministic and cannot create eligibility', () => {
  const result = buildCareerTimingV23({ v22Result: v22([candidate('P1', [phase(START, '2026-01-07T00:00:00.000Z'), phase('2026-01-07T00:00:00.000Z', '2026-01-13T00:00:00.000Z', { pd: 'CONNECTED', pdState: 'CONFIRMING_REFINEMENT' }), phase('2026-01-13T00:00:00.000Z', END, { pd: 'UNRELATED', pdState: 'NOT_RELEVANT' })])]) });
  assert.deepEqual(result.children.map((child) => child.refinement.pd), ['PEAK_SUPPORT', 'SUPPORT', 'NEUTRAL']);
  assert.equal(buildCareerTimingV23({ v22Result: v22([]) }).children.length, 0);
});

test('H-K: D10 and transit matrix changes tier only, with exact PEAK requirements', () => {
  assert.equal(refinementTier({ pd: 'PEAK_SUPPORT', d10: 'CONFIRMS', transit: 'DUAL_STRONG' }), 'PEAK');
  assert.equal(refinementTier({ pd: 'PEAK_SUPPORT', d10: 'CONFIRMS', transit: 'JUPITER_ONLY' }), 'STRONG');
  assert.equal(refinementTier({ pd: 'SUPPORT', d10: 'CONFIRMS', transit: 'DUAL_STRONG' }), 'STRONG');
  assert.equal(refinementTier({ pd: 'SUPPORT', d10: 'NEUTRAL', transit: 'SATURN_ONLY' }), 'MODERATE');
  assert.equal(refinementTier({ pd: 'PEAK_SUPPORT', d10: 'MIXED', transit: 'DUAL_STRONG' }), 'BASE');
  const result = buildCareerTimingV23({ v22Result: v22([candidate('P1', [phase(START, MID), phase(MID, END, { d10: 'NEUTRAL' })])]) });
  assert.equal(result.parentCount, 1);
  assert.deepEqual(result.children.map((child) => child.tier), ['PEAK', 'MODERATE']);
});

test('L-N: PD boundaries split refinements, identical phases coalesce, material tiers remain distinct', () => {
  const same = buildCareerTimingV23({ v22Result: v22([candidate('P1', [phase(START, MID), phase(MID, END)])]) });
  assert.equal(same.children.length, 1);
  assert.equal(same.children[0].internalPhases.length, 2);
  const distinct = buildCareerTimingV23({ v22Result: v22([candidate('P1', [phase(START, MID), phase(MID, END, { pd: 'UNRELATED', pdState: 'NOT_RELEVANT' })])]) });
  assert.equal(distinct.children.length, 2);
  assert.deepEqual(distinct.children.map((child) => child.tier), ['PEAK', 'MODERATE']);
  assert.equal(coalesceChildren(distinct.children).length, 2);
});

test('O: current/next selection uses active parent and strongest child of nearest future parent', () => {
  const laterStart = '2026-02-01T00:00:00.000Z'; const laterEnd = '2026-02-10T00:00:00.000Z';
  const result = buildCareerTimingV23({ v22Result: { ...v22(), forecastEnd: laterEnd, candidates: [candidate('CURRENT'), candidate('NEXT', [phase(laterStart, laterEnd)])] }, referenceInstant: '2026-01-05T00:00:00.000Z' });
  assert.equal(result.selected.activeParentId, 'CURRENT');
  assert.equal(result.selected.nextParentId, 'NEXT');
  assert.match(result.selected.nextStrongestWindowId, /NEXT/);
});

test('P-S: Ashtakavarga is context-only, history is ignored, and earlier shadow rulesets remain reproducible', () => {
  const base = buildCareerTimingV23({ v22Result: v22(), referenceInstant: START });
  const withAv = buildCareerTimingV23({ v22Result: v22(), referenceInstant: START, ashtakavargaContext: { h10Sav: 30 } });
  assert.equal(base.children[0].tier, withAv.children[0].tier);
  assert.equal(withAv.children[0].refinement.ashtakavarga, 'RAW_CONTEXT');
  const d1Houses = { houses: Array.from({ length: 12 }, (_, index) => ({ houseNumber: index + 1, rashi: { rashiIndex: index + 1 }, rashiHouseLord: index === 9 ? 'Saturn' : 'Sun' })), planetaryAssignments: [{ body: 'Saturn', rashi: { rashiIndex: 8 }, rashiHouseNumber: 8 }, { body: 'Moon', rashi: { rashiIndex: 10 }, rashiHouseNumber: 10 }] };
  const input = { d1Houses, dashaIntervals: [{ start: START, end: END, activePeriods: [{ level: 'MD', lord: 'Saturn' }, { level: 'AD', lord: 'Moon' }, { level: 'PD', lord: 'Saturn' }] }], transitIntervals: [{ planet: 'Jupiter', sign: 10, start: START, end: END }, { planet: 'Saturn', sign: 10, start: START, end: END }], d10Corroboration: { themes: [{}] }, forecastStart: START, forecastEnd: END, calculationInstant: START, referenceInstant: START };
  const snapshots = [buildCareerTimingV2(input), buildCareerTimingV21(input), buildCareerTimingV22(input)].map(JSON.stringify);
  buildCareerTimingV23({ v22Result: buildCareerTimingV22(input), historicalEvents: [{ type: 'JOB_CHANGED' }] });
  assert.deepEqual([buildCareerTimingV2(input), buildCareerTimingV21(input), buildCareerTimingV22(input)].map(JSON.stringify), snapshots);
  assert.equal(base.provenance.productionIntegrated, false);
});
