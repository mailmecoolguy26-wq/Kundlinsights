'use strict';

const { freeze } = require('../../synthesis/evidence-node');

const NotificationType = freeze({
  COMPLETE_PROFILE: 'COMPLETE_PROFILE', ADD_CAREER_HISTORY: 'ADD_CAREER_HISTORY',
  UNLOCK_CAREER_PREMIUM: 'UNLOCK_CAREER_PREMIUM', RETURN_TO_READING: 'RETURN_TO_READING',
  INACTIVE_USER_REENGAGEMENT: 'INACTIVE_USER_REENGAGEMENT', READING_READY: 'READING_READY',
  ACCOUNT_UPDATE: 'ACCOUNT_UPDATE', CAREER_TIMING_SIGNAL: 'CAREER_TIMING_SIGNAL',
});
const TriggerType = freeze({ EVENT_DELAY: 'EVENT_DELAY', INACTIVITY: 'INACTIVITY', SCHEDULED_EVALUATION: 'SCHEDULED_EVALUATION', TRANSACTIONAL: 'TRANSACTIONAL' });
const DestinationType = freeze({ HOME: 'HOME', BIRTH_PROFILE: 'BIRTH_PROFILE', CAREER_HISTORY: 'CAREER_HISTORY', CAREER_READING: 'CAREER_READING', CAREER_PAYWALL: 'CAREER_PAYWALL', READING_DETAIL: 'READING_DETAIL' });
const GoalType = freeze({ PROFILE_COMPLETED: 'PROFILE_COMPLETED', CAREER_HISTORY_ADDED: 'CAREER_HISTORY_ADDED', CAREER_UNLOCKED: 'CAREER_UNLOCKED', READING_OPENED: 'READING_OPENED', APP_RETURNED: 'APP_RETURNED' });
const PreferenceKey = freeze({ READING_UPDATES: 'readingUpdates', CAREER_REMINDERS: 'careerReminders', OFFERS_AND_UPDATES: 'offersAndUpdates' });
const DEFAULT_PREFERENCES = freeze({ readingUpdates: true, careerReminders: true, offersAndUpdates: false });
const ALLOWED_PAYLOAD_KEYS = new Set(['notificationType', 'campaignId', 'destinationType', 'birthProfileId', 'readingId']);
const FORBIDDEN_PAYLOAD_KEYS = new Set(['dob', 'birthdate', 'birthtime', 'birthlocation', 'careerhistory', 'dasha', 'gochar', 'prediction', 'astrologyevidence', 'paymentamount', 'paymentdetails']);
const ENGAGEMENT_LIMITS = freeze({ maxPer24Hours: 1, maxPer7Days: 3 });

function fail(code) { const error = new RangeError(code); error.code = code; throw error; }
function requiredString(value, code) { if (typeof value !== 'string' || value.length === 0) fail(code); return value; }
function canonicalNow(now) { const at = new Date(now); if (Number.isNaN(at.getTime())) fail('INVALID_NOTIFICATION_TIME'); return at.toISOString(); }
function normalizedKey(key) { return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase(); }
function assertSafePayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('INVALID_NOTIFICATION_PAYLOAD');
  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizedKey(key);
    if (!ALLOWED_PAYLOAD_KEYS.has(key) || FORBIDDEN_PAYLOAD_KEYS.has(normalized)) fail('UNSAFE_NOTIFICATION_PAYLOAD');
    if (typeof value !== 'string' || !value) fail('INVALID_NOTIFICATION_PAYLOAD');
  }
  return freeze({ ...payload });
}
function renderTemplate(template, values = {}, allowed = []) {
  if (typeof template !== 'string') fail('INVALID_NOTIFICATION_TEMPLATE');
  const allowedSet = new Set(allowed);
  return template.replace(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g, (_, key) => {
    if (!allowedSet.has(key) || typeof values[key] !== 'string') fail('UNSAFE_NOTIFICATION_TEMPLATE');
    return values[key];
  });
}
function preferenceForCampaign(campaign) {
  switch (campaign.type) {
    case NotificationType.RETURN_TO_READING:
    case NotificationType.READING_READY: return PreferenceKey.READING_UPDATES;
    case NotificationType.COMPLETE_PROFILE:
    case NotificationType.ADD_CAREER_HISTORY:
    case NotificationType.UNLOCK_CAREER_PREMIUM:
    case NotificationType.INACTIVE_USER_REENGAGEMENT: return PreferenceKey.CAREER_REMINDERS;
    default: return PreferenceKey.OFFERS_AND_UPDATES;
  }
}

const LAUNCH_CAMPAIGNS = freeze([
  freeze({ id: 'complete-profile-v1', name: 'COMPLETE_PROFILE', type: NotificationType.COMPLETE_PROFILE, enabled: false, priority: 1, audienceRules: [{ predicate: 'HAS_INCOMPLETE_BIRTH_PROFILE' }], triggerType: TriggerType.SCHEDULED_EVALUATION, triggerConfig: {}, titleTemplate: 'Complete your TaraVerse profile', bodyTemplate: 'Apni birth details complete karein taaki TaraVerse aapke liye personalized insights prepare kar sake.', destinationType: DestinationType.BIRTH_PROFILE, destinationConfig: {}, cooldownHours: 24, maxSendsPerUser: null, maxSendsPerPeriod: null, maxPeriodHours: null, goalType: GoalType.PROFILE_COMPLETED }),
  freeze({ id: 'add-career-history-v1', name: 'ADD_CAREER_HISTORY', type: NotificationType.ADD_CAREER_HISTORY, enabled: false, priority: 2, audienceRules: [{ predicate: 'HAS_NO_CAREER_HISTORY' }], triggerType: TriggerType.SCHEDULED_EVALUATION, triggerConfig: {}, titleTemplate: 'Complete your Career timeline', bodyTemplate: 'Apne past Career events add karein. Isse TaraVerse aapke Career patterns ko better understand kar sakta hai.', destinationType: DestinationType.CAREER_HISTORY, destinationConfig: {}, cooldownHours: 24, maxSendsPerUser: 2, maxSendsPerPeriod: null, maxPeriodHours: null, goalType: GoalType.CAREER_HISTORY_ADDED }),
  freeze({ id: 'unlock-career-premium-v1', name: 'UNLOCK_CAREER_PREMIUM', type: NotificationType.UNLOCK_CAREER_PREMIUM, enabled: false, priority: 4, audienceRules: [{ predicate: 'CAREER_NOT_UNLOCKED' }], triggerType: TriggerType.SCHEDULED_EVALUATION, triggerConfig: {}, titleTemplate: 'Explore your complete Career Reading', bodyTemplate: 'Aapki Career Reading mein aur insights available hain. TaraVerse open karke details explore karein.', destinationType: DestinationType.CAREER_PAYWALL, destinationConfig: {}, cooldownHours: 24, maxSendsPerUser: null, maxSendsPerPeriod: null, maxPeriodHours: null, goalType: GoalType.CAREER_UNLOCKED }),
  freeze({ id: 'return-to-reading-v1', name: 'RETURN_TO_READING', type: NotificationType.RETURN_TO_READING, enabled: false, priority: 3, audienceRules: [{ predicate: 'READING_EXISTS' }, { predicate: 'READING_NOT_VIEWED' }], triggerType: TriggerType.SCHEDULED_EVALUATION, triggerConfig: {}, titleTemplate: 'Your Career Reading is ready', bodyTemplate: 'Apni Career Reading explore karein aur important insights review karein.', destinationType: DestinationType.READING_DETAIL, destinationConfig: {}, cooldownHours: 24, maxSendsPerUser: null, maxSendsPerPeriod: null, maxPeriodHours: null, goalType: GoalType.READING_OPENED }),
  freeze({ id: 'inactive-user-reengagement-v1', name: 'INACTIVE_USER_REENGAGEMENT', type: NotificationType.INACTIVE_USER_REENGAGEMENT, enabled: false, priority: 5, audienceRules: [{ predicate: 'INACTIVE_FOR_N_DAYS', days: 7 }], triggerType: TriggerType.INACTIVITY, triggerConfig: { days: 7 }, titleTemplate: 'Come back to TaraVerse', bodyTemplate: 'Aapke personalized insights TaraVerse mein available hain.', destinationType: DestinationType.HOME, destinationConfig: {}, cooldownHours: 168, maxSendsPerUser: null, maxSendsPerPeriod: null, maxPeriodHours: null, goalType: GoalType.APP_RETURNED }),
]);

class DeviceNotificationRegistrationService {
  constructor({ repository, clock = () => new Date().toISOString() } = {}) { if (!repository) throw new TypeError('INVALID_NOTIFICATION_REPOSITORY'); this.repository = repository; this.clock = clock; }
  registerDevice({ userId, deviceId, platform, pushProvider, pushToken, appVersion = null, environment, notificationsEnabled = true }) { return this.repository.upsertDevice({ userId: requiredString(userId, 'INVALID_USER_ID'), deviceId: requiredString(deviceId, 'INVALID_DEVICE_ID'), platform: requiredString(platform, 'INVALID_DEVICE_PLATFORM'), pushProvider: requiredString(pushProvider, 'INVALID_PUSH_PROVIDER'), pushToken: requiredString(pushToken, 'INVALID_PUSH_TOKEN'), appVersion, environment: requiredString(environment, 'INVALID_ENVIRONMENT'), notificationsEnabled: notificationsEnabled === true, now: canonicalNow(this.clock()) }); }
  refreshToken({ userId, deviceId, pushToken }) { return this.repository.refreshDeviceToken({ userId: requiredString(userId, 'INVALID_USER_ID'), deviceId: requiredString(deviceId, 'INVALID_DEVICE_ID'), pushToken: requiredString(pushToken, 'INVALID_PUSH_TOKEN'), now: canonicalNow(this.clock()) }); }
  revokeDevice({ userId, deviceId }) { return this.repository.revokeDevice({ userId: requiredString(userId, 'INVALID_USER_ID'), deviceId: requiredString(deviceId, 'INVALID_DEVICE_ID'), now: canonicalNow(this.clock()) }); }
  listActiveDevicesForUser(userId) { return this.repository.listActiveDevicesForUser(requiredString(userId, 'INVALID_USER_ID')); }
  reassignDeviceSafely({ fromUserId, toUserId, deviceId }) { return this.repository.reassignDeviceSafely({ fromUserId: requiredString(fromUserId, 'INVALID_USER_ID'), toUserId: requiredString(toUserId, 'INVALID_USER_ID'), deviceId: requiredString(deviceId, 'INVALID_DEVICE_ID'), now: canonicalNow(this.clock()) }); }
}
class NotificationPreferencesService {
  constructor({ repository, clock = () => new Date().toISOString() } = {}) { if (!repository) throw new TypeError('INVALID_NOTIFICATION_REPOSITORY'); this.repository = repository; this.clock = clock; }
  getPreferences(userId) { return this.repository.getPreferences(requiredString(userId, 'INVALID_USER_ID')) || freeze({ ...DEFAULT_PREFERENCES }); }
  updatePreferences(userId, partial = {}) { for (const key of Object.keys(partial)) if (!(key in DEFAULT_PREFERENCES) || typeof partial[key] !== 'boolean') fail('INVALID_NOTIFICATION_PREFERENCES'); return this.repository.upsertPreferences({ userId: requiredString(userId, 'INVALID_USER_ID'), ...partial, updatedAt: canonicalNow(this.clock()) }); }
}
class NotificationActivityService {
  constructor({ repository, clock = () => new Date().toISOString() } = {}) { if (!repository) throw new TypeError('INVALID_NOTIFICATION_REPOSITORY'); this.repository = repository; this.clock = clock; }
  recordAppActivity(userId) { return this.repository.recordAppActivity({ userId: requiredString(userId, 'INVALID_USER_ID'), at: canonicalNow(this.clock()) }); }
  recordReadingOpened({ userId, readingId }) { return this.repository.recordReadingOpened({ userId: requiredString(userId, 'INVALID_USER_ID'), readingId: requiredString(readingId, 'INVALID_READING_ID'), at: canonicalNow(this.clock()) }); }
  recordCareerPaywallViewed({ userId, birthProfileId }) { return this.repository.recordCareerPaywallViewed({ userId: requiredString(userId, 'INVALID_USER_ID'), birthProfileId: requiredString(birthProfileId, 'INVALID_BIRTH_PROFILE_ID'), at: canonicalNow(this.clock()) }); }
}
class NotificationAudienceEvaluator {
  evaluate({ rules = [], state = {}, now = new Date().toISOString() } = {}) {
    const matchedRules = []; const failedRules = []; const at = Date.parse(canonicalNow(now));
    for (const rule of rules) {
      const predicate = rule && rule.predicate; let matched;
      switch (predicate) {
        case 'HAS_NO_BIRTH_PROFILE': matched = !state.hasBirthProfile; break;
        case 'HAS_BIRTH_PROFILE': matched = state.hasBirthProfile === true; break;
        case 'HAS_INCOMPLETE_BIRTH_PROFILE': matched = state.hasIncompleteBirthProfile === true; break;
        case 'HAS_NO_CAREER_HISTORY': matched = !state.hasCareerHistory; break;
        case 'HAS_CAREER_HISTORY': matched = state.hasCareerHistory === true; break;
        case 'CAREER_NOT_UNLOCKED': matched = !state.careerUnlocked; break;
        case 'CAREER_UNLOCKED': matched = state.careerUnlocked === true; break;
        case 'VIEWED_CAREER_PAYWALL': matched = state.viewedCareerPaywall === true; break;
        case 'READING_EXISTS': matched = state.readingExists === true; break;
        case 'READING_NOT_VIEWED': matched = state.readingNotViewed === true; break;
        case 'INACTIVE_FOR_N_DAYS': matched = !!state.lastAppActiveAt && at - Date.parse(state.lastAppActiveAt) >= (Number(rule.days) * 86400000); break;
        default: fail('UNKNOWN_NOTIFICATION_AUDIENCE_PREDICATE');
      }
      (matched ? matchedRules : failedRules).push(freeze({ ...rule }));
    }
    return freeze({ matched: failedRules.length === 0, matchedRules: freeze(matchedRules), failedRules: freeze(failedRules) });
  }
}
function isGoalComplete(goalType, state) { return ({ [GoalType.PROFILE_COMPLETED]: !state.hasIncompleteBirthProfile, [GoalType.CAREER_HISTORY_ADDED]: state.hasCareerHistory === true, [GoalType.CAREER_UNLOCKED]: state.careerUnlocked === true, [GoalType.READING_OPENED]: state.readingNotViewed === false, [GoalType.APP_RETURNED]: state.returnedToApp === true })[goalType] === true; }
class NotificationCampaignEligibilityService {
  constructor({ audienceEvaluator = new NotificationAudienceEvaluator(), frequencyPolicy = ENGAGEMENT_LIMITS } = {}) { this.audienceEvaluator = audienceEvaluator; this.frequencyPolicy = frequencyPolicy; }
  evaluate({ campaign, state, preferences = DEFAULT_PREFERENCES, deliveryEvents = [], activeDevices = [], now = new Date().toISOString() } = {}) {
    const reasons = []; const at = Date.parse(canonicalNow(now));
    if (!campaign.enabled) reasons.push('CAMPAIGN_DISABLED');
    if (campaign.startsAt && at < Date.parse(campaign.startsAt)) reasons.push('CAMPAIGN_NOT_STARTED');
    if (campaign.endsAt && at >= Date.parse(campaign.endsAt)) reasons.push('CAMPAIGN_ENDED');
    const audience = this.audienceEvaluator.evaluate({ rules: campaign.audienceRules || [], state, now }); if (!audience.matched) reasons.push('AUDIENCE_MISMATCH');
    if (preferences[preferenceForCampaign(campaign)] !== true) reasons.push('PREFERENCE_DISABLED');
    if (campaign.goalType && isGoalComplete(campaign.goalType, state)) reasons.push('GOAL_COMPLETED');
    const sent = deliveryEvents.filter((event) => event.campaignId === campaign.id && event.deliveredAt);
    const elapsedHours = (event) => (at - Date.parse(event.deliveredAt)) / 3600000;
    if (campaign.cooldownHours && sent.some((event) => elapsedHours(event) < campaign.cooldownHours)) reasons.push('COOLDOWN_ACTIVE');
    if (campaign.maxSendsPerUser && sent.length >= campaign.maxSendsPerUser) reasons.push('CAMPAIGN_CAP_REACHED');
    if (campaign.triggerType !== TriggerType.TRANSACTIONAL) {
      const engagement = deliveryEvents.filter((event) => event.deliveredAt && event.engagement !== false);
      if (engagement.filter((event) => elapsedHours(event) < 24).length >= this.frequencyPolicy.maxPer24Hours) reasons.push('GLOBAL_24H_CAP');
      if (engagement.filter((event) => elapsedHours(event) < 24 * 7).length >= this.frequencyPolicy.maxPer7Days) reasons.push('GLOBAL_7D_CAP');
    }
    if (!activeDevices.some((device) => device.notificationsEnabled && !device.revokedAt)) reasons.push('NO_ACTIVE_DEVICE');
    return freeze({ eligible: reasons.length === 0, exclusionReasons: freeze(reasons), audience });
  }
}
class NoopPushNotificationProvider { async send() { return freeze({ accepted: false, provider: 'NOOP', reason: 'PROVIDER_DISABLED' }); } }
class FakePushNotificationProvider { constructor() { this.requests = []; } async send(request) { this.requests.push(freeze({ ...request })); return freeze({ accepted: true, provider: 'FAKE', providerMessageId: `fake-${this.requests.length}` }); } }
class NotificationService {
  constructor({ repository, provider = new NoopPushNotificationProvider(), clock = () => new Date().toISOString() } = {}) { if (!repository) throw new TypeError('INVALID_NOTIFICATION_REPOSITORY'); this.repository = repository; this.provider = provider; this.clock = clock; }
  async send({ campaign, userId, triggerOccurrenceKey, data = {} } = {}) {
    if (campaign.type === NotificationType.CAREER_TIMING_SIGNAL) fail('NON_EMITTABLE_NOTIFICATION_TYPE');
    const payload = assertSafePayload({ notificationType: campaign.type, campaignId: campaign.id, destinationType: campaign.destinationType, ...data });
    const idempotencyKey = `${campaign.id}:${requiredString(userId, 'INVALID_USER_ID')}:${requiredString(triggerOccurrenceKey, 'INVALID_TRIGGER_OCCURRENCE_KEY')}`;
    const event = this.repository.createDeliveryEvent({ campaignId: campaign.id, notificationType: campaign.type, userId, triggerOccurrenceKey, idempotencyKey, requestedAt: canonicalNow(this.clock()), engagement: campaign.triggerType !== TriggerType.TRANSACTIONAL });
    if (event.deliveredAt || event.deliveryAttemptedAt) return event;
    const devices = this.repository.listActiveDevicesForUser(userId);
    for (const device of devices) {
      try { const result = await this.provider.send({ token: device.pushToken, title: renderTemplate(campaign.titleTemplate), body: renderTemplate(campaign.bodyTemplate), data: payload }); this.repository.recordDeliveryResult({ eventId: event.id, deviceRegistrationId: device.id, result, at: canonicalNow(this.clock()) }); if (result && result.invalidToken === true && typeof this.repository.revokeDevice === 'function') this.repository.revokeDevice({ userId, deviceId: device.deviceId, now: canonicalNow(this.clock()) }); }
      catch (error) { this.repository.recordDeliveryFailure({ eventId: event.id, deviceRegistrationId: device.id, failureReasonCode: 'PROVIDER_FAILURE', at: canonicalNow(this.clock()) }); }
    }
    return this.repository.getDeliveryEvent(event.id);
  }
}
class EngagementCampaignEvaluator {
  constructor({ campaignRepository, userStateRepository, eligibilityService = new NotificationCampaignEligibilityService(), notificationService } = {}) { if (!campaignRepository || !userStateRepository || !notificationService) throw new TypeError('INVALID_NOTIFICATION_EVALUATOR'); this.campaignRepository = campaignRepository; this.userStateRepository = userStateRepository; this.eligibilityService = eligibilityService; this.notificationService = notificationService; }
  async evaluateEngagementCampaigns({ now }) { const campaigns = this.campaignRepository.listActiveEngagementCampaigns().sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)); const results = []; for (const userId of this.userStateRepository.listCandidateUserIds()) { for (const campaign of campaigns) { const result = this.eligibilityService.evaluate({ campaign, state: this.userStateRepository.stateForUser(userId), preferences: this.userStateRepository.preferencesForUser(userId), deliveryEvents: this.userStateRepository.deliveryEventsForUser(userId), activeDevices: this.userStateRepository.activeDevicesForUser(userId), now }); if (result.eligible) { results.push(await this.notificationService.send({ campaign, userId, triggerOccurrenceKey: `${campaign.id}:${canonicalNow(now)}` })); break; } } } return freeze(results); }
}

class NotificationCampaignDryRunService {
  constructor({ campaignRepository, userStateRepository, eligibilityService = new NotificationCampaignEligibilityService() } = {}) { if (!campaignRepository || !userStateRepository) throw new TypeError('INVALID_NOTIFICATION_DRY_RUN'); this.campaignRepository = campaignRepository; this.userStateRepository = userStateRepository; this.eligibilityService = eligibilityService; }
  dryRun({ campaignId, now }) {
    const campaign = this.campaignRepository.getCampaign(campaignId); if (!campaign) fail('NOTIFICATION_CAMPAIGN_NOT_FOUND');
    const aggregate = { eligibleUsers: 0, eligibleDevices: 0, excludedByGoal: 0, excludedByCooldown: 0, excludedByGlobalCap: 0, excludedByPreferences: 0, excludedByMissingDevice: 0, excludedByAudience: 0 };
    for (const userId of this.userStateRepository.listCandidateUserIds()) {
      const activeDevices = this.userStateRepository.activeDevicesForUser(userId);
      const result = this.eligibilityService.evaluate({ campaign, state: this.userStateRepository.stateForUser(userId), preferences: this.userStateRepository.preferencesForUser(userId), deliveryEvents: this.userStateRepository.deliveryEventsForUser(userId), activeDevices, now });
      if (result.eligible) { aggregate.eligibleUsers += 1; aggregate.eligibleDevices += activeDevices.length; continue; }
      for (const reason of result.exclusionReasons) {
        if (reason === 'GOAL_COMPLETED') aggregate.excludedByGoal += 1;
        if (reason === 'COOLDOWN_ACTIVE') aggregate.excludedByCooldown += 1;
        if (reason === 'GLOBAL_24H_CAP' || reason === 'GLOBAL_7D_CAP') aggregate.excludedByGlobalCap += 1;
        if (reason === 'PREFERENCE_DISABLED') aggregate.excludedByPreferences += 1;
        if (reason === 'NO_ACTIVE_DEVICE') aggregate.excludedByMissingDevice += 1;
        if (reason === 'AUDIENCE_MISMATCH') aggregate.excludedByAudience += 1;
      }
    }
    return freeze(aggregate);
  }
}

module.exports = { NotificationType, TriggerType, DestinationType, GoalType, PreferenceKey, DEFAULT_PREFERENCES, ENGAGEMENT_LIMITS, LAUNCH_CAMPAIGNS, assertSafePayload, renderTemplate, preferenceForCampaign, DeviceNotificationRegistrationService, NotificationPreferencesService, NotificationActivityService, NotificationAudienceEvaluator, NotificationCampaignEligibilityService, NoopPushNotificationProvider, FakePushNotificationProvider, NotificationService, EngagementCampaignEvaluator, NotificationCampaignDryRunService, isGoalComplete };
