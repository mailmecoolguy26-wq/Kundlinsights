-- Payment foundation: provider-neutral verified purchase, subscription, and event records.

create table app.purchase_records (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  provider text not null check (provider in ('APPLE', 'GOOGLE', 'WEB')),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION')),
  product_id text not null check (product_id <> ''),
  provider_transaction_id text not null check (provider_transaction_id <> ''),
  original_transaction_id text null check (original_transaction_id is null or original_transaction_id <> ''),
  status text not null check (status in ('VERIFIED', 'PENDING', 'REVOKED', 'REFUNDED', 'FAILED')),
  purchased_at timestamptz not null,
  valid_from timestamptz null,
  valid_until timestamptz null check (valid_until is null or valid_from is null or valid_until > valid_from),
  verified_at timestamptz not null,
  payment_transaction_id text null references app.payment_transactions(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (provider, environment, provider_transaction_id)
);

create table app.subscription_records (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  provider text not null check (provider in ('APPLE', 'GOOGLE', 'WEB')),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION')),
  product_id text not null check (product_id <> ''),
  original_transaction_id text not null check (original_transaction_id <> ''),
  status text not null check (status in ('ACTIVE', 'GRACE_PERIOD', 'CANCELED', 'EXPIRED', 'REVOKED', 'REFUNDED')),
  valid_from timestamptz not null,
  valid_until timestamptz not null check (valid_until > valid_from),
  auto_renew_enabled boolean null,
  grace_until timestamptz null,
  canceled_at timestamptz null,
  revoked_at timestamptz null,
  refunded_at timestamptz null,
  latest_purchase_record_id text null references app.purchase_records(id) on delete restrict,
  provider_event_time timestamptz null,
  provider_event_version text null check (provider_event_version is null or provider_event_version <> ''),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (provider, environment, original_transaction_id)
);

create table app.payment_events (
  id text primary key check (id <> ''),
  provider text not null check (provider in ('APPLE', 'GOOGLE', 'WEB')),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION')),
  provider_event_id text not null check (provider_event_id <> ''),
  event_type text not null check (event_type <> ''),
  provider_event_time timestamptz null,
  purchase_record_id text null references app.purchase_records(id) on delete restrict,
  subscription_record_id text null references app.subscription_records(id) on delete restrict,
  received_at timestamptz not null,
  processed_at timestamptz null,
  processing_status text not null check (processing_status in ('RECEIVED', 'PROCESSED', 'FAILED')),
  failure_code text null check (failure_code is null or failure_code <> ''),
  payload_digest char(64) null check (payload_digest is null or payload_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null,
  unique (provider, environment, provider_event_id)
);

create index purchase_records_user_purchased_idx on app.purchase_records (user_id, purchased_at desc, id);
create index subscription_records_user_status_validity_idx on app.subscription_records (user_id, status, valid_until desc, id);
create index payment_events_subscription_received_idx on app.payment_events (subscription_record_id, received_at desc, id);

alter table app.purchase_records enable row level security;
alter table app.subscription_records enable row level security;
alter table app.payment_events enable row level security;
alter table app.purchase_records force row level security;
alter table app.subscription_records force row level security;
alter table app.payment_events force row level security;

create policy app_runtime_select_own_purchase_records on app.purchase_records for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_subscription_records on app.subscription_records for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_worker_manage_purchase_records on app.purchase_records for all to app_worker using (true) with check (true);
create policy app_worker_manage_subscription_records on app.subscription_records for all to app_worker using (true) with check (true);
create policy app_worker_manage_payment_events on app.payment_events for all to app_worker using (true) with check (true);
grant select on app.purchase_records, app.subscription_records to app_runtime;
grant select, insert, update on app.purchase_records, app.subscription_records, app.payment_events to app_worker;

comment on table app.purchase_records is 'Verified normalized provider transactions; no raw provider evidence is retained.';
comment on table app.subscription_records is 'Current normalized subscription lifecycle state; access policy is applied separately.';
comment on table app.payment_events is 'Immutable bounded provider event audit and deduplication records.';
