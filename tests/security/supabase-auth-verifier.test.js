'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPair, generateSecret, exportJWK, SignJWT, createLocalJWKSet } = require('jose');
const { createSupabaseAuthVerifier } = require('../../src/security/auth');
const { createApi } = require('../../src/api');

const ISSUER = 'https://project-ref.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';
const now = Math.floor(Date.now() / 1000);

async function fixture() {
  const a = await generateKeyPair('ES256'); const b = await generateKeyPair('ES256');
  const aPublic = { ...(await exportJWK(a.publicKey)), kid: 'key-a', alg: 'ES256', use: 'sig' };
  const bPublic = { ...(await exportJWK(b.publicKey)), kid: 'key-b', alg: 'ES256', use: 'sig' };
  let local = createLocalJWKSet({ keys: [aPublic] });
  const verifier = () => createSupabaseAuthVerifier({ issuer: ISSUER, audience: AUDIENCE, allowedAlgorithms: ['ES256'], jwksResolver: (...args) => local(...args) });
  const token = async ({ key = a.privateKey, kid = 'key-a', claims = {}, subject = 'user-a', omitSubject = false, expiration = now + 300, notBefore, issuer = ISSUER, audience = AUDIENCE } = {}) => {
    const jwt = new SignJWT({ role: 'authenticated', ...claims }).setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' }).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiration);
    if (!omitSubject) jwt.setSubject(subject); if (notBefore !== undefined) jwt.setNotBefore(notBefore);
    return jwt.sign(key);
  };
  return { verifier, token, rotate: () => { local = createLocalJWKSet({ keys: [aPublic, bPublic] }); }, b };
}
function request(token) { return { headers: { authorization: `Bearer ${token}` } }; }
function rejects(promise) { return assert.rejects(promise, (error) => error && error.code === 'INVALID_AUTH_PRINCIPAL'); }

test('Supabase verifier cryptographically verifies minimal verified principals and anonymous mapping', async () => {
  const f = await fixture(); const value = await f.verifier().verifyRequest(request(await f.token({ claims: { is_anonymous: true, role: 'authenticated', email: 'ignored@example.test' } })));
  assert.deepEqual(value, { provider: 'supabase', subject: 'user-a', isAnonymous: true }); assert.equal(JSON.stringify(value).includes('ignored@example.test'), false); assert.equal(JSON.stringify(value).includes('Bearer'), false); assert.equal(Object.isFrozen(value), true);
});
test('Supabase verifier rejects malformed bearer data, invalid signatures, issuer/audience/time/subject failures, and service roles', async () => {
  const f = await fixture(); const verifier = f.verifier();
  await rejects(verifier.verifyRequest({ headers: {} })); await rejects(verifier.verifyRequest({ headers: { authorization: 'Basic abc' } })); await rejects(verifier.verifyRequest({ headers: { authorization: 'Bearer one two' } })); await rejects(verifier.verifyRequest(request('not-a-jwt')));
  await rejects(verifier.verifyRequest(request(await f.token({ key: f.b.privateKey, kid: 'key-b' }))));
  await rejects(verifier.verifyRequest(request(await f.token({ issuer: 'https://wrong.example/auth/v1' }))));
  await rejects(verifier.verifyRequest(request(await f.token({ audience: 'wrong' }))));
  await rejects(verifier.verifyRequest(request(await f.token({ expiration: now - 1 }))));
  await rejects(verifier.verifyRequest(request(await f.token({ notBefore: now + 300 }))));
  await rejects(verifier.verifyRequest(request(await f.token({ omitSubject: true }))));
  await rejects(verifier.verifyRequest(request(await f.token({ claims: { role: 'service_role' } }))));
  await rejects(verifier.verifyRequest(request(await f.token({ claims: { token_type: 'refresh_token' } }))));
  await rejects(verifier.verifyRequest(request(await f.token({ claims: { is_anonymous: 'true' } }))));
});
test('Supabase verifier rejects unapproved algorithms and accepts JWKS key rotation by kid', async () => {
  const f = await fixture(); const secret = await generateSecret('HS256');
  const hs256 = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256', kid: 'symmetric' }).setIssuer(ISSUER).setAudience(AUDIENCE).setSubject('user-a').setIssuedAt().setExpirationTime(now + 300).sign(secret);
  await rejects(f.verifier().verifyRequest(request(hs256)));
  const rotated = await f.token({ key: f.b.privateKey, kid: 'key-b', subject: 'user-b' }); await rejects(f.verifier().verifyRequest(request(rotated)));
  f.rotate(); assert.equal((await f.verifier().verifyRequest(request(rotated))).subject, 'user-b');
});
test('Fastify reaches application services only with a verified minimal Supabase principal', async () => {
  const f = await fixture(); const received = []; const app = createApi({
    authVerifier: f.verifier(), requestIdGenerator: () => 'request-1',
    userResolver: { resolve: async (principal) => { received.push(principal); return { id: 'opaque-user', status: 'active' }; } },
    birthProfileService: {}, secureReadingService: {},
  });
  try {
    const valid = await app.inject({ url: '/v1/me', headers: { authorization: `Bearer ${await f.token()}` } }); assert.equal(valid.statusCode, 200); assert.deepEqual(received, [{ provider: 'supabase', subject: 'user-a', isAnonymous: false }]);
    const invalid = await app.inject({ url: '/v1/me', headers: { authorization: 'Bearer invalid' } }); assert.equal(invalid.statusCode, 401); assert.equal(invalid.json().requestId, 'request-1');
  } finally { await app.close(); }
});
