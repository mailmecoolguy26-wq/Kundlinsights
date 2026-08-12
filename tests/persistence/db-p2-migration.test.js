'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationDirectory = path.join(__dirname, '../../supabase/migrations');
const migrationNames = fs.readdirSync(migrationDirectory).filter((name) => /_db_p2_initial_app_schema\.sql$/.test(name));
const migrationPath = path.join(migrationDirectory, migrationNames[0]);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

test('DB-P2 migration defines the portable encrypted application schema and immutable reading boundary', () => {
  assert.equal(migrationNames.length, 1);
  assert.match(migrationNames[0], /^\d{14}_db_p2_initial_app_schema\.sql$/);
  for (const table of ['users', 'birth_profiles', 'payment_transactions', 'entitlements', 'reading_records']) assert.match(sql, new RegExp(`create table app\\.${table} \\(`));
  assert.match(sql, /create schema if not exists app/);
  assert.match(sql, /amount_minor bigint not null check \(amount_minor >= 0\)/);
  assert.doesNotMatch(sql, /\bamount\s+(numeric|decimal|real|double precision|money)\b/);
  assert.match(sql, /unique \(provider, provider_transaction_id\)/);
  assert.match(sql, /create unique index reading_records_user_idempotency_key_idx[\s\S]*where idempotency_key is not null/);
  assert.match(sql, /create function app\.enforce_reading_record_immutability\(\)/);
  assert.match(sql, /raise exception 'reading_record_semantic_immutable'/);
  assert.match(sql, /create trigger reading_records_enforce_immutability[\s\S]*before update on app\.reading_records/);
  assert.match(sql, /on delete restrict/);
  assert.doesNotMatch(sql, /on delete cascade/);
  assert.doesNotMatch(sql, /auth\.users/);
  assert.doesNotMatch(sql, /enable row level security/);
  assert.match(sql, /calculation_digest char\(64\) not null/);
  assert.doesNotMatch(sql, /unique \(calculation_digest\)/);
  assert.match(sql, /birth_payload_ciphertext bytea not null/);
  assert.match(sql, /input_snapshot_ciphertext bytea not null/);
});
