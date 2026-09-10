'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptDashaInsight, LatestCareerReadingInsightSource } = require('../../src/application/vimshottari');

const MD = { lord: { id: 'Saturn' }, startInstant: { utc: '2020-01-01T00:00:00.000Z', epochMilliseconds: '1577836800000' }, endInstant: { utc: '2039-01-01T00:00:00.000Z', epochMilliseconds: '2177452800000' } };
const AD = { lord: { id: 'Mercury' }, startInstant: { utc: '2026-01-01T00:00:00.000Z', epochMilliseconds: '1767225600000' }, endInstant: { utc: '2027-01-01T00:00:00.000Z', epochMilliseconds: '1798761600000' } };
const PD = { lord: { id: 'Venus' }, startInstant: { utc: '2026-09-01T00:00:00.000Z', epochMilliseconds: '1788220800000' }, endInstant: { utc: '2026-10-01T00:00:00.000Z', epochMilliseconds: '1790812800000' } };
const NEXT_PD = { lord: { id: 'Sun' }, startInstant: { utc: '2026-10-01T00:00:00.000Z', epochMilliseconds: '1790812800000' }, endInstant: { utc: '2026-11-01T00:00:00.000Z', epochMilliseconds: '1793491200000' } };
const dasha = { periods: [{ ...MD, children: [{ ...AD, children: [PD, NEXT_PD] }] }] };
const active = { mahadasha: MD, antardasha: AD, pratyantardasha: PD };
function insight({ family = 'ACTIVE_CAREER_DASHA', status = 'SUPPORTED', periods = [{ periodLevel: 'ANTARDASHA', periodPlanet: 'Mercury', start: AD.startInstant.utc, end: AD.endInstant.utc }] } = {}) { return { family, status, timing: { dashaPeriods: periods } }; }

test('Dasha Insight exposes factual current periods and only the next deterministic transition', () => {
  const result = adaptDashaInsight({ dasha, active });
  assert.deepEqual(result.currentPeriods.antardasha, { lord: 'Mercury', start: AD.startInstant.utc, end: AD.endInstant.utc, isCurrent: true });
  assert.deepEqual(result.nextTransition, { level: 'PRATYANTAR', lord: 'Sun', starts: NEXT_PD.startInstant.utc });
  assert.equal(result.currentPhase, null);
  assert.equal(result.careerRelevance, null);
});

test('Dasha Insight matches exact active Career Dasha timing and never upgrades status', () => {
  const result = adaptDashaInsight({ dasha, active, insights: [insight()] });
  assert.equal(result.currentPhase.status, 'SUPPORTED');
  assert.equal(result.currentPhase.timingLevel, 'ANTARDASHA');
  assert.equal(result.currentPhase.lord, 'Mercury');
  assert.equal(result.careerRelevance.active, true);
  assert.match(result.currentPhase.presentation.english, /Career-related Dasha evidence/);
  assert.match(result.currentPhase.presentation.hinglish, /Career-related evidence/);
  const insufficient = adaptDashaInsight({ dasha, active, insights: [insight({ status: 'INSUFFICIENT_EVIDENCE' })] });
  assert.equal(insufficient.currentPhase.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(insufficient.careerRelevance.active, false);
});

test('Dasha Insight excludes mismatched and not-applicable Career evidence and leaks no internal fields', () => {
  const mismatch = insight({ periods: [{ periodLevel: 'ANTARDASHA', periodPlanet: 'Saturn', start: AD.startInstant.utc, end: AD.endInstant.utc }] });
  const notApplicable = insight({ status: 'NOT_APPLICABLE' });
  const result = adaptDashaInsight({ dasha, active, insights: [mismatch, notApplicable] });
  assert.equal(result.currentPhase, null);
  assert.equal(result.careerRelevance, null);
  const json = JSON.stringify(result);
  for (const forbidden of ['ruleId', 'rulesetId', 'evidenceId', 'signalId', 'rawFacts', 'graphId', 'promotion', 'success', 'communication', 'discipline']) assert.equal(json.includes(forbidden), false, forbidden);
});

test('Dasha Insight exposes a matching supported classical predicate only with neutral caution', () => {
  const result = adaptDashaInsight({ dasha, active, insights: [insight({ family: 'AUDITED_CLASSICAL_PREDICATE' })] });
  assert.equal(result.classicalContext.active, true);
  assert.match(result.classicalContext.presentation.english, /audited classical Career rule/);
  assert.match(result.classicalContext.caution, /not a guaranteed Career outcome/);
  assert.equal(JSON.stringify(result.classicalContext).includes('loss'), false);
});

test('latest Career Insight source is profile-scoped and does not inspect another profile', async () => {
  const calls = [];
  const source = new LatestCareerReadingInsightSource({ secureReadingService: {
    listSecureReadings: async (input) => { calls.push(['list', input.birthProfileId]); return [{ readingId: 'reading-a', birthProfileId: 'profile-a', domain: 'CAREER' }]; },
    getSecureReadingDetail: async ({ readingId }) => { calls.push(['detail', readingId]); return { birthProfileId: 'profile-a', domain: 'CAREER', insights: [insight()] }; },
  } });
  const result = await source.latestForProfile({ principal: { subject: 'subject-a' }, birthProfileId: 'profile-a' });
  assert.equal(result.birthProfileId, 'profile-a');
  assert.deepEqual(calls, [['list', 'profile-a'], ['detail', 'reading-a']]);
  const wrong = new LatestCareerReadingInsightSource({ secureReadingService: {
    listSecureReadings: async () => [{ readingId: 'reading-b', birthProfileId: 'profile-b', domain: 'CAREER' }],
    getSecureReadingDetail: async () => { throw new Error('must not fetch a foreign summary'); },
  } });
  assert.equal(await wrong.latestForProfile({ principal: { subject: 'subject-a' }, birthProfileId: 'profile-a' }), null);
});
