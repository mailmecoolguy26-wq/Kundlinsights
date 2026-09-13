'use strict';

// Analysis-only. This file is intentionally not imported by production code.
const fs = require('node:fs');
const path = require('node:path');
const { AstronomyEngineProvider, AstronomicalEngine } = require('../../src/astronomy');
const { AshtakavargaService } = require('../../src/application/ashtakavarga');
const { calculateRashiHouses } = require('../../src/bhava');

const SAMPLE_SIZE = 250;
const LOCATIONS = Object.freeze([
  { latitude: 28.6139, longitude: 77.2090 }, { latitude: 19.0760, longitude: 72.8777 },
  { latitude: 12.9716, longitude: 77.5946 }, { latitude: 40.7128, longitude: -74.0060 },
  { latitude: -33.8688, longitude: 151.2093 }, { latitude: 51.5072, longitude: -0.1276 },
]);
const PLANETS = new Set(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']);

function sampleProfiles(count = SAMPLE_SIZE) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(1950 + (index * 7) % 71, (index * 5) % 12, 1 + (index * 11) % 28));
    const location = LOCATIONS[index % LOCATIONS.length];
    return { id: `research-${String(index + 1).padStart(3, '0')}`, status: 'active', birthData: {
      localDate: date.toISOString().slice(0, 10), localTime: `${String((index * 7) % 24).padStart(2, '0')}:${String((index * 13) % 60).padStart(2, '0')}:00`, timezone: 'UTC', ...location,
    } };
  });
}
function percentile(sorted, p) { if (!sorted.length) return null; return sorted[Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * p) - 1)]; }
function stats(values) {
  const sorted = [...values].sort((a, b) => a - b); const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { count: values.length, min: sorted[0], max: sorted.at(-1), mean, median: percentile(sorted, .5), standardDeviation: Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length), p10: percentile(sorted, .1), p25: percentile(sorted, .25), p50: percentile(sorted, .5), p75: percentile(sorted, .75), p90: percentile(sorted, .9), frequency: Object.fromEntries(sorted.reduce((map, value) => map.set(value, (map.get(value) || 0) + 1), new Map())) };
}
function values(records, selector) { return records.map(selector).filter(Number.isFinite); }
function split(records, selector) { return { odd: stats(values(records.filter((_, index) => index % 2 === 0), selector)), even: stats(values(records.filter((_, index) => index % 2 === 1), selector)) }; }
function houseByNumber(houses, number) { return houses.houses.find((item) => item.houseNumber === number) || null; }
function countedHouse(fromHouse, ordinal) { return Number.isInteger(fromHouse) && fromHouse >= 1 && fromHouse <= 12 && Number.isInteger(ordinal) && ordinal >= 1 ? ((fromHouse + ordinal - 2) % 12) + 1 : null; }
function candidateStructure({ houses, sav }) {
  const assignmentByBody = new Map(houses.planetaryAssignments.map((item) => [item.body, item]));
  const scoreForHouse = (number) => {
    const house = houseByNumber(houses, number);
    return house ? sav.get(house.rashi.rashiIndex) ?? null : null;
  };
  const structureFor = (number) => {
    const house = houseByNumber(houses, number);
    const lord = house?.rashiHouseLord?.name || null;
    const lordHouse = lord ? assignmentByBody.get(lord)?.rashiHouseNumber ?? null : null;
    return { house: number, sav: scoreForHouse(number), lord, lordHouse, lordHouseSav: scoreForHouse(lordHouse) };
  };
  const h10 = structureFor(10);
  const h7 = structureFor(7);
  const tenthFromH10LordHouse = countedHouse(h10.lordHouse, 10);
  return Object.freeze({
    h10Sav: h10.sav,
    h10Lord: h10.lord,
    h10LordHouse: h10.lordHouse,
    h10LordHouseSav: h10.lordHouseSav,
    h7Sav: h7.sav,
    h7Lord: h7.lord,
    h7LordHouse: h7.lordHouse,
    h7LordHouseSav: h7.lordHouseSav,
    tenthFromH10LordHouse,
    tenthFromH10LordHouseSav: scoreForHouse(tenthFromH10LordHouse),
  });
}
function referenceBands(records, selector) {
  const source = values(records, selector);
  return Object.fromEntries([27, 28, 29, 30].map((reference) => [reference, {
    below: source.filter((value) => value < reference).length,
    equal: source.filter((value) => value === reference).length,
    above: source.filter((value) => value > reference).length,
    atOrAbove: source.filter((value) => value >= reference).length,
  }]));
}
function compactRecord(record) {
  if (!record) return null;
  const { fixtureId, ascendantSign, candidate } = record;
  return { fixtureId, ascendantSign, candidate };
}
function representativeRecords(records) {
  const spread = (record) => stats(record.allSav).standardDeviation;
  const highCount = (record) => record.allSav.filter((value) => value >= 31).length;
  const lowCount = (record) => record.allSav.filter((value) => value < 25).length;
  const others = (record) => [record.candidate.h10LordHouseSav, record.candidate.h7Sav, record.candidate.h7LordHouseSav, record.candidate.tenthFromH10LordHouseSav].filter(Number.isFinite);
  const average = (items) => items.length ? items.reduce((sum, item) => sum + item, 0) / items.length : null;
  return {
    lowestSpread: compactRecord([...records].sort((left, right) => spread(left) - spread(right))[0]),
    broadestHighDistribution: compactRecord([...records].sort((left, right) => highCount(right) - highCount(left))[0]),
    broadestLowDistribution: compactRecord([...records].sort((left, right) => lowCount(right) - lowCount(left))[0]),
    h10HighOtherFactorsLow: compactRecord([...records].filter((record) => record.candidate.h10Sav >= 31 && average(others(record)) < 28).sort((left, right) => left.fixtureId.localeCompare(right.fixtureId))[0]),
    h10LowOtherFactorsHigh: compactRecord([...records].filter((record) => record.candidate.h10Sav < 25 && average(others(record)) > 28).sort((left, right) => left.fixtureId.localeCompare(right.fixtureId))[0]),
  };
}
async function collect({ count = SAMPLE_SIZE } = {}) {
  const profiles = sampleProfiles(count); const byId = new Map(profiles.map((profile) => [profile.id, profile]));
  const engine = new AstronomicalEngine(new AstronomyEngineProvider());
  const service = new AshtakavargaService({ birthProfileService: { get: async ({ birthProfileId }) => byId.get(birthProfileId) }, astronomicalEngine: engine });
  const records = [];
  for (const profile of profiles) {
    const natal = engine.calculate({ date: profile.birthData.localDate, time: profile.birthData.localTime, timezone: profile.birthData.timezone, latitude: profile.birthData.latitude, longitude: profile.birthData.longitude });
    const houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
    const ashtakavarga = await service.get({ principal: { research: true }, birthProfileId: profile.id });
    const sav = new Map(ashtakavarga.sav.signScores.map((item) => [item.sign.rashiIndex, item.score]));
    const lagna = new Map(ashtakavarga.lagnaBav.signScores.map((item) => [item.sign.rashiIndex, item.score]));
    const bav = new Map(ashtakavarga.bav.map((item) => [item.body, new Map(item.signScores.map((score) => [score.sign.rashiIndex, score.score]))]));
    const house = (number) => houses.houses.find((item) => item.houseNumber === number);
    const h10 = house(10); const occupants = houses.planetaryAssignments.filter((item) => item.rashiHouseNumber === 10 && PLANETS.has(item.body)).map((item) => item.body);
    const candidate = candidateStructure({ houses, sav });
    records.push({ fixtureId: profile.id, ascendantSign: houses.ascendant.rashi.rashiIndex, h10Sign: h10.rashi.rashiIndex, h10Lord: h10.rashiHouseLord.name, h10Occupants: occupants, h2Sav: sav.get(house(2).rashi.rashiIndex), h10Sav: sav.get(h10.rashi.rashiIndex), h11Sav: sav.get(house(11).rashi.rashiIndex), allSav: [...sav.values()], h2LagnaBav: lagna.get(house(2).rashi.rashiIndex), h10LagnaBav: lagna.get(h10.rashi.rashiIndex), h11LagnaBav: lagna.get(house(11).rashi.rashiIndex), h10LordBavAtH10: bav.get(h10.rashiHouseLord.name).get(h10.rashi.rashiIndex), h10OccupantBavAtH10: occupants.map((body) => ({ body, value: bav.get(body).get(h10.rashi.rashiIndex) })), chartMedianSav: percentile([...sav.values()].sort((a, b) => a - b), .5), candidate });
  }
  return records;
}
function audit(records) {
  const distributions = { h2Sav: stats(values(records, (item) => item.h2Sav)), h10Sav: stats(values(records, (item) => item.h10Sav)), h11Sav: stats(values(records, (item) => item.h11Sav)), allSav: stats(records.flatMap((item) => item.allSav)), h10LordBavAtH10: stats(values(records, (item) => item.h10LordBavAtH10)), h2LagnaBav: stats(values(records, (item) => item.h2LagnaBav)), h10LagnaBav: stats(values(records, (item) => item.h10LagnaBav)), h11LagnaBav: stats(values(records, (item) => item.h11LagnaBav)), h10LordHouseSav: stats(values(records, (item) => item.candidate?.h10LordHouseSav)), h7Sav: stats(values(records, (item) => item.candidate?.h7Sav)), h7LordHouseSav: stats(values(records, (item) => item.candidate?.h7LordHouseSav)), tenthFromH10LordHouseSav: stats(values(records, (item) => item.candidate?.tenthFromH10LordHouseSav)) };
  return { sample: { count: records.length, construction: 'deterministic explicit UTC dates/times with six global WGS84 locations; AstronomyEngineProvider plus production AshtakavargaService' }, engineRanges: { rawBavAndLagnaBav: '0..8 per rashi (eight contributors)', rawSav: '0..56 mathematically; fixed total 337 across 12 rashis' }, distributions, splitSample: { h2Sav: split(records, (item) => item.h2Sav), h10Sav: split(records, (item) => item.h10Sav), h11Sav: split(records, (item) => item.h11Sav), h10LordBavAtH10: split(records, (item) => item.h10LordBavAtH10) }, candidatePolicies: [
    { policy: 'global absolute SAV/BAV cutoff', classification: 'REJECT', rationale: 'No repository-vetted threshold policy; sample percentiles are descriptive only and do not establish polarity.' },
    { policy: 'within-chart H10 SAV above chart median', classification: 'RESEARCH_FURTHER', rationale: 'Ordinal and chart-relative, but static natal context cannot establish event timing or outcome polarity.' },
    { policy: 'H10 top-three SAV within chart', classification: 'RESEARCH_FURTHER', rationale: 'Interpretable relative descriptor only; requires independent outcome validation before product use.' },
  ], candidateStructure: { calculationOnly: true, factors: ['h10Sav', 'h10LordHouseSav', 'h7Sav', 'h7LordHouseSav', 'tenthFromH10LordHouseSav'], distributions: { h10Sav: distributions.h10Sav, h10LordHouseSav: distributions.h10LordHouseSav, h7Sav: distributions.h7Sav, h7LordHouseSav: distributions.h7LordHouseSav, tenthFromH10LordHouseSav: distributions.tenthFromH10LordHouseSav }, referenceBands: { h10Sav: referenceBands(records, (item) => item.candidate?.h10Sav), h10LordHouseSav: referenceBands(records, (item) => item.candidate?.h10LordHouseSav), h7Sav: referenceBands(records, (item) => item.candidate?.h7Sav), h7LordHouseSav: referenceBands(records, (item) => item.candidate?.h7LordHouseSav), tenthFromH10LordHouseSav: referenceBands(records, (item) => item.candidate?.tenthFromH10LordHouseSav) }, representatives: representativeRecords(records) }, careerEventAnalysis: { usableEventSnapshots: 0, conclusion: 'Repository fixtures exercise event snapshot mechanics but provide no de-identified multi-profile, repeated historical cohort suitable for correlation analysis.' }, withinPersonRecurrence: 'Not assessable from available fixtures. Natal SAV/BAV is static per profile, so repeated events for one person are not independent confirmations and cannot support timing inference.', independence: 'Ashtakavarga originates from a separate deterministic natal calculation, but this audit contains no validated outcome labels; it remains structural corroborating context, not timing evidence.', recommendation: { option: 'A', label: 'NO THRESHOLD POLICY', rationale: 'The deterministic sample establishes engine distributions, not empirical career-outcome validity. Keep raw technical context only.' }, limitations: ['Astronomy Engine provider is provisional, not licensed Swiss production authority.', 'Synthetic deterministic sample is not a real user cohort.', 'No sufficiently sized de-identified career-event outcome dataset is present in repository fixtures.'] };
}
async function run({ outputPath = path.join(process.cwd(), 'tmp', 'ashtakavarga-career-audit.json'), count = SAMPLE_SIZE } = {}) { const result = audit(await collect({ count })); fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`); return { outputPath, result }; }
if (require.main === module) run().then(({ outputPath, result }) => console.log(JSON.stringify({ outputPath, sampleSize: result.sample.count, recommendation: result.recommendation }, null, 2)));
module.exports = { sampleProfiles, collect, audit, run, candidateStructure, countedHouse, referenceBands };
