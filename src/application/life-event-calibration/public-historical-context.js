'use strict';

// Narrow customer projection only; internal fingerprints/audits never leave it.
function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
const LABELS = Object.freeze({
  CAREER: Object.freeze({ JOB_SWITCH: 'job changes', PROMOTION: 'promotions', BUSINESS_STARTED: 'business starts', default: 'Career events' }),
  PROPERTY: Object.freeze({ PROPERTY_PURCHASE: 'property purchases', PROPERTY_SALE: 'property sales', default: 'Property events' }),
  VEHICLE: Object.freeze({ VEHICLE_PURCHASE: 'vehicle purchases', VEHICLE_SALE: 'vehicle sales', default: 'Vehicle events' }),
  RELATIONSHIP: Object.freeze({ MARRIAGE: 'marriage milestones', ENGAGEMENT: 'engagement milestones', default: 'relationship milestones' }),
});
function publicHistoricalContext({ domain, calibration } = {}) {
  if (!calibration || calibration.customerDisplayEligible !== true) return null;
  const readiness = (calibration.customerDisplayReadiness || []).find((item) => item && item.customerDisplayEligible === true);
  if (!readiness || !Number.isInteger(readiness.matchedEventCount) || !Number.isInteger(readiness.comparableEventCount)) return null;
  if (domain === 'FAMILY_EXPANSION') return freeze({ available: true, summary: 'Similar family-oriented timing factors were present around prior recorded family milestones.' });
  const labels = LABELS[domain]; if (!labels) return null;
  const types = calibration.audit && Array.isArray(calibration.audit.eventTypes) ? calibration.audit.eventTypes : [];
  const label = types.length === 1 ? (labels[types[0]] || labels.default) : labels.default;
  return freeze({ available: true, summary: `Similar timing factors were present around ${readiness.matchedEventCount} of your ${readiness.comparableEventCount} recorded ${label}.`, matchedEventCount: readiness.matchedEventCount, comparableEventCount: readiness.comparableEventCount });
}
module.exports = { publicHistoricalContext };
