'use strict';

const { classifyLayer1Bodies } = require('../jyotish');
const { calculateRashiHouses } = require('../bhava');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET, resolveVimshottariRuleset } = require('../dasha');
const { calculateGocharSnapshot } = require('../gochar');
const { scanTransitEvents } = require('../transit-events');
const { assembleNatalEvidenceGraph, freeze } = require('../synthesis');
const { calculateChartCoordinates, buildCareerD10Structure } = require('../application/divisional-charts');
const { calculateAshtakavargaForLayer2 } = require('../application/ashtakavarga');
const { buildCareerAshtakavargaStructure } = require('../application/ashtakavarga/career-ashtakavarga-structure');
const { evaluatePlanetaryState } = require('../dignity');
const { buildCareerReading } = require('./career-reading-orchestrator');
const { buildCareerTimingPeriods } = require('../application/insights/career-timing-periods');
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

function d10Rashi(coordinate) {
  const rashi = coordinate.varga.derivedVargaRashi;
  return {
    rashiIndex: rashi.rashiIndex,
    sanskritName: rashi.sanskritName,
    englishName: rashi.englishName,
  };
}

// This is the same pure projection used by DivisionalChartService.  It keeps
// only the factual D10 structure needed by the Career evidence graph; it does
// not introduce a second calculator or any D10 interpretation.
function d10CareerStructure(layer1Result) {
  const d10 = calculateChartCoordinates(layer1Result, 'd10');
  const assignmentByBody = new Map(
    d10.houses.planetaryAssignments.map((assignment) => [
      assignment.body,
      assignment.rashiHouseNumber,
    ]),
  );
  return freeze({
    chart: 'D10',
    rulesetId: 'parashari-varga-engine-v1',
    ascendant: {
      rashi: d10Rashi(d10.coordinates.Ascendant),
      houseNumber: d10.houses.ascendant.rashiHouseNumber,
    },
    houses: d10.houses.houses.map((house) => ({
      houseNumber: house.houseNumber,
      rashi: house.rashi,
      rashiHouseLord: house.rashiHouseLord,
    })),
    bodies: Object.fromEntries(
      Object.entries(d10.coordinates).map(([body, coordinate]) => [
        body,
        {
          rashi: d10Rashi(coordinate),
          rashiHouseNumber:
            body === 'Ascendant'
              ? d10.houses.ascendant.rashiHouseNumber
              : assignmentByBody.get(body) || null,
          ...(Number.isFinite(coordinate.varga.derivedVargaRashi.degreesWithinResultingRashi) ? { degree: coordinate.varga.derivedVargaRashi.degreesWithinResultingRashi } : {}),
          ...(body !== 'Ascendant' && typeof layer1Result.bodies[body].motion === 'string' ? { retrograde: layer1Result.bodies[body].motion === 'retrograde' } : {}),
        },
      ]),
    ),
    provenance: {
      chartCalculation: 'delegated-to-production-divisional-chart-projection',
      sourceLayer: '1',
    },
  });
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

function addMonths(instant, months) {
  const value = new Date(instant);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString();
}

function futureDashaIntervals(dasha, horizonEnd) {
  const intervals = [];
  for (const md of dasha.periods) for (const ad of md.children) for (const pd of ad.children) {
    const start = pd.startInstant.utc; const end = pd.endInstant.utc;
    if (Date.parse(start) < Date.parse(horizonEnd)) intervals.push({
      start, end,
      activePeriods: [
        { level: 'MD', lord: md.lord.name },
        { level: 'AD', lord: ad.lord.name },
        { level: 'PD', lord: pd.lord.name },
      ],
    });
  }
  return intervals;
}

function futureMajorTransitIntervals({ astronomicalEngine, start, end, place }) {
  const daily = [];
  for (let timestamp = Date.parse(start); timestamp < Date.parse(end); timestamp += 86400000) {
    const instant = new Date(timestamp);
    const chart = astronomicalEngine.calculate(utcInstantToLayer1Input(instant.toISOString(), place));
    for (const planet of ['Jupiter', 'Saturn']) daily.push({
      planet,
      sign: Math.floor(chart.bodies[planet].siderealLongitudeDegrees / 30) + 1,
      start: instant.toISOString(),
      end: new Date(timestamp + 86400000).toISOString(),
    });
  }
  const intervals = [];
  for (const item of daily) {
    const previous = intervals.at(-1);
    if (previous && previous.planet === item.planet && previous.sign === item.sign && previous.end === item.start) previous.end = item.end;
    else intervals.push(item);
  }
  return intervals;
}

class BirthCareerReadingOrchestrator {
  constructor({ astronomicalEngine, dashaRulesetId, canonicalSiderealSunSampler, careerTimingHorizonMonths = 12 } = {}) {
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function') throw new TypeError('BirthCareerReadingOrchestrator requires an injected astronomicalEngine.');
    if (dashaRulesetId !== undefined && typeof dashaRulesetId !== 'string') throw new TypeError('dashaRulesetId must be a supported string identifier when supplied.');
    if (!Number.isInteger(careerTimingHorizonMonths) || careerTimingHorizonMonths < 1 || careerTimingHorizonMonths > 24) throw new RangeError('careerTimingHorizonMonths must be between 1 and 24.');
    const isDefaultPolicy = dashaRulesetId === undefined;
    const selectedDashaRulesetId = isDefaultPolicy
      ? DEFAULT_BIRTH_CAREER_ENGINE_PROFILE.calculation.dashaRulesetId
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
    this.careerTimingHorizonMonths = careerTimingHorizonMonths;
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
    const rawAshtakavarga = calculateAshtakavargaForLayer2(layer2Bodies);
    const d10 = d10CareerStructure(birthLayer1Result);
    const natal = assembleNatalEvidenceGraph({
      layer2Bodies,
      houses,
      planetaryState: evaluatePlanetaryState({ bodies: Object.fromEntries(Object.entries(layer2Bodies).map(([body, value]) => [body, { canonicalSiderealLongitudeDegrees: value.siderealLongitudeDegrees, motion: value.motion || 'unknown' }])) }),
      vargas: { D10: d10 },
      ashtakavarga: rawAshtakavarga,
    });
    const career = buildCareerReading({
      natal,
      temporal: { instant: input.readingInstant, dasha, gochar, ...(transitEvents === undefined ? {} : { transitEvents }) },
      locale: input.locale,
      careerAshtakavargaStructure: buildCareerAshtakavargaStructure({ houses, rawAshtakavarga }),
      careerD10Structure: buildCareerD10Structure({ d10 }),
    });
    const timingHorizonEnd = addMonths(input.readingInstant, this.careerTimingHorizonMonths);
    const h10 = houses.houses.find((house) => house.houseNumber === 10);
    const h10Sav = rawAshtakavarga.rawSarvashtakavarga.rashis.find((rashi) => rashi.rashiIndex === h10.rashi.rashiIndex)?.favorableMarkCount;
    const careerTiming = buildCareerTimingPeriods({
      d1Houses: houses,
      dashaIntervals: futureDashaIntervals(dasha, timingHorizonEnd),
      transitIntervals: futureMajorTransitIntervals({ astronomicalEngine: this.astronomicalEngine, start: input.readingInstant, end: timingHorizonEnd, place: input.birth.place }),
      horizonStart: input.readingInstant,
      horizonEnd: timingHorizonEnd,
      d10Confirmation: Boolean(career.reading.careerD10Corroboration),
      h10Sav,
    });
    return freeze({
      domain: career.domain,
      locale: career.locale,
      reading: freeze({ ...career.reading, careerTimingPeriods: careerTiming.periods }),
      renderedReading: career.renderedReading,
      provenance: safeProviderProvenance(birthLayer1Result, houses, dasha, input.birth.place, providerSamplerConsistency, this.engineProfile),
    });
  }
}

module.exports = { BirthCareerReadingOrchestrator, d10CareerStructure };
