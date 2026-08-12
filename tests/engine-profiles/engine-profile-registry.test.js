'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveEngineProfile, defaultEngineProfile, KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1, KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2 } = require('../../src/engine-profiles');

test('resolves the two immutable, exact engine profiles without aliases or fallback', () => {
  const v1 = resolveEngineProfile('kundlinsights-vedic-engine-profile-v1');
  const v2 = resolveEngineProfile('kundlinsights-vedic-engine-profile-v2');
  assert.equal(v1, KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V1);
  assert.equal(v2, KUNDLINSIGHTS_VEDIC_ENGINE_PROFILE_V2);
  assert.equal(v1.calculation.dashaRulesetId, 'vimshottari-longitude-proportional-savana-360-v1');
  assert.equal(v2.calculation.dashaRulesetId, 'vimshottari-longitude-proportional-solar-return-v1');
  assert.equal(defaultEngineProfile(), v2);
  assert.equal(Object.isFrozen(v1), true); assert.equal(Object.isFrozen(v1.calculation.vargaRulesetIds), true); assert.equal(Object.isFrozen(v2), true);
  assert.throws(() => resolveEngineProfile(), /ENGINE_PROFILE_REQUIRED/);
  assert.throws(() => resolveEngineProfile('kundlinsights-vedic-engine-profile-v3'), /UNKNOWN_ENGINE_PROFILE/);
});

test('separates presentation identity from calculation-profile identity', () => {
  const profile = resolveEngineProfile('kundlinsights-vedic-engine-profile-v2');
  assert.equal(profile.calculation.rendererRulesetId, profile.presentation.rendererRulesetId);
  assert.equal(profile.calculation.dashaTimeConventionId, 'solar-return-lahiri-grid-v1');
  assert.equal(profile.calculation.solarReturnSolverId, 'solar-return-lahiri-bisection-v1');
  assert.equal(profile.calculation.solarYearInterpolationId, 'solar-return-grid-linear-time-interpolation-v1');
});
