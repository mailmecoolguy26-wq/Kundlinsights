# TaraVerse analytics boundary

Analytics is provider-neutral. Product code calls the `Analytics` boundary,
which forwards only allowlisted categorical properties to an adapter. The
default adapter is a no-op; selecting/configuring a production provider is a
deployment decision, not a domain dependency.

## Event names

`signup_completed`, `birth_profile_created`, `career_opened`,
`career_chat_question_sent`, `career_paywall_viewed`, `purchase_started`,
`purchase_failed`, `purchase_completed`, and `career_unlocked`.

Permitted properties are opaque `user_id`/`birth_profile_id`, `platform`,
`app_version`, `screen`, `source`, `sku`, `payment_provider`, `product_type`,
`failure_category`, `is_premium`, and deterministic `intent`.

Never pass DOB, birth time/place/coordinates, names, contact details, chat
messages, rendered answers, chart/evidence data, provider payloads, payment
tokens/signatures/instrument data, credentials, or entitlement secrets.

A future provider implements `AnalyticsProvider.track`. It must not throw into
the caller, and must preserve the property allowlist at its own egress layer.
