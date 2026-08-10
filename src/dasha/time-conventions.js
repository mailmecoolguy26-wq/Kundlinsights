'use strict';

const MILLISECONDS_PER_DAY = 86_400_000n;
const SAVANA_DAYS_PER_YEAR = 360n;
const SAVANA_MILLISECONDS_PER_YEAR = MILLISECONDS_PER_DAY * SAVANA_DAYS_PER_YEAR;

const SAVANA_360_DAY_V1 = Object.freeze({
  id: 'savana-360-day-v1',
  millisecondsPerVimshottariYear: SAVANA_MILLISECONDS_PER_YEAR,
  provenance: 'One Vimshottari year equals exactly 360 civil days; timestamp boundaries use integer milliseconds.'
});

function resolveTimeConvention(id) {
  if (id === SAVANA_360_DAY_V1.id) return SAVANA_360_DAY_V1;
  throw new RangeError(`Unsupported Vimshottari time convention: ${id}`);
}

function partitionMilliseconds(parentDurationMilliseconds, lords) {
  const totalWeight = lords.reduce((total, lord) => total + BigInt(lord.years), 0n);
  let priorBoundary = 0n;
  return lords.map((lord, index) => {
    const cumulativeWeight = lords.slice(0, index + 1).reduce((total, item) => total + BigInt(item.years), 0n);
    const boundary = index === lords.length - 1 ? parentDurationMilliseconds : (parentDurationMilliseconds * cumulativeWeight) / totalWeight;
    const duration = boundary - priorBoundary;
    priorBoundary = boundary;
    return duration;
  });
}

function instantFromEpochMilliseconds(epochMilliseconds) {
  const numeric = Number(epochMilliseconds);
  if (!Number.isSafeInteger(numeric)) throw new RangeError('Vimshottari timestamp is outside the supported JavaScript Date range.');
  return Object.freeze({ epochMilliseconds: epochMilliseconds.toString(), utc: new Date(numeric).toISOString() });
}

function parseBirthInstant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('birthInstant must be a valid Date or ISO instant.');
  return BigInt(date.getTime());
}

module.exports = { MILLISECONDS_PER_DAY, SAVANA_DAYS_PER_YEAR, SAVANA_MILLISECONDS_PER_YEAR, SAVANA_360_DAY_V1, resolveTimeConvention, partitionMilliseconds, instantFromEpochMilliseconds, parseBirthInstant };
