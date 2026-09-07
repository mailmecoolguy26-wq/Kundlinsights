-- Provider order correlation is intentionally separate from completed payment transactions.
create table app.provider_payment_orders (
  id text primary key check (id <> ''),
  user_id text not null references app.users(id) on delete restrict,
  birth_profile_id text null references app.birth_profiles(id) on delete restrict,
  provider text not null check (provider in ('RAZORPAY')),
  logical_sku text not null check (logical_sku <> ''),
  provider_order_id text not null check (provider_order_id <> ''),
  provider_payment_id text null check (provider_payment_id is null or provider_payment_id <> ''),
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('CREATED','PAID','FINALIZED','FAILED')),
  purchase_record_id text null references app.purchase_records(id) on delete restrict,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (provider, provider_order_id),
  unique (provider, provider_payment_id)
);
alter table app.provider_payment_orders enable row level security;
alter table app.provider_payment_orders force row level security;
create policy app_runtime_select_own_provider_payment_orders on app.provider_payment_orders for select to app_runtime using (user_id = (select security.current_app_user_id()));
create policy app_worker_manage_provider_payment_orders on app.provider_payment_orders for all to app_worker using (true) with check (true);
grant select on app.provider_payment_orders to app_runtime;
grant select, insert, update on app.provider_payment_orders to app_worker;

alter table app.purchase_records drop constraint purchase_records_provider_check;
alter table app.purchase_records add constraint purchase_records_provider_check check (provider in ('APPLE', 'GOOGLE', 'RAZORPAY', 'WEB'));
