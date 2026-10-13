'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('subscription profile-scope migration is additive and prevents profile transfer', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261011000000_profile_scoped_career_premium_subscriptions.sql'), 'utf8');
  assert.match(sql, /add column if not exists birth_profile_id text null/i);
  assert.match(sql, /references app\.birth_profiles\(id\) on delete restrict/i);
  assert.match(sql, /old\.birth_profile_id is not null/i);
  assert.match(sql, /new\.birth_profile_id is distinct from old\.birth_profile_id/i);
  assert.match(sql, /subscription birth profile is immutable/i);
  assert.doesNotMatch(sql, /update\s+app\.subscription_records\s+set\s+birth_profile_id/i);
  assert.doesNotMatch(sql, /delete\s+from/i);
});
