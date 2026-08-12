-- SEC-P3: server-only runtime roles and RLS defense in depth. No client/API grants are created.

create schema if not exists security;
revoke all on schema security from public;
revoke all on schema app from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_worker') then
    create role app_worker nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit;
  end if;
end;
$$;

revoke all on all tables in schema app from public;
revoke all on all functions in schema app from public;
revoke all on all functions in schema security from public;

grant usage on schema app, security to app_runtime, app_worker;

create or replace function security.current_auth_subject()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select nullif(current_setting('app.auth_subject', true), '');
$$;

create or replace function security.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select users.id
  from app.users
  where users.auth_subject = security.current_auth_subject()
  limit 1;
$$;

revoke all on function security.current_auth_subject() from public;
revoke all on function security.current_app_user_id() from public;
grant execute on function security.current_auth_subject(), security.current_app_user_id() to app_runtime;

alter table app.users enable row level security;
alter table app.birth_profiles enable row level security;
alter table app.reading_records enable row level security;
alter table app.entitlements enable row level security;
alter table app.payment_transactions enable row level security;

alter table app.users force row level security;
alter table app.birth_profiles force row level security;
alter table app.reading_records force row level security;
alter table app.entitlements force row level security;
alter table app.payment_transactions force row level security;

create policy app_runtime_select_own_user on app.users
  for select to app_runtime
  using (id = (select security.current_app_user_id()));
create policy app_runtime_insert_verified_user on app.users
  for insert to app_runtime
  with check (auth_subject = (select security.current_auth_subject()) and status = 'active');

create policy app_runtime_select_own_birth_profiles on app.birth_profiles
  for select to app_runtime
  using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_birth_profiles on app.birth_profiles
  for insert to app_runtime
  with check (user_id = (select security.current_app_user_id()));
create policy app_runtime_update_own_birth_profiles on app.birth_profiles
  for update to app_runtime
  using (user_id = (select security.current_app_user_id()))
  with check (user_id = (select security.current_app_user_id()));

create policy app_runtime_select_own_readings on app.reading_records
  for select to app_runtime
  using (user_id = (select security.current_app_user_id()));
create policy app_runtime_insert_own_readings on app.reading_records
  for insert to app_runtime
  with check (
    user_id = (select security.current_app_user_id())
    and (birth_profile_id is null or exists (
      select 1 from app.birth_profiles
      where app.birth_profiles.id = reading_records.birth_profile_id
        and app.birth_profiles.user_id = (select security.current_app_user_id())
    ))
  );
create policy app_runtime_update_own_readings on app.reading_records
  for update to app_runtime
  using (user_id = (select security.current_app_user_id()))
  with check (user_id = (select security.current_app_user_id()));

create policy app_runtime_select_own_entitlements on app.entitlements
  for select to app_runtime
  using (user_id = (select security.current_app_user_id()));
create policy app_runtime_select_own_payments on app.payment_transactions
  for select to app_runtime
  using (user_id = (select security.current_app_user_id()));

create policy app_worker_manage_entitlements on app.entitlements
  for all to app_worker
  using (true)
  with check (true);
create policy app_worker_manage_payments on app.payment_transactions
  for all to app_worker
  using (true)
  with check (true);

grant select, insert on app.users to app_runtime;
grant select, insert, update on app.birth_profiles to app_runtime;
grant select, insert, update on app.reading_records to app_runtime;
grant select on app.entitlements, app.payment_transactions to app_runtime;
grant select, insert, update on app.entitlements, app.payment_transactions to app_worker;

comment on schema security is 'Non-exposed RLS helper schema. API server sets app.auth_subject transaction-locally after verifying identity.';
comment on function security.current_auth_subject() is 'Returns only transaction-local trusted server identity context; absent context returns NULL.';
comment on function security.current_app_user_id() is 'Maps transaction-local verified auth subject to app.users.id; does not provision users.';
