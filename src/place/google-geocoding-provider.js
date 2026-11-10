'use strict';

const { BirthPlaceResolutionError } = require('./errors');
const { freeze } = require('./resolved-birth-place');

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

function fail(code) { throw new BirthPlaceResolutionError(code, 'Place provider request failed.'); }
function candidate(result) {
  if (!result || typeof result.place_id !== 'string' || !result.place_id || !result.geometry || !result.geometry.location) {
    return null;
  }
  const { lat: latitude, lng: longitude } = result.geometry.location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || typeof result.formatted_address !== 'string') return null;
  return freeze({ providerPlaceId: result.place_id, primaryLabel: result.formatted_address, latitude, longitude });
}
function component(result, types) {
  if (!result || !Array.isArray(result.address_components)) return null;
  const found = result.address_components.find((item) => item && Array.isArray(item.types) && types.some((type) => item.types.includes(type)) && typeof item.long_name === 'string' && item.long_name.trim());
  return found ? found.long_name.trim() : null;
}
function reverseLabel(result) {
  if (!result || typeof result !== 'object') return null;
  const locality = component(result, ['locality', 'postal_town', 'administrative_area_level_2', 'sublocality']);
  const state = component(result, ['administrative_area_level_1']);
  const country = component(result, ['country']);
  const concise = [...new Set([locality, state, country].filter(Boolean))].join(', ');
  if (concise) return concise;
  return typeof result.formatted_address === 'string' && result.formatted_address.trim() ? result.formatted_address.trim() : null;
}

class GoogleGeocodingProvider {
  constructor({ apiKey, fetchImplementation = globalThis.fetch, timeoutMilliseconds = 5000 } = {}) {
    if (typeof apiKey !== 'string' || !apiKey || typeof fetchImplementation !== 'function' || !Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds < 100 || timeoutMilliseconds > 15000) throw new TypeError('INVALID_GOOGLE_GEOCODING_PROVIDER');
    this.apiKey = apiKey; this.fetch = fetchImplementation; this.timeoutMilliseconds = timeoutMilliseconds; Object.freeze(this);
  }
  async request(params) {
    const url = new URL(ENDPOINT); url.search = new URLSearchParams({ ...params, key: this.apiKey }).toString();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMilliseconds);
    let response;
    try { response = await this.fetch(url, { signal: controller.signal }); } catch { fail('PLACE_PROVIDER_UNAVAILABLE'); } finally { clearTimeout(timer); }
    if (!response || !response.ok) fail('PLACE_PROVIDER_UNAVAILABLE');
    let body; try { body = await response.json(); } catch { fail('PLACE_PROVIDER_UNAVAILABLE'); }
    if (!body || typeof body.status !== 'string' || !Array.isArray(body.results)) fail('PLACE_PROVIDER_UNAVAILABLE');
    if (body.status === 'ZERO_RESULTS') return [];
    if (body.status !== 'OK') fail(body.status === 'OVER_QUERY_LIMIT' ? 'PLACE_PROVIDER_UNAVAILABLE' : 'PLACE_PROVIDER_UNAVAILABLE');
    return body.results;
  }
  async suggest({ query, limit = 5 } = {}) {
    if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 5) fail('PLACE_QUERY_INVALID');
    return freeze((await this.request({ address: query.trim() })).map(candidate).filter(Boolean).slice(0, limit));
  }
  async resolve({ providerPlaceId } = {}) {
    if (typeof providerPlaceId !== 'string' || !providerPlaceId || providerPlaceId.length > 256) fail('PLACE_NOT_FOUND');
    const found = candidate((await this.request({ place_id: providerPlaceId }))[0]);
    if (!found || found.providerPlaceId !== providerPlaceId) fail('PLACE_NOT_FOUND');
    return freeze({ provider: 'google-geocoding', providerPlaceId: found.providerPlaceId, latitude: found.latitude, longitude: found.longitude, displayName: found.primaryLabel });
  }
  async reverseGeocode({ latitude, longitude } = {}) {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) fail('PLACE_COORDINATES_INVALID');
    const label = reverseLabel((await this.request({ latlng: `${latitude},${longitude}` }))[0]);
    if (!label) fail('PLACE_NOT_FOUND');
    return freeze({ provider: 'google-geocoding', displayName: label });
  }
}

module.exports = { GoogleGeocodingProvider, ENDPOINT };
