'use strict';

const crypto = require('node:crypto');
const { freeze } = require('../synthesis/evidence-node');

function integrityError(code) {
  const error = new TypeError(code);
  error.code = code;
  return error;
}

function canonicalUtc(value) {
  if (typeof value !== 'string' || !value.endsWith('Z') || Number.isNaN(Date.parse(value))) throw integrityError('INVALID_CANONICAL_UTC');
  return new Date(value).toISOString();
}

function canonicalValue(value, stack = new Set()) {
  if (value === null) return null;
  if (typeof value === 'string') return value.endsWith('Z') && !Number.isNaN(Date.parse(value)) ? canonicalUtc(value) : value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw integrityError('UNSUPPORTED_CANONICAL_VALUE');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw integrityError('UNSUPPORTED_CANONICAL_VALUE');
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) throw integrityError('UNSUPPORTED_CANONICAL_VALUE');
  if (stack.has(value)) throw integrityError('CYCLIC_CANONICAL_VALUE');
  stack.add(value);
  const out = Array.isArray(value)
    ? value.map((item) => canonicalValue(item, stack))
    : Object.fromEntries(Object.keys(value).sort().map((key) => {
      if (value[key] === undefined) throw integrityError('UNSUPPORTED_CANONICAL_VALUE');
      return [key, canonicalValue(value[key], stack)];
    }));
  stack.delete(value);
  return out;
}

function canonicalSerialize(value) { return JSON.stringify(canonicalValue(value)); }
function sha256(value) { return crypto.createHash('sha256').update(canonicalSerialize(value)).digest('hex'); }
function digest(algorithm, value) { if (algorithm !== 'sha256') throw integrityError('UNSUPPORTED_DIGEST_ALGORITHM'); return freeze({ algorithm, digest: sha256(value) }); }

module.exports = { canonicalUtc, canonicalValue, canonicalSerialize, sha256, digest, integrityError };
