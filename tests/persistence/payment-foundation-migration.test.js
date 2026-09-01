'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260901000000_payment_foundation.sql'), 'utf8').toLowerCase();

test('payment foundation migration creates bounded, owned, idempotent records', () => {
  for (const table of ['purchase_records', 'subscription_records', 'payment_events']) assert.match(sql, new RegExp(`create table app\\.${table} \\(`));
  assert.match(sql, /unique \(provider, environment, provider_transaction_id\)/);
  assert.match(sql, /unique \(provider, environment, original_transaction_id\)/);
  assert.match(sql, /unique \(provider, environment, provider_event_id\)/);
  assert.match(sql, /user_id text not null references app\.users\(id\) on delete restrict/);
  assert.match(sql, /payment_transaction_id text null references app\.payment_transactions\(id\) on delete restrict/);
  assert.match(sql, /status in \('active', 'grace_period', 'canceled', 'expired', 'revoked', 'refunded'\)/);
  assert.doesNotMatch(sql, /raw.*payload|authorization|access_token|private_key/);
});
