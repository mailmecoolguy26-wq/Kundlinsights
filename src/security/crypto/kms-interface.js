'use strict';
const { fail } = require('./crypto-errors');
function kmsBoundary(kms) { if (!kms || typeof kms.wrapDek !== 'function' || typeof kms.unwrapDek !== 'function' || typeof kms.getCurrentKeyVersion !== 'function') fail('INVALID_KMS_INTERFACE'); return kms; }
function envelopeStoreBoundary(store) { if (!store || typeof store.getEnvelope !== 'function' || typeof store.putEnvelope !== 'function') fail('INVALID_KEY_ENVELOPE_STORE'); return store; }
module.exports = { kmsBoundary, envelopeStoreBoundary };
