'use strict';

const EVIDENCE_RULESET_ID = 'parashari-evidence-infrastructure-v1';
const NODE_KINDS = Object.freeze(['FACT', 'DERIVED_RELATION', 'MISSING_DATA']);
const EDGE_TYPES = Object.freeze(['DERIVES_FROM', 'RELATES_TO_DOMAIN', 'TARGETS', 'MODIFIES', 'ACTIVE_IN_CONTEXT', 'OCCURS_AT', 'OCCURS_WITHIN', 'CONTRADICTS']);
const SOURCE_STRENGTHS = Object.freeze(['DIRECT_CLASSICAL', 'CLASSICAL_TRANSLATION', 'COMMENTARY', 'LATER_CONVENTION', 'ENGINE_CONVENTION', 'UNRESOLVED']);
const MISSING_DATA_STATUSES = Object.freeze(['notProvided', 'notComputed', 'notApplicable', 'unresolvedByRuleset']);
const FORBIDDEN_SEMANTIC_FIELDS = Object.freeze(['prediction', 'probability', 'confidence', 'score', 'favorable', 'unfavorable', 'beneficResult', 'maleficResult', 'recommendation', 'remedy', 'outcome', 'severity']);

module.exports = { EVIDENCE_RULESET_ID, NODE_KINDS, EDGE_TYPES, SOURCE_STRENGTHS, MISSING_DATA_STATUSES, FORBIDDEN_SEMANTIC_FIELDS };
