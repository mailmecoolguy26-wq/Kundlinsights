'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaraConversationService } = require('../../src/application/tara-conversations/tara-conversation-service');
const { TaraOrchestrator, TaraCareerCapability } = require('../../src/application/tara');

const principal = Object.freeze({ provider: 'supabase', subject: 'subject-a', isAnonymous: false });
const otherPrincipal = Object.freeze({ provider: 'supabase', subject: 'subject-b', isAnonymous: false });

function fixture({ taraOrchestrator, careerEntitlementResolver = null, metadataAsJsonString = false } = {}) {
  const conversations = [];
  const messages = [];
  let next = 0;
  const db = {
    async query(sql, values) {
      if (sql.startsWith('insert into app.tara_conversations')) {
        const [id, userId, birthProfileId, title, createdAt] = values;
        const row = { id, user_id: userId, birth_profile_id: birthProfileId, title, created_at: createdAt, updated_at: createdAt };
        conversations.push(row);
        return { rows: [row] };
      }
      if (sql.includes('from app.tara_conversations c')) {
        const [userId, birthProfileId] = values;
        return { rows: conversations.filter((item) => item.user_id === userId && item.birth_profile_id === birthProfileId).map((item) => ({ ...item, last_message_preview: messages.filter((message) => message.conversation_id === item.id).at(-1)?.content || null })) };
      }
      if (sql.startsWith('select id,birth_profile_id,title')) {
        const [id, userId, birthProfileId] = values;
        return { rows: conversations.filter((item) => item.id === id && item.user_id === userId && item.birth_profile_id === birthProfileId) };
      }
      if (sql.startsWith('select id,role,content,created_at')) {
        return { rows: messages.filter((item) => item.conversation_id === values[0]).map((item) => ({ ...item, metadata: metadataAsJsonString ? JSON.stringify(item.metadata) : item.metadata })) };
      }
      if (sql.startsWith('insert into app.tara_conversation_messages')) {
        const [id, conversationId, role, content, createdAt, metadata] = values;
        const row = { id, conversation_id: conversationId, role, content, created_at: createdAt, metadata: metadata ? JSON.parse(metadata) : {} };
        messages.push(row);
        return { rows: [row] };
      }
      if (sql.startsWith('update app.tara_conversations')) {
        const [id, userId, birthProfileId, originalTitle, nextTitle, updatedAt] = values;
        const row = conversations.find((item) => item.id === id && item.user_id === userId && item.birth_profile_id === birthProfileId);
        if (row) { if (row.title === originalTitle) row.title = nextTitle; row.updated_at = updatedAt; }
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const service = new TaraConversationService({
    authUserResolver: async (value) => ({ id: value.subject === 'subject-a' ? 'user-a' : 'user-b', status: 'active' }),
    birthProfileService: { get: async ({ principal: value, birthProfileId }) => {
      if ((value.subject === 'subject-a' && birthProfileId === 'profile-a') || (value.subject === 'subject-b' && birthProfileId === 'profile-b')) return { id: birthProfileId };
      const error = new Error('NOT_FOUND_OR_FORBIDDEN'); error.code = 'NOT_FOUND_OR_FORBIDDEN'; throw error;
    } },
    transactionExecutor: { execute: async ({ operation }) => operation({ db }) },
    taraOrchestrator: taraOrchestrator || { respond: async ({ message }) => ({ message: `Grounded: ${message}` }) },
    careerEntitlementResolver,
    idGenerator: () => `id-${++next}`,
    clock: () => '2026-10-14T00:00:00.000Z',
  });
  return { service };
}

test('persists and reloads chronological Ask Tara history for the owned profile', async () => {
  const { service } = fixture();
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  const result = await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'What should I explore next?', language: 'ENGLISH' } });
  assert.equal(result.userMessage.content, 'What should I explore next?');
  assert.equal(result.assistantMessage.content, 'Grounded: What should I explore next?');
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(loaded.conversation.title, 'What should I explore next?');
  const history = await service.list({ principal, birthProfileId: 'profile-a' });
  assert.equal(history.length, 1);
  assert.equal(history[0].lastMessagePreview, 'Grounded: What should I explore next?');
});

test('persists an allowlisted profile premium action only for the same profile thread', async () => {
  const { service } = fixture({ taraOrchestrator: { respond: async () => ({ message: 'Premium required.', action: { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' } }) } });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  const result = await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'When should I switch jobs?' } });
  assert.deepEqual(result.assistantMessage.action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.at(-1).action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
  await assert.rejects(() => service.get({ principal: otherPrincipal, birthProfileId: 'profile-b', conversationId: created.conversationId }), (error) => error.code === 'NOT_FOUND_OR_FORBIDDEN');
});

test('persists and reloads only an allowlisted Career Decision action', async () => {
  const action = { type: 'OPEN_CAREER_DECISION', label: 'Evaluate this job offer', decisionType: 'JOB_OFFER' };
  const { service } = fixture({ taraOrchestrator: { respond: async () => ({ message: 'I need a few details about the offer.', action }) } });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  const result = await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'I got a job offer' } });
  assert.deepEqual(result.assistantMessage.action, action);
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.at(-1).action, action);
});

test('does not suppress a saved Career Decision action when the profile is entitled', async () => {
  const action = { type: 'OPEN_CAREER_DECISION', label: 'Evaluate this job offer', decisionType: 'JOB_OFFER' };
  const premium = { getReadingEntitlementStatus: async () => ({ career: { eligible: true } }) };
  const { service } = fixture({ careerEntitlementResolver: premium, taraOrchestrator: { respond: async () => ({ message: 'I need a few details about the offer.', action }) } });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'I got a job offer' } });
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.at(-1).action, action);
});

test('returns the premium action from POST through the grounded Tara chain', async () => {
  const taraOrchestrator = new TaraOrchestrator({
    careerCapability: new TaraCareerCapability({
      careerAnswerService: {
        answer: async () => ({
          questionType: 'JOB_FAVOURABILITY_TIMING',
          answerability: 'PREMIUM_REQUIRED',
        }),
      },
    }),
  });
  const { service } = fixture({ taraOrchestrator });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  const result = await service.message({
    principal,
    birthProfileId: 'profile-a',
    conversationId: created.conversationId,
    body: { message: 'When is my career likely to improve?' },
  });
  assert.equal(result.tara.career.state, 'PREMIUM_REQUIRED');
  assert.deepEqual(result.assistantMessage.action, {
    type: 'OPEN_PROFILE_PREMIUM',
    label: 'Unlock TaraVerse Premium',
  });
});

test('serializes persisted JSONB action metadata from GET without exposing raw metadata', async () => {
  const { service } = fixture({ metadataAsJsonString: true, taraOrchestrator: { respond: async () => ({ message: 'Premium required.', action: { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' } }) } });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'When should I switch jobs?' } });
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.at(-1).action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
  assert.equal(Object.hasOwn(loaded.messages.at(-1), 'metadata'), false);
});

test('omits malformed or non-allowlisted persisted actions', async () => {
  for (const action of [{ type: 'OPEN_CAREER_PREMIUM', label: 'Unexpected label' }, { type: 'OPEN_OTHER_ACTION', label: 'Unlock Career Premium' }, { type: 'OPEN_CAREER_DECISION', label: 'Go', decisionType: 'UNSAFE_ROUTE' }, 'not-an-action']) {
    const { service } = fixture({ taraOrchestrator: { respond: async () => ({ message: 'Safe response.', action }) } });
    const created = await service.create({ principal, birthProfileId: 'profile-a' });
    const result = await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'When should I switch jobs?' } });
    const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
    assert.equal(result.assistantMessage.action, null);
    assert.equal(loaded.messages.at(-1).action, null);
  }
});

test('hides persisted Career Premium actions when the exact profile becomes entitled', async () => {
  const premium = { getReadingEntitlementStatus: async () => ({ career: { eligible: true } }) };
  const { service } = fixture({ careerEntitlementResolver: premium, taraOrchestrator: { respond: async () => ({ message: 'Premium required.', action: { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' } }) } });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'When should I switch jobs?' } });
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.equal(loaded.messages.at(-1).action, null);
});

test('does not suppress a profile action because a different profile is entitled', async () => {
  const checkedProfiles = [];
  const premium = { getReadingEntitlementStatus: async ({ birthProfileId }) => { checkedProfiles.push(birthProfileId); return { career: { eligible: birthProfileId === 'profile-b' } }; } };
  const { service } = fixture({ careerEntitlementResolver: premium, taraOrchestrator: { respond: async () => ({ message: 'Premium required.', action: { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' } }) } });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'When should I switch jobs?' } });
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.at(-1).action, { type: 'OPEN_PROFILE_PREMIUM', label: 'Unlock TaraVerse Premium' });
  assert.equal(checkedProfiles.every((id) => id === 'profile-a'), true);
});

test('keeps different detected domains in one profile-scoped Tara thread', async () => {
  const careerCalls = [];
  const taraOrchestrator = new TaraOrchestrator({
    careerCapability: {
      respond: async ({ message }) => {
        careerCalls.push(message);
        return { answer: { answerability: 'SUPPORTED', headlineFact: 'Grounded Career context.' } };
      },
    },
  });
  const { service } = fixture({ taraOrchestrator });
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'When could my job switch be relevant?', language: 'ENGLISH' } });
  await service.message({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId, body: { message: 'What does my chart say about marriage?', language: 'ENGLISH' } });
  const loaded = await service.get({ principal, birthProfileId: 'profile-a', conversationId: created.conversationId });
  assert.deepEqual(loaded.messages.map((message) => message.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(careerCalls.length, 1);
  assert.match(loaded.messages.at(-1).content, /not ready to give you a reliable personalized answer/i);
});

test('fails closed for cross-profile and cross-user Ask Tara history access', async () => {
  const { service } = fixture();
  const created = await service.create({ principal, birthProfileId: 'profile-a' });
  await assert.rejects(
    () => service.get({ principal: otherPrincipal, birthProfileId: 'profile-b', conversationId: created.conversationId }),
    (error) => error.code === 'NOT_FOUND_OR_FORBIDDEN',
  );
  await assert.rejects(
    () => service.list({ principal: otherPrincipal, birthProfileId: 'profile-a' }),
    (error) => error.code === 'NOT_FOUND_OR_FORBIDDEN',
  );
});
