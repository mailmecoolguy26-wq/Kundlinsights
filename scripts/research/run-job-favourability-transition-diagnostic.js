'use strict';

// Private, descriptive inspection of curated historical transitions. This is
// not a backtest predicate, scoring model, or production method.
const fs = require('node:fs');
const path = require('node:path');
const { createDevelopmentAstrology } = require('../../src/runtime/create-development-astrology');
const { normalizeJobFavourabilityPrivateCohort } = require('../../src/application/research/job-favourability-private-cohort-intake');
const { buildJobFavourabilityCohort } = require('../../src/application/research/job-favourability-cohort-builder');
const { PRIVATE_ARTIFACT_ROOT, privateDirectory } = require('../../src/application/research/job-favourability-report');
const { calculateRashiHouses } = require('../../src/bhava');
const { calculateVimshottariDasha, SOLAR_RETURN_VIMSHOTTARI_RULESET } = require('../../src/dasha');

const INPUT = path.join(PRIVATE_ARTIFACT_ROOT, 'JOB-FAVOURABILITY-CURATED-COHORT.json');
const OUTPUT = 'JOB-FAVOURABILITY-TRANSITION-DIAGNOSTIC';
const WORK_HOUSES = Object.freeze([2, 6, 10, 11]);
const PRE_HORIZONS = Object.freeze(['PRE_30', 'PRE_60', 'PRE_90']);
const BODY_NAMES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);
function safeText(value) { return value === null || value === undefined ? 'NOT AVAILABLE' : String(value); }
function bodyKey(value) { return typeof value === 'string' ? value.toLowerCase() : ''; }
function interval(value) { return value && typeof value.start === 'string' && typeof value.end === 'string' && Date.parse(value.start) < Date.parse(value.end); }
function intersects(left, right) { return interval(left) && interval(right) && Date.parse(left.start) < Date.parse(right.end) && Date.parse(right.start) < Date.parse(left.end); }
function mapHouses(d1) { return new Map((d1.houses || []).map((item) => [item.houseNumber, item])); }
function assignments(d1) { return new Map((d1.planetaryAssignments || []).map((item) => [bodyKey(item.body), item])); }
function lord(house) { return typeof (house && house.rashiHouseLord) === 'string' ? house.rashiHouseLord : house && house.rashiHouseLord && house.rashiHouseLord.name || null; }
function activeDashaAt(intervals, coverage) {
  const active = (intervals || []).filter((item) => intersects(item, coverage)).flatMap((item) => item.activePeriods || []);
  const level = (value) => [...new Set(active.filter((item) => item.level === value).map((item) => item.lord))].sort();
  return { md: level('MD'), ad: level('AD'), pd: level('PD') };
}
function natalAndDasha(profile, astrology) {
  const natal = astrology.astronomicalEngine.calculate({ date: profile.birth.localDate, time: profile.birth.localTime, timezone: profile.birth.timezone, latitude: profile.birth.latitude, longitude: profile.birth.longitude });
  const d1Houses = calculateRashiHouses({ ascendantCanonicalSiderealLongitude: natal.bodies.Ascendant.siderealLongitudeDegrees, bodies: natal.bodies });
  const dasha = calculateVimshottariDasha({ birthInstant: natal.instant.utc, moonCanonicalSiderealLongitude: natal.bodies.Moon.siderealLongitudeDegrees, natalSunCanonicalSiderealLongitude: natal.bodies.Sun.siderealLongitudeDegrees, canonicalSiderealSunSampler: astrology.canonicalSiderealSunSampler, rulesetId: SOLAR_RETURN_VIMSHOTTARI_RULESET.id });
  const intervals = [];
  for (const md of dasha.periods) for (const ad of md.children) for (const pd of ad.children) intervals.push({ start: pd.startInstant.utc, end: pd.endInstant.utc, activePeriods: [{ level: 'MD', lord: md.lord.id }, { level: 'AD', lord: ad.lord.id }, { level: 'PD', lord: pd.lord.id }] });
  return { d1Houses, dashaIntervals: intervals };
}
function bodyFacts(bodies, d1) {
  const byHouse = mapHouses(d1); const byBody = assignments(d1); const lords = Object.fromEntries(WORK_HOUSES.map((house) => [`h${house}`, lord(byHouse.get(house))]));
  const one = (body) => {
    const placement = byBody.get(bodyKey(body)); const occupied = placement && placement.rashiHouseNumber || null;
    const owns = Object.fromEntries(WORK_HOUSES.map((house) => [`h${house}`, bodyKey(lords[`h${house}`]) === bodyKey(body)]));
    const sharesRashiWithLords = Object.fromEntries(WORK_HOUSES.map((house) => {
      const houseLord = lords[`h${house}`]; const lordPlacement = byBody.get(bodyKey(houseLord));
      return [`h${house}`, Boolean(placement && lordPlacement && placement.rashi && lordPlacement.rashi && placement.rashi.rashiIndex === lordPlacement.rashi.rashiIndex)];
    }));
    return { body, natalHouse: occupied, rules: owns, occupies: Object.fromEntries(WORK_HOUSES.map((house) => [`h${house}`, occupied === house])), sameRashiWithHouseLord: sharesRashiWithLords };
  };
  return Object.fromEntries(bodies.map((body) => [body, one(body)]));
}
function natalFacts(d1) {
  const byHouse = mapHouses(d1); const byBody = assignments(d1);
  const house = (number) => ({ lord: lord(byHouse.get(number)), occupants: [...byBody.values()].filter((item) => item.rashiHouseNumber === number).map((item) => item.body).sort() });
  const selected = Object.fromEntries(WORK_HOUSES.map((number) => [`h${number}`, house(number)]));
  const allLords = Object.values(selected).map((item) => item.lord).filter(Boolean);
  return { ascendant: d1.ascendant && d1.ascendant.rashi && d1.ascendant.rashi.rashiIndex || null, ...selected, sharedLordIdentities: [...new Set(allLords.filter((body) => allLords.filter((item) => item === body).length > 1))].sort() };
}
function houseAshtakavarga(raw, d1) {
  if (!raw || !raw.rawSarvashtakavarga || !raw.planetaryBavs) return null;
  const houses = mapHouses(d1); const score = (source, sign) => { const item = source && source.rashis && source.rashis.find((row) => row.rashiIndex === sign); return item ? item.favorableMarkCount : null; };
  return Object.fromEntries(WORK_HOUSES.map((number) => {
    const house = houses.get(number); const sign = house && house.rashi && house.rashi.rashiIndex; const houseLord = lord(house);
    return [`h${number}`, { sign, sav: score(raw.rawSarvashtakavarga, sign), lord: houseLord, lordBav: houseLord && raw.planetaryBavs[houseLord] ? score(raw.planetaryBavs[houseLord], sign) : null }];
  }));
}
function compactD10(d10) {
  if (!d10 || !Array.isArray(d10.houses)) return null;
  const h10 = d10.houses.find((item) => item.houseNumber === 10);
  const bodies = d10.bodies && typeof d10.bodies === 'object' ? d10.bodies : {};
  const h10Lord = h10 && lord(h10);
  return { ascendant: d10.ascendant || null, h10: h10 || null, h10LordPlacement: h10Lord ? bodies[Object.keys(bodies).find((body) => bodyKey(body) === bodyKey(h10Lord))] || null : null, h10Occupants: Object.entries(bodies).filter(([, item]) => item && item.rashiHouseNumber === 10).map(([body, item]) => ({ body, ...item })) };
}
function unique(values) { return [...new Map(values.map((item) => [JSON.stringify(item), item])).values()]; }
function transitAt(transitIntervals, coverage) { return Object.fromEntries(BODY_NAMES.map((body) => [body, unique((transitIntervals || []).filter((item) => item.planet === body && intersects(item, coverage)).map((item) => ({ natalHouse: item.natalHouse || null, sign: item.sign, start: item.start, end: item.end }))) ])); }
function ingressIn(events, coverage) { return unique((events || []).filter((item) => BODY_NAMES.includes(item.body) && Date.parse(item.instant) >= Date.parse(coverage.start) && Date.parse(item.instant) < Date.parse(coverage.end)).map((item) => ({ body: item.body, eventType: item.eventType, instant: item.instant, fromRashi: item.fromRashi && item.fromRashi.rashiIndex || item.fromRashi || null, toRashi: item.toRashi && item.toRashi.rashiIndex || item.toRashi || null }))); }
function month(anchor, timezone) {
  if (!anchor || anchor.precision !== 'MONTH') return null;
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit' }).formatToParts(new Date(anchor.coverage.start)).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}
function anchorDiagnostic(anchor, enriched, timezone) {
  const precision = anchor.precision;
  const coverage = anchor.coverage;
  const dasha = activeDashaAt(enriched.dashaIntervals, coverage);
  return { observationType: anchor.observationType, month: month(anchor, timezone), precision, coverage, dasha: { md: dasha.md, ad: dasha.ad, pd: precision === 'DAY' ? dasha.pd : 'NOT_APPLICABLE' }, dashaPlanetFacts: { md: bodyFacts(dasha.md, enriched.d1Houses), ad: bodyFacts(dasha.ad, enriched.d1Houses), ...(precision === 'DAY' ? { pd: bodyFacts(dasha.pd, enriched.d1Houses) } : {}) }, transits: transitAt(enriched.transitIntervals, coverage) };
}
function rowsForPre(anchor, enriched) {
  const start = Date.parse(anchor.coverage.start);
  const days = { PRE_30: 30, PRE_60: 60, PRE_90: 90 };
  return Object.fromEntries(PRE_HORIZONS.map((id) => {
    const coverage = { start: new Date(start - (days[id] * 86400000)).toISOString(), end: anchor.coverage.start };
    return [id, { coverage, refinedIngressReentryEvents: ingressIn(enriched.transitEvents, coverage) }];
  }));
}
function transitionUnits(cohort) { return cohort.units.filter((unit) => unit.unitKind === 'EMPLOYMENT_TRANSITION'); }
function transitionDiagnostic(unit, factual, featureRows, timezone) {
  const unitRows = featureRows.filter((row) => row.unitId === unit.unitId);
  const sample = unitRows[0] || {};
  const transitIntervals = unitRows.flatMap((row) => Object.entries(row.transits || {}).flatMap(([planet, item]) => (item && item.values || []).map((value) => ({ ...value, planet: `${planet.slice(0, 1).toUpperCase()}${planet.slice(1)}` }))));
  const transitEvents = unitRows.flatMap((row) => row.refinedTransitFacts && row.refinedTransitFacts.values || []);
  const enriched = { ...factual, transitIntervals, transitEvents, d10Facts: sample.d10 && sample.d10.values, ashtakavargaFacts: sample.ashtakavarga && sample.ashtakavarga.values, moonSupportFacts: sample.moon && sample.moon.values };
  const anchors = unit.anchors.map((anchor) => ({ ...anchorDiagnostic(anchor, enriched, timezone), preWindows: rowsForPre(anchor, enriched) }));
  const offer = anchors.find((item) => item.observationType === 'OFFER') || null;
  const joining = anchors.find((item) => item.observationType === 'JOINING') || null;
  return { unitId: unit.unitId, eventFamily: unit.eventFamily, offerObservationMonth: offer && offer.month, joiningObservationMonth: joining && joining.month, anchors, natal: natalFacts(enriched.d1Houses), d10: compactD10(enriched.d10Facts), ashtakavarga: houseAshtakavarga(enriched.ashtakavargaFacts, enriched.d1Houses), moon: enriched.moonSupportFacts || null };
}
function factsForTransition(item) {
  const anchor = item.anchors[0]; const facts = {};
  for (const level of ['md', 'ad']) for (const body of anchor.dasha[level] || []) {
    const itemFacts = anchor.dashaPlanetFacts[level][body] || {};
    for (const house of WORK_HOUSES) {
      facts[`${level.toUpperCase()} rules H${house}`] = facts[`${level.toUpperCase()} rules H${house}`] || itemFacts.rules && itemFacts.rules[`h${house}`] === true;
      facts[`${level.toUpperCase()} occupies H${house}`] = facts[`${level.toUpperCase()} occupies H${house}`] || itemFacts.occupies && itemFacts.occupies[`h${house}`] === true;
    }
  }
  for (const body of BODY_NAMES) for (const house of WORK_HOUSES) facts[`${body} in H${house}`] = anchor.transits[body].some((item) => item.natalHouse === house);
  for (const id of PRE_HORIZONS) facts[`transit ingress within ${id}`] = anchor.preWindows[id].refinedIngressReentryEvents.length > 0;
  return facts;
}
function occurrenceMatrix(transitions, controls) {
  const transitionFacts = transitions.map(factsForTransition); const controlFacts = controls.map(factsForTransition);
  const names = [...new Set(transitionFacts.flatMap((item) => Object.keys(item)))].sort();
  const rows = names.map((fact) => ({ fact, transitions: transitionFacts.map((item) => item[fact] === true), transitionCount: transitionFacts.filter((item) => item[fact] === true).length, temporalControls: controlFacts.map((item) => item[fact] === true), temporalControlCount: controlFacts.filter((item) => item[fact] === true).length }));
  return { transitionLabels: transitions.map((item) => item.unitId), temporalControlLabels: controls.map((item) => item.unitId), rows };
}
function render(report) {
  const lines = ['# Job Favourability transition diagnostic', '', 'Status: PRIVATE FACTUAL DIAGNOSTIC ONLY. It does not use POSSIBLE_CAREER_ACTIVITY_SIGNAL, infer a job outcome, create a rule, or produce a customer period.', ''];
  for (const item of report.transitions) {
    lines.push(`## ${item.unitId}`, `- Event family: ${item.eventFamily}`, `- Offer month: ${safeText(item.offerObservationMonth)}`, `- Joining month: ${safeText(item.joiningObservationMonth)}`, `- Natal: ${JSON.stringify(item.natal)}`, `- D10 factual structure: ${JSON.stringify(item.d10)}`, `- H2/H6/H10/H11 SAV/BAV: ${JSON.stringify(item.ashtakavarga)}`, `- Moon factual support: ${JSON.stringify(item.moon)}`);
    for (const anchor of item.anchors) lines.push(`### ${anchor.observationType}`, `- Coverage: ${anchor.coverage.start} to ${anchor.coverage.end}`, `- Dasha: ${JSON.stringify(anchor.dasha)}`, `- Dasha relationships/placements: ${JSON.stringify(anchor.dashaPlanetFacts)}`, `- Transit natal houses: ${JSON.stringify(anchor.transits)}`, ...PRE_HORIZONS.map((id) => `- ${id}: ${anchor.preWindows[id].coverage.start} to ${anchor.preWindows[id].coverage.end}; ingress/re-entry events=${JSON.stringify(anchor.preWindows[id].refinedIngressReentryEvents)}`));
    lines.push('');
  }
  lines.push('## Cross-transition occurrence matrix', '', '| Fact | Count | Temporal controls |', '| --- | ---: | ---: |');
  for (const row of report.occurrenceMatrix.rows) lines.push(`| ${row.fact} | ${row.transitionCount}/${report.transitions.length} | ${row.temporalControlCount}/${report.occurrenceMatrix.temporalControlLabels.length} |`);
  const groups = { '5/5': [], '4/5': [], '3/5': [], '<=2/5': [] };
  for (const row of report.occurrenceMatrix.rows) groups[row.transitionCount === report.transitions.length ? '5/5' : row.transitionCount === 4 ? '4/5' : row.transitionCount === 3 ? '3/5' : '<=2/5'].push(row);
  lines.push('', '## Pattern summary'); for (const [label, rows] of Object.entries(groups)) lines.push(`- ${label}: ${rows.map((row) => `${row.fact}${row.temporalControlCount ? ` (also ${row.temporalControlCount}/${report.occurrenceMatrix.temporalControlLabels.length} temporal controls)` : ''}`).join('; ') || 'NONE'}`);
  return `${lines.join('\n')}\n`;
}
function run({ inputPath = INPUT, outputName = OUTPUT } = {}) {
  const input = JSON.parse(fs.readFileSync(privateDirectory(path.resolve(inputPath)), 'utf8'));
  const curated = normalizeJobFavourabilityPrivateCohort(input); const astrology = createDevelopmentAstrology();
  const featureRowsPath = path.join(PRIVATE_ARTIFACT_ROOT, 'JOB-FAVOURABILITY-CURATED-COHORT-REPORT-FEATURE-ROWS.json');
  const featureRows = JSON.parse(fs.readFileSync(privateDirectory(featureRowsPath), 'utf8'));
  const researchProfiles = curated.profiles.map((profile) => ({ birthProfileId: profile.pseudonymousProfileId, events: profile.canonicalEvents }));
  const cohort = buildJobFavourabilityCohort({ profiles: researchProfiles, cohortSalt: curated.cohortSalt });
  const transitions = []; const controls = [];
  for (const profile of curated.profiles) {
    const factual = natalAndDasha(profile, astrology);
    const ownUnits = cohort.units.filter((unit) => unit.profileId === profile.pseudonymousProfileId);
    transitions.push(...transitionUnits({ units: ownUnits }).map((unit) => transitionDiagnostic(unit, factual, featureRows, profile.birth.timezone)));
    controls.push(...ownUnits.filter((unit) => unit.unitKind === 'TEMPORAL_CONTROL').map((unit) => transitionDiagnostic(unit, factual, featureRows, profile.birth.timezone)));
  }
  const report = { diagnosticVersion: 'taraverse-job-favourability-transition-diagnostic-v1', status: 'PRIVATE_FACTUAL_DIAGNOSTIC_ONLY', genericCareerSignalUsed: false, transitions, temporalControls: controls, occurrenceMatrix: occurrenceMatrix(transitions, controls) };
  const directory = privateDirectory(); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(directory, `${outputName}.json`); const markdownPath = path.join(directory, `${outputName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }); fs.writeFileSync(markdownPath, render(report), { mode: 0o600 });
  return { report, paths: { jsonPath, markdownPath } };
}
if (require.main === module) { const result = run({ inputPath: process.argv[2] || INPUT }); console.log(JSON.stringify({ transitions: result.report.transitions.length, temporalControls: result.report.temporalControls.length, paths: result.paths }, null, 2)); }
module.exports = { activeDashaAt, bodyFacts, occurrenceMatrix, run };
