'use strict';

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function text(value) { return typeof value === 'string' && value.length > 0; }

function decodeGoogleRtdn({ envelope, packageName } = {}) {
  if (!envelope || typeof envelope !== 'object' || !envelope.message || typeof envelope.message !== 'object') fail('INVALID_GOOGLE_RTDN');
  const message = envelope.message;
  if (!text(message.messageId) || !text(message.data)) fail('INVALID_GOOGLE_RTDN');
  let notification;
  try {
    const decoded = Buffer.from(message.data, 'base64');
    if (!decoded.length || decoded.toString('base64').replace(/=+$/, '') !== message.data.replace(/=+$/, '')) fail('INVALID_GOOGLE_RTDN');
    notification = JSON.parse(decoded.toString('utf8'));
  } catch { fail('INVALID_GOOGLE_RTDN'); }
  if (!notification || typeof notification !== 'object' || notification.version !== '1.0' || notification.packageName !== packageName) fail('INVALID_GOOGLE_RTDN');
  let providerEventTime = null;
  if (text(notification.eventTimeMillis)) {
    try { providerEventTime = new Date(Number(notification.eventTimeMillis)).toISOString(); }
    catch { fail('INVALID_GOOGLE_RTDN'); }
  }
  const base = { provider: 'GOOGLE', environment: 'PRODUCTION', providerEventId: message.messageId, providerEventTime };
  if (notification.testNotification) return Object.freeze({ ...base, kind: 'TEST', eventType: 'TEST_NOTIFICATION' });
  const subscription = notification.subscriptionNotification;
  if (!subscription) return Object.freeze({ ...base, kind: 'IGNORED', eventType: 'UNSUPPORTED_NOTIFICATION' });
  if (subscription.version !== '1.0' || !Number.isInteger(subscription.notificationType) || !text(subscription.purchaseToken)) fail('INVALID_GOOGLE_RTDN');
  return Object.freeze({ ...base, kind: 'SUBSCRIPTION', eventType: `SUBSCRIPTION_${subscription.notificationType}`, notificationType: subscription.notificationType, purchaseToken: subscription.purchaseToken });
}

module.exports = { decodeGoogleRtdn };
