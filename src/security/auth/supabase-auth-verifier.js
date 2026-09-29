'use strict';

const { jwtVerify, createRemoteJWKSet } = require('jose');
const { verifiedPrincipal } = require('./verified-principal');

const DEFAULT_ALGORITHMS = Object.freeze(['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512']);

function authError() { const error = new Error('Authentication failed.'); error.code = 'INVALID_AUTH_PRINCIPAL'; return error; }
function text(value) { return typeof value === 'string' && value.trim() === value && value.length > 0; }
function audience(value) {
  if (value === undefined || value === null) return undefined;
  if (text(value)) return value;
  if (Array.isArray(value) && value.length && value.every(text)) return Object.freeze([...value]);
  throw authError();
}
function algorithms(value) {
  const items = value === undefined ? DEFAULT_ALGORITHMS : value;
  if (!Array.isArray(items) || !items.length || !items.every((item) => text(item) && DEFAULT_ALGORITHMS.includes(item))) throw authError();
  return Object.freeze([...new Set(items)]);
}
function bearerToken(header) {
  if (typeof header !== 'string') throw authError();
  const match = /^Bearer ([^\s,]+)$/i.exec(header);
  if (!match) throw authError();
  return match[1];
}
function resolver({ jwksUri, jwksResolver }) {
  if (typeof jwksResolver === 'function') return jwksResolver;
  if (!text(jwksUri)) throw authError();
  let url;
  try { url = new URL(jwksUri); } catch { throw authError(); }
  if (url.protocol !== 'https:') throw authError();
  return createRemoteJWKSet(url);
}

function createSupabaseAuthVerifier({ issuer, jwksUri, audience: configuredAudience, allowedAlgorithms, jwksResolver } = {}) {
  if (!text(issuer)) throw authError();
  const verification = Object.freeze({ issuer, audience: audience(configuredAudience), algorithms: algorithms(allowedAlgorithms) });
  const keyResolver = resolver({ jwksUri, jwksResolver });
  return Object.freeze({
    async verifyRequest(request) {
      try {
        const token = bearerToken(request && request.headers && request.headers.authorization);
        const { payload } = await jwtVerify(token, keyResolver, verification);
        if (!text(payload.sub) || payload.role === 'service_role' || payload.token_type === 'refresh_token' || (payload.is_anonymous !== undefined && typeof payload.is_anonymous !== 'boolean')) throw authError();
        return verifiedPrincipal({ provider: 'supabase', subject: payload.sub, isAnonymous: payload.is_anonymous === true });
      } catch (error) {
        if (error && error.code === 'INVALID_AUTH_PRINCIPAL') throw error;
        throw authError();
      }
    },
  });
}

module.exports = { createSupabaseAuthVerifier, DEFAULT_ALGORITHMS };
