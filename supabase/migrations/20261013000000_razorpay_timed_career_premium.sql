-- Android Career Premium purchases are Razorpay-backed, non-renewing timed
-- access for one owned birth profile. Existing Apple/Google lineage remains
-- untouched.

alter table app.subscription_records
  drop constraint if exists subscription_records_entitlement_source_check;

alter table app.subscription_records
  add constraint subscription_records_entitlement_source_check
  check (
    entitlement_source is null
    or entitlement_source in (
      'PRIMARY_SUBSCRIPTION',
      'ADDON_PURCHASE',
      'RAZORPAY_TIMED_PURCHASE',
      'LEGACY_PROFILE_UNLOCK'
    )
  );

comment on column app.subscription_records.entitlement_source is
  'PRIMARY_SUBSCRIPTION for renewable provider products; ADDON_PURCHASE for Apple/Google timed add-ons; RAZORPAY_TIMED_PURCHASE for Android profile-scoped non-renewing timed purchases; LEGACY_PROFILE_UNLOCK for compatible legacy access.';
