'use strict';

const { createResolvedBirthPlace, validZone } = require('../place');
const { localDateTimeToUtc } = require('../astronomy/time');

const SUPPORTED_LOCALE = 'en-IN';

function utcInstant(value, name) {
  if (typeof value !== 'string' || !value.endsWith('Z') || Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${name} must be a valid UTC ISO timestamp ending in Z.`);
  }
  return value;
}

function resolvedPlace(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('birth.place must be a ResolvedBirthPlace.');
  return createResolvedBirthPlace(value);
}

function validateBirthCareerRequest(request = {}) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || !request.birth || typeof request.birth !== 'object') {
    throw new TypeError('birth is required.');
  }
  const { birth, locale = SUPPORTED_LOCALE, readingInstant, transitScanRange } = request;
  const place = resolvedPlace(birth.place);
  if (!validZone(place.timezone)) throw new TypeError('birth.place.timezone must be a valid IANA timezone.');
  // This is the Layer 1 conversion/validation contract; it intentionally preserves
  // DST ambiguity and nonexistent-time errors instead of introducing a second policy.
  localDateTimeToUtc({ date: birth.date, time: birth.time, timezone: place.timezone });
  if (locale !== SUPPORTED_LOCALE) throw new RangeError(`Unsupported locale: ${locale}`);
  const validated = { birth: { date: birth.date, time: birth.time, place }, readingInstant: utcInstant(readingInstant, 'readingInstant'), locale };
  if (transitScanRange !== undefined) {
    if (!transitScanRange || typeof transitScanRange !== 'object' || Array.isArray(transitScanRange)) throw new TypeError('transitScanRange must be an object when supplied.');
    const startInstant = utcInstant(transitScanRange.startInstant, 'transitScanRange.startInstant');
    const endInstant = utcInstant(transitScanRange.endInstant, 'transitScanRange.endInstant');
    if (Date.parse(startInstant) >= Date.parse(endInstant)) throw new RangeError('transitScanRange.startInstant must be before endInstant.');
    validated.transitScanRange = { startInstant, endInstant };
  }
  return Object.freeze(validated);
}

function utcInstantToLayer1Input(instant, place) {
  const date = new Date(instant);
  return Object.freeze({
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 23),
    timezone: 'UTC', latitude: place.latitude, longitude: place.longitude,
  });
}

module.exports = { validateBirthCareerRequest, utcInstantToLayer1Input };
