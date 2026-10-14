'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };

test('POST Tara message exposes the allowlisted Career Premium action', async () => {
  const service = {
    create: async () => ({}),
    list: async () => [],
    get: async () => ({}),
    message: async () => ({
      userMessage: { messageId: 'user-1', role: 'user', content: 'When is my career likely to improve?' },
      assistantMessage: {
        messageId: 'assistant-1',
        role: 'assistant',
        content: 'I can see a stronger Career window for this profile, but the exact timing is part of Career Premium.',
        action: { type: 'OPEN_CAREER_PREMIUM', label: 'Unlock Career Premium' },
      },
      tara: { career: { state: 'PREMIUM_REQUIRED' } },
    }),
  };
  const api = createApi({
    authVerifier: createTestOnlyAuthVerifier({ token: principal }),
    userResolver: { resolve: async () => ({ id: 'user-a', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: {},
    taraConversationService: service,
    requestIdGenerator: () => 'request-1',
  });

  const response = await api.inject({
    method: 'POST',
    url: '/v1/birth-profiles/profile-a/tara/conversations/conversation-a/messages',
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    payload: { message: 'When is my career likely to improve?' },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.json().assistantMessage.action, {
    type: 'OPEN_CAREER_PREMIUM',
    label: 'Unlock Career Premium',
  });
  await api.close();
});
