'use strict';
// TEST_ONLY: never export from the production API entrypoint.
function createTestOnlyAuthVerifier(tokens) { return Object.freeze({ async verifyRequest(request) { const header = request.headers.authorization; const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null; const principal = token && tokens[token]; if (!principal) { const error = new Error(); error.code = 'INVALID_AUTH_PRINCIPAL'; throw error; } return principal; } }); }
module.exports = { createTestOnlyAuthVerifier };
