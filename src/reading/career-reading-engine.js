'use strict';

const { freeze } = require('../synthesis/evidence-node');
const { READING_RULESET_ID, READING_DOMAINS, SECTION_ORDER } = require('./reference-data');
const { createReadingItem, temporalIdentity } = require('./reading-item');

function buildReading({ domain, conclusions } = {}) {
  if (!READING_DOMAINS.includes(domain)) throw new RangeError(`Unsupported reading domain: ${domain}`);
  if (!Array.isArray(conclusions)) throw new TypeError('conclusions must be an array.');
  const items = new Map();
  conclusions.forEach((conclusion) => {
    if (!conclusion || conclusion.domain !== domain) throw new RangeError('Every supplied conclusion must belong to the requested reading domain.');
    const item = createReadingItem(conclusion); const prior = items.get(item.readingItemId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(item)) throw new RangeError(`Conflicting duplicate reading conclusion: ${conclusion.conclusionId}`);
    items.set(item.readingItemId, item);
  });
  const order = new Map(SECTION_ORDER.map((section, index) => [section, index]));
  const sorted = [...items.values()].sort((left, right) => order.get(left.section) - order.get(right.section) || temporalIdentity(left.temporalContext).localeCompare(temporalIdentity(right.temporalContext)) || left.topic.localeCompare(right.topic) || left.readingItemId.localeCompare(right.readingItemId));
  const sections = SECTION_ORDER.map((section) => freeze({ section, items: sorted.filter((item) => item.section === section) })).filter((section) => section.items.length);
  return freeze({ domain, rulesetId: READING_RULESET_ID, displayPolicy: 'include-all-nonduplicate-conclusions', sections, readingItems: sorted, provenance: { sourceLayer: '13', sourceConclusions: 'consumed-only', sectionOrder: SECTION_ORDER, itemOrder: 'temporal-identity-then-topic-then-reading-item-id', astronomyCalculation: 'not-performed', providerDependency: 'none', freeFormProse: 'not-generated', llmIntegration: 'not-performed' } });
}

module.exports = { buildReading };
