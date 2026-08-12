'use strict';

const { cyclicLordsStartingAt, VIMSHOTTARI_TOTAL_YEARS } = require('./reference-data');
const { partitionMilliseconds, instantFromEpochMilliseconds } = require('./time-conventions');

function durationExact(numerator, denominator = 1) {
  return Object.freeze({ numerator: String(numerator), denominator: String(denominator), unit: 'vimshottari-year' });
}

function materializedDuration(milliseconds) {
  return Object.freeze({ milliseconds: milliseconds.toString() });
}

function freezePeriod(period) {
  return Object.freeze({ ...period, children: Object.freeze(period.children) });
}

function buildPratyantardashas({ mahadasha, antardasha, startEpochMilliseconds, durationMilliseconds, ruleset }) {
  const lords = cyclicLordsStartingAt(antardasha.lord.id);
  const durations = partitionMilliseconds(durationMilliseconds, lords);
  let cursor = startEpochMilliseconds;
  return Object.freeze(lords.map((lord, index) => {
    const duration = durations[index];
    const end = cursor + duration;
    const period = freezePeriod({
      id: `${antardasha.id}/PD:${lord.id}`,
      level: 'pratyantardasha',
      lord,
      parentId: antardasha.id,
      startInstant: instantFromEpochMilliseconds(cursor),
      endInstant: instantFromEpochMilliseconds(end),
      durationExact: durationExact(mahadasha.lord.years * antardasha.lord.years * lord.years, VIMSHOTTARI_TOTAL_YEARS ** 2),
      materializedDuration: materializedDuration(duration),
      rulesetId: ruleset.id,
      children: []
    });
    cursor = end;
    return period;
  }));
}

function buildAntardashas({ mahadasha, startEpochMilliseconds, durationMilliseconds, ruleset }) {
  const lords = cyclicLordsStartingAt(mahadasha.lord.id);
  const durations = partitionMilliseconds(durationMilliseconds, lords);
  let cursor = startEpochMilliseconds;
  return Object.freeze(lords.map((lord, index) => {
    const duration = durations[index];
    const end = cursor + duration;
    const id = `${mahadasha.id}/AD:${lord.id}`;
    const shell = { id, lord };
    const children = buildPratyantardashas({ mahadasha, antardasha: shell, startEpochMilliseconds: cursor, durationMilliseconds: duration, ruleset });
    const period = freezePeriod({
      id,
      level: 'antardasha',
      lord,
      parentId: mahadasha.id,
      startInstant: instantFromEpochMilliseconds(cursor),
      endInstant: instantFromEpochMilliseconds(end),
      durationExact: durationExact(mahadasha.lord.years * lord.years, VIMSHOTTARI_TOTAL_YEARS),
      materializedDuration: materializedDuration(duration),
      rulesetId: ruleset.id,
      children
    });
    cursor = end;
    return period;
  }));
}

function buildMahadashaTimeline({ birthEpochMilliseconds, birthBalance, timeConvention, ruleset }) {
  const lords = cyclicLordsStartingAt(birthBalance.nakshatra.lord.id);
  const activeLord = lords[0];
  const activeDuration = timeConvention.millisecondsPerVimshottariYear * BigInt(activeLord.years);
  // The longitude-derived ratio is intentionally kept at full JS numeric precision until this one deterministic millisecond materialization boundary.
  const elapsedMilliseconds = BigInt(Math.round(birthBalance.elapsedRatio * Number(activeDuration)));
  let cursor = birthEpochMilliseconds - elapsedMilliseconds;
  return Object.freeze(lords.map((lord) => {
    const duration = timeConvention.millisecondsPerVimshottariYear * BigInt(lord.years);
    const end = cursor + duration;
    const id = `MD:${lord.id}`;
    const shell = { id, lord };
    const children = buildAntardashas({ mahadasha: shell, startEpochMilliseconds: cursor, durationMilliseconds: duration, ruleset });
    const period = freezePeriod({
      id,
      level: 'mahadasha',
      lord,
      parentId: null,
      startInstant: instantFromEpochMilliseconds(cursor),
      endInstant: instantFromEpochMilliseconds(end),
      durationExact: durationExact(lord.years),
      materializedDuration: materializedDuration(duration),
      rulesetId: ruleset.id,
      children
    });
    cursor = end;
    return period;
  }));
}

function periodContains(period, birthEpochMilliseconds) {
  return BigInt(period.startInstant.epochMilliseconds) <= birthEpochMilliseconds && birthEpochMilliseconds < BigInt(period.endInstant.epochMilliseconds);
}

function findActiveAt(periods, epochMilliseconds) {
  const mahadasha = periods.find((period) => periodContains(period, epochMilliseconds));
  const antardasha = mahadasha.children.find((period) => periodContains(period, epochMilliseconds));
  const pratyantardasha = antardasha.children.find((period) => periodContains(period, epochMilliseconds));
  return Object.freeze({ mahadasha, antardasha, pratyantardasha });
}
function findActiveAtBirth(periods, birthEpochMilliseconds) { return findActiveAt(periods, birthEpochMilliseconds); }

module.exports = { buildMahadashaTimeline, buildAntardashas, findActiveAt, findActiveAtBirth };
