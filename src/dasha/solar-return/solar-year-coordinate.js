'use strict';

const { deepFreeze } = require('../../astronomy/canonical-sidereal-sun-sampler');
const { SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1 } = require('./reference-data');
const { fail } = require('./solar-return-errors');

function epoch(entry) { const date = new Date(entry.instantUtc); return date.getTime(); }
function splitSolarYearCoordinate(coordinate) {
  if (!Number.isFinite(coordinate) || coordinate < 0) fail('INVALID_SOLAR_YEAR_FRACTION', 'Solar-year coordinate must be a finite nonnegative number.');
  const integerYears = Math.floor(coordinate); const fraction = coordinate - integerYears;
  return deepFreeze({ integerYears, fraction });
}
function interpolateSolarYear({ grid, index, fraction, rulesetId = SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1.id } = {}) {
  if (rulesetId !== SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1.id) fail('UNSUPPORTED_SOLAR_RETURN_RULESET', `Unsupported solar-year interpolation ruleset: ${rulesetId}`);
  if (!grid || !Array.isArray(grid.entries) || !Number.isSafeInteger(index) || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) fail('INVALID_SOLAR_YEAR_FRACTION', 'Solar-year interpolation requires an index and fraction in [0, 1].');
  const start = grid.entries[index]; const end = grid.entries[index + 1];
  if (!start || !end) fail('INVALID_SOLAR_YEAR_FRACTION', 'Solar-year interpolation requires two adjacent grid entries.');
  const startEpoch = epoch(start); const endEpoch = epoch(end);
  const interpolatedEpoch = startEpoch + Math.round((endEpoch - startEpoch) * fraction);
  return deepFreeze({ index, fraction, instantUtc: new Date(interpolatedEpoch).toISOString(), rulesetId, provenance: deepFreeze({ method: 'linear-utc-time-between-solar-returns' }) });
}

module.exports = { splitSolarYearCoordinate, interpolateSolarYear };
