'use strict'; const { freeze } = require('../synthesis/evidence-node'); const { RULE_CLASSIFICATIONS } = require('./reference-data');
const PRODUCTION_RULES = Object.freeze({
  'career-h10-signification-scope-v1': 'parashari-career-interpretation-foundation-v1',
  'career-h10-lord-natal-connection-v1': 'parashari-career-interpretation-foundation-v1',
  'career-h10-occupant-connection-v1': 'parashari-career-interpretation-foundation-v1',
  'career-h10-connected-dasha-activation-v1': 'parashari-career-interpretation-foundation-v1',
  'career-gochar-structural-connection-v1': 'parashari-career-interpretation-foundation-v1',
  'career-transit-event-timing-context-v1': 'parashari-career-interpretation-foundation-v1',
  'career-temporal-coactivation-v1': 'parashari-career-interpretation-foundation-v1',
  'career-venus-md-saturn-ad-professional-loss-predicate-v1': 'parashari-career-classical-event-predicates-v1'
});
const PRODUCTION_RULE_IDS = Object.freeze(Object.keys(PRODUCTION_RULES));
function registry({ rules = [] } = {}) { if (!Array.isArray(rules)) throw new TypeError('rules must be an array.'); const map = new Map(); rules.forEach((rule) => { const fixture = rule && rule.testOnly === true && rule.classification === 'ENGINE_CONVENTION'; const production = rule && rule.production === true && PRODUCTION_RULES[rule.id] === rule.rulesetId && ['CLASSICAL_RULE','SOURCE_INTERPRETATION','ENGINE_CONVENTION'].includes(rule.classification) && rule.domain === 'CAREER'; if (!rule || typeof rule.id !== 'string' || !rule.id || typeof rule.rulesetId !== 'string' || !RULE_CLASSIFICATIONS.includes(rule.classification) || (!fixture && !production)) throw new RangeError('Rule must be test-only or an explicitly allowlisted production Career rule.'); if (map.has(rule.id)) throw new RangeError(`Duplicate interpretive rule: ${rule.id}`); map.set(rule.id, freeze({ ...rule, requiredEvidenceIds: [...new Set(rule.requiredEvidenceIds || [])].sort(), optionalEvidenceIds: [...new Set(rule.optionalEvidenceIds || [])].sort(), contradictionEvidenceIds: [...new Set(rule.contradictionEvidenceIds || [])].sort(), allowedStatuses: [...new Set(rule.allowedStatuses || [])].sort() })); }); return freeze({ get(id) { if (!map.has(id)) throw new RangeError(`Unknown interpretive rule: ${id}`); return map.get(id); }, ids: [...map.keys()].sort(), productionRules: [...map.values()].filter((rule) => rule.production).map((rule) => rule.id).sort() }); }
module.exports = { createInterpretiveRuleRegistry: registry, PRODUCTION_RULE_IDS };
