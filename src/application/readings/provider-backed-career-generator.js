'use strict';
const { repositoryError } = require('../../persistence/contracts');
function fail() { throw repositoryError('INVALID_PROVIDER_BACKED_CAREER_GENERATOR'); }
class ProviderBackedCareerGenerator {
  constructor({ promptBuilder, providerAdapter, locale } = {}) { if (!promptBuilder || typeof promptBuilder.build !== 'function' || !providerAdapter || typeof providerAdapter.generate !== 'function' || typeof locale !== 'string' || !locale) fail(); this.promptBuilder = promptBuilder; this.providerAdapter = providerAdapter; this.locale = locale; Object.freeze(this); }
  async generate({ interpretationInput } = {}) { return this.providerAdapter.generate({ prompt: this.promptBuilder.build({ interpretationInput, locale: this.locale }) }); }
}
module.exports = { ProviderBackedCareerGenerator };
