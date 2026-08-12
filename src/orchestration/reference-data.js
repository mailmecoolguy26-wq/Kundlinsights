'use strict';

const { freeze } = require('../synthesis/evidence-node');

const CAREER_ORCHESTRATOR_RULESET_ID = 'kundlinsights-career-orchestrator-v1';
const BIRTH_CAREER_ORCHESTRATOR_RULESET_ID = 'kundlinsights-birth-career-orchestrator-v1';
const SUPPORTED_DOMAIN = 'CAREER';
const SAVANA_DASHA_RULESET_ID = 'vimshottari-longitude-proportional-savana-360-v1';
const SOLAR_DASHA_RULESET_ID = 'vimshottari-longitude-proportional-solar-return-v1';

const KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1 = freeze({
  id: 'kundlinsights-vedic-engine-profile-v1',
  dashaRulesetId: SAVANA_DASHA_RULESET_ID,
  migrationStatus: 'LEGACY_COMPATIBILITY',
});

const KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2 = freeze({
  id: 'kundlinsights-vedic-engine-profile-v2',
  dashaRulesetId: SOLAR_DASHA_RULESET_ID,
  migrationStatus: 'CURRENT_DEFAULT_FOR_NEW_READINGS',
});

function resolveBirthCareerEngineProfile(dashaRulesetId) {
  if (dashaRulesetId === SAVANA_DASHA_RULESET_ID) return KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1;
  if (dashaRulesetId === SOLAR_DASHA_RULESET_ID) return KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2;
  return null;
}

module.exports = {
  CAREER_ORCHESTRATOR_RULESET_ID,
  BIRTH_CAREER_ORCHESTRATOR_RULESET_ID,
  SUPPORTED_DOMAIN,
  SUPPORTED_LOCALE: 'en-IN',
  SAVANA_DASHA_RULESET_ID,
  SOLAR_DASHA_RULESET_ID,
  KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1,
  KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2,
  DEFAULT_BIRTH_CAREER_ENGINE_PROFILE: KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2,
  resolveBirthCareerEngineProfile,
  ORCHESTRATOR_DISPATCH: freeze(['Layer12B3', 'Layer12C', 'Layer12D', 'Layer13B1', 'Layer13B2', 'Layer13B3', 'Layer13B4', 'Layer13C2', 'Layer14A', 'Layer14B']),
};
