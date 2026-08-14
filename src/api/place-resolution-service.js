'use strict';

const { localDateTimeToUtc } = require('../astronomy/time');
const { BirthPlaceResolutionError } = require('../place');

function fail(code) { const error = new Error(); error.code = code; throw error; }
function time(value) { if (typeof value !== 'string') fail('LOCAL_TIME_INVALID'); const match = /^(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value); if (!match) fail('LOCAL_TIME_INVALID'); return `${match[1]}:${match[2] || '00'}`; }
function date(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('LOCAL_TIME_INVALID'); return value; }
function map(error) { if (error && error.code === 'NONEXISTENT_LOCAL_TIME') fail('LOCAL_TIME_NONEXISTENT'); if (error && error.code === 'AMBIGUOUS_LOCAL_TIME') fail('LOCAL_TIME_AMBIGUOUS'); if (error && error.code === 'INVALID_LOCAL_DATETIME') fail('LOCAL_TIME_INVALID'); if (error && error.code === 'TIMEZONE_RESOLUTION_FAILURE') fail('TIMEZONE_RESOLUTION_FAILED'); if (error instanceof BirthPlaceResolutionError || error && ['PLACE_QUERY_INVALID','PLACE_NOT_FOUND','PLACE_PROVIDER_UNAVAILABLE','PLACE_RESOLUTION_FAILED','TIMEZONE_RESOLUTION_FAILED'].includes(error.code)) fail(error.code); throw error; }
function dto(place) { return Object.freeze({ id: place.providerPlaceId, label: place.displayName, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone, timezoneProvenance: place.timezoneResolver }); }

class PlaceResolutionService {
  constructor({ birthPlaceResolver, utcConverter = localDateTimeToUtc } = {}) { if (!birthPlaceResolver || typeof birthPlaceResolver.autocomplete !== 'function' || typeof birthPlaceResolver.resolveSelection !== 'function' || typeof utcConverter !== 'function') throw new TypeError('INVALID_PLACE_RESOLUTION_SERVICE'); this.resolver = birthPlaceResolver; this.utc = utcConverter; Object.freeze(this); }
  async search({ query }) { try { const normalized = typeof query === 'string' ? query.trim() : ''; if (normalized.length < 3 || normalized.length > 120) fail('PLACE_QUERY_INVALID'); const suggestions = await this.resolver.autocomplete({ query: normalized, limit: 5 }); const results = []; for (const item of suggestions.slice(0, 5)) results.push(dto(await this.resolver.resolveSelection({ providerPlaceId: item.providerPlaceId }))); return Object.freeze(results); } catch (error) { map(error); } }
  async resolveBirthTime({ placeId, localDate, localTime }) { try { const resolved = await this.resolver.resolveSelection({ providerPlaceId: placeId }); const exactDate = date(localDate); const exactTime = time(localTime); const utc = this.utc({ date: exactDate, time: exactTime, timezone: resolved.timezone }); return Object.freeze({ localDate: exactDate, localTime: exactTime, timezone: resolved.timezone, utc: utc.toISOString(), latitude: resolved.latitude, longitude: resolved.longitude, timezoneProvenance: resolved.timezoneResolver }); } catch (error) { map(error); } }
}

module.exports = { PlaceResolutionService };
