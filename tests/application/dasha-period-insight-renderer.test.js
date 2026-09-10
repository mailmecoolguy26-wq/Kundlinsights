'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planet, structuralSummary } = require('../../src/application/vimshottari/dasha-period-insight-renderer');

test('normalizes known Dasha lords for English and Hinglish presentation only', () => {
  assert.equal(planet('jupiter', 'english'), 'Jupiter');
  assert.equal(planet('JUPITER', 'hinglish'), 'Guru Dev');
  assert.equal(planet('SaTuRn', 'english'), 'Saturn');
  assert.equal(planet('mercury', 'hinglish'), 'Budh');
  assert.equal(planet('rahu', 'hinglish'), 'Rahu');
  assert.equal(planet('SomeBody', 'hinglish'), 'SomeBody');
});

test('renders current, upcoming, and past summaries with normalized planet names', () => {
  const input = {
    mahadashaLord: 'jupiter',
    antardashaLord: 'rahu',
    pratyantarLord: 'saturn',
  };
  const current = structuralSummary({ ...input, status: 'CURRENT' });
  assert.equal(
    current.english,
    'This Saturn Pratyantar is currently active within your Rahu Antardasha and Jupiter Mahadasha.',
  );
  assert.equal(
    current.hinglish,
    'Yeh Shani Dev Pratyantar aapki Rahu Antardasha aur Guru Dev Mahadasha ke andar abhi active hai.',
  );
  assert.match(structuralSummary({ ...input, status: 'UPCOMING' }).english, /^This Saturn Pratyantar begins/);
  assert.match(structuralSummary({ ...input, status: 'PAST' }).hinglish, /^Yeh Shani Dev Pratyantar/);
  for (const forbidden of ['favorable', 'strong', 'weak', 'opportunity', 'growth', 'promotion', 'salary', 'success', 'best used', 'watch out', 'likely', 'probability']) {
    assert.equal(JSON.stringify(current).toLowerCase().includes(forbidden), false, forbidden);
  }
});
