'use strict'; const { freeze } = require('../synthesis/evidence-node');
const CAREER_ORCHESTRATOR_RULESET_ID = 'kundlinsights-career-orchestrator-v1'; const BIRTH_CAREER_ORCHESTRATOR_RULESET_ID = 'kundlinsights-birth-career-orchestrator-v1'; const SUPPORTED_DOMAIN = 'CAREER';
module.exports = { CAREER_ORCHESTRATOR_RULESET_ID, BIRTH_CAREER_ORCHESTRATOR_RULESET_ID, SUPPORTED_DOMAIN, SUPPORTED_LOCALE: 'en-IN', ORCHESTRATOR_DISPATCH: freeze(['Layer12B3', 'Layer12C', 'Layer12D', 'Layer13B1', 'Layer13B2', 'Layer13B3', 'Layer13B4', 'Layer13C2', 'Layer14A', 'Layer14B']) };
