'use strict';

const { createDevelopmentAstrology } = require('./create-development-astrology');
const { createDevelopmentRuntime } = require('./development-runtime');

async function startDevelopment({ env = process.env, dependencies = {} } = {}) {
  const astrology = (dependencies.createDevelopmentAstrology || createDevelopmentAstrology)(); const runtime = (dependencies.createDevelopmentRuntime || createDevelopmentRuntime)({ env, astronomicalEngine: astrology.astronomicalEngine, canonicalSiderealSunSampler: astrology.canonicalSiderealSunSampler });
  runtime.installSignalHandlers(); await runtime.start(); return runtime;
}

if (require.main === module) startDevelopment().catch(() => { console.error('Development startup failed.'); process.exitCode = 1; });

module.exports = { startDevelopment };
