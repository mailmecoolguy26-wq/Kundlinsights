'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { InMemoryUserRepository } = require('../../src/persistence');
const { resolveOrProvisionAppUser, verifiedPrincipal } = require('../../src/security/auth');

const T0 = '2026-01-01T00:00:00.000Z';
function principal(subject = 'supabase-subject-a', extra = {}) { return { provider: 'supabase', subject, isAnonymous: false, ...extra }; }
function dependencies(users, ids = ['app-user-001', 'app-user-002']) { let index = 0; return { userRepository: users, idGenerator: () => ids[index++], now: () => T0 }; }
function rejectsCode(promise, code) { return assert.rejects(promise, (error) => error && error.code === code); }

test('provisions opaque application users only from a verified Supabase principal and resolves existing subjects', async () => {
  const users = new InMemoryUserRepository(); const injected = dependencies(users);
  const first = await resolveOrProvisionAppUser({ principal: principal(), ...injected, userId: 'client-controlled' });
  const again = await resolveOrProvisionAppUser({ principal: principal('supabase-subject-a', { clientUserId: 'other-client-id' }), ...injected });
  const different = await resolveOrProvisionAppUser({ principal: principal('supabase-subject-b'), ...injected });
  assert.equal(first.id, 'app-user-001'); assert.equal(first.authSubject, 'supabase-subject-a');
  assert.equal(again.id, first.id); assert.equal(different.id, 'app-user-002');
  assert.equal(Object.isFrozen(first), true); assert.throws(() => { first.id = 'changed'; }, TypeError);
  assert.equal(users.getUser(first.id).authSubject, 'supabase-subject-a');
});

test('rejects malformed, unsupported, raw-token, and anonymous principals without normalizing subjects', async () => {
  const users = new InMemoryUserRepository(); const injected = dependencies(users);
  for (const value of [undefined, {}, { provider: 'supabase', subject: '', isAnonymous: false }, { provider: 'supabase', subject: ' subject', isAnonymous: false }, { provider: 'supabase', subject: 1, isAnonymous: false }, { provider: 'supabase', subject: 'x', isAnonymous: false, jwt: 'raw' }]) await rejectsCode(resolveOrProvisionAppUser({ principal: value, ...injected }), 'INVALID_AUTH_PRINCIPAL');
  await rejectsCode(resolveOrProvisionAppUser({ principal: { provider: 'other', subject: 'x', isAnonymous: false }, ...injected }), 'UNSUPPORTED_AUTH_PROVIDER');
  await rejectsCode(resolveOrProvisionAppUser({ principal: { provider: 'supabase', subject: 'guest', isAnonymous: true }, ...injected }), 'ANONYMOUS_AUTH_NOT_ALLOWED');
  assert.equal(verifiedPrincipal(principal()).subject, 'supabase-subject-a');
});

test('does not reactivate disabled users, rewrite auth subjects, or allow client identity fields to affect resolution', async () => {
  const users = new InMemoryUserRepository(); users.createUser({ id: 'disabled-user', authSubject: 'disabled-subject', status: 'disabled', createdAt: T0 });
  await rejectsCode(resolveOrProvisionAppUser({ principal: principal('disabled-subject', { userId: 'active-user' }), ...dependencies(users) }), 'APP_USER_DISABLED');
  assert.equal(users.getUser('disabled-user').authSubject, 'disabled-subject');
  assert.equal(users.getUser('disabled-user').status, 'disabled');
});

test('recovers the authoritative user when concurrent first provisioning races on one auth subject', async () => {
  const users = new InMemoryUserRepository(); const injected = dependencies(users, ['race-user-a', 'race-user-b']);
  const [left, right] = await Promise.all([resolveOrProvisionAppUser({ principal: principal('race-subject'), ...injected }), resolveOrProvisionAppUser({ principal: principal('race-subject'), ...injected })]);
  assert.equal(left.id, right.id); assert.equal(users.getUserByAuthSubject('race-subject').id, left.id);
});
