'use strict';

const { classifyLayer1Bodies } = require('../jyotish');
const { calculateRashiHouses } = require('../bhava');
const { calculateVimshottariDasha } = require('../dasha');
const { calculateGocharSnapshot } = require('../gochar');
const { scanTransitEvents } = require('../transit-events');
const { assembleNatalEvidenceGraph, freeze } = require('../synthesis');
const { buildCareerReading } = require('./career-reading-orchestrator');
const { isProductionAstronomicalAuthority } = require('../astronomy');
const { validateBirthCareerRequest, utcInstantToLayer1Input } = require('./birth-career-input-validation');
const { BIRTH_CAREER_ORCHESTRATOR_RULESET_ID } = require('./reference-data');

function layer1Request(birth) {
  return { date: birth.date, time: birth.time, timezone: birth.place.timezone, latitude: birth.place.latitude, longitude: birth.place.longitude };
}

function safeProviderProvenance(layer1Result, houses, dasha, place) {
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
    dashaRulesetId: dasha.ruleset.id,
    timezoneRulesetId: place.resolutionVersion,
    timezoneDatasetVersion: place.timezoneResolver.datasetVersion,
    layer15aRulesetId: 'kundlinsights-career-orchestrator-v1',
    providerDependency: 'injected-layer-1-engine',
    networkAccess: 'not-performed',
    llmGeneration: 'not-performed',
  };
}

class BirthCareerReadingOrchestrator {
  constructor({ astronomicalEngine } = {}) {
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') throw new TypeError('BirthCareerReadingOrchestrator requires an injected astronomicalEngine.');
    this.astronomicalEngine = astronomicalEngine;
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
    const dasha = calculateVimshottariDasha({
      birthInstant: birthLayer1Result.instant.utc,
      moonCanonicalSiderealLongitude: birthLayer1Result.bodies.Moon.siderealLongitudeDegrees,
    });
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
      provenance: safeProviderProvenance(birthLayer1Result, houses, dasha, input.birth.place),
    });
  }
}

module.exports = { BirthCareerReadingOrchestrator };
