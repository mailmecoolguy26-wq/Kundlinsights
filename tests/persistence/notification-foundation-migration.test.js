'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260923000000_notification_foundation.sql'), 'utf8').toLowerCase();

test('notification foundation migration is RLS-protected, provider-neutral, and has disabled launch seeds', () => {
  for (const table of ['device_notification_registrations', 'notification_preferences', 'notification_campaigns', 'notification_delivery_events', 'user_notification_activity', 'reading_views', 'career_paywall_interactions']) assert.match(sql, new RegExp(`create table if not exists app\\.${table}`));
  for (const table of ['device_notification_registrations', 'notification_preferences', 'user_notification_activity', 'reading_views', 'career_paywall_interactions']) {
    assert.match(sql, new RegExp(`alter table app\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`alter table app\\.${table} force row level security`));
  }
  assert.match(sql, /unique \(user_id, device_id\)/);
  assert.match(sql, /unique.*idempotency_key|idempotency_key.*unique/);
  assert.match(sql, /check \(type <> 'career_timing_signal'\)/);
  assert.match(sql, /'complete_profile'.*false/);
  assert.match(sql, /'add_career_history'.*false/);
  assert.match(sql, /'unlock_career_premium'.*false/);
  assert.match(sql, /'return_to_reading'.*false/);
  assert.match(sql, /'inactive_user_reengagement'.*false/);
  assert.doesNotMatch(sql, /firebase|fcm|apns|setinterval|settimeout/);
});
