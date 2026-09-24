'use strict';

// Firebase Admin is loaded only when a configured provider is constructed.
// Missing credentials fail closed and never turn campaigns on.
class FirebasePushNotificationProvider {
  constructor({ messaging = null } = {}) { this.messaging = messaging; }
  static fromEnvironment({ serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON } = {}) {
    if (!serviceAccountJson) return null;
    let credential;
    try { credential = JSON.parse(serviceAccountJson); } catch { return null; }
    try {
      const admin = require('firebase-admin');
      const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(credential) });
      return new FirebasePushNotificationProvider({ messaging: admin.messaging(app) });
    } catch { return null; }
  }
  async send({ token, title, body, data }) {
    if (!this.messaging) return Object.freeze({ accepted: false, provider: 'FCM', reason: 'PROVIDER_UNAVAILABLE' });
    try {
      const providerMessageId = await this.messaging.send({ token, notification: { title, body }, data });
      return Object.freeze({ accepted: true, provider: 'FCM', providerMessageId });
    } catch (error) {
      const code = error && error.code;
      const invalidToken = code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
      return Object.freeze({ accepted: false, provider: 'FCM', invalidToken, reason: invalidToken ? 'INVALID_TOKEN' : 'PROVIDER_FAILURE' });
    }
  }
}
module.exports = { FirebasePushNotificationProvider };
