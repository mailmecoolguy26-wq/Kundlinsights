'use strict';

const { immutableCopy, repositoryError } = require('../../persistence/contracts');

const SUPPORTED_PROVIDER = 'supabase';

function fail(code) { throw repositoryError(code); }

function verifiedPrincipal(principal) {
  if (!principal || typeof principal !== 'object' || Array.isArray(principal)) fail('INVALID_AUTH_PRINCIPAL');
  if (typeof principal.provider !== 'string' || !principal.provider || principal.provider.trim() !== principal.provider) fail('INVALID_AUTH_PRINCIPAL');
  if (principal.provider !== SUPPORTED_PROVIDER) fail('UNSUPPORTED_AUTH_PROVIDER');
  if (typeof principal.subject !== 'string' || !principal.subject || principal.subject.trim() !== principal.subject) fail('INVALID_AUTH_PRINCIPAL');
  if (typeof principal.isAnonymous !== 'boolean') fail('INVALID_AUTH_PRINCIPAL');
  if (principal.claims !== undefined && (!principal.claims || typeof principal.claims !== 'object' || Array.isArray(principal.claims))) fail('INVALID_AUTH_PRINCIPAL');
  if (Object.prototype.hasOwnProperty.call(principal, 'jwt') || Object.prototype.hasOwnProperty.call(principal, 'token') || Object.prototype.hasOwnProperty.call(principal, 'accessToken')) fail('INVALID_AUTH_PRINCIPAL');
  return immutableCopy({ provider: principal.provider, subject: principal.subject, isAnonymous: principal.isAnonymous, ...(principal.claims === undefined ? {} : { claims: principal.claims }) }, 'INVALID_AUTH_PRINCIPAL');
}

module.exports = { SUPPORTED_PROVIDER, verifiedPrincipal };
