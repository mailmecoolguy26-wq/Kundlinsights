'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApi } = require('../../src/api');
const { createTestOnlyAuthVerifier } = require('../../src/api/test-only-auth-verifier');
const { TaraConversationService } = require('../../src/application/tara-conversations/tara-conversation-service');
const { TaraOrchestrator, TaraPropertyCapability } = require('../../src/application/tara');

const principal = { provider: 'supabase', subject: 'subject-a', isAnonymous: false };

function propertyConversationService() {
  const conversations = [];
  const messages = [];
  let next = 0;
  const db = { async query(sql, values) {
    if (sql.startsWith('insert into app.tara_conversations')) {
      const [id, userId, birthProfileId, title, now] = values;
      const row = { id, user_id: userId, birth_profile_id: birthProfileId, title, created_at: now, updated_at: now };
      conversations.push(row); return { rows: [row] };
    }
    if (sql.startsWith('select id,birth_profile_id,title')) return { rows: conversations.filter((row) => row.id === values[0] && row.user_id === values[1] && row.birth_profile_id === values[2]) };
    if (sql.startsWith('select id,role,content,created_at')) return { rows: messages.filter((row) => row.conversation_id === values[0]) };
    if (sql.startsWith('insert into app.tara_conversation_messages')) {
      const [id, conversationId, role, content, createdAt, metadata] = values;
      const row = { id, conversation_id: conversationId, role, content, created_at: createdAt, metadata: metadata ? JSON.parse(metadata) : {} };
      messages.push(row); return { rows: [row] };
    }
    if (sql.startsWith('update app.tara_conversations')) return { rows: [] };
    throw new Error('UNEXPECTED_QUERY');
  } };
  const property = new TaraPropertyCapability({
    propertyAnswerService: {
      answer: async ({ intent }) => ({
        intent,
        answerability: 'SUPPORTED',
        classification: 'MIXED',
        state: 'MIXED',
        strongerWindow: null,
        evidence: { transit: { activeMajor: [] } },
      }),
    },
  });
  return new TaraConversationService({
    authUserResolver: async () => ({ id: 'user-a', status: 'active' }),
    birthProfileService: { get: async ({ birthProfileId }) => birthProfileId === 'profile-a' ? { id: 'profile-a' } : null },
    transactionExecutor: { execute: async ({ operation }) => operation({ db }) },
    taraOrchestrator: new TaraOrchestrator({ careerCapability: { respond: async () => { throw new Error('CAREER_MUST_NOT_RUN'); } }, propertyCapability: property }),
    idGenerator: () => `id-${++next}`,
    clock: () => '2026-10-15T00:00:00.000Z',
  });
}

test('POST Tara message exposes the allowlisted profile premium action', async () => {
  const service = {
    create: async () => ({}),
    list: async () => [],
    get: async () => ({}),
    message: async () => ({
      userMessage: { messageId: 'user-1', role: 'user', content: 'When is my career likely to improve?' },
      assistantMessage: {
        messageId: 'assistant-1',
        role: 'assistant',
        content: 'Personalized insights for this profile are part of TaraVerse Premium.',
        action: { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' },
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
    type: 'OPEN_PROFILE_PREMIUM',
    label: 'Unlock TaraVerse Premium',
  });
  await api.close();
});

test('POST Tara Property message follows the real conversation and routes to the existing Property hub without Life Events', async () => {
  const service = propertyConversationService();
  const api = createApi({
    authVerifier: createTestOnlyAuthVerifier({ token: principal }),
    userResolver: { resolve: async () => ({ id: 'user-a', status: 'active' }) },
    birthProfileService: { create: async () => null, list: async () => [], get: async () => null },
    secureReadingService: {},
    taraConversationService: service,
    requestIdGenerator: () => 'request-property',
  });
  const created = await api.inject({ method: 'POST', url: '/v1/birth-profiles/profile-a/tara/conversations', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, payload: {} });
  const response = await api.inject({
    method: 'POST',
    url: `/v1/birth-profiles/profile-a/tara/conversations/${created.json().conversation.conversationId}/messages`,
    headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
    payload: { message: 'Property lene ka acha time kab hai?', language: 'HINGLISH' },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().tara.domain, 'PROPERTY');
  assert.equal(response.json().tara.capability, 'DOMAIN_HUB_ROUTING');
  assert.deepEqual(response.json().assistantMessage.action, {
    type: 'OPEN_DOMAIN_HUB', label: 'Property outlook dekhein', domain: 'PROPERTY',
  });
  await api.close();
});
