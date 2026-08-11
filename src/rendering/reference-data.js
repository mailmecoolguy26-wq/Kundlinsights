'use strict';
const { freeze } = require('../synthesis/evidence-node');
const RENDERER_RULESET_ID = 'kundlinsights-career-reading-en-in-v1';
const SUPPORTED_LOCALES = freeze(['en-IN']);
const FORBIDDEN_TEMPLATE_TERMS = freeze(['will happen', 'definitely', 'certainly', 'guaranteed', 'must happen', 'inevitable', 'likely', 'unlikely', 'probably', 'possibly', 'chance', 'confidence', 'odds', 'good', 'bad', 'positive', 'negative', 'favorable', 'unfavorable', 'strong', 'weak', 'danger', 'warning', 'serious', 'severe', 'threat', 'risk', 'recommendation', 'remedy']);
const DISCLOSURE_TEXT = freeze({
  STRUCTURAL_CONTEXT_ONLY: 'This is structural chart context, not an event prediction.',
  TEMPORAL_CONTEXT_ONLY: 'This identifies supplied timing context only.',
  CLASSICAL_PREDICATE_NOT_EVENT_CERTAINTY: 'Satisfying this classical predicate does not establish that an event will occur.',
  MISSING_DATA_NEUTRAL: 'Missing evidence is treated as neutral.',
  CONTRADICTION_PRESENT: 'The evidence contains an explicit contradiction.',
  NO_PROBABILITY_ASSESSMENT: 'No numerical estimate is assigned.',
  NO_OUTCOME_GUARANTEE: 'This does not establish an outcome.'
});
module.exports = { RENDERER_RULESET_ID, SUPPORTED_LOCALES, FORBIDDEN_TEMPLATE_TERMS, DISCLOSURE_TEXT };
