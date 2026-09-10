'use strict';

const { createDashaInsightContext } = require('./dasha-insight-contract');
const { COPY, copyForCurrentPhase } = require('./dasha-insight-renderer');
const ACTIVE_CAREER_DASHA = 'ACTIVE_CAREER_DASHA';
const AUDITED_CLASSICAL_PREDICATE = 'AUDITED_CLASSICAL_PREDICATE';
const USABLE_STATUSES = new Set(['SUPPORTED', 'MIXED', 'CONTRADICTED', 'INSUFFICIENT_EVIDENCE']);
function interval(period) { return { start: period.startInstant.utc, end: period.endInstant.utc }; }
function publicPeriod(period) { return { lord: period.lord.id, ...interval(period) }; }
function overlaps(left, right) { return Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end); }
function activePeriods(active) { return [{ level: 'MAHADASHA', period: active.mahadasha }, { level: 'ANTARDASHA', period: active.antardasha }, { level: 'PRATYANTAR', period: active.pratyantardasha }]; }
function matchingPeriod(insight, active) {
  // Matching is identity-based: the public Career Insight must name the same
  // MD/AD/PD level and lord and overlap the current half-open period.
  const periods = insight && insight.timing && Array.isArray(insight.timing.dashaPeriods) ? insight.timing.dashaPeriods : [];
  return activePeriods(active).find(({ level, period }) => periods.some((candidate) => candidate && candidate.periodLevel === level && candidate.periodPlanet === period.lord.id && typeof candidate.start === 'string' && typeof candidate.end === 'string' && overlaps(interval(period), candidate)));
}
function matchingInsight(insights, family, active) { return (Array.isArray(insights) ? insights : []).find((insight) => insight && insight.family === family && USABLE_STATUSES.has(insight.status) && matchingPeriod(insight, active)); }
function atPeriod(periods, at) { return periods.find((period) => BigInt(period.startInstant.epochMilliseconds) <= at && at < BigInt(period.endInstant.epochMilliseconds)); }
function periodAfter({ dasha, active }) {
  // At a shared boundary, report the highest level that changes. This produces
  // one deterministic transition rather than duplicating the same instant.
  const candidates = [{ level: 'MAHADASHA', at: BigInt(active.mahadasha.endInstant.epochMilliseconds) }, { level: 'ANTARDASHA', at: BigInt(active.antardasha.endInstant.epochMilliseconds) }, { level: 'PRATYANTAR', at: BigInt(active.pratyantardasha.endInstant.epochMilliseconds) }].sort((left, right) => left.at === right.at ? ['MAHADASHA', 'ANTARDASHA', 'PRATYANTAR'].indexOf(left.level) - ['MAHADASHA', 'ANTARDASHA', 'PRATYANTAR'].indexOf(right.level) : left.at < right.at ? -1 : 1);
  const boundary = candidates[0]; const md = atPeriod(dasha.periods, boundary.at); if (!md) return null;
  if (boundary.level === 'MAHADASHA') return { level: boundary.level, lord: md.lord.id, starts: md.startInstant.utc };
  const ad = atPeriod(md.children, boundary.at); if (!ad) return null;
  if (boundary.level === 'ANTARDASHA') return { level: boundary.level, lord: ad.lord.id, starts: ad.startInstant.utc };
  const pd = atPeriod(ad.children, boundary.at); return pd ? { level: boundary.level, lord: pd.lord.id, starts: pd.startInstant.utc } : null;
}
function adaptDashaInsight({ dasha, active, insights = [] } = {}) {
  const career = matchingInsight(insights, ACTIVE_CAREER_DASHA, active); const matched = career && matchingPeriod(career, active);
  const phase = career && matched ? { status: career.status, timingLevel: matched.level, lord: matched.period.lord.id, presentation: copyForCurrentPhase(career.status) } : null;
  const relevance = career && career.status === 'SUPPORTED' ? { active: true, status: career.status, presentation: COPY.careerRelevance } : career ? { active: false, status: career.status, presentation: copyForCurrentPhase(career.status) } : null;
  const classical = matchingInsight(insights, AUDITED_CLASSICAL_PREDICATE, active);
  const classicalContext = classical && classical.status === 'SUPPORTED' ? { active: true, status: classical.status, presentation: COPY.classical, caution: COPY.classicalCaution } : null;
  return createDashaInsightContext({ currentPeriods: { mahadasha: publicPeriod(active.mahadasha), antardasha: publicPeriod(active.antardasha), pratyantardasha: publicPeriod(active.pratyantardasha) }, currentPhase: phase, careerRelevance: relevance, nextTransition: periodAfter({ dasha, active }), classicalContext });
}
module.exports = { adaptDashaInsight, matchingPeriod, periodAfter };
