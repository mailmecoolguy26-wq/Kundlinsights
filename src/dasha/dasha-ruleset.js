'use strict';

const DEFAULT_VIMSHOTTARI_RULESET = Object.freeze({
  id: 'vimshottari-longitude-proportional-savana-360-v1',
  sequenceVersion: 'vimshottari-120-v1',
  balanceMethodId: 'longitude-proportional-balance-v1',
  timeConventionId: 'savana-360-day-v1',
  boundaryPolicy: '[start, end)',
  provenance: Object.freeze({
    classicalSource: 'BPHS Chapters 46 and 51: sequence, weights, and proportional MD/AD/PD arithmetic.',
    balanceMethod: 'Deterministic KundlInsights computational implementation derived from Moon canonical sidereal longitude within its Janma Nakshatra; not represented as an exact BPHS bhayata/bhabhoga transit-time calculation.',
    timeConvention: 'KundlInsights Savana convention: one Vimshottari year equals exactly 360 civil days.',
    futureRulesets: Object.freeze(['bphs-transit-time-bhayat-v1', 'phaladeepika-solar-return-v1'])
  })
});

const SOLAR_RETURN_VIMSHOTTARI_RULESET = Object.freeze({
  id: 'vimshottari-longitude-proportional-solar-return-v1',
  sequenceVersion: 'vimshottari-120-v1',
  balanceMethodId: 'longitude-proportional-balance-v1',
  timeConventionId: 'solar-return-lahiri-grid-v1',
  boundaryPolicy: '[start, end)',
  provenance: Object.freeze({
    classicalSource: 'BPHS Chapters 46 and 51: sequence, weights, and proportional MD/AD/PD arithmetic.',
    balanceMethod: 'Deterministic KundlInsights computational implementation derived from Moon canonical sidereal longitude within its Janma Nakshatra.',
    timeConvention: 'KundlInsights solar-return convention: actual native Lahiri solar-return intervals with linear UTC-time fractional interpolation.',
    chronologyStatus: 'EXPLICIT_OPT_IN_ONLY; prototype parity pending independent Swiss C validation.'
  })
});

function rulesetFor(value) {
  if (value === undefined || value === DEFAULT_VIMSHOTTARI_RULESET || value === DEFAULT_VIMSHOTTARI_RULESET.id) return DEFAULT_VIMSHOTTARI_RULESET;
  if (value === SOLAR_RETURN_VIMSHOTTARI_RULESET || value === SOLAR_RETURN_VIMSHOTTARI_RULESET.id) return SOLAR_RETURN_VIMSHOTTARI_RULESET;
  if (value && value.id === DEFAULT_VIMSHOTTARI_RULESET.id && value.balanceMethodId === DEFAULT_VIMSHOTTARI_RULESET.balanceMethodId && value.timeConventionId === DEFAULT_VIMSHOTTARI_RULESET.timeConventionId) return DEFAULT_VIMSHOTTARI_RULESET;
  if (value && value.id === SOLAR_RETURN_VIMSHOTTARI_RULESET.id && value.balanceMethodId === SOLAR_RETURN_VIMSHOTTARI_RULESET.balanceMethodId && value.timeConventionId === SOLAR_RETURN_VIMSHOTTARI_RULESET.timeConventionId) return SOLAR_RETURN_VIMSHOTTARI_RULESET;
  throw new RangeError('Unsupported Vimshottari ruleset.');
}

function resolveVimshottariRuleset(ruleset, rulesetId) {
  const legacy = rulesetFor(ruleset);
  if (rulesetId === undefined) return legacy;
  const explicit = rulesetFor(rulesetId);
  if (ruleset !== undefined && legacy.id !== explicit.id) throw new RangeError('Conflicting Vimshottari ruleset identifiers.');
  return explicit;
}

module.exports = { DEFAULT_VIMSHOTTARI_RULESET, SOLAR_RETURN_VIMSHOTTARI_RULESET, resolveVimshottariRuleset };
