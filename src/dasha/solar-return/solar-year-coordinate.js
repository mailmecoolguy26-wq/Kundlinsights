'use strict';

const { deepFreeze } = require('../../astronomy/canonical-sidereal-sun-sampler');
const { SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1 } = require('./reference-data');
const { fail } = require('./solar-return-errors');

function epoch(entry) { const date = new Date(entry.instantUtc); return date.getTime(); }
function gridEntryAt(grid, index) {
  if (!grid || !Array.isArray(grid.entries)) return null;
  const indexed = grid.entries.find((entry) => entry.index === index);
  return indexed || (index >= 0 ? grid.entries[index] || null : null);
}
function splitSolarYearCoordinate(coordinate) {
  if (!Number.isFinite(coordinate)) fail('INVALID_SOLAR_YEAR_FRACTION', 'Solar-year coordinate must be finite.');
  const integerYears = Math.floor(coordinate); const fraction = coordinate - integerYears;
  return deepFreeze({ integerYears, fraction });
}
function interpolateSolarYear({ grid, index, fraction, rulesetId = SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1.id } = {}) {
  if (rulesetId !== SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1.id) fail('UNSUPPORTED_SOLAR_RETURN_RULESET', `Unsupported solar-year interpolation ruleset: ${rulesetId}`);
  if (!grid || !Array.isArray(grid.entries) || !Number.isSafeInteger(index) || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) fail('INVALID_SOLAR_YEAR_FRACTION', 'Solar-year interpolation requires an index and fraction in [0, 1].');
  const start = gridEntryAt(grid, index); const end = gridEntryAt(grid, index + 1);
  if (!start || !end) fail('INVALID_SOLAR_YEAR_FRACTION', 'Solar-year interpolation requires two adjacent grid entries.');
  const startEpoch = epoch(start); const endEpoch = epoch(end);
  const interpolatedEpoch = startEpoch + Math.round((endEpoch - startEpoch) * fraction);
  return deepFreeze({ index, fraction, instantUtc: new Date(interpolatedEpoch).toISOString(), rulesetId, provenance: deepFreeze({ method: 'linear-utc-time-between-solar-returns' }) });
}

function instantAtSolarYearCoordinate({ grid, coordinate, rulesetId = SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1.id } = {}) {
  const { integerYears, fraction } = splitSolarYearCoordinate(coordinate);
  const exact = gridEntryAt(grid, integerYears);
  if (fraction === 0 && exact) return deepFreeze({ index: integerYears, fraction, instantUtc: exact.instantUtc, rulesetId, provenance: deepFreeze({ method: 'exact-solar-return-grid-epoch' }) });
  return interpolateSolarYear({ grid, index: integerYears, fraction, rulesetId });
}

module.exports = { splitSolarYearCoordinate, interpolateSolarYear, instantAtSolarYearCoordinate };
