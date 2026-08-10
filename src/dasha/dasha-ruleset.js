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

function resolveVimshottariRuleset(ruleset = DEFAULT_VIMSHOTTARI_RULESET) {
  if (ruleset === DEFAULT_VIMSHOTTARI_RULESET || ruleset === undefined) return DEFAULT_VIMSHOTTARI_RULESET;
  if (typeof ruleset === 'string' && ruleset === DEFAULT_VIMSHOTTARI_RULESET.id) return DEFAULT_VIMSHOTTARI_RULESET;
  if (ruleset && ruleset.id === DEFAULT_VIMSHOTTARI_RULESET.id && ruleset.balanceMethodId === DEFAULT_VIMSHOTTARI_RULESET.balanceMethodId && ruleset.timeConventionId === DEFAULT_VIMSHOTTARI_RULESET.timeConventionId) return DEFAULT_VIMSHOTTARI_RULESET;
  throw new RangeError('Unsupported Vimshottari ruleset.');
}

module.exports = { DEFAULT_VIMSHOTTARI_RULESET, resolveVimshottariRuleset };
