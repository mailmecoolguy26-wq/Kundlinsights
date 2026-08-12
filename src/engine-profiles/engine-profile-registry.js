'use strict';

const { ENGINE_PROFILES, DEFAULT_ENGINE_PROFILE_ID } = require('./reference-data');

function resolveEngineProfile(profileId) {
  if (typeof profileId !== 'string' || !profileId) throw new RangeError('ENGINE_PROFILE_REQUIRED');
  const profile = ENGINE_PROFILES[profileId];
  if (!profile) throw new RangeError(`UNKNOWN_ENGINE_PROFILE: ${profileId}`);
  return profile;
}

function defaultEngineProfile() {
  return resolveEngineProfile(DEFAULT_ENGINE_PROFILE_ID);
}

module.exports = { resolveEngineProfile, defaultEngineProfile };
