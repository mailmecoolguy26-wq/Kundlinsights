'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('subscription entitlement metadata migration is additive and safely backfills only the normalized entitlement', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261010000000_subscription_record_entitlement_metadata.sql'), 'utf8');
  assert.match(sql, /add column if not exists provider_product_id text null/i);
  assert.match(sql, /add column if not exists entitlement_key text null/i);
  assert.match(sql, /set entitlement_key = 'CAREER_PREMIUM'/i);
  assert.match(sql, /product_id in \('career_premium_6_month', 'career_premium_12_month', 'career_premium_annual'\)/i);
  assert.doesNotMatch(sql, /delete\s+from|update\s+app\.subscription_records\s+set\s+original_transaction_id/i);
});
