'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRashiHouses } = require('../../src/bhava/calculate-rashi-houses');
const { buildCareerTimingPeriods } = require('../../src/application/insights');

const longitudeForSign = (sign) => ((sign - 1) * 30) + 10;
function d1WithTenthSign(tenthSign) {
  const ascendantSign = ((tenthSign - 10 + 12) % 12) + 1;
  return calculateRashiHouses({
    ascendantCanonicalSiderealLongitude: longitudeForSign(ascendantSign),
    bodies: { Sun: longitudeForSign(1), Moon: longitudeForSign(2), Mars: longitudeForSign(3), Mercury: longitudeForSign(4), Jupiter: longitudeForSign(tenthSign), Venus: longitudeForSign(6), Saturn: longitudeForSign(7), Rahu: longitudeForSign(8), Ketu: longitudeForSign(9) },
  });
}

const horizon = { horizonStart: '2026-11-01T00:00:00.000Z', horizonEnd: '2027-02-01T00:00:00.000Z' };
const dasha = (start, end, lord = 'Jupiter') => ({ start, end, activePeriods: [{ level: 'PD', lord }] });
const transit = (start, end, planet = 'Jupiter', sign = 9) => ({ start, end, planet, sign });

test('launch Career timing periods are chronological possible signals with chart-specific Dasha and Gochar evidence', () => {
  const value = buildCareerTimingPeriods({
    d1Houses: d1WithTenthSign(9),
    ...horizon,
    dashaIntervals: [dasha('2026-11-10T00:00:00.000Z', '2026-12-20T00:00:00.000Z'), dasha('2027-01-02T00:00:00.000Z', '2027-01-25T00:00:00.000Z')],
    transitIntervals: [transit('2026-11-20T00:00:00.000Z', '2026-12-10T00:00:00.000Z'), transit('2027-01-05T00:00:00.000Z', '2027-01-20T00:00:00.000Z')],
    d10Confirmation: true,
    h10Sav: 35,
  });
  assert.equal(value.noSignal, false);
  assert.deepEqual(value.periods.map((item) => [item.startDate, item.endDate]), [
    ['2026-11-20T00:00:00.000Z', '2026-12-10T00:00:00.000Z'],
    ['2027-01-05T00:00:00.000Z', '2027-01-20T00:00:00.000Z'],
  ]);
  for (const period of value.periods) {
    assert.equal(period.evidenceState, 'POSSIBLE_CAREER_ACTIVITY_SIGNAL');
    assert.equal(period.headline, 'POSSIBLE CAREER ACTIVITY SIGNAL');
    assert.match(period.summary, /important Dasha aur Gochar factors/i);
    assert.match(period.whatThisCanMean, /interviews, networking/i);
    assert.match(period.disclosure, /guarantee nahi hai/i);
    assert.deepEqual(period.technicalDetails.dasha.qualifyingLevel, ['PD']);
    assert.equal(period.technicalDetails.d10.confirmationPresent, true);
    assert.equal(period.technicalDetails.savBav.h10Sav, 35);
    assert.ok(period.whyItems.some((item) => item.includes('Guru Dev')));
    assert.equal(JSON.stringify(period).match(/probability|confidence|favourable|best|guaranteed/i), null);
  }
});

test('no Dasha and major-Gochar convergence produces a safe no-signal result', () => {
  const value = buildCareerTimingPeriods({
    d1Houses: d1WithTenthSign(9), ...horizon,
    dashaIntervals: [dasha('2026-11-10T00:00:00.000Z', '2026-12-20T00:00:00.000Z', 'Venus')],
    transitIntervals: [transit('2026-11-20T00:00:00.000Z', '2026-12-10T00:00:00.000Z', 'Jupiter', 9)],
  });
  assert.equal(value.noSignal, true);
  assert.deepEqual(value.periods, []);
});
