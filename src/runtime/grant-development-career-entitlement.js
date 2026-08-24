'use strict';

const { createDevelopmentAstrology } = require('./create-development-astrology');
const { createDevelopmentRuntime } = require('./development-runtime');

function authorizationFromEnvironment(env = process.env) {
  const authorization = env.DEV_AUTH_BEARER_TOKEN;
  if (typeof authorization !== 'string' || !/^Bearer [^\s,]+$/i.test(authorization)) {
    const error = new Error('A legitimate development bearer token is required.');
    error.code = 'DEVELOPMENT_FIXTURE_AUTH_REQUIRED';
    throw error;
  }
  return authorization;
}

async function runDevelopmentCareerEntitlementFixture({ env = process.env, dependencies = {} } = {}) {
  const authorization = authorizationFromEnvironment(env);
  const astrology = (dependencies.createDevelopmentAstrology || createDevelopmentAstrology)();
  const runtime = (dependencies.createDevelopmentRuntime || createDevelopmentRuntime)({
    env, astronomicalEngine: astrology.astronomicalEngine, canonicalSiderealSunSampler: astrology.canonicalSiderealSunSampler,
  });
  try {
    await runtime.initialize();
    return await runtime.grantCareerEntitlementForAuthenticatedPrincipal({ authorization });
  } finally {
    await runtime.shutdown();
  }
}

if (require.main === module) {
  runDevelopmentCareerEntitlementFixture().then(() => {
    process.stdout.write('Development CAREER entitlement is ready.\n');
  }).catch(() => {
    process.stderr.write('Development CAREER entitlement fixture failed.\n');
    process.exitCode = 1;
  });
}

module.exports = { authorizationFromEnvironment, runDevelopmentCareerEntitlementFixture };
