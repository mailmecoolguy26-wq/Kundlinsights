'use strict';

const { canonicalTime, immutableCopy, repositoryError } = require('../../persistence/contracts');
const { SUPPORTED_PROVIDER, verifiedPrincipal } = require('./verified-principal');

function fail(code) { throw repositoryError(code); }
function requiredInjectedFunction(value, code) { if (typeof value !== 'function') fail(code); return value; }
function activeUser(user) { if (!user || typeof user !== 'object' || user.status !== 'active') fail('APP_USER_DISABLED'); return user; }
function userRepositoryBoundary(userRepository) {
  if (!userRepository || typeof userRepository.getUserByAuthSubject !== 'function' || typeof userRepository.createUser !== 'function') fail('INVALID_USER_REPOSITORY');
  return userRepository;
}
function safeProvisioningError(error) {
  if (error && typeof error.code === 'string' && /^(INVALID_AUTH_PRINCIPAL|UNSUPPORTED_AUTH_PROVIDER|ANONYMOUS_AUTH_NOT_ALLOWED|APP_USER_DISABLED|AUTH_SUBJECT_CONFLICT|APP_USER_PROVISIONING_FAILED|INVALID_USER_REPOSITORY|INVALID_APP_USER_ID|INVALID_PROVISIONING_CLOCK)$/.test(error.code)) throw error;
  fail('APP_USER_PROVISIONING_FAILED');
}

async function resolveOrProvisionAppUser({ principal, userRepository, idGenerator, now } = {}) {
  const verified = verifiedPrincipal(principal);
  if (verified.isAnonymous) fail('ANONYMOUS_AUTH_NOT_ALLOWED');
  const repository = userRepositoryBoundary(userRepository);
  const nextId = requiredInjectedFunction(idGenerator, 'INVALID_APP_USER_ID');
  const clock = requiredInjectedFunction(now, 'INVALID_PROVISIONING_CLOCK');
  try {
    const existing = await repository.getUserByAuthSubject(verified.subject);
    if (existing) return immutableCopy(activeUser(existing));
    const id = nextId();
    if (typeof id !== 'string' || !id || id.trim() !== id) fail('INVALID_APP_USER_ID');
    const timestamp = canonicalTime(clock(), 'INVALID_PROVISIONING_CLOCK');
    try {
      return immutableCopy(activeUser(await repository.createUser({ id, authSubject: verified.subject, status: 'active', createdAt: timestamp, updatedAt: timestamp })));
    } catch (error) {
      if (!error || error.code !== 'DUPLICATE_AUTH_SUBJECT') throw error;
      const winner = await repository.getUserByAuthSubject(verified.subject);
      if (!winner) fail('AUTH_SUBJECT_CONFLICT');
      return immutableCopy(activeUser(winner));
    }
  } catch (error) { safeProvisioningError(error); }
}

module.exports = { SUPPORTED_PROVIDER, verifiedPrincipal, resolveOrProvisionAppUser };
module.exports.createSupabaseAuthVerifier = require('./supabase-auth-verifier').createSupabaseAuthVerifier;
