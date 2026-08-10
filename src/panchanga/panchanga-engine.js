'use strict';
const { normalizeDegrees } = require('./angular-intervals');
const { calculateTithi, calculatePaksha } = require('./tithi');
const { calculateLunarPhaseState } = require('./lunar-state');
const { calculateKarana } = require('./karana');
const { calculateNityaYoga } = require('./nitya-yoga');
function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); return value; }
function calculatePanchangaAtInstant({ sunCanonicalSiderealLongitudeDegrees, moonCanonicalSiderealLongitudeDegrees } = {}) {
  const sun = normalizeDegrees(sunCanonicalSiderealLongitudeDegrees);
  const moon = normalizeDegrees(moonCanonicalSiderealLongitudeDegrees);
  const elongation = normalizeDegrees(moon - sun);
  const normalizedSum = normalizeDegrees(sun + moon);
  return deepFreeze({ coordinateAuthority: 'canonical-sidereal', tithi: calculateTithi(elongation), paksha: calculatePaksha(elongation), lunarPhaseState: calculateLunarPhaseState(elongation), karana: calculateKarana(elongation), nityaYoga: calculateNityaYoga(normalizedSum), provenance: { providerIndependent: true, astronomicalCalculation: 'not-performed', ayanamshaCalculation: 'not-performed', sunriseCalculation: 'not-performed', coordinateFrame: 'canonical-sidereal' } });
}
module.exports = { calculatePanchangaAtInstant };
