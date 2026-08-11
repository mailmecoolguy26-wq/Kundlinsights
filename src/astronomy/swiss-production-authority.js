'use strict';

const { SWISS_BINDING, SWISS_VERSION, REQUIRED_BODY_NAMES } = require('./swiss-reference-data');

function isProductionAstronomicalAuthority(layer1Result) {
  const provider = layer1Result && layer1Result.provider;
  if (!provider || provider.providerId !== 'swiss-ephemeris' || provider.calculationStatus !== 'PRODUCTION') return false;
  if (provider.swissVersion !== SWISS_VERSION || !provider.binding || provider.binding.name !== SWISS_BINDING.name || provider.binding.version !== SWISS_BINDING.version) return false;
  if (provider.ephemerisMode !== 'SWIEPH' || provider.siderealMode !== 'SE_SIDM_LAHIRI' || provider.nodeModel !== 'MEAN_NODE' || provider.ephemerisManifestStatus !== 'VERIFIED' || provider.productionLicenseGate !== true) return false;
  const flags = provider.returnedFlagsByBody;
  if (!flags || typeof flags !== 'object') return false;
  const requiredFlags = provider.requestedFlags;
  if (!Number.isInteger(requiredFlags)) return false;
  const bodies = layer1Result.bodies;
  if (!bodies || typeof bodies !== 'object') return false;
  for (const body of REQUIRED_BODY_NAMES) if (!bodies[body] || !Number.isFinite(bodies[body].siderealLongitudeDegrees)) return false;
  for (const body of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu']) {
    if (!Number.isInteger(flags[body]) || (flags[body] & requiredFlags) !== requiredFlags) return false;
    if ((flags[body] & 4) !== 0 || (flags[body] & 1) !== 0) return false; // SEFLG_MOSEPH / SEFLG_JPLEPH
  }
  return bodies.Rahu.provenance && bodies.Rahu.provenance.nodeModel === 'MEAN_NODE'
    && bodies.Ketu.provenance && bodies.Ketu.provenance.ketuDerivation === 'NORMALIZED_RAHU_PLUS_180'
    && bodies.Ascendant.provenance && bodies.Ascendant.provenance.api === 'houses_ex2';
}

module.exports = { isProductionAstronomicalAuthority };
