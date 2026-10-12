-- Provider product identity and normalized entitlement metadata are additive.
-- Existing subscription lineage remains immutable and legacy rows stay valid.
alter table app.subscription_records
  add column if not exists provider_product_id text null check (provider_product_id is null or provider_product_id <> ''),
  add column if not exists entitlement_key text null check (entitlement_key is null or entitlement_key <> '');

-- The legacy logical plan is sufficient to backfill the shared entitlement;
-- historical provider SKU values are deliberately left null when unavailable.
update app.subscription_records
set entitlement_key = 'CAREER_PREMIUM'
where entitlement_key is null
  and product_id in ('career_premium_6_month', 'career_premium_12_month', 'career_premium_annual');

comment on column app.subscription_records.provider_product_id is 'Exact provider SKU/product identifier for the latest verified subscription state.';
comment on column app.subscription_records.entitlement_key is 'Normalized product entitlement independent of provider SKU and billing plan.';
