'use strict';

// Presentation-only grouping over already sanitized facts. It cannot calculate
// astrology or alter an Insight; it removes duplication and internal IDs.
const { freeze } = require('../../synthesis/evidence-node');
const unique = (items, key) => [...new Map(items.map((item) => [key(item), item])).values()];
const order = (items, key) => items.slice().sort((a, b) => key(a).localeCompare(key(b)));

function buildCareerTechnicalContext({ timing = {}, charts = [], ashtakavarga = [], planetaryState = [], planetaryRelationships = [], calibrationContext = null, family } = {}) {
  const dasha = (timing.dashaPeriods || []).map((item) => ({ kind: 'DASHA', level: item.periodLevel, planet: item.periodPlanet, start: item.start, end: item.end, isCurrent: item.isCurrent === true }));
  const transit = (timing.transitContexts || []).map((item) => ({
    kind: 'TRANSIT',
    ...(typeof item.transitPlanet === 'string' ? { transitPlanet: item.transitPlanet } : {}),
    ...(typeof item.eventType === 'string' ? { eventType: item.eventType } : {}),
    ...(typeof item.motion === 'string' ? { motion: item.motion } : {}),
    ...(Number.isInteger(item.natalHouseNumber) ? { natalHouseNumber: item.natalHouseNumber } : {}),
    ...(typeof item.natalBody === 'string' ? { natalBody: item.natalBody } : {}),
    start: item.start,
    ...(item.end ? { end: item.end } : {}),
  }));
  const concurrent = timing.timingWindow ? [{
    kind: 'CONCURRENT_TIMING',
    start: timing.timingWindow.start,
    end: timing.timingWindow.end,
    ...(typeof timing.timingState === 'string' ? { timingState: timing.timingState } : {}),
    ...(typeof timing.lineageClassification === 'string' ? { lineageClassification: timing.lineageClassification } : {}),
    mechanismFamilies: timing.mechanismFamilies || [],
  }] : [];
  const d10 = charts.includes('D10') ? [{ kind: 'D10_CAREER_CHART', label: 'D10 Career Chart' }] : [];
  const history = calibrationContext ? [{ kind: 'CAREER_HISTORY', calibrationLevel: calibrationContext.calibrationLevel, ...(Number.isInteger(calibrationContext.eventCount) ? { eventCount: calibrationContext.eventCount } : {}), ...(Number.isInteger(calibrationContext.matchedEventCount) ? { matchedEventCount: calibrationContext.matchedEventCount } : {}), matchedEvents: calibrationContext.matchedEvents || [], mechanismFamilies: calibrationContext.mechanismFamilies || [], composite: calibrationContext.composite === true }] : [];
  const classical = family === 'AUDITED_CLASSICAL_PREDICATE' ? [{ kind: 'CLASSICAL_RULE_CONTEXT', cautionRequired: true }] : [];
  return freeze({
    natalStructure: [],
    d10CareerChart: d10,
    timing: order(unique([...dasha, ...transit, ...concurrent], (item) => JSON.stringify(item)), (item) => `${item.kind}|${item.level || ''}|${item.planet || item.transitPlanet || ''}|${item.start || ''}`),
    supportingContext: order(unique([...ashtakavarga, ...planetaryState, ...planetaryRelationships], (item) => JSON.stringify(item)), (item) => `${item.sourceFamily}|${item.planet || item.subjectPlanet || ''}|${item.targetPlanet || ''}|${item.scoreType || item.state || item.relationship || ''}`),
    careerHistory: history,
    classicalRuleContext: classical,
  });
}
module.exports = { buildCareerTechnicalContext };
