'use strict';

const { classifyLayer1Bodies } = require('../jyotish');
const { calculateRashiHouses } = require('../bhava');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../dasha');
const { calculateGocharSnapshot } = require('../gochar');
const { assembleNatalEvidenceGraph, freeze } = require('../synthesis');
const { calculateAshtakavargaForLayer2 } = require('../application/ashtakavarga');
const { buildCareerD10Structure } = require('../application/divisional-charts');
const { evaluatePlanetaryState } = require('../dignity');
const { buildCareerReading } = require('../orchestration/career-reading-orchestrator');
const { d10CareerStructure, futureMajorTransitIntervals, CAREER_TRANSIT_BOUNDARY_METHOD } = require('../orchestration/birth-career-reading-orchestrator');
const { createDevelopmentAstrology } = require('../runtime/create-development-astrology');
const { createProductionAstrology } = require('../runtime/create-production-astrology');

const PROVIDER_VERSION = 'career-v2-local-evidence-provider-v1';
const MAX_RANGE_MS = 100 * 366 * 86_400_000;
const iso = (value) => typeof value === 'string' && value.endsWith('Z') && Number.isFinite(Date.parse(value));

function validateRequest(request) {
  if (!request || Object.keys(request).some((key) => !['profileId', 'birthData', 'evaluationInstant', 'rangeStart', 'rangeEnd'].includes(key))) throw new TypeError('Local Career evidence request contains unsupported fields.');
  if (!/^PROFILE_[A-Z0-9_-]+$/.test(request.profileId || '')) throw new TypeError('Local Career evidence requires an anonymized PROFILE_* identifier.');
  const birth = request.birthData;
  if (!birth || Object.keys(birth).some((key) => !['date', 'time', 'timezone', 'latitude', 'longitude'].includes(key)) || !/^\d{4}-\d{2}-\d{2}$/.test(birth.date || '') || !/^\d{2}:\d{2}(:\d{2})?$/.test(birth.time || '') || typeof birth.timezone !== 'string' || !birth.timezone || !Number.isFinite(birth.latitude) || !Number.isFinite(birth.longitude)) throw new TypeError('Local Career evidence requires validated birthData only.');
  if (!iso(request.rangeStart) || !iso(request.rangeEnd) || Date.parse(request.rangeStart) >= Date.parse(request.rangeEnd) || Date.parse(request.rangeEnd) - Date.parse(request.rangeStart) > MAX_RANGE_MS) throw new RangeError('Local Career evidence requires a valid bounded UTC range.');
  const evaluationInstant = request.evaluationInstant || request.rangeStart;
  if (!iso(evaluationInstant)) throw new TypeError('evaluationInstant must be a UTC ISO timestamp.');
  return freeze({ profileId: request.profileId, birthData: freeze({ ...birth }), evaluationInstant, rangeStart: request.rangeStart, rangeEnd: request.rangeEnd });
}

function layer1Input(birth) { return freeze({ date: birth.date, time: birth.time, timezone: birth.timezone, latitude: birth.latitude, longitude: birth.longitude }); }
function instantInput(instant, birth) { const value = new Date(instant).toISOString(); return freeze({ date: value.slice(0, 10), time: value.slice(11, 23), timezone: 'UTC', latitude: birth.latitude, longitude: birth.longitude }); }

function dashaIntervals(tree, rangeStart, rangeEnd) {
  const output = [];
  for (const md of tree.periods) for (const ad of md.children) for (const pd of ad.children) {
    const start = pd.startInstant.utc; const end = pd.endInstant.utc;
    if (Date.parse(start) >= Date.parse(rangeEnd) || Date.parse(end) <= Date.parse(rangeStart)) continue;
    output.push(freeze({
      start, end,
      activePeriods: freeze([{ level: 'MD', lord: md.lord.name }, { level: 'AD', lord: ad.lord.name }, { level: 'PD', lord: pd.lord.name }].map(freeze)),
      provenance: freeze({ rulesetId: tree.ruleset.id, timeConventionId: tree.ruleset.timeConventionId, intervalSemantics: 'HALF_OPEN', subdivision: 'MD_AD_PD' }),
    }));
  }
  return freeze(output.sort((left, right) => left.start.localeCompare(right.start) || left.end.localeCompare(right.end)));
}

class CareerV2LocalEvidenceProvider {
  constructor({ astronomicalEngine, canonicalSiderealSunSampler, transitIntervalBuilder = futureMajorTransitIntervals } = {}) {
    if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !canonicalSiderealSunSampler || typeof canonicalSiderealSunSampler.sampleCanonicalSiderealSun !== 'function' || typeof transitIntervalBuilder !== 'function') throw new TypeError('CareerV2LocalEvidenceProvider requires approved astronomy, solar sampler, and transit interval dependencies.');
    Object.assign(this, { engine: astronomicalEngine, sampler: canonicalSiderealSunSampler, transitIntervalBuilder }); Object.freeze(this);
  }

  async provide(request) {
    const input = validateRequest(request);
    const natal = this.engine.calculate(layer1Input(input.birthData));
    const layer2Bodies = classifyLayer1Bodies(natal);
    const d1Houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
    const tree = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: this.sampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
    const rawD10 = d10CareerStructure(natal);
    const d10Structure = buildCareerD10Structure({ d10: rawD10 });
    const rawAshtakavarga = calculateAshtakavargaForLayer2(layer2Bodies);
    const natalGraph = assembleNatalEvidenceGraph({
      layer2Bodies, houses: d1Houses,
      planetaryState: evaluatePlanetaryState({ bodies: Object.fromEntries(Object.entries(layer2Bodies).map(([body, value]) => [body, { canonicalSiderealLongitudeDegrees: value.siderealLongitudeDegrees, motion: value.motion || 'unknown' }])) }),
      vargas: { D10: rawD10 }, ashtakavarga: rawAshtakavarga,
    });
    const transitChart = this.engine.calculate(instantInput(input.evaluationInstant, input.birthData));
    const gochar = calculateGocharSnapshot({ snapshotInstant: input.evaluationInstant, natalBodies: natal.bodies, natalHouses: d1Houses, transitBodies: transitChart.bodies });
    const careerReading = buildCareerReading({ natal: natalGraph, temporal: { instant: input.evaluationInstant, dasha: tree, gochar }, careerD10Structure: d10Structure });
    const transitIntervals = freeze(this.transitIntervalBuilder({ astronomicalEngine: this.engine, start: input.rangeStart, end: input.rangeEnd, place: input.birthData, natalBodies: natal.bodies, natalHouses: d1Houses }).map((item) => freeze({ ...item })).sort((left, right) => left.start.localeCompare(right.start) || left.planet.localeCompare(right.planet)));
    const provider = natal.provider || {};
    return freeze({
      d1Houses,
      dashaIntervals: dashaIntervals(tree, input.rangeStart, input.rangeEnd),
      transitIntervals,
      d10Structure,
      d10Corroboration: careerReading.reading.careerD10Corroboration || null,
      forecastStart: input.rangeStart,
      forecastEnd: input.rangeEnd,
      calculationInstant: input.evaluationInstant,
      provenance: freeze({
        providerVersion: PROVIDER_VERSION,
        astronomyProviderId: provider.providerId || null,
        astronomyVersion: provider.swissVersion || provider.version || null,
        calculationStatus: provider.calculationStatus || natal.calculationStatus || null,
        ayanamshaSystem: 'Lahiri / Chitrapaksha',
        siderealMode: provider.siderealMode || natal.sidereal && natal.sidereal.siderealMode || null,
        nodeModel: provider.nodeModel || null,
        dashaRulesetId: tree.ruleset.id,
        dashaTimeConventionId: tree.ruleset.timeConventionId,
        d10RulesetId: rawD10.rulesetId,
        transitBoundaryMethod: CAREER_TRANSIT_BOUNDARY_METHOD,
        intervalSemantics: 'HALF_OPEN',
        databaseAccess: 'NONE',
        networkAccess: 'NONE',
      }),
    });
  }
}

function createCareerV2LocalEvidenceProvider(dependencies) {
  const provider = new CareerV2LocalEvidenceProvider(dependencies);
  return provider.provide.bind(provider);
}

function createProductionCompatibleLocalCareerV2EvidenceProvider({ env = process.env, astrology = null } = {}) {
  const selected = astrology || (env.ASTRONOMY_PRODUCTION_AUTHORITY === 'swiss' ? createProductionAstrology({ env }) : createDevelopmentAstrology());
  return createCareerV2LocalEvidenceProvider({ astronomicalEngine: selected.astronomicalEngine, canonicalSiderealSunSampler: selected.canonicalSiderealSunSampler });
}

module.exports = { PROVIDER_VERSION, CareerV2LocalEvidenceProvider, createCareerV2LocalEvidenceProvider, createProductionCompatibleLocalCareerV2EvidenceProvider, dashaIntervals };
