'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { UserDekProvider } = require('../../../src/security/crypto'); const { TestOnlyKms, TestOnlyKeyEnvelopeStore } = require('./test-only-kms');
test('explicit provision and rotation retain old versioned envelopes while current reads use only active envelope', async () => {
  const kms = new TestOnlyKms(); const store = new TestOnlyKeyEnvelopeStore(); const provider = new UserDekProvider({ kms, envelopeStore: store, idGenerator: (() => { let n = 0; return () => `envelope-${++n}`; })(), now: () => '2026-08-13T00:00:00.000Z' });
  await assert.rejects(provider.current('user-a'), (e) => e.code === 'DEK_NOT_AVAILABLE');
  const v1 = await provider.provisionUserDek('user-a'); assert.equal(v1.keyVersion, 'test-kek-v1'); const old = await provider.current('user-a');
  kms.setCurrentKeyVersion('test-kek-v2'); const v2 = await provider.rotateUserDek('user-a'); assert.equal(v2.keyVersion, 'test-kek-v2');
  const current = await provider.current('user-a'); const retained = await provider.forVersion({ userId: 'user-a', keyVersion: 'test-kek-v1' });
  assert.equal(current.keyVersion, 'test-kek-v2'); assert.equal(retained.keyVersion, 'test-kek-v1'); assert.deepEqual(retained.dek, old.dek); old.dek.fill(0); current.dek.fill(0); retained.dek.fill(0);
  await assert.rejects(provider.provisionUserDek('user-a'), (e) => e.code === 'ACTIVE_KEY_ENVELOPE_EXISTS');
});
