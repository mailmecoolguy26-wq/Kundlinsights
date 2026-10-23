'use strict';

// External certification is intentionally separate from calculation.  This
// runner consumes a harness report and independently entered source values; it
// neither changes, rounds, nor reconciles TaraVerse output.
const PLANETS = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant']);
const VARGAS = Object.freeze(['D4', 'D9', 'D10', 'D16']);
const TRANSIT_BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);

function freeze(value) { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }
function circularDegrees(left, right) { return Math.abs((((left - right + 540) % 360) - 180)); }
function equal(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function numeric(value) { return typeof value === 'number' && Number.isFinite(value); }
function sourceProvenance(source) {
  const value = source && source.provenance || {};
  return freeze({ sourceName: value.sourceName ?? null, sourceVersion: value.sourceVersion ?? null, ephemeris: value.ephemeris ?? null, ayanamsa: value.ayanamsa ?? null, zodiac: value.zodiac ?? null, nodeType: value.nodeType ?? null, nodeTypeObserved: value.nodeTypeObserved ?? null, nodeTypeUiSetting: value.nodeTypeUiSetting ?? null, provenanceConflict: value.provenanceConflict === true, yearConvention: value.yearConvention ?? null, location: value.location ?? null, verifiedAt: value.verifiedAt ?? null, notes: value.notes ?? null });
}
function reportLongitudes(report) { return Object.fromEntries([...report.astronomy.planets.map((row) => [row.body, row.longitude]), ['Ascendant', report.astronomy.ascendant.longitude]]); }
function reportVarga(report, id) { return report.vargas && report.vargas[id] || null; }
function valueEntries(source, report) {
  const values = source.values || {};
  const dashaTimestampKind = source.comparisonGranularity && source.comparisonGranularity.dasha === 'DATE' ? 'date' : 'timestamp';
  const rows = [];
  const longitudes = values.astronomy && values.astronomy.longitudes || {};
  const actualLongitudes = reportLongitudes(report);
  for (const planet of PLANETS) rows.push({ field: `astronomy.longitudes.${planet}`, kind: 'longitude', expected: longitudes[planet], actual: actualLongitudes[planet] });
  const astronomy = values.astronomy || {};
  rows.push({ field: 'astronomy.moonNakshatra', kind: 'exact', expected: astronomy.moonNakshatra, actual: report.astronomy.nakshatra.moon });
  rows.push({ field: 'astronomy.moonPada', kind: 'exact', expected: astronomy.moonPada, actual: report.astronomy.nakshatra.pada });
  for (const level of ['currentMD', 'currentAD', 'currentPD']) {
    const expected = values.dasha && values.dasha[level] || {};
    const actual = report.dasha[level] || {};
    for (const field of ['lord', 'start', 'end']) rows.push({ field: `dasha.${level}.${field}`, kind: field === 'start' || field === 'end' ? dashaTimestampKind : 'exact', expected: expected[field], actual: actual[field] });
  }
  for (const period of values.dasha && values.dasha.referencePeriods || []) {
    const md = report.dasha.timeline.find((item) => item.lord === period.mdLord);
    const ad = md && md.antardashas.find((item) => item.lord === period.adLord);
    const actual = ad && ad.pratyantardashas.find((item) => item.lord === period.lord) || {};
    const identity = `${period.level}.${period.mdLord}.${period.adLord}.${period.lord}`;
    rows.push({ field: `dasha.referencePeriods.${identity}.start`, kind: dashaTimestampKind, expected: period.start, actual: actual.start });
    rows.push({ field: `dasha.referencePeriods.${identity}.end`, kind: dashaTimestampKind, expected: period.end, actual: actual.end });
  }
  for (const id of VARGAS) {
    const expected = values.vargas && values.vargas[id] || {};
    const actual = reportVarga(report, id) || {};
    rows.push({ field: `vargas.${id}.ascendant`, kind: 'exact', expected: expected.ascendant, actual: actual.ascendant });
    for (const planet of PLANETS) {
      const placement = expected.planets && expected.planets[planet]; const fact = actual.bodies && actual.bodies[planet];
      if (placement && typeof placement === 'object') {
        rows.push({ field: `vargas.${id}.planets.${planet}.rashi`, kind: 'exact', expected: placement.rashi, actual: fact && fact.rashiIndex });
        rows.push({ field: `vargas.${id}.planets.${planet}.house`, kind: 'exact', expected: placement.house, actual: fact && fact.house });
      } else rows.push({ field: `vargas.${id}.planets.${planet}`, kind: 'exact', expected: placement, actual: fact && freeze({ rashi: fact.rashiIndex, house: fact.house }) });
    }
  }
  const ingresses = values.transits && values.transits.ingresses || {};
  for (const body of TRANSIT_BODIES) rows.push({ field: `transits.ingresses.${body}`, kind: 'ingresses', expected: ingresses[body], actual: report.transits.futureIngresses.filter((event) => event.body === body) });
  const ashtakavarga = values.ashtakavarga || {};
  const sav = ashtakavarga.savBySign || {};
  for (let sign = 1; sign <= 12; sign += 1) rows.push({ field: `ashtakavarga.savBySign.${sign}`, kind: 'exact', expected: sav[sign], actual: report.ashtakavarga.sav.find((item) => item.rashi === sign)?.bindu });
  const bav = ashtakavarga.bavByBodyAndSign || {};
  for (const [body, bySign] of Object.entries(bav)) for (const [sign, expected] of Object.entries(bySign || {})) rows.push({ field: `ashtakavarga.bavByBodyAndSign.${body}.${sign}`, kind: 'exact', expected, actual: report.ashtakavarga.bav[body] && report.ashtakavarga.bav[body].find((item) => item.rashi === Number(sign))?.bindu });
  return rows;
}
function comparison(row, tolerances) {
  if (row.expected === null || row.expected === undefined) return freeze({ ...row, status: 'NOT_VERIFIED', delta: null, tolerance: null });
  if (row.kind === 'longitude') {
    if (!numeric(row.expected) || !numeric(row.actual)) return freeze({ ...row, status: 'FAIL', delta: null, tolerance: tolerances.longitudeArcseconds ?? tolerances.longitudeDegrees ?? 0 });
    const deltaDegrees = circularDegrees(row.expected, row.actual); const toleranceDegrees = tolerances.longitudeDegrees ?? ((tolerances.longitudeArcseconds ?? 0) / 3600);
    return freeze({ ...row, status: deltaDegrees <= toleranceDegrees ? 'PASS' : 'FAIL', delta: freeze({ degrees: deltaDegrees, arcseconds: deltaDegrees * 3600 }), tolerance: freeze({ degrees: toleranceDegrees, arcseconds: toleranceDegrees * 3600 }) });
  }
  if (row.kind === 'timestamp') {
    const expected = Date.parse(row.expected); const actual = Date.parse(row.actual); const toleranceSeconds = tolerances.timestampSeconds ?? ((tolerances.timestampMinutes ?? 0) * 60);
    return freeze({ ...row, status: Number.isFinite(expected) && Number.isFinite(actual) && Math.abs(actual - expected) / 1000 <= toleranceSeconds ? 'PASS' : 'FAIL', delta: Number.isFinite(expected) && Number.isFinite(actual) ? Math.abs(actual - expected) / 1000 : null, tolerance: toleranceSeconds });
  }
  if (row.kind === 'date') return freeze({ ...row, status: typeof row.actual === 'string' && row.actual.slice(0, 10) === row.expected ? 'PASS' : 'FAIL', delta: typeof row.actual === 'string' ? row.actual.slice(0, 10) : null, tolerance: 'CALENDAR_DATE_EXACT' });
  return freeze({ ...row, status: equal(row.expected, row.actual) ? 'PASS' : 'FAIL', delta: null, tolerance: 'EXACT' });
}
function sourceConflict(rows) {
  const verified = rows.filter((row) => row.expected !== null && row.expected !== undefined);
  if (verified.length < 2) return false;
  const baseline = verified[0].expected;
  return verified.some((row) => !equal(baseline, row.expected));
}

// This is deliberately a reporting aid, not a reconciliation mechanism.  A
// date-only source can agree only at calendar-date precision; callers must
// retain the source provenance alongside the classification.
function normalizeThreeWayValue(value, granularity) {
  if (value === null || value === undefined) return null;
  return granularity === 'DATE' && typeof value === 'string' ? value.slice(0, 10) : value;
}

function classifyThreeWay({ taraVerse, sourceA, sourceB, sourceAGranularity = null, sourceBGranularity = null } = {}) {
  if (taraVerse === null || taraVerse === undefined || sourceA === null || sourceA === undefined || sourceB === null || sourceB === undefined) return 'NOT_VERIFIED';
  // Compare at the least precise supplied resolution.  This does not turn a
  // date-only capture into a timestamp or conceal a timestamp mismatch.
  const dateOnly = sourceAGranularity === 'DATE' || sourceBGranularity === 'DATE';
  const normalize = (value) => normalizeThreeWayValue(value, dateOnly ? 'DATE' : null);
  const tara = normalize(taraVerse);
  const a = normalize(sourceA);
  const b = normalize(sourceB);
  if (equal(tara, a) && equal(tara, b)) return 'MATCH_ALL_THREE';
  if (equal(tara, a)) return 'TARAVERSE_DRIK_MATCH';
  if (equal(tara, b)) return 'TARAVERSE_SOURCE_B_MATCH';
  if (equal(a, b)) return 'DRIK_SOURCE_B_MATCH';
  return 'ALL_DIFFER';
}

function nodeMatch(left, right, toleranceArcseconds) {
  return numeric(left) && numeric(right) && circularDegrees(left, right) * 3600 <= toleranceArcseconds;
}

// Nodes must only be compared within the same declared/observed convention.
// This explicitly distinguishes a source's displayed node value from a
// contradictory UI preference and prevents an expected mean/true mismatch
// from being reported as a TaraVerse astronomy failure.
function classifyNodeConventionEvidence({ taraVerse, drikTrue, drikMean, sourceB, toleranceArcseconds = 60 } = {}) {
  return freeze({
    toleranceArcseconds,
    taraVerseDrikTrue: nodeMatch(taraVerse, drikTrue, toleranceArcseconds) ? 'TARAVERSE_DRIK_TRUE_MATCH' : 'TARAVERSE_DRIK_TRUE_DIFFER',
    sourceBDrikMean: nodeMatch(sourceB, drikMean, toleranceArcseconds) ? 'SOURCE_B_DRIK_MEAN_MATCH' : 'SOURCE_B_DRIK_MEAN_DIFFER',
    sourceBComparedToDrikTrue: nodeMatch(sourceB, drikTrue, toleranceArcseconds) ? 'SOURCE_B_DRIK_TRUE_MATCH' : 'SOURCE_B_DRIK_TRUE_DIFFER',
  });
}

function compareGoldenFixture({ fixture, report } = {}) {
  if (!fixture || !report) throw new TypeError('fixture and harness report are required.');
  const tolerances = fixture.tolerances || {};
  const byField = new Map();
  for (const source of fixture.sources || []) {
    const provenance = sourceProvenance(source);
    for (const row of valueEntries(source, report)) {
      if (!byField.has(row.field)) byField.set(row.field, []);
      byField.get(row.field).push(freeze({ ...comparison(row, tolerances), source: provenance }));
    }
  }
  const results = [];
  for (const [field, rows] of byField) {
    if (sourceConflict(rows)) results.push(freeze({ field, status: 'EXTERNAL_SOURCE_CONFLICT', expected: rows.filter((row) => row.status !== 'NOT_VERIFIED').map((row) => freeze({ sourceName: row.source.sourceName, value: row.expected })), actual: rows[0].actual, delta: null, tolerance: null, sources: freeze(rows.map((row) => row.source)) }));
    else results.push(...rows);
  }
  return freeze({ fixtureName: fixture.name, fixtureId: fixture.fixtureId, statuses: freeze({ PASS: results.filter((row) => row.status === 'PASS').length, FAIL: results.filter((row) => row.status === 'FAIL').length, NOT_VERIFIED: results.filter((row) => row.status === 'NOT_VERIFIED').length, EXTERNAL_SOURCE_CONFLICT: results.filter((row) => row.status === 'EXTERNAL_SOURCE_CONFLICT').length }), results: freeze(results) });
}

module.exports = { PLANETS, VARGAS, TRANSIT_BODIES, compareGoldenFixture, classifyThreeWay, classifyNodeConventionEvidence, sourceProvenance };
