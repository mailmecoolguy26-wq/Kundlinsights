'use strict';

const { InputValidationError } = require('./errors');

function parseLocalDateTime(date, time) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(time || '');
  if (!match || !timeMatch) throw new InputValidationError('date must be YYYY-MM-DD and time must be HH:mm:ss[.SSS].', 'INVALID_LOCAL_DATETIME');
  const [year, month, day] = match.slice(1).map(Number);
  const hour = Number(timeMatch[1]); const minute = Number(timeMatch[2]); const second = Number(timeMatch[3]);
  const millisecond = Number((timeMatch[4] || '').padEnd(3, '0') || 0);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new InputValidationError('Local date or time is outside the Gregorian calendar range.', 'INVALID_LOCAL_DATETIME');
  }
  return { year, month, day, hour, minute, second, millisecond };
}

function formatter(timeZone) {
  // Accept IANA region/location identifiers and the IANA special identifier UTC.
  // Reject locale abbreviations such as IST because they are ambiguous and not a stable input contract.
  if (typeof timeZone !== 'string' || (timeZone !== 'UTC' && !timeZone.includes('/'))) throw new InputValidationError('timezone must be a valid IANA timezone identifier (for example Asia/Kolkata).', 'INVALID_TIMEZONE');
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  } catch (_) { throw new InputValidationError('timezone must be a valid IANA timezone.', 'INVALID_TIMEZONE'); }
}

function localParts(format, epochMs) {
  const bag = {};
  for (const p of format.formatToParts(new Date(epochMs))) if (p.type !== 'literal') bag[p.type] = Number(p.value);
  return bag;
}

function offsetAt(format, epochMs) {
  const parts = localParts(format, epochMs);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(epochMs / 1000) * 1000;
}

function sameLocal(parts, target) {
  return parts.year === target.year && parts.month === target.month && parts.day === target.day && parts.hour === target.hour && parts.minute === target.minute && parts.second === target.second;
}

function localDateTimeToUtc({ date, time, timezone }) {
  const target = parseLocalDateTime(date, time);
  const format = formatter(timezone);
  const naiveEpoch = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second, target.millisecond);
  // Gather every offset that occurs in a 72-hour window. This handles both DST changes and historical non-hour offsets.
  const offsets = new Set();
  for (let ms = naiveEpoch - 36 * 3600000; ms <= naiveEpoch + 36 * 3600000; ms += 15 * 60000) offsets.add(offsetAt(format, ms));
  const matches = [];
  for (const offset of offsets) {
    const candidate = naiveEpoch - offset;
    if (sameLocal(localParts(format, candidate), target)) matches.push(candidate);
  }
  if (matches.length === 0) throw new InputValidationError('Local time does not exist in this timezone (DST gap or historical transition).', 'NONEXISTENT_LOCAL_TIME');
  if (matches.length > 1) throw new InputValidationError('Local time is ambiguous in this timezone (DST overlap). Supply an unambiguous local time.', 'AMBIGUOUS_LOCAL_TIME');
  return new Date(matches[0]);
}

module.exports = { localDateTimeToUtc };
