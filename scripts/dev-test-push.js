'use strict';

// Local-only Firebase delivery helper. There is intentionally no HTTP equivalent.
const { NotificationType, DestinationType } = require('../src/application/notifications');
const { FirebasePushNotificationProvider } = require('../src/infrastructure/push/firebase-push-notification-provider');
const type = process.env.DEV_PUSH_TYPE || NotificationType.READING_READY;
const destinationType = process.env.DEV_PUSH_DESTINATION || DestinationType.READING_DETAIL;
const userId = process.env.DEV_PUSH_USER_ID;
if (!userId || type === NotificationType.CAREER_TIMING_SIGNAL || !Object.values(NotificationType).includes(type) || !Object.values(DestinationType).includes(destinationType)) throw new Error('INVALID_DEV_PUSH_CONFIGURATION');
const provider = FirebasePushNotificationProvider.fromEnvironment();
if (!provider) throw new Error('FIREBASE_PROVIDER_UNAVAILABLE');
// Device lookup is deliberately not implemented as a public database path. Invoke this
// only through a local trusted runtime with a known active DEV token provisioned by ops.
const token = process.env.DEV_PUSH_TOKEN;
if (!token) throw new Error('DEV_PUSH_TOKEN_REQUIRED');
provider.send({ token, title: 'TaraVerse test notification', body: 'This is a safe development push test.', data: { notificationType: type, campaignId: 'dev-test', destinationType, ...(process.env.DEV_PUSH_BIRTH_PROFILE_ID ? { birthProfileId: process.env.DEV_PUSH_BIRTH_PROFILE_ID } : {}), ...(process.env.DEV_PUSH_READING_ID ? { readingId: process.env.DEV_PUSH_READING_ID } : {}) } }).then((result) => { if (!result.accepted) process.exitCode = 1; else process.stdout.write(`sent ${result.provider}\n`); });
