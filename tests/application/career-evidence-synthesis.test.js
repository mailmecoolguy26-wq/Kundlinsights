'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCareerEvidenceSynthesis } = require('../../src/application/insights/career-evidence-synthesis');

const insight = (family, status = 'SUPPORTED') => ({ family, status });
const corroboration = { kind: 'H10_NATAL_CONTEXT', chart: 'D1', corroborates: 'CAREER_FOUNDATION', h10: { house: 10, sav: 31 }, limitation: 'NOT_STANDALONE_PREDICTION' };

test('Phase16E creates a foundation-only synthesis only from an existing supported Career foundation', () => {
  const value = buildCareerEvidenceSynthesis({ insights: [insight('CAREER_FOUNDATION')] });
  assert.deepEqual(value, { foundation: { family: 'CAREER_FOUNDATION' }, timing: { activeDasha: false, currentTransit: false, concurrent: false, limited: false } });
  assert.equal(buildCareerEvidenceSynthesis({ insights: [], careerAshtakavargaCorroboration: corroboration }), null);
});

test('Phase16E carries existing timing, Ashtakavarga context, calibration, and recurrence without deriving a new signal', () => {
  const value = buildCareerEvidenceSynthesis({
    insights: [
      insight('CAREER_FOUNDATION'),
      insight('ACTIVE_CAREER_DASHA'),
      insight('CURRENT_CAREER_TRANSIT'),
      insight('CONCURRENT_CAREER_TIMING'),
      insight('FUTURE_RECURRENCE_WINDOW'),
      insight('AUDITED_CLASSICAL_PREDICATE', 'MIXED'),
    ],
    careerAshtakavargaCorroboration: corroboration,
    calibrationSummary: { calibrationLevel: 'CALIBRATED', eventCount: 2 },
  });
  assert.deepEqual(value, {
    foundation: { family: 'CAREER_FOUNDATION' },
    timing: { activeDasha: true, currentTransit: true, concurrent: true, limited: false },
    corroboration: { h10: { house: 10, sav: 31 } },
    calibration: { calibrationLevel: 'CALIBRATED', eventCount: 2 },
    futureRecurrence: { family: 'FUTURE_RECURRENCE_WINDOW' },
  });
  assert.equal(JSON.stringify(value).match(/score|weight|confidence|probability|rank|threshold|strong|weak|promotion|salary|h7/i), null);
});

test('Phase16E retains limiting timing and limited calibration without upgrading either', () => {
  const value = buildCareerEvidenceSynthesis({
    insights: [insight('CAREER_FOUNDATION'), insight('CURRENT_CAREER_TRANSIT', 'MIXED')],
    calibrationSummary: { calibrationLevel: 'LIMITED', eventCount: 1 },
  });
  assert.equal(value.timing.currentTransit, false);
  assert.equal(value.timing.limited, true);
  assert.deepEqual(value.calibration, { calibrationLevel: 'LIMITED', eventCount: 1 });
});
