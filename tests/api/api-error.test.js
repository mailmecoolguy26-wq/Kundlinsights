'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mapApiError } = require('../../src/api/api-error');

test('maps Fastify body-limit errors to a stable safe 413 envelope', () => {
  const mapped = mapApiError({ code: 'FST_ERR_CTP_BODY_TOO_LARGE', stack: 'not public' });
  assert.deepEqual(mapped, { statusCode: 413, body: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large.' } } });
  assert.equal(JSON.stringify(mapped).includes('FST_ERR_CTP_BODY_TOO_LARGE'), false);
  assert.equal(JSON.stringify(mapped).includes('stack'), false);
});
