'use strict';

const { CareerTimingAuthorityService, CAREER_TIMING_V2_MODES } = require('./index');

function validProfileId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

class CareerTimingAuthorityResolver {
  constructor({ globalMode = 'OFF', canonicalQaProfileIds = [], serviceOptions = {}, serviceFactory = null } = {}) {
    if (!CAREER_TIMING_V2_MODES.includes(globalMode)) throw new RangeError('Career timing global mode must be OFF, SHADOW, or ON.');
    if (!Array.isArray(canonicalQaProfileIds) || canonicalQaProfileIds.some((value) => !validProfileId(value))) throw new TypeError('Career timing QA profile allowlist must contain valid profile identifiers.');
    if (serviceFactory !== null && typeof serviceFactory !== 'function') throw new TypeError('Career timing authority serviceFactory must be a function.');
    this.globalMode = globalMode;
    this.canonicalQaProfileIds = new Set(canonicalQaProfileIds.map((value) => value.toLowerCase()));
    this.serviceOptions = serviceOptions;
    this.serviceFactory = serviceFactory || ((rolloutMode) => new CareerTimingAuthorityService({ ...serviceOptions, rolloutMode }));
    Object.freeze(this);
  }

  resolveMode(birthProfileId) {
    if (this.globalMode === 'OFF') return 'OFF';
    if (this.globalMode === 'ON') return 'ON';
    return validProfileId(birthProfileId) && this.canonicalQaProfileIds.has(birthProfileId.toLowerCase()) ? 'ON' : 'SHADOW';
  }

  createService(birthProfileId) {
    return this.serviceFactory(this.resolveMode(birthProfileId));
  }
}

module.exports = { CareerTimingAuthorityResolver, validProfileId };
