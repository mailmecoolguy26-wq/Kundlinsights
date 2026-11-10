'use strict';

function fail(code) { const error = new Error(); error.code = code; throw error; }
function reading(row, deck = [], selectedCards = []) { return { id: row.id, userId: row.user_id, question: row.question, category: row.category, spreadType: row.spread_type, status: row.status, rulesVersion: row.rules_version, entitlementSource: row.entitlement_source, language: row.language, quotaDay: String(row.quota_day).slice(0,10), deck, selectedCards, interpretation: row.final_interpretation, interpretationVersion: row.interpretation_version, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(), completedAt: row.completed_at && new Date(row.completed_at).toISOString(), deletedAt: row.deleted_at && new Date(row.deleted_at).toISOString() }; }
const COLUMNS = 'id,user_id,question,category,spread_type,status,rules_version,entitlement_source,language,quota_day,final_interpretation,interpretation_version,created_at,updated_at,completed_at,deleted_at';
class PostgresTarotRepository {
  constructor({ transactionExecutor, idGenerator } = {}) { if (!transactionExecutor || typeof transactionExecutor.execute !== 'function') throw new TypeError('INVALID_TAROT_TRANSACTION_EXECUTOR'); this.tx = transactionExecutor; this.id = idGenerator; }
  async _run(principal, operation) { return this.tx.execute({ principal, role: 'app_runtime', operation }); }
  async _hydrate(db, row) { const deck = (await db.query('select deck_json from app.tarot_reading_decks where reading_id=$1', [row.id])).rows[0]; const cards = await db.query('select position,card_id,selection_token,orientation,selected_at from app.tarot_reading_cards where reading_id=$1 order by position', [row.id]); return reading(row, deck ? deck.deck_json : [], cards.rows.map((c) => ({ position: c.position, cardId: c.card_id, token: c.selection_token, orientation: c.orientation, selectedAt: new Date(c.selected_at).toISOString() }))); }
  async createWithEntitlement(input) { return this._run(input.principal, async ({ db }) => {
    await db.query('select pg_advisory_xact_lock(hashtext($1))', [`tarot:${input.userId}`]);
    const prior = await db.query(`select ${COLUMNS} from app.tarot_readings where user_id=$1 and creation_idempotency_key=$2`, [input.userId,input.idempotencyKey]);
    if (prior.rows.length) return { reading: await this._hydrate(db, prior.rows[0]), created: false };
    const daily = await db.query("select 1 from app.tarot_readings where user_id=$1 and quota_day=$2 and entitlement_source='FREE_DAILY'", [input.userId,input.quotaDay]);
    let source = 'FREE_DAILY', grantId = null;
    if (daily.rows.length) {
      const grant = await db.query('select id from app.tarot_credit_grants where user_id=$1 and consumed_quantity < granted_quantity order by created_at,id for update skip locked limit 1', [input.userId]);
      if (!grant.rows.length) return { purchaseRequired: true };
      source = 'PAID_CREDIT'; grantId = grant.rows[0].id;
      await db.query('update app.tarot_credit_grants set consumed_quantity=consumed_quantity+1,updated_at=$2 where id=$1', [grantId,input.createdAt]);
    }
    const inserted = (await db.query(`insert into app.tarot_readings (id,user_id,question,category,spread_type,status,rules_version,entitlement_source,language,quota_day,creation_idempotency_key,created_at,updated_at) values ($1,$2,$3,$4,$5,'DRAWING',$6,$7,$8,$9,$10,$11,$11) returning ${COLUMNS}`, [input.id,input.userId,input.question,input.category,input.spreadType,input.rulesVersion,source,input.language,input.quotaDay,input.idempotencyKey,input.createdAt])).rows[0];
    await db.query('insert into app.tarot_reading_decks (reading_id,deck_json,created_at) values ($1,$2,$3)', [input.id,JSON.stringify(input.deck),input.createdAt]);
    if (grantId) await db.query("insert into app.tarot_credit_ledger (id,user_id,reading_id,grant_id,entry_type,quantity,created_at) values ($1,$2,$3,$4,'CONSUMPTION',-1,$5)", [this.id(),input.userId,input.id,grantId,input.createdAt]);
    return { reading: await this._hydrate(db, inserted), created: true };
  }); }
  async selectCard(input) { return this._run(input.principal, async ({ db }) => {
    const replay = await db.query('select response_json from app.tarot_selection_requests where reading_id=$1 and idempotency_key=$2', [input.readingId,input.idempotencyKey]); if (replay.rows.length) { const owned=await db.query(`select ${COLUMNS} from app.tarot_readings where id=$1 and user_id=$2`,[input.readingId,input.userId]); if(!owned.rows.length) fail('TAROT_READING_NOT_FOUND'); return {...replay.rows[0].response_json,reading:await this._hydrate(db,owned.rows[0]),needsInterpretation:false}; }
    const found = await db.query(`select ${COLUMNS} from app.tarot_readings where id=$1 and user_id=$2 for update`, [input.readingId,input.userId]); if (!found.rows.length) fail('TAROT_READING_NOT_FOUND');
    const current = await this._hydrate(db, found.rows[0]); if (current.selectedCards.length >= 3) fail('TAROT_READING_COMPLETE');
    const hidden = current.deck.find((item) => item.token === input.token); if (!hidden || current.selectedCards.some((item) => item.token === input.token)) fail('INVALID_TAROT_SELECTION');
    const selectedCard = { token: input.token, cardId: hidden.cardId, position: current.selectedCards.length + 1, orientation: 'UPRIGHT', selectedAt: input.selectedAt };
    await db.query("insert into app.tarot_reading_cards (reading_id,position,card_id,selection_token,orientation,selected_at) values ($1,$2,$3,$4,'UPRIGHT',$5)", [input.readingId,selectedCard.position,selectedCard.cardId,selectedCard.token,input.selectedAt]);
    const nextStatus = selectedCard.position === 3 ? 'INTERPRETING' : 'DRAWING'; const row = (await db.query(`update app.tarot_readings set status=$2,updated_at=$3 where id=$1 returning ${COLUMNS}`, [input.readingId,nextStatus,input.selectedAt])).rows[0];
    const next = await this._hydrate(db,row); const response = { reading: next, selectedCard, needsInterpretation: nextStatus === 'INTERPRETING' };
    await db.query('insert into app.tarot_selection_requests (reading_id,idempotency_key,response_json,created_at) values ($1,$2,$3,$4)', [input.readingId,input.idempotencyKey,JSON.stringify(response),input.selectedAt]); return response;
  }); }
  async get(input) { return this._run(input.principal, async ({ db }) => { const out = await db.query(`select ${COLUMNS} from app.tarot_readings where id=$1 and user_id=$2 and deleted_at is null`, [input.readingId,input.userId]); if (!out.rows.length) fail('TAROT_READING_NOT_FOUND'); return this._hydrate(db,out.rows[0]); }); }
  async list(input) { return this._run(input.principal, async ({ db }) => { const values=[input.userId,input.limit]; let filter=''; if(input.cursor){ const split=input.cursor.lastIndexOf(':'); if(split<1) fail('INVALID_TAROT_CURSOR'); values.push(input.cursor.slice(0,split),input.cursor.slice(split+1)); filter='and (created_at,id)<($3::timestamptz,$4)'; } const rows=(await db.query(`select ${COLUMNS} from app.tarot_readings where user_id=$1 and deleted_at is null ${filter} order by created_at desc,id desc limit $2`,values)).rows; return Promise.all(rows.map((row)=>this._hydrate(db,row))); }); }
  async finalize(input) { return this._run(input.principal, async ({db}) => this._hydrate(db,(await db.query(`update app.tarot_readings set status='COMPLETED',final_interpretation=$3,interpretation_version=$4,completed_at=$5,updated_at=$5 where id=$1 and user_id=$2 and status<>'COMPLETED' returning ${COLUMNS}`, [input.readingId,input.userId,JSON.stringify(input.interpretation),input.interpretationVersion,input.completedAt])).rows[0] || (await db.query(`select ${COLUMNS} from app.tarot_readings where id=$1 and user_id=$2`,[input.readingId,input.userId])).rows[0])); }
  async markRetryable(input) { return this._state(input,"INTERPRETATION_RETRYABLE",['INTERPRETING','INTERPRETATION_RETRYABLE']); }
  async beginRetry(input) { return this._state(input,'INTERPRETING',['INTERPRETATION_RETRYABLE']); }
  async _state(input,next,allowed) { return this._run(input.principal, async({db})=>{ const row=(await db.query(`update app.tarot_readings set status=$3,updated_at=$4 where id=$1 and user_id=$2 and status=any($5::text[]) returning ${COLUMNS}`,[input.readingId,input.userId,next,input.updatedAt,allowed])).rows[0]; if(!row) fail('TAROT_INTERPRETATION_NOT_RETRYABLE'); return this._hydrate(db,row); }); }
  async entitlement(input) { return this._run(input.principal, async({db})=>{ const free=!(await db.query("select 1 from app.tarot_readings where user_id=$1 and quota_day=$2 and entitlement_source='FREE_DAILY'",[input.userId,input.quotaDay])).rows.length; const paid=await db.query('select coalesce(sum(granted_quantity-consumed_quantity),0)::int as remaining from app.tarot_credit_grants where user_id=$1',[input.userId]); return {freeReadingAvailableToday:free,paidCreditsRemaining:paid.rows[0].remaining}; }); }
}
module.exports = { PostgresTarotRepository };
