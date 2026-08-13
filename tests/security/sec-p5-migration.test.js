'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260813000000_sec_p5_user_key_envelopes.sql'), 'utf8').toLowerCase();
test('SEC-P5 is a forward-only wrapped-DEK envelope migration with isolated crypto role and RLS', () => {
  assert.match(sql, /create table app\.user_key_envelopes/); assert.match(sql, /wrapped_dek bytea not null/); assert.match(sql, /unique \(user_id, key_version\)/); assert.match(sql, /where status = 'active'/);
  assert.match(sql, /create role app_crypto nologin nosuperuser nobypassrls/); assert.match(sql, /revoke all on app\.user_key_envelopes from public, app_runtime, app_worker/); assert.match(sql, /force row level security/);
  assert.match(sql, /user_id = \(select security\.current_app_user_id\(\)\)/); assert.match(sql, /prevent_user_key_envelope_mutation/); assert.doesNotMatch(sql, /raw_dek|aws|azure|google/);
});
