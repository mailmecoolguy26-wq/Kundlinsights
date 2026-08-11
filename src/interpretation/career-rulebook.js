'use strict'; const { freeze } = require('../synthesis/evidence-node');
const RULESET_ID='parashari-career-interpretation-foundation-v1';
const RULES=freeze([
  {id:'career-h10-signification-scope-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_H10_SIGNIFICATION_SCOPE_PRESENT',classification:'CLASSICAL_RULE',sourceStatus:'CLASSICAL_RULE',sourceRefs:['BPHS:tenth-house-significations'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','INSUFFICIENT_EVIDENCE','CONTRADICTED']},
  {id:'career-h10-lord-natal-connection-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_H10_LORD_NATAL_CONNECTION_PRESENT',classification:'SOURCE_INTERPRETATION',sourceStatus:'SOURCE_INTERPRETATION',sourceRefs:['BPHS:tenth-house-lord-relationship'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','MIXED','INSUFFICIENT_EVIDENCE','CONTRADICTED']},
  {id:'career-h10-occupant-connection-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_H10_OCCUPANT_CONNECTION_PRESENT',classification:'SOURCE_INTERPRETATION',sourceStatus:'SOURCE_INTERPRETATION',sourceRefs:['BPHS:tenth-house-significations'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','MIXED','INSUFFICIENT_EVIDENCE','CONTRADICTED','NOT_APPLICABLE']}
  ,{id:'career-h10-connected-dasha-activation-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT',classification:'SOURCE_INTERPRETATION',sourceStatus:'SOURCE_INTERPRETATION',sourceRefs:['BPHS:vimshottari-dasha-placement-state-relationships'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','MIXED','INSUFFICIENT_EVIDENCE','CONTRADICTED','NOT_APPLICABLE']}
  ,{id:'career-gochar-structural-connection-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_GOCHAR_CONNECTION_PRESENT',classification:'SOURCE_INTERPRETATION',sourceStatus:'SOURCE_INTERPRETATION',sourceRefs:['Layer9-Layer12C-supplied-structural-gochar'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','MIXED','INSUFFICIENT_EVIDENCE','CONTRADICTED','NOT_APPLICABLE']}
  ,{id:'career-transit-event-timing-context-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_TIMING_TRIGGER_CONTEXT_PRESENT',classification:'ENGINE_CONVENTION',sourceStatus:'ENGINE_CONVENTION',sourceRefs:['Layer10-refined-event-Layer12C-structural-link'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','MIXED','INSUFFICIENT_EVIDENCE','CONTRADICTED','NOT_APPLICABLE']}
  ,{id:'career-temporal-coactivation-v1',rulesetId:RULESET_ID,production:true,domain:'CAREER',topic:'CAREER_TEMPORAL_COACTIVATION_PRESENT',classification:'ENGINE_CONVENTION',sourceStatus:'ENGINE_CONVENTION',sourceRefs:['KundlInsights:Layer12D-independent-temporal-lineage-policy'],requiredEvidenceIds:[],optionalEvidenceIds:[],allowedStatuses:['SUPPORTED','INSUFFICIENT_EVIDENCE','CONTRADICTED','NOT_APPLICABLE']}
]);

const CAREER_CLASSICAL_EVENT_RULESET_ID = 'parashari-career-classical-event-predicates-v1';
const CAREER_CLASSICAL_EVENT_RULES = freeze([
  {
    id: 'career-venus-md-saturn-ad-professional-loss-predicate-v1',
    rulesetId: CAREER_CLASSICAL_EVENT_RULESET_ID,
    production: true,
    domain: 'CAREER',
    topic: 'CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT',
    classification: 'CLASSICAL_RULE',
    sourceStatus: 'CLASSICAL_RULE',
    sourceRefs: ['BPHS:Chapter-60:Venus-Dasha/Saturn-Antardasha:verses-55-57'],
    sourcePredicateId: 'bphs-venus-saturn-professional-loss-natal-v1',
    requiredEvidenceIds: [],
    optionalEvidenceIds: [],
    allowedStatuses: ['SUPPORTED', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED', 'NOT_APPLICABLE']
  }
]);

module.exports = {
  CAREER_INTERPRETATION_RULESET_ID: RULESET_ID,
  CAREER_NATAL_RULES: RULES,
  CAREER_CLASSICAL_EVENT_RULESET_ID,
  CAREER_CLASSICAL_EVENT_RULES,
  CAREER_PRODUCTION_RULES: freeze([...RULES, ...CAREER_CLASSICAL_EVENT_RULES])
};
