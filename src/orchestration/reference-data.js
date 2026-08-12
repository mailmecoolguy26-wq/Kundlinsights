'use strict';

const { freeze } = require('../synthesis/evidence-node');
const {
  KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1,
  KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2,
  DEFAULT_ENGINE_PROFILE_ID,
} = require('../engine-profiles');
const { resolveEngineProfile } = require('../engine-profiles');

const CAREER_ORCHESTRATOR_RULESET_ID = 'kundlinsights-career-orchestrator-v1';
const BIRTH_CAREER_ORCHESTRATOR_RULESET_ID = 'kundlinsights-birth-career-orchestrator-v1';
const SUPPORTED_DOMAIN = 'CAREER';
const SAVANA_DASHA_RULESET_ID = KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1.calculation.dashaRulesetId;
const SOLAR_DASHA_RULESET_ID = KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2.calculation.dashaRulesetId;

function resolveBirthCareerEngineProfile(dashaRulesetId) {
  if (dashaRulesetId === SAVANA_DASHA_RULESET_ID) return resolveEngineProfile(KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1.id);
  if (dashaRulesetId === SOLAR_DASHA_RULESET_ID) return resolveEngineProfile(KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2.id);
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
  DEFAULT_BIRTH_CAREER_ENGINE_PROFILE: resolveEngineProfile(DEFAULT_ENGINE_PROFILE_ID),
  resolveBirthCareerEngineProfile,
  ORCHESTRATOR_DISPATCH: freeze(['Layer12B3', 'Layer12C', 'Layer12D', 'Layer13B1', 'Layer13B2', 'Layer13B3', 'Layer13B4', 'Layer13C2', 'Layer14A', 'Layer14B']),
};
