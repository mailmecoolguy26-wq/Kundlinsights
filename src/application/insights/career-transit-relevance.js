'use strict';

const { freeze } = require('../../synthesis/evidence-node');

const RELEVANCE_PRIORITY = Object.freeze({
  DIRECT_10TH_HOUSE_TRANSIT: 0,
  ASPECTS_10TH_HOUSE: 1,
  ACTIVATES_10TH_LORD: 2,
  ACTIVATES_6TH_HOUSE: 3,
  ACTIVATES_11TH_HOUSE: 4,
  ACTIVATES_2ND_HOUSE: 5,
  D10_SUPPORT: 6,
  SECONDARY_CONTEXT: 7,
});
const STATUS_PRIORITY = Object.freeze({ SUPPORTED: 0, MIXED: 1, CONTRADICTED: 2, INSUFFICIENT_EVIDENCE: 3, NOT_APPLICABLE: 4 });
const MAX_CURRENT_CAREER_TRANSITS = 3;

function unique(values) { return [...new Set(values)].sort((a, b) => (RELEVANCE_PRIORITY[a] ?? 99) - (RELEVANCE_PRIORITY[b] ?? 99) || a.localeCompare(b)); }
function key(item) { return [item.transitPlanet || '', item.start || '', item.end || '', item.kind || ''].join('|'); }

function rankCurrentCareerTransits(items = []) {
  const merged = new Map();
  for (const evidence of items) {
    for (const context of evidence.temporalContext && evidence.temporalContext.transitContexts || []) {
      if (context.isCurrent !== true) continue;
      const identity = key(context); const previous = merged.get(identity);
      const reasons = unique([...(previous && previous.relevanceReasons || []), ...(context.relevanceReasons || [])]);
      merged.set(identity, {
        ...(previous || context),
        ...context,
        aspectTargetHouses: [...new Set([...(previous && previous.aspectTargetHouses || []), ...(context.aspectTargetHouses || [])])].sort((a, b) => a - b),
        relevanceReasons: reasons.length ? reasons : ['SECONDARY_CONTEXT'],
        relevanceType: reasons[0] || 'SECONDARY_CONTEXT',
        evidenceState: previous && (STATUS_PRIORITY[previous.evidenceState] ?? 99) <= (STATUS_PRIORITY[evidence.status] ?? 99) ? previous.evidenceState : evidence.status,
      });
    }
  }
  return freeze([...merged.values()].sort((left, right) =>
    (RELEVANCE_PRIORITY[left.relevanceType] ?? 99) - (RELEVANCE_PRIORITY[right.relevanceType] ?? 99)
      || (STATUS_PRIORITY[left.evidenceState] ?? 99) - (STATUS_PRIORITY[right.evidenceState] ?? 99)
      || String(left.start).localeCompare(String(right.start))
      || String(left.transitPlanet).localeCompare(String(right.transitPlanet)))
    .slice(0, MAX_CURRENT_CAREER_TRANSITS));
}

function mergeCurrentCareerTransitContext(items = []) {
  const contexts = rankCurrentCareerTransits(items);
  const first = items.find((item) => item.temporalContext && Object.keys(item.temporalContext).length);
  const mechanismFamilies = [...new Set(items.flatMap((item) => item.temporalContext && item.temporalContext.mechanismFamilies || []))].sort();
  return freeze({
    ...(first && first.temporalContext.readingInstant ? { readingInstant: first.temporalContext.readingInstant } : {}),
    dashaPeriods: [],
    transitContexts: contexts,
    mechanismFamilies,
    timingState: 'CURRENT',
  });
}

module.exports = { RELEVANCE_PRIORITY, MAX_CURRENT_CAREER_TRANSITS, rankCurrentCareerTransits, mergeCurrentCareerTransitContext };
