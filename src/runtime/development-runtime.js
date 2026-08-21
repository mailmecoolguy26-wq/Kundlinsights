'use strict';

const crypto = require('node:crypto');
const { Pool } = require('pg');
const { createSupabaseAuthVerifier } = require('../security/auth');
const { createApiComposition } = require('../api');
const { DevelopmentLocalKms } = require('./development-local-kms');
const { loadDevelopmentConfig } = require('./development-config');

function createDevelopmentRuntime({ env = process.env, astronomicalEngine, canonicalSiderealSunSampler, idGenerator = crypto.randomUUID, clock = () => new Date().toISOString(), dependencies = {} } = {}) {
  const config = (dependencies.loadDevelopmentConfig || loadDevelopmentConfig)(env); if (!astronomicalEngine || !canonicalSiderealSunSampler) throw new TypeError('Development runtime requires astronomy dependencies.');
  const PoolClass = dependencies.Pool || Pool, KmsClass = dependencies.DevelopmentLocalKms || DevelopmentLocalKms, authFactory = dependencies.createSupabaseAuthVerifier || createSupabaseAuthVerifier, compositionFactory = dependencies.createApiComposition || createApiComposition;
  const db = new PoolClass({ connectionString: config.databaseUrl }); const kms = new KmsClass(config.localKms); const authVerifier = authFactory(config.auth); let ready = false, initialized = false, shuttingDown = null;
  const composition = compositionFactory({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, idGenerator, clock, corsAllowlist: config.corsOrigins, isReady: () => ready, logger: false, bodyLimit: config.bodyLimitBytes }); const api = composition.api;
  async function initialize() { if (initialized) return; try { await db.query('select 1'); await kms.validateStartupKey(); ready = true; initialized = true; } catch { ready = false; await Promise.allSettled([typeof db.end === 'function' ? db.end() : undefined]); const error = new Error('Development startup validation failed.'); error.code = 'DEVELOPMENT_STARTUP_FAILED'; throw error; } }
  async function start() { await initialize(); return api.listen({ host: config.host, port: config.port }); }
  function shutdown() { if (shuttingDown) return shuttingDown; shuttingDown = (async () => { ready = false; await Promise.resolve(api.close()); if (typeof db.end === 'function') await db.end(); })(); return shuttingDown; }
  function installSignalHandlers() { const handler = () => { shutdown().finally(() => { process.exitCode = 0; }); }; process.once('SIGTERM', handler); process.once('SIGINT', handler); return handler; }
  return Object.freeze({ config, api, services: composition.services, initialize, start, shutdown, installSignalHandlers, isReady: () => ready });
}

module.exports = { createDevelopmentRuntime };
