'use strict';

// Private descriptive pair diagnostic. It reads the already-generated factual
// transition diagnostic and does not calculate, score, or promote astrology.
const fs = require('node:fs');
const path = require('node:path');
const { PRIVATE_ARTIFACT_ROOT, privateDirectory } = require('../../src/application/research/job-favourability-report');

const INPUT = path.join(PRIVATE_ARTIFACT_ROOT, 'JOB-FAVOURABILITY-TRANSITION-DIAGNOSTIC.json');
const OUTPUT = 'JOB-FAVOURABILITY-COMBINATION-DIAGNOSTIC';
const WORK_HOUSES = Object.freeze([2, 6, 10, 11]);
const BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);
const PRE = Object.freeze(['PRE_30', 'PRE_60', 'PRE_90']);

function unique(values) { return [...new Set(values)].sort(); }
function firstAnchor(item) { return item && Array.isArray(item.anchors) ? item.anchors[0] || null : null; }
function factMap(item) {
  const anchor = firstAnchor(item); const values = new Set(); if (!anchor) return values;
  for (const level of ['md', 'ad']) for (const body of anchor.dasha[level] || []) {
    const facts = anchor.dashaPlanetFacts[level] && anchor.dashaPlanetFacts[level][body]; if (!facts) continue;
    for (const house of WORK_HOUSES) {
      if (facts.rules && facts.rules[`h${house}`] === true) values.add(`${level.toUpperCase()}_RULES_H${house}`);
      if (facts.occupies && facts.occupies[`h${house}`] === true) values.add(`${level.toUpperCase()}_OCCUPIES_H${house}`);
    }
  }
  for (const body of BODIES) for (const transit of anchor.transits[body] || []) if (WORK_HOUSES.includes(transit.natalHouse)) values.add(`${body.toUpperCase()}_IN_H${transit.natalHouse}`);
  for (const horizon of PRE) if (anchor.preWindows && anchor.preWindows[horizon] && (anchor.preWindows[horizon].refinedIngressReentryEvents || []).length) values.add(`INGRESS_IN_${horizon}`);
  // These are static natal/D10/support facts, deliberately retained as facts;
  // their occurrence in controls makes their lack of discrimination visible.
  const d10 = item.d10 || {}; const h10 = d10.h10; const placement = d10.h10LordPlacement;
  if (h10 && h10.rashi && Number.isInteger(h10.rashi.rashiIndex)) values.add(`D10_H10_SIGN_${h10.rashi.rashiIndex}`);
  if (placement && WORK_HOUSES.includes(placement.rashiHouseNumber)) values.add(`D10_H10_LORD_IN_H${placement.rashiHouseNumber}`);
  for (const occupant of d10.h10Occupants || []) values.add(`D10_H10_OCCUPANT_${String(occupant.body).toUpperCase()}`);
  for (const house of WORK_HOUSES) {
    const av = item.ashtakavarga && item.ashtakavarga[`h${house}`];
    if (av && Number.isInteger(av.sav)) values.add(`H${house}_SAV_${av.sav}`);
    if (av && Number.isInteger(av.lordBav)) values.add(`H${house}_LORD_BAV_${av.lordBav}`);
    const natalHouse = item.natal && item.natal[`h${house}`];
    if (natalHouse && natalHouse.lord) values.add(`NATAL_H${house}_LORD_${String(natalHouse.lord).toUpperCase()}`);
  }
  if (item.moon && item.moon.jupiterSupportive === true) values.add('MOON_JUPITER_SUPPORTIVE_FACT');
  if (item.moon && item.moon.saturnSupportive === true) values.add('MOON_SATURN_SUPPORTIVE_FACT');
  return values;
}
function family(feature) {
  if (/^(?:MD|AD)_(?:RULES|OCCUPIES)_H/.test(feature)) return 'DASHA_HOUSE';
  if (/^(?:JUPITER|SATURN|RAHU|KETU)_IN_H/.test(feature)) return 'TRANSIT_HOUSE';
  if (feature.startsWith('INGRESS_')) return 'INGRESS';
  if (feature.startsWith('D10_')) return 'D10';
  if (feature.startsWith('H') && /_(?:SAV|LORD_BAV)_/.test(feature)) return 'ASHTAKAVARGA';
  if (feature.startsWith('NATAL_H')) return 'NATAL_AXIS';
  if (feature.startsWith('MOON_')) return 'MOON';
  return 'OTHER';
}
// The allowed registry is intentionally small and matches the owner-requested
// pair families. It is not an arbitrary all-planets/all-houses search.
function allowedPair(left, right) {
  const a = family(left); const b = family(right);
  if (a === 'DASHA_HOUSE' && (b === 'TRANSIT_HOUSE' || b === 'INGRESS')) return true;
  if (b === 'DASHA_HOUSE' && (a === 'TRANSIT_HOUSE' || a === 'INGRESS')) return true;
  if (a === 'D10' && b === 'TRANSIT_HOUSE') return true;
  if (b === 'D10' && a === 'TRANSIT_HOUSE') return true;
  if (a === 'NATAL_AXIS' && b === 'TRANSIT_HOUSE') return true;
  if (b === 'NATAL_AXIS' && a === 'TRANSIT_HOUSE') return true;
  return false;
}
function label(item) { return item.unitId; }
function pairRows(transitions, temporalControls, careerControls) {
  const allFeatures = unique([...transitions, ...temporalControls, ...careerControls].flatMap((item) => [...factMap(item)]));
  const pairs = [];
  for (let i = 0; i < allFeatures.length; i += 1) for (let j = i + 1; j < allFeatures.length; j += 1) {
    const facts = [allFeatures[i], allFeatures[j]]; if (!allowedPair(...facts)) continue;
    const contains = (item) => facts.every((fact) => factMap(item).has(fact));
    const transitionUnits = transitions.filter(contains).map(label); const temporalUnits = temporalControls.filter(contains).map(label); const careerUnits = careerControls.filter(contains).map(label);
    pairs.push({ facts, transitionCount: transitionUnits.length, temporalControlCount: temporalUnits.length, careerControlCount: careerUnits.length, transitions: transitionUnits, temporalControls: temporalUnits, careerControls: careerUnits });
  }
  return pairs.sort((a, b) => b.transitionCount - a.transitionCount || a.temporalControlCount - b.temporalControlCount || a.facts.join('|').localeCompare(b.facts.join('|')));
}
function render(report) {
  const lines = ['# Job Favourability combination diagnostic', '', 'Status: PRIVATE FACTUAL COMBINATION DIAGNOSTIC ONLY. No customer period, predictive assertion, score, generic Career signal, recurrence, or rule selection is present.', '', `Allowed pair registry: ${report.allowedPairFamilies.join(' × ')}`, '', '| Pair | Transitions | Temporal controls | Career controls | Transition units | Temporal-control units |', '| --- | ---: | ---: | --- | --- | --- |'];
  for (const row of report.pairs) lines.push(`| ${row.facts.join(' + ')} | ${row.transitionCount}/${report.transitionCount} | ${row.temporalControlCount}/${report.temporalControlCount} | ${row.careerControlCount}/${report.careerControlCount} | ${row.transitions.join(', ') || 'NONE'} | ${row.temporalControls.join(', ') || 'NONE'} |`);
  lines.push('', `Stop condition met: ${report.stopConditionMet ? 'YES — NO_USEFUL_ORDER_2_PATTERN_IN_OWNER_PROFILE' : 'NO'}`);
  return `${lines.join('\n')}\n`;
}
function run({ inputPath = INPUT, outputName = OUTPUT } = {}) {
  const input = JSON.parse(fs.readFileSync(privateDirectory(path.resolve(inputPath)), 'utf8'));
  const transitions = input.transitions || []; const temporalControls = input.temporalControls || []; const careerControls = input.careerControls || [];
  const pairs = pairRows(transitions, temporalControls, careerControls);
  const useful = pairs.filter((row) => row.transitionCount >= 3 && row.temporalControlCount <= 1);
  const report = { diagnosticVersion: 'taraverse-job-favourability-combination-diagnostic-v1', status: 'PRIVATE_FACTUAL_COMBINATION_DIAGNOSTIC_ONLY', genericCareerSignalUsed: false, interactionOrderMaximum: 2, allowedPairFamilies: ['DASHA_HOUSE × TRANSIT_HOUSE', 'DASHA_HOUSE × INGRESS', 'D10 × TRANSIT_HOUSE', 'NATAL_AXIS × TRANSIT_HOUSE'], transitionCount: transitions.length, temporalControlCount: temporalControls.length, careerControlCount: careerControls.length, pairs, usefulOrder2Pairs: useful, stopConditionMet: useful.length === 0, conclusion: useful.length === 0 ? 'NO_USEFUL_ORDER_2_PATTERN_IN_OWNER_PROFILE' : 'ORDER_2_FACTUAL_PAIRS_REQUIRE_SEPARATE_REPLICATION_REVIEW' };
  const directory = privateDirectory(); fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(directory, `${outputName}.json`); const markdownPath = path.join(directory, `${outputName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }); fs.writeFileSync(markdownPath, render(report), { mode: 0o600 });
  return { report, paths: { jsonPath, markdownPath } };
}
if (require.main === module) { const result = run({ inputPath: process.argv[2] || INPUT }); console.log(JSON.stringify({ pairCount: result.report.pairs.length, usefulOrder2Pairs: result.report.usefulOrder2Pairs.length, conclusion: result.report.conclusion, paths: result.paths }, null, 2)); }
module.exports = { factMap, allowedPair, pairRows, run };
