'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260813010000_sec_p3_1_user_subject_rls.sql'), 'utf8');

test('SEC-P3.1 forward migration replaces only the bootstrap-cyclic app.users SELECT policy', () => {
  assert.match(migration, /drop policy app_runtime_select_own_user on app\.users/i);
  assert.match(migration, /create policy app_runtime_select_own_user on app\.users[\s\S]*for select to app_runtime[\s\S]*using \(auth_subject = security\.current_auth_subject\(\)\)/i);
  assert.doesNotMatch(migration, /current_app_user_id/i);
  assert.doesNotMatch(migration, /for insert|with check|grant |bypassrls|force row level security|disable row level security|alter table/i);
});
