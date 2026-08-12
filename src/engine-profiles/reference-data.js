'use strict';

const { HOUSE_SYSTEM_ID } = require('../bhava/reference-data');
const { VARGA_DEFINITIONS } = require('../varga/reference-data');
const { RULESETS: GOCHAR_RULESETS } = require('../gochar/reference-data');
const { DEFAULT_VIMSHOTTARI_RULESET, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../dasha/dasha-ruleset');
const { READING_RULESET_ID } = require('../reading/reference-data');
const { INTERPRETATION_RULESET_ID } = require('../interpretation/reference-data');
const { RENDERER_RULESET_ID } = require('../rendering/reference-data');
const { freeze } = require('../synthesis/evidence-node');

const ENGINE_PROFILE_IDS = freeze({
  v1: 'kundlinsights-vedic-engine-profile-v1',
  v2: 'kundlinsights-vedic-engine-profile-v2',
});

const SHARED_CALCULATION_POLICY = freeze({
  siderealMode: 'SE_SIDM_LAHIRI',
  ayanamshaSystem: 'Lahiri / Chitrapaksha',
  nodeModel: 'MEAN_NODE',
  ketuDerivation: 'NORMALIZED_RAHU_PLUS_180',
  providerContractId: 'canonical-sidereal-astronomical-provider-v1',
  ascendantPolicyId: 'observer-aware-eastern-ecliptic-horizon-intersection-v1',
  houseRulesetId: HOUSE_SYSTEM_ID,
  vargaRulesetIds: freeze(Object.fromEntries(Object.entries(VARGA_DEFINITIONS).map(([id, definition]) => [id, definition.rulesetVersion || definition.classicalMapping && definition.classicalMapping.rulesetVersion || 'bphs-chapter-6-v1']))),
  gocharRulesets: GOCHAR_RULESETS,
  readingRulesetId: READING_RULESET_ID,
  interpretationRulesetId: INTERPRETATION_RULESET_ID,
  rendererRulesetId: RENDERER_RULESET_ID,
});

const KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1 = freeze({
  id: ENGINE_PROFILE_IDS.v1,
  profileVersion: 1,
  migrationStatus: 'LEGACY_COMPATIBILITY',
  calculation: freeze({
    ...SHARED_CALCULATION_POLICY,
    dashaRulesetId: DEFAULT_VIMSHOTTARI_RULESET.id,
    dashaTimeConventionId: DEFAULT_VIMSHOTTARI_RULESET.timeConventionId,
    dashaBalanceMethodId: DEFAULT_VIMSHOTTARI_RULESET.balanceMethodId,
  }),
  presentation: freeze({ rendererRulesetId: RENDERER_RULESET_ID }),
});

const KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2 = freeze({
  id: ENGINE_PROFILE_IDS.v2,
  profileVersion: 2,
  migrationStatus: 'CURRENT_DEFAULT_FOR_NEW_READINGS',
  calculation: freeze({
    ...SHARED_CALCULATION_POLICY,
    dashaRulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id,
    dashaTimeConventionId: SOLAR_RETURN_VIMSHOTTARI_RULESET.timeConventionId,
    dashaBalanceMethodId: SOLAR_RETURN_VIMSHOTTARI_RULESET.balanceMethodId,
    solarReturnSolverId: 'solar-return-lahiri-bisection-v1',
    solarYearInterpolationId: 'solar-return-grid-linear-time-interpolation-v1',
  }),
  presentation: freeze({ rendererRulesetId: RENDERER_RULESET_ID }),
});

const ENGINE_PROFILES = freeze({
  [KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1.id]: KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1,
  [KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2.id]: KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2,
});

const DEFAULT_ENGINE_PROFILE_ID = KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2.id;

module.exports = {
  ENGINE_PROFILE_IDS,
  SHARED_CALCULATION_POLICY,
  KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1,
  KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2,
  ENGINE_PROFILES,
  DEFAULT_ENGINE_PROFILE_ID,
};
