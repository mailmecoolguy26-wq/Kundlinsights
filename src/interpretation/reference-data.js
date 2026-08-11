'use strict';
const CONCLUSION_STATUSES = Object.freeze(['SUPPORTED', 'MIXED', 'INSUFFICIENT_EVIDENCE', 'CONTRADICTED', 'NOT_APPLICABLE']);
const RULE_CLASSIFICATIONS = Object.freeze(['CLASSICAL_RULE', 'SOURCE_INTERPRETATION', 'ENGINE_CONVENTION', 'RENDERING_POLICY']);
const FORBIDDEN_FIELDS = Object.freeze(['score', 'weight', 'probability', 'confidence', 'percentage', 'likelihood', 'favorable', 'unfavorable', 'remedy', 'recommendation', 'predictedOutcome']);
const INTERPRETATION_RULESET_ID = 'kundlinsights-interpretation-infrastructure-v1';
module.exports = { CONCLUSION_STATUSES, RULE_CLASSIFICATIONS, FORBIDDEN_FIELDS, INTERPRETATION_RULESET_ID };
