'use strict';

const { fail } = require('./crypto-errors');

function required(value, code) { if (typeof value !== 'string' || !value || value.trim() !== value) fail(code); return value; }
function bytes(value) { if (!Buffer.isBuffer(value) || value.length === 0) fail('INVALID_KEY_ENVELOPE'); return value; }
function dbBoundary(db) { if (!db || typeof db.query !== 'function') fail('INVALID_POSTGRES_DB'); return db; }
function fromRow(row) { if (!row) return null; return Object.freeze({ id: row.id, userId: row.user_id, keyVersion: row.key_version, wrappedDek: Buffer.from(row.wrapped_dek), kmsKeyRef: row.kms_key_ref, wrappingAlgorithm: row.wrapping_algorithm, createdAt: new Date(row.created_at).toISOString(), retiredAt: row.retired_at === null ? null : new Date(row.retired_at).toISOString(), status: row.status }); }
function input(value) { return { id: required(value && value.id, 'INVALID_KEY_ENVELOPE_ID'), userId: required(value && value.userId, 'INVALID_USER_ID'), keyVersion: required(value && value.keyVersion, 'INVALID_KEY_VERSION'), wrappedDek: bytes(value && value.wrappedDek), kmsKeyRef: required(value && value.kmsKeyRef, 'INVALID_KMS_METADATA'), wrappingAlgorithm: required(value && value.wrappingAlgorithm, 'INVALID_KMS_METADATA'), createdAt: required(value && value.createdAt, 'INVALID_KEY_ENVELOPE_TIMESTAMP') }; }
function mapped(error, fallback) { if (error && error.code === '23505') fail('ACTIVE_KEY_ENVELOPE_EXISTS'); if (error && error.code && /^[A-Z_]+$/.test(error.code)) throw error; fail(fallback); }
const COLUMNS = 'id,user_id,key_version,wrapped_dek,kms_key_ref,wrapping_algorithm,created_at,retired_at,status';

class PostgresUserKeyEnvelopeStore {
  constructor({ db } = {}) { this.db = dbBoundary(db); }
  withClient(db) { return new PostgresUserKeyEnvelopeStore({ db }); }
  async getActiveEnvelope({ userId } = {}) { const id = required(userId, 'INVALID_USER_ID'); try { const result = await this.db.query(`select ${COLUMNS} from app.user_key_envelopes where user_id=$1 and status='active'`, [id]); return result.rows.length ? fromRow(result.rows[0]) : null; } catch (error) { mapped(error, 'GET_KEY_ENVELOPE_FAILED'); } }
  async getEnvelopeByVersion({ userId, keyVersion } = {}) { const id = required(userId, 'INVALID_USER_ID'); const version = required(keyVersion, 'INVALID_KEY_VERSION'); try { const result = await this.db.query(`select ${COLUMNS} from app.user_key_envelopes where user_id=$1 and key_version=$2`, [id, version]); return result.rows.length ? fromRow(result.rows[0]) : null; } catch (error) { mapped(error, 'GET_KEY_ENVELOPE_FAILED'); } }
  async insertEnvelope(value) { const envelope = input(value); try { const result = await this.db.query(`insert into app.user_key_envelopes (${COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,null,'active') returning ${COLUMNS}`, [envelope.id, envelope.userId, envelope.keyVersion, envelope.wrappedDek, envelope.kmsKeyRef, envelope.wrappingAlgorithm, envelope.createdAt]); return fromRow(result.rows[0]); } catch (error) { mapped(error, 'INSERT_KEY_ENVELOPE_FAILED'); } }
  async rotateEnvelope(value) { const envelope = input(value); try { const result = await this.db.query(`with retired as (update app.user_key_envelopes set status='retired',retired_at=$7 where user_id=$2 and status='active' returning id), inserted as (insert into app.user_key_envelopes (${COLUMNS}) select $1,$2,$3,$4,$5,$6,$7,null,'active' where exists (select 1 from retired) returning ${COLUMNS}) select * from inserted`, [envelope.id, envelope.userId, envelope.keyVersion, envelope.wrappedDek, envelope.kmsKeyRef, envelope.wrappingAlgorithm, envelope.createdAt]); if (!result.rows.length) fail('ACTIVE_KEY_ENVELOPE_NOT_FOUND'); return fromRow(result.rows[0]); } catch (error) { mapped(error, 'ROTATE_KEY_ENVELOPE_FAILED'); } }
}

module.exports = { PostgresUserKeyEnvelopeStore };
