'use strict';

const { verifiedPrincipal } = require('../../security/auth');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function required(value, code) { if (typeof value !== 'string' || !value.trim()) fail(code); return value.trim(); }
function titleFor(message) { const value = required(message, 'INVALID_TARA_MESSAGE').replace(/\s+/g, ' ').trim(); return value.length <= 72 ? value : `${value.slice(0, 69).trimEnd()}…`; }
function publicConversation(row) { return Object.freeze({ conversationId: row.id, birthProfileId: row.birth_profile_id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at, lastMessagePreview: row.last_message_preview || null }); }
function publicMessage(row) { return Object.freeze({ messageId: row.id, role: row.role, content: row.content, createdAt: row.created_at }); }

class TaraConversationService {
  constructor({ authUserResolver, birthProfileService, transactionExecutor, taraOrchestrator, idGenerator, clock } = {}) {
    if (!authUserResolver || !birthProfileService || !transactionExecutor || typeof transactionExecutor.execute !== 'function' || !taraOrchestrator || typeof taraOrchestrator.respond !== 'function' || !idGenerator || !clock) throw new TypeError('INVALID_TARA_CONVERSATION_SERVICE');
    this.auth = authUserResolver; this.profiles = birthProfileService; this.tx = transactionExecutor; this.tara = taraOrchestrator; this.ids = idGenerator; this.clock = clock;
  }
  async _user(principal) { const verified = verifiedPrincipal(principal); const user = await this.auth(verified); if (!user || user.status !== 'active') fail('APP_USER_DISABLED'); return { verified, user }; }
  async _profile(principal, user, birthProfileId) { const profile = await this.profiles.get({ principal, birthProfileId: required(birthProfileId, 'INVALID_BIRTH_PROFILE_ID') }); if (!profile || profile.id !== birthProfileId) fail('NOT_FOUND_OR_FORBIDDEN'); return profile; }
  async _runtime(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation: ({ db }) => operation(db) }); }
  async create({ principal, birthProfileId, title } = {}) { const { verified, user } = await this._user(principal); await this._profile(verified, user, birthProfileId); const now = this.clock(); const row = (await this._runtime(verified, (db) => db.query('insert into app.tara_conversations (id,user_id,birth_profile_id,title,created_at,updated_at) values ($1,$2,$3,$4,$5,$5) returning id,birth_profile_id,title,created_at,updated_at', [this.ids(), user.id, birthProfileId, title && String(title).trim() ? String(title).trim().slice(0, 120) : 'New conversation', now]))).rows[0]; return publicConversation(row); }
  async list({ principal, birthProfileId } = {}) { const { verified, user } = await this._user(principal); await this._profile(verified, user, birthProfileId); const rows = (await this._runtime(verified, (db) => db.query(`select c.id,c.birth_profile_id,c.title,c.created_at,c.updated_at,(select m.content from app.tara_conversation_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) as last_message_preview from app.tara_conversations c where c.user_id=$1 and c.birth_profile_id=$2 order by c.updated_at desc,c.id asc`, [user.id, birthProfileId]))).rows; return Object.freeze(rows.map(publicConversation)); }
  async get({ principal, birthProfileId, conversationId } = {}) { const { verified, user } = await this._user(principal); await this._profile(verified, user, birthProfileId); const stored = await this._runtime(verified, async (db) => { const row = (await db.query('select id,birth_profile_id,title,created_at,updated_at from app.tara_conversations where id=$1 and user_id=$2 and birth_profile_id=$3', [required(conversationId, 'INVALID_TARA_CONVERSATION_ID'), user.id, birthProfileId])).rows[0]; if (!row) fail('NOT_FOUND_OR_FORBIDDEN'); const messages = (await db.query('select id,role,content,created_at from app.tara_conversation_messages where conversation_id=$1 order by created_at asc,id asc', [conversationId])).rows; return { row, messages }; }); return Object.freeze({ conversation: publicConversation(stored.row), messages: Object.freeze(stored.messages.map(publicMessage)) }); }
  async message({ principal, birthProfileId, conversationId, body = {} } = {}) { const message = required(body.message, 'INVALID_TARA_MESSAGE'); if (message.length > 2000) fail('INVALID_TARA_MESSAGE'); const { verified, user } = await this._user(principal); await this._profile(verified, user, birthProfileId); const existing = await this.get({ principal: verified, birthProfileId, conversationId }); const context = existing.messages.slice(-8).map((item) => ({ role: item.role === 'user' ? 'USER' : 'ASSISTANT', text: item.content })); const now = this.clock(); const userMessage = publicMessage((await this._runtime(verified, (db) => db.query('insert into app.tara_conversation_messages (id,conversation_id,role,content,created_at) values ($1,$2,$3,$4,$5) returning id,role,content,created_at', [this.ids(), conversationId, 'user', message, now]))).rows[0]);
    let response;
    try { response = await this.tara.respond({ principal: verified, birthProfileId, message, conversationContext: context, language: body.language || 'ENGLISH' }); } catch (error) { throw error; }
    const content = response.message;
    const assistantMessage = publicMessage((await this._runtime(verified, (db) => db.query('insert into app.tara_conversation_messages (id,conversation_id,role,content,created_at) values ($1,$2,$3,$4,$5) returning id,role,content,created_at', [this.ids(), conversationId, 'assistant', content, this.clock()]))).rows[0]);
    await this._runtime(verified, (db) => db.query('update app.tara_conversations set title=case when title=$4 then $5 else title end,updated_at=$6 where id=$1 and user_id=$2 and birth_profile_id=$3', [conversationId, user.id, birthProfileId, 'New conversation', titleFor(message), this.clock()]));
    return Object.freeze({ userMessage, assistantMessage, tara: response });
  }
}

module.exports = { TaraConversationService };
