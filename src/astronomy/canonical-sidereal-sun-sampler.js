'use strict';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function sunSampleError(message) {
  const error = new TypeError(message);
  error.code = 'INVALID_SUN_SAMPLE';
  return error;
}

function assertCanonicalUtcInstant(instantUtc) {
  if (typeof instantUtc !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(instantUtc)) throw sunSampleError('instantUtc must be a canonical millisecond UTC ISO instant.');
  const date = new Date(instantUtc);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== instantUtc) throw sunSampleError('instantUtc must be a valid canonical UTC instant.');
  return date;
}

function assertDeepFrozen(value, label) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) throw sunSampleError(`${label} must be deeply frozen.`);
  for (const child of Object.values(value)) if (child && typeof child === 'object') assertDeepFrozen(child, label);
}

function validateCanonicalSiderealSunSample(sample) {
  if (!sample || typeof sample !== 'object') throw sunSampleError('Sun sampler must return an object.');
  assertDeepFrozen(sample, 'Sun sampler result');
  const longitude = sample.canonicalSiderealLongitudeDegrees;
  if (!Number.isFinite(longitude) || longitude < 0 || longitude >= 360) throw sunSampleError('Sun sampler longitude must already be canonical in [0, 360).');
  if (!sample.provenance || typeof sample.provenance !== 'object') throw sunSampleError('Sun sampler provenance is required.');
  return sample;
}

class CanonicalSiderealSunSampler {
  constructor({ sample } = {}) {
    if (typeof sample !== 'function') throw new TypeError('CanonicalSiderealSunSampler requires a sample function.');
    this.sample = sample;
    Object.freeze(this);
  }

  sampleCanonicalSiderealSun({ instantUtc } = {}) {
    assertCanonicalUtcInstant(instantUtc);
    try { return validateCanonicalSiderealSunSample(this.sample(Object.freeze({ instantUtc }))); }
    catch (error) { if (error && error.code === 'INVALID_SUN_SAMPLE') throw error; throw sunSampleError(`Sun sampler failed: ${error && error.message ? error.message : 'unknown error'}`); }
  }
}

module.exports = { CanonicalSiderealSunSampler, assertCanonicalUtcInstant, validateCanonicalSiderealSunSample, sunSampleError, deepFreeze };
