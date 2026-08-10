'use strict';

// Read-only audit utility. It is not part of the calculation engine.
const { spawnSync } = require('node:child_process');
const { AstronomicalEngine, AstronomyEngineProvider, normalizeLongitude } = require('../src/astronomy');

const CASES = [
  { date: '1975-06-15', time: '12:00:00' },
  { date: '1988-11-22', time: '03:00:00' },
  { date: '1990-08-15', time: '09:00:00' },
  { date: '2001-01-01', time: '00:00:00' },
  { date: '2015-09-21', time: '18:00:00' }
];
const COMMANDS = { Sun: '10', Moon: '301', Mars: '499', Mercury: '199', Jupiter: '599', Venus: '299', Saturn: '699' };
const engine = new AstronomicalEngine(new AstronomyEngineProvider());

function angularDifference(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }
function request(command) {
  const tlist = CASES.map(({ date, time }) => `'${date} ${time}'`).join(' ');
  const args = ['--fail', '--silent', '--show-error', '--get', 'https://ssd.jpl.nasa.gov/api/horizons.api', '--data-urlencode', 'format=text', '--data-urlencode', `COMMAND='${command}'`, '--data-urlencode', "OBJ_DATA='NO'", '--data-urlencode', "MAKE_EPHEM='YES'", '--data-urlencode', "EPHEM_TYPE='OBSERVER'", '--data-urlencode', "CENTER='500@399'", '--data-urlencode', `TLIST=${tlist}`, '--data-urlencode', "TIME_TYPE='UT'", '--data-urlencode', "QUANTITIES='31'", '--data-urlencode', "ANG_FORMAT='DEG'", '--data-urlencode', "APPARENT='AIRLESS'", '--data-urlencode', "EXTRA_PREC='YES'"];
  const run = spawnSync('curl', args, { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || 'Horizons query failed.');
  const block = run.stdout.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!block) throw new Error('Horizons response did not contain ephemeris data.');
  return block[1].split('\n').filter((line) => /\d{4}-[A-Z][a-z]{2}-\d{2}/.test(line)).map((line) => Number(line.trim().split(/\s+/).at(-2)));
}

const differences = [];
for (const [body, command] of Object.entries(COMMANDS)) {
  const reference = request(command);
  CASES.forEach((sample, index) => {
    const result = engine.calculate({ ...sample, timezone: 'UTC', latitude: 0, longitude: 0 });
    const tropicalLongitude = result.bodies[body].tropicalLongitudeDegrees;
    differences.push({ body, utc: `${sample.date}T${sample.time}Z`, astronomyEngineTropicalLongitude: tropicalLongitude, jplHorizonsApparentLongitude: reference[index], angularDifferenceDegrees: angularDifference(tropicalLongitude, reference[index]) });
  });
}
console.log(JSON.stringify({ reference: 'NASA/JPL Horizons observer-centered apparent ecliptic-of-date longitude (quantity 31)', caveat: 'Horizons quantity 31 is mean ecliptic-of-date; Astronomy Engine uses true ecliptic-of-date, so nutation-frame differences are included in this comparison.', maximumAngularDifferenceDegrees: Math.max(...differences.map((row) => row.angularDifferenceDegrees)), comparisons: differences }, null, 2));
