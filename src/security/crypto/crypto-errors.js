'use strict';

function cryptoError(code) { const error = new Error(code); error.code = code; return error; }
function fail(code) { throw cryptoError(code); }
function safeCrypto(operation, fallback) { try { return operation(); } catch (error) { if (error && error.code && /^[A-Z_]+$/.test(error.code)) throw error; fail(fallback); } }

module.exports = { cryptoError, fail, safeCrypto };
