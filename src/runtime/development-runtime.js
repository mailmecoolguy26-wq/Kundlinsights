'use strict';

const crypto = require('node:crypto');
const { Pool } = require('pg');
const { KMSClient } = require('@aws-sdk/client-kms');
const { createSupabaseAuthVerifier } = require('../security/auth');
const { AwsKmsProvider } = require('../security/crypto');
const { createApiComposition } = require('../api');
const { loadDevelopmentConfig } = require('./development-config');

function createDevelopmentRuntime({ env = process.env, astronomicalEngine, canonicalSiderealSunSampler, idGenerator = crypto.randomUUID, clock = () => new Date().toISOString(), dependencies = {} } = {}) {
  const config = (dependencies.loadDevelopmentConfig || loadDevelopmentConfig)(env);
  if (!astronomicalEngine || !canonicalSiderealSunSampler) throw new TypeError('Development runtime requires astronomy dependencies.');
  const PoolClass = dependencies.Pool || Pool; const KmsClientClass = dependencies.KMSClient || KMSClient; const KmsProviderClass = dependencies.AwsKmsProvider || AwsKmsProvider; const authFactory = dependencies.createSupabaseAuthVerifier || createSupabaseAuthVerifier; const compositionFactory = dependencies.createApiComposition || createApiComposition;
  const db = new PoolClass({ connectionString: config.databaseUrl }); const kmsClient = new KmsClientClass({ region: config.aws.region, maxAttempts: 3, retryMode: 'standard' }); const kms = new KmsProviderClass({ client: kmsClient, kmsKeyArn: config.aws.kmsKeyArn }); const authVerifier = authFactory(config.auth);
  let ready = false; let initialized = false; let shuttingDown = null;
  const composition = compositionFactory({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, idGenerator, clock, corsAllowlist: config.corsOrigins, isReady: () => ready, logger: false, bodyLimit: config.bodyLimitBytes }); const api = composition.api;
  async function initialize() { if (initialized) return; try { await db.query('select 1'); await kms.validateStartupKey(); ready = true; initialized = true; } catch { ready = false; await Promise.allSettled([typeof db.end === 'function' ? db.end() : undefined, typeof kmsClient.destroy === 'function' ? kmsClient.destroy() : undefined]); const error = new Error('Development startup validation failed.'); error.code = 'DEVELOPMENT_STARTUP_FAILED'; throw error; } }
  async function start() { await initialize(); return api.listen({ host: config.host, port: config.port }); }
  function shutdown() { if (shuttingDown) return shuttingDown; shuttingDown = (async () => { ready = false; await Promise.resolve(api.close()); await Promise.all([typeof db.end === 'function' ? db.end() : undefined, typeof kmsClient.destroy === 'function' ? Promise.resolve(kmsClient.destroy()) : undefined]); })(); return shuttingDown; }
  function installSignalHandlers() { const handler = () => { shutdown().finally(() => { process.exitCode = 0; }); }; process.once('SIGTERM', handler); process.once('SIGINT', handler); return handler; }
  return Object.freeze({ config, api, services: composition.services, initialize, start, shutdown, installSignalHandlers, isReady: () => ready });
}

module.exports = { createDevelopmentRuntime };
