'use strict';

const { resolveVimshottariRuleset } = require('./dasha-ruleset');
const { calculateLongitudeProportionalBirthBalance } = require('./birth-balance');
const { resolveTimeConvention, parseBirthInstant, instantFromEpochMilliseconds } = require('./time-conventions');
const { buildMahadashaTimeline, findActiveAtBirth } = require('./timeline-builder');
const { buildSolarReturnVimshottariTimeline } = require('./solar-return-vimshottari-timeline');

function calculateVimshottariDasha({ birthInstant, moonCanonicalSiderealLongitude, ruleset, rulesetId, canonicalSiderealSunSampler, natalSunCanonicalSiderealLongitude } = {}) {
  if (typeof moonCanonicalSiderealLongitude !== 'number' || !Number.isFinite(moonCanonicalSiderealLongitude)) throw new TypeError('moonCanonicalSiderealLongitude must be a finite number.');
  const resolvedRuleset = resolveVimshottariRuleset(ruleset, rulesetId);
  const birthEpochMilliseconds = parseBirthInstant(birthInstant);
  const birthInstantResult = instantFromEpochMilliseconds(birthEpochMilliseconds);
  const birthBalance = calculateLongitudeProportionalBirthBalance(moonCanonicalSiderealLongitude);
  if (resolvedRuleset.timeConventionId === 'solar-return-lahiri-grid-v1') {
    const solar = buildSolarReturnVimshottariTimeline({ birthEpochMilliseconds, birthInstantUtc: birthInstantResult.utc, birthBalance, ruleset: resolvedRuleset, canonicalSiderealSunSampler, natalSunCanonicalSiderealLongitude });
    const remainingMahadashaMilliseconds = BigInt(solar.activeAtBirth.mahadasha.endInstant.epochMilliseconds) - birthEpochMilliseconds;
    return Object.freeze({
      birthInstant: birthInstantResult,
      moonCanonicalSiderealLongitude: birthBalance.moonCanonicalSiderealLongitude,
      ruleset: resolvedRuleset,
      birthContext: Object.freeze({ nakshatra: birthBalance.nakshatra.name, nakshatraIndex: birthBalance.nakshatra.index, lord: birthBalance.nakshatra.lord, degreesWithinNakshatra: birthBalance.degreesWithinNakshatra, elapsedRatio: birthBalance.elapsedRatio, remainingRatio: birthBalance.remainingRatio, remainingMahadashaYears: birthBalance.remainingMahadashaYears, remainingMahadashaDuration: Object.freeze({ materializedMilliseconds: remainingMahadashaMilliseconds.toString() }) }),
      activeAtBirth: solar.activeAtBirth,
      periods: solar.periods,
      provenance: Object.freeze({ layer: 'Layer 4 — Vimshottari Dasha', providerIndependent: false, coordinateInput: 'canonical sidereal Moon longitude classified with Layer 2 Jyotish reference data; canonical sidereal Sun sampler supplies solar-return timing', balanceMethod: resolvedRuleset.provenance.balanceMethod, timeConvention: resolvedRuleset.provenance.timeConvention, timestampPrecision: 'integer milliseconds; MD coordinates derive from actual solar-return grid interpolation and AD/PD use exact cumulative BigInt parent partitioning.', solarReturn: solar.provenance })
    });
  }
  const timeConvention = resolveTimeConvention(resolvedRuleset.timeConventionId);
  const periods = buildMahadashaTimeline({ birthEpochMilliseconds, birthBalance, timeConvention, ruleset: resolvedRuleset });
  const activeAtBirth = findActiveAtBirth(periods, birthEpochMilliseconds);
  const remainingMahadashaMilliseconds = BigInt(activeAtBirth.mahadasha.endInstant.epochMilliseconds) - birthEpochMilliseconds;
  return Object.freeze({
    birthInstant: birthInstantResult,
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
