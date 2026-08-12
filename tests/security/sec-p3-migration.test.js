'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260812010000_sec_p3_roles_and_rls.sql'), 'utf8');

test('SEC-P3 is a forward-only, server-only RLS migration with least-privilege runtime roles', () => {
  assert.match(migration, /create schema if not exists security/i);
  assert.match(migration, /create role app_runtime nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit/i);
  assert.match(migration, /create role app_worker nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit/i);
  for (const table of ['users', 'birth_profiles', 'reading_records', 'entitlements', 'payment_transactions']) {
    assert.match(migration, new RegExp(`alter table app\\.${table} enable row level security`, 'i'));
    assert.match(migration, new RegExp(`alter table app\\.${table} force row level security`, 'i'));
  }
  assert.match(migration, /function security\.current_auth_subject\(\)/i);
  assert.match(migration, /function security\.current_app_user_id\(\)/i);
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog/i);
  assert.match(migration, /current_setting\('app\.auth_subject', true\)/i);
  assert.match(migration, /revoke all on schema security from public/i);
  assert.match(migration, /revoke all on all tables in schema app from public/i);
  assert.doesNotMatch(migration, /auth\.users/i);
  assert.doesNotMatch(migration, /supabase[-_ ]?(service|sdk)|service_role/i);
  assert.doesNotMatch(migration, /create extension|create table app\.users/i);
});
