'use strict';
const { hash, freeze } = require('../synthesis/evidence-node');
const { RENDERER_RULESET_ID, SUPPORTED_LOCALES, DISCLOSURE_TEXT } = require('./reference-data');
const { getTemplate } = require('./template-registry');
function clone(value) { return value === undefined ? null : JSON.parse(JSON.stringify(value)); }
function statusSentence(item) {
  if (item.status === 'SUPPORTED') return getTemplate(item.templateKey);
  if (item.status === 'CONTRADICTED') return 'The relevant evidence contains an explicit contradiction.';
  if (item.status === 'INSUFFICIENT_EVIDENCE') return 'Available evidence is insufficient to evaluate this item.';
  if (item.status === 'NOT_APPLICABLE') return 'The supplied evidence does not satisfy this specific rule or context.';
  if (item.status === 'MIXED') return 'Available evidence contains differing supported contexts.';
  throw new RangeError(`Unsupported reading item status: ${item.status}`);
}
function headline(section) { return ({ CAREER_STRUCTURE: 'Career structure', CURRENT_DASHA_CONTEXT: 'Dasha context', GOCHAR_CONTEXT: 'Transit context', TEMPORAL_COACTIVATION: 'Concurrent timing context', CLASSICAL_EVENT_PREDICATES: 'Classical source predicate', DISCLOSURES: 'Disclosures' })[section] || 'Career context'; }
function sourceTitle(refs) { return Array.isArray(refs) && refs.some((value) => String(value).includes('BPHS') || String(value).includes('Brihat Parashara Hora Shastra')) ? 'Brihat Parashara Hora Shastra' : null; }
function renderItem(item) {
  if (!item || item.domain !== 'CAREER' || typeof item.readingItemId !== 'string' || typeof item.templateKey !== 'string') throw new TypeError('A Layer 14A CAREER reading item is required.');
  const sourceRefs = item.sourceRuleRefs || {}; const source = { title: sourceTitle(sourceRefs.sourceRefs), ruleId: sourceRefs.ruleId || null, rulesetId: sourceRefs.rulesetId || null, classification: sourceRefs.classification || null };
  const disclosures = (item.disclosures || []).map((code) => { if (!Object.hasOwn(DISCLOSURE_TEXT, code)) throw new RangeError(`Unknown reading disclosure: ${code}`); return freeze({ code, statement: DISCLOSURE_TEXT[code] }); });
  return freeze({ renderedItemId: `rendered-item:${hash({ rulesetId: RENDERER_RULESET_ID, readingItemId: item.readingItemId, templateKey: item.templateKey })}`, readingItemId: item.readingItemId, topic: item.topic, status: item.status, headline: headline(item.section), sentence: statusSentence(item), sourceAttribution: source, disclosures, temporalDisplay: clone(item.temporalContext), provenance: { rendererRulesetId: RENDERER_RULESET_ID, templateKey: item.templateKey, templateVersion: 'v1', readingItemId: item.readingItemId, sourceRuleId: source.ruleId, classification: source.classification, providerDependency: 'none', networkAccess: 'not-performed', llmGeneration: 'not-performed' } });
}
function renderReading({ reading, locale } = {}) {
  if (!SUPPORTED_LOCALES.includes(locale)) throw new RangeError(`Unsupported locale: ${locale}`);
  if (!reading || reading.domain !== 'CAREER' || !Array.isArray(reading.sections)) throw new TypeError('A Layer 14A CAREER reading contract is required.');
  const seen = new Set(); const sections = reading.sections.map((section) => {
    const items = (section.items || []).filter((item) => { if (seen.has(item.readingItemId)) return false; seen.add(item.readingItemId); return true; }).map(renderItem);
    return freeze({ section: section.section, headline: headline(section.section), items });
  });
  return freeze({ domain: 'CAREER', locale, sections, provenance: { rendererRulesetId: RENDERER_RULESET_ID, readingRulesetId: reading.rulesetId, sourceReadingContract: 'Layer14A-consumed-only', sectionOrder: 'preserved-from-Layer14A', itemOrder: 'preserved-from-Layer14A', overallSummary: 'not-generated', freeFormProse: 'not-generated', llmIntegration: 'not-performed' } });
}
module.exports = { renderReading, renderItem };
