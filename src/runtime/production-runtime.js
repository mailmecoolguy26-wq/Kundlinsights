'use strict';

const crypto = require('node:crypto');
const { Pool } = require('pg');
const { KMSClient } = require('@aws-sdk/client-kms');
const { createSupabaseAuthVerifier } = require('../security/auth');
const { AwsKmsProvider } = require('../security/crypto');
const { createApiComposition } = require('../api');
const { loadProductionConfig } = require('./production-config');

function productionLogger(level) { return { level, redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'request.headers.authorization', 'request.headers.cookie', 'DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], remove: true } }; }
function poolOptions(config) { return { connectionString: config.databaseUrl, max: config.db.max, connectionTimeoutMillis: config.db.connectionTimeoutMillis, idleTimeoutMillis: config.db.idleTimeoutMillis, ssl: { rejectUnauthorized: true }, application_name: 'kundlinsights-api' }; }
function bounded(operation, milliseconds) { let timer; return Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('Shutdown timed out.'), { code: 'PRODUCTION_SHUTDOWN_TIMEOUT' })), milliseconds); })]).finally(() => clearTimeout(timer)); }

function createProductionRuntime({ env = process.env, astronomicalEngine, canonicalSiderealSunSampler, idGenerator = crypto.randomUUID, clock = () => new Date().toISOString(), dependencies = {} } = {}) {
  const config = loadProductionConfig(env); const PoolClass = dependencies.Pool || Pool; const KmsClientClass = dependencies.KMSClient || KMSClient; const KmsProviderClass = dependencies.AwsKmsProvider || AwsKmsProvider; const authFactory = dependencies.createSupabaseAuthVerifier || createSupabaseAuthVerifier; const compositionFactory = dependencies.createApiComposition || createApiComposition;
  const db = new PoolClass(poolOptions(config)); const kmsClient = new KmsClientClass({ region: config.aws.region, maxAttempts: 3, retryMode: 'standard' }); const kms = new KmsProviderClass({ client: kmsClient, kmsKeyArn: config.aws.kmsKeyArn, historicalKmsKeyArns: config.aws.historicalKmsKeyArns }); const authVerifier = authFactory(config.auth);
  let ready = false; let initialized = false; let shuttingDown = null;
  const composition = compositionFactory({ db, authVerifier, kms, astronomicalEngine, canonicalSiderealSunSampler, idGenerator, clock, corsAllowlist: config.corsOrigins, isReady: () => ready, logger: productionLogger(config.logLevel), bodyLimit: config.bodyLimitBytes });
  const api = composition.api;
  async function initialize() { if (initialized) return; try { await db.query('select 1'); await kms.validateStartupKey(); ready = true; initialized = true; } catch (error) { ready = false; await Promise.allSettled([typeof db.end === 'function' ? db.end() : undefined, typeof kmsClient.destroy === 'function' ? kmsClient.destroy() : undefined]); const failure = new Error('Production startup validation failed.'); failure.code = 'PRODUCTION_STARTUP_FAILED'; throw failure; } }
  async function start() { await initialize(); return api.listen({ host: config.host, port: config.port }); }
  function shutdown() { if (shuttingDown) return shuttingDown; shuttingDown = (async () => { ready = false; await bounded(Promise.resolve(api.close()), config.shutdownTimeoutMilliseconds); await Promise.all([typeof db.end === 'function' ? db.end() : undefined, typeof kmsClient.destroy === 'function' ? Promise.resolve(kmsClient.destroy()) : undefined]); })(); return shuttingDown; }
  function installSignalHandlers() { const handler = () => { shutdown().finally(() => process.exitCode = 0); }; process.once('SIGTERM', handler); process.once('SIGINT', handler); return handler; }
  return Object.freeze({ config, db, kms, kmsClient, authVerifier, api, services: composition.services, initialize, start, shutdown, installSignalHandlers, isReady: () => ready });
}

module.exports = { createProductionRuntime, poolOptions, productionLogger };
