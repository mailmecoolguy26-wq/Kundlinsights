# Razorpay payment foundation

Razorpay is disabled unless all server-only configuration is supplied: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `RAZORPAY_PRODUCT_CATALOG_JSON`. The launch catalog entry is `[ {"logicalSku":"career_premium_annual","amountMinor":58882,"currency":"INR"} ]`. This is a one-time payment granting one year of Career Premium access; it does not create a Razorpay recurring Plan.

The server-side commercial breakdown is base ₹499.00 (49900 paise), GST 18% ₹89.82 (8982 paise), total ₹588.82 (58882 paise). Checkout always receives only the authoritative total; no Flutter-provided amount, currency, or SKU is trusted.

The mobile build may receive only `RAZORPAY_KEY_ID`. It creates an authenticated internal order, opens Standard Checkout, and sends success evidence to the backend. The backend validates the checkout HMAC, fetches the authoritative Razorpay payment, requires a captured payment with the exact persisted order, amount, and currency, then runs the existing canonical purchase finalization path.

## Dashboard setup (future Test Mode)

1. Create Test Mode keys and set the three server variables only in the deployment secret store. Never place a key secret or webhook secret in Flutter, source control, or a Dart define.
2. Configure webhook URL: `https://<api-host>/v1/payments/razorpay/webhook`.
3. Subscribe to `payment.captured` and `order.paid`.
4. Set the dashboard webhook secret to the same value as `RAZORPAY_WEBHOOK_SECRET`. The route verifies the exact raw request body before parsing it.
5. Use a distinct endpoint and secret for Live Mode. Rotate by creating the replacement secret in the dashboard and deployment store, deploy it, verify Test/Live delivery, then revoke the old dashboard secret. Do not log either value.

No live keys, recurring Plans, refunds, settlements, or final product pricing are part of this foundation.
