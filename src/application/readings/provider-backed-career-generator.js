'use strict';
const { repositoryError } = require('../../persistence/contracts');
function fail() { throw repositoryError('INVALID_PROVIDER_BACKED_CAREER_GENERATOR'); }
class ProviderBackedCareerGenerator {
  constructor({ promptBuilder, providerAdapter, locale } = {}) { if (!promptBuilder || typeof promptBuilder.build !== 'function' || !providerAdapter || typeof providerAdapter.generate !== 'function' || typeof locale !== 'string' || !locale) fail(); this.promptBuilder = promptBuilder; this.providerAdapter = providerAdapter; this.locale = locale; Object.freeze(this); }
  async generate({ interpretationInput, diagnosticLog = null } = {}) {
    let prompt;
    try {
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'BUILD_PROMPT', status: 'STARTED' });
      prompt = this.promptBuilder.build({ interpretationInput, locale: this.locale });
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'BUILD_PROMPT', status: 'SUCCEEDED' });
    } catch (error) {
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_INTERPRETER_STEP', step: 'BUILD_PROMPT', status: 'FAILED', errorClass: typeof error.name === 'string' ? error.name : 'Error' });
      throw error;
    }
    return this.providerAdapter.generate({ prompt, diagnosticLog });
  }
}
module.exports = { ProviderBackedCareerGenerator };
