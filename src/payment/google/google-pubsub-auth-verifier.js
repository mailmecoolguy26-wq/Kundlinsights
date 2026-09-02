'use strict';

const { createRemoteJWKSet, jwtVerify } = require('jose');

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

function fail(code) { const error = new Error(code); error.code = code; throw error; }

function createGooglePubSubAuthVerifier({ audience, allowedServiceAccountEmail, jwksResolver } = {}) {
  if (typeof audience !== 'string' || !audience || typeof allowedServiceAccountEmail !== 'string' || !allowedServiceAccountEmail) {
    return Object.freeze({ async verifyRequest() { fail('GOOGLE_RTDN_UNTRUSTED'); } });
  }
  const keyResolver = jwksResolver || createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  return Object.freeze({
    async verifyRequest(request = {}) {
      const header = request.headers && request.headers.authorization;
      if (typeof header !== 'string' || !header.startsWith('Bearer ')) fail('GOOGLE_RTDN_UNTRUSTED');
      try {
        const { payload } = await jwtVerify(header.slice(7), keyResolver, { audience });
        if (!GOOGLE_ISSUERS.has(payload.iss) || payload.email !== allowedServiceAccountEmail || payload.email_verified !== true) fail('GOOGLE_RTDN_UNTRUSTED');
        return Object.freeze({ serviceAccountEmail: payload.email });
      } catch (error) {
        if (error && error.code === 'GOOGLE_RTDN_UNTRUSTED') throw error;
        fail('GOOGLE_RTDN_UNTRUSTED');
      }
    },
  });
}

module.exports = { createGooglePubSubAuthVerifier };
