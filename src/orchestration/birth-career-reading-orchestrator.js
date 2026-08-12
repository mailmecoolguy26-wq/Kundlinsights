'use strict';

const { classifyLayer1Bodies } = require('../jyotish');
const { calculateRashiHouses } = require('../bhava');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET, resolveVimshottariRuleset } = require('../dasha');
const { calculateGocharSnapshot } = require('../gochar');
const { scanTransitEvents } = require('../transit-events');
const { assembleNatalEvidenceGraph, freeze } = require('../synthesis');
const { buildCareerReading } = require('./career-reading-orchestrator');
const { isProductionAstronomicalAuthority } = require('../astronomy');
const { validateBirthCareerRequest, utcInstantToLayer1Input } = require('./birth-career-input-validation');
const {
  BIRTH_CAREER_ORCHESTRATOR_RULESET_ID,
  DEFAULT_BIRTH_CAREER_ENGINE_PROFILE,
  resolveBirthCareerEngineProfile,
} = require('./reference-data');

function layer1Request(birth) {
  return { date: birth.date, time: birth.time, timezone: birth.place.timezone, latitude: birth.place.latitude, longitude: birth.place.longitude };
}

function orchestrationError(code, message) {
  const error = new RangeError(message);
  error.code = code;
  return error;
}

function solarSamplerProvenance(dasha) {
  return dasha.provenance && dasha.provenance.solarReturn && dasha.provenance.solarReturn.sampler || null;
}

function assertCompatibleSolarDashaProvenance(layer1Result, dasha) {
  const sampler = solarSamplerProvenance(dasha);
  if (!sampler) throw orchestrationError('INCOMPATIBLE_SOLAR_DASHA_PROVIDER_PROVENANCE', 'Solar Dasha result must retain safe sampler provenance.');
  const provider = layer1Result.provider || {};
  const birthSun = layer1Result.bodies && layer1Result.bodies.Sun || {};
  const birthProvenance = birthSun.provenance || {};
  const comparable = [
    ['providerId', provider.providerId, sampler.providerId],
    ['siderealMode', provider.siderealMode || layer1Result.sidereal && layer1Result.sidereal.siderealMode, sampler.siderealMode],
    ['calculationStatus', provider.calculationStatus || layer1Result.calculationStatus, sampler.calculationStatus],
    ['productionAuthority', isProductionAstronomicalAuthority(layer1Result), sampler.productionAuthority],
    ['swissVersion', provider.swissVersion, sampler.swissVersion],
    ['coordinateProvenance', birthProvenance.coordinateProvenance, sampler.coordinateProvenance],
  ];
  const conflict = comparable.find(([, birthValue, samplerValue]) => birthValue !== undefined && birthValue !== null && samplerValue !== undefined && samplerValue !== null && birthValue !== samplerValue);
  if (conflict) throw orchestrationError('INCOMPATIBLE_SOLAR_DASHA_PROVIDER_PROVENANCE', `Solar Dasha sampler provenance conflicts with birth astronomy ${conflict[0]}.`);
  return 'COMPATIBLE_WHERE_COMPARABLE';
}

function dashaTimingProvenance(dasha, providerSamplerConsistency) {
  const solar = dasha.provenance && dasha.provenance.solarReturn;
  return {
    dashaRulesetId: dasha.ruleset.id,
    dashaTimeConventionId: dasha.ruleset.timeConventionId,
    dashaCalculationStatus: solar && solar.sampler && solar.sampler.calculationStatus || 'PROVIDER_INDEPENDENT',
    providerSamplerConsistency,
    ...(solar ? {
      solarReturnSolverId: solar.solarReturnSolverId,
      solarYearInterpolationId: solar.solarYearInterpolationId,
    } : {}),
  };
}

function safeProviderProvenance(layer1Result, houses, dasha, place, providerSamplerConsistency, engineProfile) {
  const provider = layer1Result.provider || {};
  return {
    adapterRulesetId: BIRTH_CAREER_ORCHESTRATOR_RULESET_ID,
    providerId: provider.providerId || null,
    providerVersion: provider.swissVersion || provider.version || null,
    calculationStatus: provider.calculationStatus || layer1Result.calculationStatus || null,
    productionAuthority: isProductionAstronomicalAuthority(layer1Result),
    siderealMode: provider.siderealMode || layer1Result.sidereal && layer1Result.sidereal.siderealMode || null,
    nodeModel: provider.nodeModel || null,
    houseRulesetId: houses.rulesetId,
    engineProfileId: engineProfile.id,
    dashaRulesetId: dasha.ruleset.id,
    dashaTimeConventionId: dasha.ruleset.timeConventionId,
    dashaTiming: dashaTimingProvenance(dasha, providerSamplerConsistency),
    timezoneRulesetId: place.resolutionVersion,
    timezoneDatasetVersion: place.timezoneResolver.datasetVersion,
    layer15aRulesetId: 'kundlinsights-career-orchestrator-v1',
    providerDependency: 'injected-layer-1-engine',
    networkAccess: 'not-performed',
    llmGeneration: 'not-performed',
  };
}

class BirthCareerReadingOrchestrator {
  constructor({ astronomicalEngine, dashaRulesetId, canonicalSiderealSunSampler } = {}) {
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') throw new TypeError('BirthCareerReadingOrchestrator requires an injected astronomicalEngine.');
    if (dashaRulesetId !== undefined && typeof dashaRulesetId !== 'string') throw new TypeError('dashaRulesetId must be a supported string identifier when supplied.');
    const isDefaultPolicy = dashaRulesetId === undefined;
    const selectedDashaRulesetId = isDefaultPolicy
      ? DEFAULT_BIRTH_CAREER_ENGINE_PROFILE.dashaRulesetId
      : dashaRulesetId;
    const dashaRuleset = resolveVimshottariRuleset(undefined, selectedDashaRulesetId);
    const engineProfile = resolveBirthCareerEngineProfile(dashaRuleset.id);
    if (!engineProfile) throw new RangeError(`Unsupported BirthCareer Dasha ruleset: ${dashaRuleset.id}`);
    if (dashaRuleset.id === SOLAR_RETURN_VIMSHOTTARI_RULESET.id && (!canonicalSiderealSunSampler || typeof canonicalSiderealSunSampler.sampleCanonicalSiderealSun !== 'function')) {
      if (isDefaultPolicy) throw orchestrationError('MISSING_DEFAULT_SOLAR_DASHA_SAMPLER', 'Default solar-return Dasha requires canonicalSiderealSunSampler.');
      throw new TypeError('Solar-return Dasha configuration requires canonicalSiderealSunSampler.');
    }
    this.astronomicalEngine = astronomicalEngine;
    this.dashaRuleset = dashaRuleset;
    this.engineProfile = engineProfile;
    this.canonicalSiderealSunSampler = canonicalSiderealSunSampler || null;
    Object.freeze(this);
  }

  generate(request = {}) {
    const input = validateBirthCareerRequest(request);
    const birthLayer1Result = this.astronomicalEngine.calculate(layer1Request(input.birth));
    const layer2Bodies = classifyLayer1Bodies(birthLayer1Result);
    const houses = calculateRashiHouses({
      ascendantCanonicalSiderealLongitude: birthLayer1Result.bodies.Ascendant.siderealLongitudeDegrees,
      bodies: birthLayer1Result.bodies,
    });
    const solarDasha = this.dashaRuleset.id === SOLAR_RETURN_VIMSHOTTARI_RULESET.id;
    const dasha = solarDasha
      ? calculateVimshottariDasha({
        birthInstant: birthLayer1Result.instant.utc,
        moonCanonicalSiderealLongitude: birthLayer1Result.bodies.Moon.siderealLongitudeDegrees,
        natalSunCanonicalSiderealLongitude: birthLayer1Result.bodies.Sun.siderealLongitudeDegrees,
        canonicalSiderealSunSampler: this.canonicalSiderealSunSampler,
        rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id,
      })
      : calculateVimshottariDasha({
        birthInstant: birthLayer1Result.instant.utc,
        moonCanonicalSiderealLongitude: birthLayer1Result.bodies.Moon.siderealLongitudeDegrees,
      });
    const providerSamplerConsistency = solarDasha ? assertCompatibleSolarDashaProvenance(birthLayer1Result, dasha) : 'NOT_APPLICABLE';
    const readingLayer1Result = this.astronomicalEngine.calculate(utcInstantToLayer1Input(input.readingInstant, input.birth.place));
    const gochar = calculateGocharSnapshot({
      snapshotInstant: input.readingInstant,
      natalBodies: birthLayer1Result.bodies,
      natalHouses: houses,
      transitBodies: readingLayer1Result.bodies,
    });
    let transitEvents;
    if (input.transitScanRange) {
      transitEvents = scanTransitEvents({
        ...input.transitScanRange,
        natalBodies: birthLayer1Result.bodies,
        natalHouses: houses,
        astronomicalEngine: this.astronomicalEngine,
        observer: { latitude: input.birth.place.latitude, longitude: input.birth.place.longitude },
      });
    }
    const natal = assembleNatalEvidenceGraph({ layer2Bodies, houses });
    const career = buildCareerReading({
      natal,
      temporal: { instant: input.readingInstant, dasha, gochar, ...(transitEvents === undefined ? {} : { transitEvents }) },
      locale: input.locale,
    });
    return freeze({
      domain: career.domain,
      locale: career.locale,
      reading: career.reading,
      renderedReading: career.renderedReading,
      provenance: safeProviderProvenance(birthLayer1Result, houses, dasha, input.birth.place, providerSamplerConsistency, this.engineProfile),
    });
  }
}

module.exports = { BirthCareerReadingOrchestrator };
