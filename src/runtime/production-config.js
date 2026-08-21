'use strict';

const { DEFAULT_ALGORITHMS } = require('../security/auth/supabase-auth-verifier');

function invalid() { const error = new Error('Invalid production configuration.'); error.code = 'INVALID_PRODUCTION_CONFIGURATION'; throw error; }
function text(value) { return typeof value === 'string' && value.trim() === value && value.length > 0; }
function integer(value, fallback, minimum, maximum) { const raw = value === undefined ? fallback : value; if (!/^(0|[1-9]\d*)$/.test(String(raw))) invalid(); const result = Number(raw); if (!Number.isSafeInteger(result) || result < minimum || result > maximum) invalid(); return result; }
function url(value, protocol) { if (!text(value)) invalid(); try { const result = new URL(value); if (result.protocol !== protocol) invalid(); return result.toString(); } catch { invalid(); } }
function databaseUrl(value) { if (!text(value)) invalid(); let result; try { result = new URL(value); } catch { invalid(); } if (!['postgres:', 'postgresql:'].includes(result.protocol) || !result.hostname || result.searchParams.get('sslmode') === 'disable') invalid(); return value; }
function origins(value) { if (!text(value)) invalid(); const items = value.split(','); if (!items.length || new Set(items).size !== items.length) invalid(); for (const origin of items) { let parsed; try { parsed = new URL(origin); } catch { invalid(); } if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password || origin.includes('*')) invalid(); } return Object.freeze(items); }
function algorithms(value) { if (!text(value)) invalid(); const items = value.split(','); if (!items.length || !items.every((item) => DEFAULT_ALGORITHMS.includes(item))) invalid(); return Object.freeze([...new Set(items)]); }
function awsArn(value) { if (!text(value) || !/^arn:aws(?:-[a-z]+)?:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]+$/i.test(value)) invalid(); return value; }
function awsRegion(value) { if (!text(value) || !/^[a-z]{2}(?:-gov)?-[a-z]+-\d+$/.test(value)) invalid(); return value; }
function historicalArns(value, current) { if (value === undefined || value === '') return Object.freeze([]); const items = value.split(',').map(awsArn); if (new Set(items).size !== items.length || items.includes(current)) invalid(); return Object.freeze(items); }

function loadProductionConfig(env = process.env) {
  if (!env || env.NODE_ENV !== 'production' || !text(env.HOST)) invalid();
  if (env.DB_SSL_REJECT_UNAUTHORIZED !== undefined && env.DB_SSL_REJECT_UNAUTHORIZED !== 'true') invalid();
  const issuer = url(env.SUPABASE_AUTH_ISSUER, 'https:'); const jwksUri = url(env.SUPABASE_AUTH_JWKS_URL, 'https:');
  if (!text(env.SUPABASE_AUTH_AUDIENCE)) invalid();
  return Object.freeze({
    nodeEnv: 'production', host: env.HOST, port: integer(env.PORT, 3000, 1, 65535), databaseUrl: databaseUrl(env.DATABASE_URL),
    db: Object.freeze({ ssl: Object.freeze({ rejectUnauthorized: true }), max: integer(env.DB_POOL_MAX, 10, 1, 50), connectionTimeoutMillis: integer(env.DB_CONNECTION_TIMEOUT_MS, 5000, 100, 60000), idleTimeoutMillis: integer(env.DB_IDLE_TIMEOUT_MS, 30000, 1000, 300000) }),
    auth: Object.freeze({ issuer, jwksUri, audience: env.SUPABASE_AUTH_AUDIENCE, allowedAlgorithms: algorithms(env.SUPABASE_AUTH_ALLOWED_ALGORITHMS) }),
    aws: (() => { const kmsKeyArn = awsArn(env.KUNDLINSIGHTS_KMS_KEY_ARN); return Object.freeze({ region: awsRegion(env.AWS_REGION), kmsKeyArn, historicalKmsKeyArns: historicalArns(env.KUNDLINSIGHTS_HISTORICAL_KMS_KEY_ARNS, kmsKeyArn) }); })(),
    google: Object.freeze({ mapsApiKey: text(env.GOOGLE_MAPS_API_KEY) ? env.GOOGLE_MAPS_API_KEY : invalid(), timeoutMilliseconds: integer(env.GOOGLE_GEOCODING_TIMEOUT_MS, 5000, 100, 15000) }),
    openai: Object.freeze({ apiKey: text(env.OPENAI_API_KEY) ? env.OPENAI_API_KEY : invalid(), careerModel: text(env.OPENAI_CAREER_MODEL) ? env.OPENAI_CAREER_MODEL : invalid(), timeoutMilliseconds: integer(env.OPENAI_CAREER_TIMEOUT_MS, 15000, 100, 30000) }),
    timezoneRuntime: Object.freeze({ manifestPath: text(env.TIMEZONE_RUNTIME_MANIFEST_PATH) ? env.TIMEZONE_RUNTIME_MANIFEST_PATH : invalid(), binaryPath: text(env.TIMEZONE_RUNTIME_BINARY_PATH) ? env.TIMEZONE_RUNTIME_BINARY_PATH : invalid() }),
    corsOrigins: origins(env.CORS_ALLOWED_ORIGINS), bodyLimitBytes: integer(env.REQUEST_BODY_LIMIT_BYTES, 16384, 1024, 16384), shutdownTimeoutMilliseconds: integer(env.SHUTDOWN_TIMEOUT_MS, 30000, 1000, 120000), logLevel: env.LOG_LEVEL === undefined ? 'info' : ['fatal', 'error', 'warn', 'info'].includes(env.LOG_LEVEL) ? env.LOG_LEVEL : invalid(),
  });
}

module.exports = { loadProductionConfig };
