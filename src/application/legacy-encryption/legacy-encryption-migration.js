'use strict';

const { canonicalSerialize } = require('../../readings/reading-integrity');

const LEGACY_KEY_VERSION = 'development-local-kek-v1';
const LEGACY_WRAPPING_ALGORITHM = 'LOCAL_DEVELOPMENT_AES_256_GCM';

function safeCode(error) {
  return error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,127}$/.test(error.code) ? error.code : 'UNKNOWN_ERROR';
}

function sameCanonical(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right);
}

function immutableReport(value) {
  return Object.freeze({ ...value });
}

module.exports = {
  LEGACY_KEY_VERSION,
  LEGACY_WRAPPING_ALGORITHM,
  safeCode,
  sameCanonical,
  immutableReport,
};
