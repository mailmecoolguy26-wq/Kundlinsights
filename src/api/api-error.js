'use strict';
const STATUS = Object.freeze({ INVALID_AUTH_PRINCIPAL: 401, ANONYMOUS_AUTH_NOT_ALLOWED: 401, NOT_FOUND_OR_FORBIDDEN: 404, BIRTH_PROFILE_NOT_FOUND: 404, READING_NOT_FOUND: 404, ENTITLEMENT_EXHAUSTED: 403, ENTITLEMENT_REQUIRED: 403, DUPLICATE_READING_IDEMPOTENCY_KEY: 409 });
function mapApiError(error) {
  const code = error && typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';
  if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') return { statusCode: 413, body: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large.' } } };
  const statusCode = STATUS[code] || (code.startsWith('INVALID_') ? 400 : 500);
  return { statusCode, body: { error: { code, message: statusCode >= 500 ? 'Internal server error.' : code } } };
}
module.exports = { mapApiError };
