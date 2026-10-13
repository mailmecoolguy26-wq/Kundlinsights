-- Timed one-time provider add-ons reuse the normalized subscription ledger.
-- They are profile-scoped CAREER_PREMIUM records with auto_renew_enabled=false.
-- Provider transaction lineage remains immutable and lifecycle/revocation is
-- resolved against the exact birth_profile_id only.

alter table app.subscription_records
    add column if not exists entitlement_source text null
    check (
        entitlement_source is null
        or entitlement_source in (
            'PRIMARY_SUBSCRIPTION',
            'ADDON_PURCHASE',
            'LEGACY_PROFILE_UNLOCK'
        )
    );

create index if not exists subscription_records_profile_validity_idx
    on app.subscription_records (
        user_id,
        birth_profile_id,
        status,
        valid_until desc,
        id
    );

comment on column app.subscription_records.entitlement_source is
    'PRIMARY_SUBSCRIPTION for renewable provider products; ADDON_PURCHASE for timed non-renewing profile add-ons; LEGACY_PROFILE_UNLOCK for compatible legacy profile-scoped access.';