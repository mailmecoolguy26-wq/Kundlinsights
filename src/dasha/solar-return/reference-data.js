'use strict';

const SOLAR_RETURN_LAHIRI_BISECTION_V1 = Object.freeze({ id: 'solar-return-lahiri-bisection-v1', status: 'UTILITY_ONLY', description: 'First annual native-Lahiri solar return after a prior UTC epoch, solved by integer-millisecond bisection.' });
const SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1 = Object.freeze({ id: 'solar-return-grid-linear-time-interpolation-v1', status: 'UTILITY_ONLY', description: 'Linear UTC-time interpolation between immutable solar-return grid entries.' });
const CANONICAL_SIDEREAL_SUN_SAMPLER_V1 = Object.freeze({ id: 'canonical-sidereal-sun-sampler-v1', status: 'UTILITY_ONLY' });
const MAX_SOLAR_RETURN_INTERVALS = 121;

module.exports = { SOLAR_RETURN_LAHIRI_BISECTION_V1, SOLAR_RETURN_GRID_LINEAR_TIME_INTERPOLATION_V1, CANONICAL_SIDEREAL_SUN_SAMPLER_V1, MAX_SOLAR_RETURN_INTERVALS };
