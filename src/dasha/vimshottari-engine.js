'use strict';

const { resolveVimshottariRuleset } = require('./dasha-ruleset');
const { calculateLongitudeProportionalBirthBalance } = require('./birth-balance');
const { resolveTimeConvention, parseBirthInstant, instantFromEpochMilliseconds } = require('./time-conventions');
const { buildMahadashaTimeline, findActiveAtBirth } = require('./timeline-builder');

function calculateVimshottariDasha({ birthInstant, moonCanonicalSiderealLongitude, ruleset } = {}) {
  if (typeof moonCanonicalSiderealLongitude !== 'number' || !Number.isFinite(moonCanonicalSiderealLongitude)) throw new TypeError('moonCanonicalSiderealLongitude must be a finite number.');
  const resolvedRuleset = resolveVimshottariRuleset(ruleset);
  const timeConvention = resolveTimeConvention(resolvedRuleset.timeConventionId);
  const birthEpochMilliseconds = parseBirthInstant(birthInstant);
  const birthBalance = calculateLongitudeProportionalBirthBalance(moonCanonicalSiderealLongitude);
  const periods = buildMahadashaTimeline({ birthEpochMilliseconds, birthBalance, timeConvention, ruleset: resolvedRuleset });
  const activeAtBirth = findActiveAtBirth(periods, birthEpochMilliseconds);
  const remainingMahadashaMilliseconds = BigInt(activeAtBirth.mahadasha.endInstant.epochMilliseconds) - birthEpochMilliseconds;
  return Object.freeze({
    birthInstant: instantFromEpochMilliseconds(birthEpochMilliseconds),
    moonCanonicalSiderealLongitude: birthBalance.moonCanonicalSiderealLongitude,
    ruleset: resolvedRuleset,
    birthContext: Object.freeze({
      nakshatra: birthBalance.nakshatra.name,
      nakshatraIndex: birthBalance.nakshatra.index,
      lord: birthBalance.nakshatra.lord,
      degreesWithinNakshatra: birthBalance.degreesWithinNakshatra,
      elapsedRatio: birthBalance.elapsedRatio,
      remainingRatio: birthBalance.remainingRatio,
      remainingMahadashaYears: birthBalance.remainingMahadashaYears,
      remainingMahadashaDuration: Object.freeze({ materializedMilliseconds: remainingMahadashaMilliseconds.toString() })
    }),
    activeAtBirth,
    periods,
    provenance: Object.freeze({
      layer: 'Layer 4 — Vimshottari Dasha',
      providerIndependent: true,
      coordinateInput: 'canonical sidereal Moon longitude classified with Layer 2 Jyotish reference data',
      balanceMethod: resolvedRuleset.provenance.balanceMethod,
      timeConvention: timeConvention.provenance,
      timestampPrecision: 'integer milliseconds; exact rational duration metadata is authoritative for Vimshottari proportions.'
    })
  });
}

module.exports = { calculateVimshottariDasha };
