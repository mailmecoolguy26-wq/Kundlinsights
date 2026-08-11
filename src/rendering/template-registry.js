'use strict';
const { freeze } = require('../synthesis/evidence-node');
const { FORBIDDEN_TEMPLATE_TERMS } = require('./reference-data');
function validate(text) { const lower = String(text).toLowerCase(); if (FORBIDDEN_TEMPLATE_TERMS.some((term) => lower.includes(term))) throw new RangeError('Template contains forbidden semantic vocabulary.'); return text; }
const TEMPLATE_SENTENCES = freeze({
  CAREER_H10_SIGNIFICATION_SCOPE_PRESENT: 'The 10th house is included as the primary professional-activity context in this Career reading.',
  CAREER_H10_LORD_NATAL_CONNECTION_PRESENT: 'A supplied 10th-house lord relation is recorded in this Career context.',
  CAREER_H10_OCCUPANT_CONNECTION_PRESENT: 'A supplied 10th-house occupant relation is recorded in this Career context.',
  CAREER_H2_RESOURCE_CONTEXT_PRESENT: 'The 2nd house is included as a resource context in the Career evidence.',
  CAREER_H11_GAIN_CONTEXT_PRESENT: 'The 11th house is included as a gains context in the Career evidence.',
  CAREER_H10_CONNECTED_DASHA_ACTIVATION_PRESENT: 'A supplied Vimshottari Dasha period is structurally connected with the Career evidence.',
  CAREER_GOCHAR_CONNECTION_PRESENT: 'A supplied transit snapshot is structurally connected with this Career context.',
  CAREER_TIMING_TRIGGER_CONTEXT_PRESENT: 'A refined transit event is structurally connected with this Career context.',
  CAREER_TEMPORAL_COACTIVATION_PRESENT: 'Independent Dasha and transit-related mechanisms are concurrently connected with the same Career subject.',
  CAREER_CLASSICAL_PROFESSIONAL_LOSS_PREDICATE_PRESENT: 'The supplied chart and Dasha evidence satisfy the audited BPHS Venus-Mahadasha/Saturn-Antardasha professional-loss predicate for this period.'
});
Object.values(TEMPLATE_SENTENCES).forEach(validate);
function template(key) { if (!Object.hasOwn(TEMPLATE_SENTENCES, key)) throw new RangeError(`Unknown reading template key: ${key}`); return TEMPLATE_SENTENCES[key]; }
module.exports = { TEMPLATE_SENTENCES, getTemplate: template, validateTemplateText: validate };
