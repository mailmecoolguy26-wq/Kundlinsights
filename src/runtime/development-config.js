'use strict';

const { DEFAULT_ALGORITHMS } = require('../security/auth/supabase-auth-verifier');

function invalid() { const error = new Error('Invalid development configuration.'); error.code = 'INVALID_DEVELOPMENT_CONFIGURATION'; throw error; }
function text(value) { return typeof value === 'string' && value.trim() === value && value.length > 0; }
function integer(value, fallback, minimum, maximum) { const raw = value === undefined ? fallback : value; if (!/^(0|[1-9]\d*)$/.test(String(raw))) invalid(); const result = Number(raw); if (!Number.isSafeInteger(result) || result < minimum || result > maximum) invalid(); return result; }
function databaseUrl(value) { if (!text(value)) invalid(); try { const parsed = new URL(value); if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) invalid(); return value; } catch { invalid(); } }
function httpsUrl(value) { if (!text(value)) invalid(); try { const parsed = new URL(value); if (parsed.protocol !== 'https:') invalid(); return parsed.toString(); } catch { invalid(); } }
function arn(value) { if (!text(value) || !/^arn:aws(?:-[a-z]+)?:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]+$/i.test(value)) invalid(); return value; }
function region(value) { if (!text(value) || !/^[a-z]{2}(?:-gov)?-[a-z]+-\d+$/.test(value)) invalid(); return value; }

function loadDevelopmentConfig(env = process.env) {
  if (!env || env.NODE_ENV === 'production') invalid();
  const algorithms = text(env.DEV_SUPABASE_AUTH_ALLOWED_ALGORITHMS) ? env.DEV_SUPABASE_AUTH_ALLOWED_ALGORITHMS.split(',') : DEFAULT_ALGORITHMS;
  if (!algorithms.length || !algorithms.every((algorithm) => DEFAULT_ALGORITHMS.includes(algorithm))) invalid();
  return Object.freeze({ host: text(env.DEV_HOST) ? env.DEV_HOST : '0.0.0.0', port: integer(env.DEV_PORT, 3000, 1, 65535), databaseUrl: databaseUrl(env.DEV_DATABASE_URL), auth: Object.freeze({ issuer: httpsUrl(env.DEV_SUPABASE_AUTH_ISSUER), jwksUri: httpsUrl(env.DEV_SUPABASE_AUTH_JWKS_URL), audience: text(env.DEV_SUPABASE_AUTH_AUDIENCE) ? env.DEV_SUPABASE_AUTH_AUDIENCE : invalid(), allowedAlgorithms: Object.freeze([...new Set(algorithms)]) }), aws: Object.freeze({ region: region(env.DEV_AWS_REGION), kmsKeyArn: arn(env.DEV_KMS_KEY_ARN) }), corsOrigins: Object.freeze([]), bodyLimitBytes: integer(env.DEV_REQUEST_BODY_LIMIT_BYTES, 16384, 1024, 16384) });
}

module.exports = { loadDevelopmentConfig };
