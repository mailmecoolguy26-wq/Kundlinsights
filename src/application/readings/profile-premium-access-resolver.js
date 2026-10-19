'use strict';

// Phase 1 delegates validity and legacy compatibility to the established
// resolver. CAREER_PREMIUM remains a persisted compatibility key only.
const { CareerAccessResolver } = require('./career-access-resolver');

class ProfilePremiumAccessResolver {
  constructor({ careerAccessResolver = new CareerAccessResolver() } = {}) {
    if (!careerAccessResolver || typeof careerAccessResolver.resolveForProfile !== 'function') throw new TypeError('INVALID_CAREER_ACCESS_RESOLVER');
    this.career = careerAccessResolver;
  }
  async resolveForProfile(input = {}) { return this.career.resolveForProfile(input); }
}

module.exports = { ProfilePremiumAccessResolver };
