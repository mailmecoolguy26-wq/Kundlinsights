'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20260908000000_razorpay_subscription_provider.sql'),
  'utf8',
);

test('Razorpay subscription provider migration changes only the provider check', () => {
  assert.match(sql, /alter table app\.subscription_records drop constraint subscription_records_provider_check;/i);
  assert.match(sql, /alter table app\.subscription_records add constraint subscription_records_provider_check check \(provider in \('APPLE', 'GOOGLE', 'RAZORPAY', 'WEB'\)\);/);
  assert.doesNotMatch(sql, /alter table app\.subscription_records (?!drop constraint subscription_records_provider_check;|add constraint subscription_records_provider_check)/i);
  assert.doesNotMatch(sql, /purchase_records|provider_payment_orders|grant |policy |rls|raw.*payload|authorization|access_token|private_key/i);
});
