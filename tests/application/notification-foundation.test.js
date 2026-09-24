'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  NotificationType, DestinationType, GoalType, LAUNCH_CAMPAIGNS, assertSafePayload,
  NotificationAudienceEvaluator, NotificationCampaignEligibilityService,
  FakePushNotificationProvider, NotificationService, DeviceNotificationRegistrationService,
  NotificationPreferencesService,
} = require('../../src/application/notifications');

class MemoryNotificationRepository {
  constructor() { this.devices = []; this.preferences = new Map(); this.events = new Map(); }
  upsertDevice(input) { const old = this.devices.find((d) => d.userId === input.userId && d.deviceId === input.deviceId); const row = Object.freeze({ ...(old || { id: `device-${this.devices.length + 1}`, createdAt: input.now }), ...input, revokedAt: null, lastRegisteredAt: input.now }); if (old) this.devices[this.devices.indexOf(old)] = row; else this.devices.push(row); return row; }
  refreshDeviceToken({ userId, deviceId, pushToken, now }) { const old = this.devices.find((d) => d.userId === userId && d.deviceId === deviceId); if (!old) throw new RangeError('DEVICE_NOT_FOUND'); const row = Object.freeze({ ...old, pushToken, lastRegisteredAt: now }); this.devices[this.devices.indexOf(old)] = row; return row; }
  revokeDevice({ userId, deviceId, now }) { const old = this.devices.find((d) => d.userId === userId && d.deviceId === deviceId); if (!old) throw new RangeError('DEVICE_NOT_FOUND'); const row = Object.freeze({ ...old, revokedAt: now }); this.devices[this.devices.indexOf(old)] = row; return row; }
  listActiveDevicesForUser(userId) { return this.devices.filter((d) => d.userId === userId && !d.revokedAt); }
  reassignDeviceSafely({ fromUserId, toUserId, deviceId, now }) { const old = this.devices.find((d) => d.userId === fromUserId && d.deviceId === deviceId); if (!old) throw new RangeError('DEVICE_NOT_FOUND'); const row = Object.freeze({ ...old, userId: toUserId, lastRegisteredAt: now, revokedAt: null }); this.devices[this.devices.indexOf(old)] = row; return row; }
  getPreferences(userId) { return this.preferences.get(userId) || null; }
  upsertPreferences({ userId, ...rest }) { const row = Object.freeze({ readingUpdates: true, careerReminders: true, offersAndUpdates: false, ...(this.preferences.get(userId) || {}), ...rest }); this.preferences.set(userId, row); return row; }
  createDeliveryEvent(input) { const prior = [...this.events.values()].find((e) => e.idempotencyKey === input.idempotencyKey); if (prior) return prior; const row = Object.freeze({ id: `event-${this.events.size + 1}`, ...input, deliveryAttemptedAt: null, deliveredAt: null }); this.events.set(row.id, row); return row; }
  recordDeliveryResult({ eventId, deviceRegistrationId, result, at }) { const old = this.events.get(eventId); this.events.set(eventId, Object.freeze({ ...old, deviceRegistrationId, deliveryAttemptedAt: at, deliveredAt: result.accepted ? at : null, provider: result.provider, providerMessageId: result.providerMessageId || null })); }
  recordDeliveryFailure({ eventId, deviceRegistrationId, failureReasonCode, at }) { const old = this.events.get(eventId); this.events.set(eventId, Object.freeze({ ...old, deviceRegistrationId, deliveryAttemptedAt: at, failureReasonCode })); }
  getDeliveryEvent(id) { return this.events.get(id); }
}

test('launch campaigns are disabled and never seed Career timing signals', () => {
  assert.equal(LAUNCH_CAMPAIGNS.length, 5);
  assert.ok(LAUNCH_CAMPAIGNS.every((campaign) => campaign.enabled === false));
  assert.ok(LAUNCH_CAMPAIGNS.every((campaign) => campaign.type !== NotificationType.CAREER_TIMING_SIGNAL));
  assert.deepEqual(LAUNCH_CAMPAIGNS.map((campaign) => campaign.priority), [1, 2, 4, 3, 5]);
});

test('payload validator permits navigation identity only and rejects normalized private fields', () => {
  assert.deepEqual(assertSafePayload({ notificationType: 'RETURN_TO_READING', campaignId: 'c', destinationType: DestinationType.READING_DETAIL, readingId: 'r' }), { notificationType: 'RETURN_TO_READING', campaignId: 'c', destinationType: 'READING_DETAIL', readingId: 'r' });
  assert.throws(() => assertSafePayload({ birth_date: 'secret' }), { code: 'UNSAFE_NOTIFICATION_PAYLOAD' });
  assert.throws(() => assertSafePayload({ prediction: 'secret' }), { code: 'UNSAFE_NOTIFICATION_PAYLOAD' });
});

test('audience evaluator is AND-only and reports individual rule results', () => {
  const evaluated = new NotificationAudienceEvaluator().evaluate({ rules: [{ predicate: 'HAS_BIRTH_PROFILE' }, { predicate: 'CAREER_NOT_UNLOCKED' }], state: { hasBirthProfile: true, careerUnlocked: true }, now: '2026-09-22T00:00:00.000Z' });
  assert.equal(evaluated.matched, false); assert.equal(evaluated.matchedRules.length, 1); assert.equal(evaluated.failedRules[0].predicate, 'CAREER_NOT_UNLOCKED');
});

test('eligibility honors deterministic order, goal completion, caps, and device presence', () => {
  const campaign = { ...LAUNCH_CAMPAIGNS[3], enabled: true, startsAt: null, endsAt: null, maxSendsPerUser: null, triggerType: 'SCHEDULED_EVALUATION', goalType: GoalType.READING_OPENED };
  const service = new NotificationCampaignEligibilityService();
  const result = service.evaluate({ campaign, state: { readingExists: true, readingNotViewed: true }, preferences: { readingUpdates: true }, activeDevices: [], deliveryEvents: [], now: '2026-09-22T00:00:00.000Z' });
  assert.deepEqual(result.exclusionReasons, ['NO_ACTIVE_DEVICE']);
  const complete = service.evaluate({ campaign, state: { readingExists: true, readingNotViewed: false }, preferences: { readingUpdates: true }, activeDevices: [{ notificationsEnabled: true }], deliveryEvents: [], now: '2026-09-22T00:00:00.000Z' });
  assert.ok(complete.exclusionReasons.includes('AUDIENCE_MISMATCH')); assert.ok(complete.exclusionReasons.includes('GOAL_COMPLETED'));
});

test('device reassignment revokes no recipient and notification delivery remains idempotent', async () => {
  const repository = new MemoryNotificationRepository(); const at = () => '2026-09-22T00:00:00.000Z';
  const devices = new DeviceNotificationRegistrationService({ repository, clock: at });
  devices.registerDevice({ userId: 'user-a', deviceId: 'physical', platform: 'IOS', pushProvider: 'FAKE', pushToken: 'token-a', environment: 'development' });
  devices.reassignDeviceSafely({ fromUserId: 'user-a', toUserId: 'user-b', deviceId: 'physical' });
  assert.equal(devices.listActiveDevicesForUser('user-a').length, 0); assert.equal(devices.listActiveDevicesForUser('user-b').length, 1);
  const provider = new FakePushNotificationProvider(); const service = new NotificationService({ repository, provider, clock: at });
  const campaign = { ...LAUNCH_CAMPAIGNS[3], enabled: true, triggerType: 'SCHEDULED_EVALUATION' };
  await service.send({ campaign, userId: 'user-b', triggerOccurrenceKey: 'occurrence-1', data: { readingId: 'reading-1' } });
  await service.send({ campaign, userId: 'user-b', triggerOccurrenceKey: 'occurrence-1', data: { readingId: 'reading-1' } });
  assert.equal(provider.requests.length, 1); assert.equal(repository.events.size, 1);
});

test('preference defaults and partial updates are deterministic', () => {
  const repository = new MemoryNotificationRepository(); const preferences = new NotificationPreferencesService({ repository, clock: () => '2026-09-22T00:00:00.000Z' });
  assert.deepEqual(preferences.getPreferences('user-a'), { readingUpdates: true, careerReminders: true, offersAndUpdates: false });
  assert.deepEqual(preferences.updatePreferences('user-a', { offersAndUpdates: true }), { readingUpdates: true, careerReminders: true, offersAndUpdates: true, updatedAt: '2026-09-22T00:00:00.000Z' });
});
