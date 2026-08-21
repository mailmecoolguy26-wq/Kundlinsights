'use strict';

const { loadProductionConfig } = require('./production-config');
const { createProductionRuntime } = require('./production-runtime');
const { createProductionAstrology } = require('../astronomy');

async function startProduction({ env = process.env, dependencies = {} } = {}) {
  const config = (dependencies.loadProductionConfig || loadProductionConfig)(env);
  const astrology = (dependencies.createProductionAstrology || createProductionAstrology)({ swissEphemeris: config.swissEphemeris });
  const runtime = (dependencies.createProductionRuntime || createProductionRuntime)({ env, astronomicalEngine: astrology.astronomicalEngine, canonicalSiderealSunSampler: astrology.canonicalSiderealSunSampler });
  runtime.installSignalHandlers();
  await runtime.start();
  return runtime;
}

if (require.main === module) {
  startProduction().catch(() => { process.exitCode = 1; });
}

module.exports = { startProduction };
