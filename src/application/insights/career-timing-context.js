'use strict';

const { freeze } = require('../../synthesis/evidence-node');

const PERIOD_LEVELS = Object.freeze({ MD: 'MAHADASHA', AD: 'ANTARDASHA', PD: 'PRATYANTAR_DASHA' });
const LINEAGE = new Set(['INDEPENDENT', 'PARTIALLY_OVERLAPPING', 'FULLY_DEPENDENT', 'IDENTICAL', 'CONTRADICTORY']);

function utc(value) {
  const text = value && (value.utc || value);
  return typeof text === 'string' && text.endsWith('Z') && !Number.isNaN(Date.parse(text)) ? text : null;
}

function timingState({ start, end, readingInstant }) {
  const instant = utc(readingInstant); const from = utc(start); const to = utc(end);
  if (!instant || !from) return null;
  if (Date.parse(instant) < Date.parse(from)) return 'UPCOMING';
  if (to && Date.parse(instant) >= Date.parse(to)) return 'PAST';
  return 'CURRENT';
}

function dashaPeriods(context) {
  return (context.dashaIntervals || []).map((period) => {
    const start = utc(period.start || period.startInstant); const end = utc(period.end || period.endInstant);
    const periodLevel = PERIOD_LEVELS[period.level] || null;
    if (!start || !end || !periodLevel || typeof period.lord !== 'string') return null;
    return {
      kind: 'DASHA_PERIOD', start, end,
      isCurrent: timingState({ start, end, readingInstant: context.readingInstant }) === 'CURRENT',
      periodLevel, periodPlanet: period.lord, source: 'VIMSHOTTARI',
      ...(typeof period.sourceRulesetId === 'string' ? { sourceRulesetId: period.sourceRulesetId } : {}),
    };
  }).filter(Boolean).sort((left, right) => Object.values(PERIOD_LEVELS).indexOf(left.periodLevel) - Object.values(PERIOD_LEVELS).indexOf(right.periodLevel));
}

function transitContexts(context) {
  return (context.transitContexts || []).map((item) => {
    const start = utc(item.start || item.instant); const end = utc(item.end);
    if (!start || !['GOCHAR_SNAPSHOT', 'TRANSIT_EVENT'].includes(item.kind)) return null;
    return {
      kind: item.kind, start, ...(end ? { end } : {}),
      isCurrent: timingState({ start, end, readingInstant: context.readingInstant }) === 'CURRENT',
      ...(typeof item.transitPlanet === 'string' ? { transitPlanet: item.transitPlanet } : {}),
      ...(typeof item.eventType === 'string' ? { eventType: item.eventType } : {}),
      ...(typeof item.motion === 'string' ? { motion: item.motion } : {}),
      ...(Number.isInteger(item.natalHouseNumber) ? { natalHouseNumber: item.natalHouseNumber } : {}),
      ...(typeof item.natalBody === 'string' ? { natalBody: item.natalBody } : {}),
      source: item.kind === 'GOCHAR_SNAPSHOT' ? 'GOCHAR' : 'TRANSIT_EVENT_SCANNER',
    };
  }).filter(Boolean).sort((left, right) => `${left.start}|${left.kind}|${left.transitPlanet || ''}`.localeCompare(`${right.start}|${right.kind}|${right.transitPlanet || ''}`));
}

function publicTimingContext(context = {}) {
  const dasha = dashaPeriods(context); const transits = transitContexts(context);
  const window = context.coactivationInterval && utc(context.coactivationInterval.start) && utc(context.coactivationInterval.end)
    ? { kind: 'CAREER_TIMING_OVERLAP', start: utc(context.coactivationInterval.start), end: utc(context.coactivationInterval.end), isCurrent: timingState({ start: context.coactivationInterval.start, end: context.coactivationInterval.end, readingInstant: context.readingInstant }) === 'CURRENT' }
    : null;
  return freeze({
    ...(utc(context.readingInstant) ? { readingInstant: utc(context.readingInstant) } : {}),
    dashaPeriods: dasha,
    transitContexts: transits,
    ...(window ? { timingWindow: window } : {}),
    ...(typeof context.timingState === 'string' && ['CURRENT', 'UPCOMING', 'PAST'].includes(context.timingState) ? { timingState: context.timingState } : {}),
    ...(typeof context.lineageClassification === 'string' && LINEAGE.has(context.lineageClassification) ? { lineageClassification: context.lineageClassification } : {}),
    mechanismFamilies: Array.isArray(context.mechanismFamilies) ? [...new Set(context.mechanismFamilies.filter((value) => typeof value === 'string'))].sort() : [],
  });
}

module.exports = { publicTimingContext, timingState, utc, PERIOD_LEVELS };
