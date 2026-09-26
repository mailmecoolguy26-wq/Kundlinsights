'use strict';

const {
  createDevelopmentAstrology,
} = require('./create-development-astrology');

const {
  createProductionRuntime,
} = require('./production-runtime');

async function startProduction({
  env = process.env,
  dependencies = {},
} = {}) {
  const astrology =
    (dependencies.createAstrology || createDevelopmentAstrology)();

  const runtime =
    (dependencies.createProductionRuntime || createProductionRuntime)({
      env,
      astronomicalEngine: astrology.astronomicalEngine,
      canonicalSiderealSunSampler:
        astrology.canonicalSiderealSunSampler,
    });

  runtime.installSignalHandlers();
  await runtime.start();

  return runtime;
}

if (require.main === module) {
  startProduction().catch((error) => {
    console.error(
      'Production startup failed:',
      error && error.code ? error.code : 'UNKNOWN_ERROR',
      error && error.message ? error.message : '',
    );
    process.exitCode = 1;
  });
}

module.exports = {
  startProduction,
};
