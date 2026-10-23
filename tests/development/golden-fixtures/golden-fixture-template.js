'use strict';

const PLANETS = Object.freeze(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Ascendant']);
const CHARTS = Object.freeze(['D4', 'D9', 'D10', 'D16']);
const INGRESS_BODIES = Object.freeze(['Jupiter', 'Saturn', 'Rahu', 'Ketu']);

function emptyFixture({ fixtureId, name, scenario }) {
  const longitudes = Object.fromEntries(PLANETS.map((body) => [body, null]));
  const period = () => ({ lord: null, start: null, end: null });
  const values = {
    astronomy: { longitudes, moonNakshatra: null, moonPada: null },
    dasha: { currentMD: period(), currentAD: period(), currentPD: period() },
    vargas: Object.fromEntries(CHARTS.map((chart) => [chart, { ascendant: null, planets: Object.fromEntries(PLANETS.map((body) => [body, { rashi: null, house: null }])) }])),
    transits: { ingresses: Object.fromEntries(INGRESS_BODIES.map((body) => [body, null])) },
    ashtakavarga: { savBySign: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, null])), bavByBodyAndSign: {} },
  };
  return Object.freeze({ fixtureId, name, scenario, input: { birthProfileReference: 'ENTER_LOCALLY_DO_NOT_COMMIT_BIRTH_DATA', calculationInstant: null }, tolerances: { longitudeArcseconds: null, longitudeDegrees: null, timestampSeconds: null, timestampMinutes: null }, sources: [{ provenance: { sourceName: null, sourceVersion: null, ephemeris: null, ayanamsa: null, zodiac: null, nodeType: null, yearConvention: null, verifiedAt: null, notes: null }, values }] });
}

module.exports = { emptyFixture };
